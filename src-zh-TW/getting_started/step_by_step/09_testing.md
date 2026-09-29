# 第 9 步：用 testkit 寫介面測試

## 目標

把「建面 → 輸入注入 → 一幀 → 像素/狀態斷言 → CPU↔GPU 對照」這條鏈寫進測試 ——
不用抄 600 行樣板，十幾行就夠，而且**預設帶上**前置斷言、越界為 0、失敗時列印可重現命令。

> **前置**：testkit 在 `testing` feature 後面（生產建置裡零成本）：
> 自己的專案裡寫 `features = ["testing"]`；本倉庫的測試目標自動包含它。

## 操作步驟

1. `Harness::new(tree, w, h, theme)` 建面（自動載入系統字型出**真實字形**；
   沒字型環境用 `Harness::without_font`，走 `ApproxMeasure` 近似度量）。參數直接收
   `Node` 或 `Builder`。
2. 用 `tap(id)` / `send(&InputEvent)` / `run_script(src)` 注入輸入 —— 每一步回傳
   `Step`（改沒改狀態、發了哪些事件）。
3. `shoot()` / `shoot_named("…")` 拿離屏 CPU 像素（`Shot`），做像素斷言。
4. 狀態斷言用 `assert_hover` / `assert_focus` / `assert_pressed` / `assert_text` 等
   現成助手 —— 每一個都有「反向自檢」測試：餵錯值必須能紅。
5. 用 `set_repro` 登記重現命令；斷言失敗時錯誤訊息會帶上它。

## 完整範例

```rust
use deer_gui::prelude::*;
use deer_gui::testing::{Harness, Repro};

fn main() -> Result<(), String> {
    // ① 建面：一顆按鈕（測試目標），帶前置斷言與重現命令
    let mut h = Harness::without_font(
        Builder::new(Kind::Column, "app").gap(4.0),
        320, 200, Theme::default(),
    );
    h.set_case("button_click");
    h.set_repro(Repro::test("my-app", "testing", "my_test", "button_click", &[]));

    // ② 點擊前拍一張
    let before = h.shoot_named("點擊前")?;

    // ③ 注入輸入：tap = move 到節點中心 + 按下 + 抬起（座標由版面配置算出，不寫死）
    let step = h.tap("button_1")?;
    assert!(step.changed, "點按鈕必須改狀態");

    // ④ 點擊後拍一張，斷言差異只落在變化的節點矩形內（框外必須為 0）
    let after = h.shoot_named("點擊後")?;
    after.assert_state_change_only(&before, "button_1")?;

    // ⑤ 狀態斷言：hover 停在按鈕上
    h.assert_hover(Some("button_1"))?;
    Ok(())
}
```

```sh
# 本倉庫裡跑等價範例（testing feature 的可執行演示）：
cargo run -q -p deer-gui --features testing --example testkit_demo
```

## 能力面速查

| 能力 | 入口 |
|---|---|
| 建面 | `Harness::new` / `without_font`（收 `Node` 或 `Builder`） |
| 輸入注入 | `send`（單事件）/ `tap(id)` / `run_script`（腳本，支援 `move @id`） |
| 一幀 | `frame()`（**內建前置斷言**）→ `Frame`（幾何、繪製清單、繪製出的文字） |
| 離屏像素 | `shoot` / `shoot_named` / `shoot_png` / `GpuProbe`（離屏 Vulkan） |
| 像素斷言 | `Shot::pixel`、`assert_bytes_eq`、`assert_state_change_only`、`assert_diff_only_inside`、`assert_no_diff_outside` |
| 狀態斷言 | `assert_hover` / `assert_focus` / `assert_pressed` / `assert_text` / `assert_state` / `assert_focus_order` |
| 繪製清單斷言 | `assert_counts` / `assert_drawn_text` / `assert_text_size` / `assert_clip_nodes` |
| CPU↔GPU 對照 | `compare_cpu_gpu` → `ParityReport`（最大通道差 / 不同像素數） |
| 門檻與自證 | `gate()` / `require_gate()` / `print_gate()`（環境變數開關，先 `trim()` 再比） |

## 判據紀律（testkit 不放寬任何閾值）

- CPU↔GPU 對照只有兩檔規則：不透明內容**逐位元組相等**（容差 0），半透明內容最多 1 LSB ——
  沒有「放寬」入口；
- 每個斷言助手的失敗訊息都帶**可複製的重現命令**與關鍵數字；
- 「一條永遠不會紅的斷言」不是防護欄 —— 每個助手都被一條表驅動測試餵過錯誤期望值。

## 本節用到的 API

| API | 作用 | 詳細文件 |
|---|---|---|
| `Harness` | 測試主控制代碼 | [測試介面](../../api/testing.md) |
| `tap` / `send` / `run_script` | 輸入注入 | [測試介面](../../api/testing.md) |
| `Shot` | 離屏像素與像素斷言 | [測試介面](../../api/testing.md) |
| `Repro` | 可重現命令 | [測試介面](../../api/testing.md) |

## 下一步

教學到此完整走完一遍。接下來：

- 需要查 API？去 [API 參考](../../api/index.md)；
- 想理解「為什麼」？讀[架構總覽](../../advanced/architecture.md)與[已知陷阱](../../advanced/pitfalls.md)；
- 想跑更多例子？看[範例索引](../../appendix/examples.md)。
