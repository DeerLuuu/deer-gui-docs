# 第 6 步：開啟視窗

## 目標

用視窗層（`deer-window`，基於 `winit`）開啟一個真視窗，實作 `App` trait 的生命週期回呼，並理解**事件驅動重繪**：預設省電模式（`OnDemand`）下，沒有變化的幀一幀都不畫。

> **前置**：需要 `features = ["window"]`，且目前只有 **Windows** 支援把原生控制代碼交給算繪層
> （其它平台 `run()` 會明確回傳「平台不支援」，不靜默填 0）。

## 操作步驟

1. 寫一個實作 `deer_gui::window::App` 的結構體；
2. 至少實作 `init`（建窗後呼叫一次，建立算繪資源）與 `redraw`（畫一幀）；
3. 用 `run(WindowConfig::new("標題", 800, 600), app)` 啟動 —— **必須在主執行緒呼叫**；
4. 需要「輸入改了狀態才重繪」就在 `input` 裡記帳，並在 `wants_redraw` 裡如實回答。

## 完整範例

```rust
use deer_gui::window::{App, Flow, InputEvent, Key, RedrawPolicy, WindowConfig, WindowInfo, run};

struct MyApp {
    /// 「剛才那條輸入改了狀態嗎」的記帳（wants_redraw 讀它）
    dirty: bool,
}

impl App for MyApp {
    fn init(&mut self, info: &WindowInfo) -> Result<(), String> {
        println!(
            "視窗 {}x{}，HWND=0x{:X}",
            info.extent.width, info.extent.height, info.raw.handle
        );
        Ok(()) // 真實實作在這裡建立 Vulkan 裝置 / 交換鏈
    }

    fn redraw(&mut self) -> Result<Flow, String> {
        self.dirty = false; // 這一幀畫完了，髒標記清掉
        Ok(Flow::Continue)
    }

    fn input(&mut self, _info: &WindowInfo, ev: &InputEvent) -> Result<Flow, String> {
        match ev {
            InputEvent::KeyDown { key: Key::Escape, .. } => return Ok(Flow::Exit),
            InputEvent::PointerDown { x, y, .. } => {
                println!("按下 ({x}, {y})");
                self.dirty = true; // 狀態真的變了
            }
            _ => {}
        }
        Ok(Flow::Continue)
    }

    fn wants_redraw(&self) -> bool {
        self.dirty // 為真才會請求重繪；系統事件（Resized 等）不看它，一律重畫
    }

    fn redraw_policy(&self) -> RedrawPolicy {
        RedrawPolicy::OnDemand // 預設值；動畫類 App 才回傳 Continuous
    }
}

fn main() -> Result<(), String> {
    run(WindowConfig::new("hello", 800, 600), MyApp { dirty: false })
}
```

```sh
cargo run --features window
```

## App 生命週期速查

| 回呼 | 時機 | 預設實作 |
|---|---|---|
| `init(&WindowInfo)` | 視窗建好後**呼叫一次** | 必須自己實作 |
| `resized(w, h)` | 尺寸變化（物理像素），應重建交換鏈 | 什麼都不做 |
| `redraw()` | 每一幀 | 必須自己實作 |
| `input(&WindowInfo, &InputEvent)` | 每條輸入事件 | 什麼都不做 |
| `close_requested()` | 點了關閉按鈕 | 允許關閉（`Flow::Exit`） |
| `wants_redraw()` | 每條輸入之後問一次 | `false` |
| `redraw_policy()` | 啟動時讀一次 | `OnDemand` |
| `wake_handle(Waker)` | 建窗後呼叫一次（省電模式的喚醒控制代碼） | 什麼都不做 |
| `next_deadline()` | 每輪事件循環收斂時問一次 | `None`（睡死） |
| `on_wake_stats(&WakeStats)` | 收尾呼叫一次（觀測帳本） | 什麼都不做 |

## 重繪的六條置位規則（省電模式的關鍵）

| 觸發 | 是否請求重繪 |
|---|---|
| 輸入事件 | **只有 `wants_redraw()` 為真**才請求 |
| 系統事件（`Resized` / `Focused` / 視窗重新暴露 / 引導幀） | **一律**請求（不看 `wants_redraw`） |
| `RedrawRequested` 到達 | 才呼叫 `redraw()` |
| `RedrawPolicy::Continuous` | 每畫完一幀續下一幀 |
| `Waker::wake()`（提示） | 問 `wants_redraw()`，答真才畫 |
| `wake_after(d)` / `next_deadline` 到點 | **一律**畫一幀（App 自己下的單） |

執行時可用環境變數強制關掉省電模式：`DEER_WINDOW_REDRAW=continuous`。
啟動與結束時視窗層會列印自證行（「重繪策略」「重繪帳本」「喚醒帳本」）——
驗收時 grep 那幾行，別只看離開代碼。

## 「樹怎麼上屏？」

本節只搭了 App 骨架。把介面樹畫進視窗的完整樣板（Vulkan 視窗路徑
`WindowedRenderer`）見倉庫內兩個可執行範例：

```sh
cargo run -p deer-gui --features window --example hello_window   # 8 步：樹 → 視窗
cargo run -p deer-gui --features window --example counter        # 最小可互動介面
```

兩者的配套說明見倉庫 `docs/GETTING-STARTED-UI-STEPS.md` 與 `docs/GETTING-STARTED-UI.md`。

## 本節用到的 API

| API | 作用 | 詳細文件 |
|---|---|---|
| `App` trait | 視窗應用的生命週期 | [視窗層](../../api/window.md) |
| `run(config, app)` | 建窗 + 跑事件循環 | [視窗層](../../api/window.md) |
| `WindowConfig` | 標題與邏輯尺寸 | [視窗層](../../api/window.md) |
| `Waker` | 省電模式下的定時 / 提示喚醒 | [視窗層](../../api/window.md) |

## 下一步

視窗有了，接下來讓它**回應你**：[第 7 步：輸入、點擊與焦點](07_interaction.md)。
