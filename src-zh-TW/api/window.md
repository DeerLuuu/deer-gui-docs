# 視窗層（App / run / Waker）

**crate**：`deer-window`（`deer-gui` 開 `window` feature 後經 `deer_gui::window` 使用）

## 功能說明

「原生視窗 + 事件迴圈」層，也是本 workspace **唯一引入第三方相依**（`winit 0.30`）的地方。它把視窗的原生句柄以 HAL 的不透明形式（`RawWindowHandle`）交給渲染層 —— 渲染後端不依賴 winit，所以換視窗實作不動渲染堆疊。

邊界：**只有 Windows** 的句柄填法實作了；其它平台 `run()` 明確回傳
`UNSUPPORTED_PLATFORM_MSG`，**不靜默填 0**。視窗本身用 winit，其它平台「能開窗」，只是句柄交給 HAL 這一步未實作。

## `App` trait（你實作它，`run` 負責其餘）

| 方法 | 時機 | 預設實作 |
|---|---|---|
| `init(&mut self, &WindowInfo) -> Result<(), String>` | 視窗建好後**調一次**（建立渲染器/交換鏈） | 必須實作 |
| `resized(w, h)` | 尺寸變化（實體像素；應重建交換鏈） | 什麼都不做 |
| `redraw() -> Result<Flow, String>` | 每一幀 | 必須實作 |
| `input(&mut self, &WindowInfo, &InputEvent) -> Result<Flow, String>` | 每條輸入事件 | 什麼都不做 |
| `close_requested() -> Flow` | 關閉請求 | `Flow::Exit` |
| `wants_redraw() -> bool` | **每條輸入之後**問一次 | `false` |
| `redraw_policy() -> RedrawPolicy` | 啟動時讀一次 | `OnDemand` |
| `wake_handle(Waker)` | 建窗後調一次（**存下來**） | 什麼都不做 |
| `next_deadline() -> Option<Instant>` | 每輪事件迴圈收斂時問（拉式預約） | `None` |
| `on_wake_stats(&WakeStats)` | 收尾調一次（喚醒帳本；只適合記帳/斷言） | 什麼都不做 |

所有回呼都在**主執行緒**呼叫。任何回呼回傳 `Err` ⇒ `run()` 列印原因並回傳 `Err`（絕不吞掉）；`Flow::Exit` 請求結束事件迴圈。

## 其餘型別

| 型別 | 要點 |
|---|---|
| `WindowConfig` | `new(title, width, height)`（**邏輯**尺寸，建窗時換算）；預設 800×600 無標題；`display_title()` 會加 `deer-gui — ` 前綴 |
| `WindowInfo` | `{ raw: RawWindowHandle, extent: Extent }`（目前實體尺寸；`Resized` 後同步） |
| `Flow` | `Continue` / `Exit` |
| `RedrawPolicy` | `OnDemand`（預設，省電）/ `Continuous`（每幀續下一幀）；可被環境變數 `DEER_WINDOW_REDRAW=continuous` 執行時強制覆蓋 |
| `Waker` | `wake()`（提示：問 `wants_redraw`，答真才畫）/ `wake_after(Duration)`（預約：到點**一律**畫一幀）；可 `Clone`、`Send` |
| `InputEvent` / `Key` / `Mods` / `PointerButton` | 輸入模型（與 [互動層](interaction.md) 同一份定義） |
| `WakeStats` / `FrameCounter` | 帳本（frames / requests / skipped / iters …） |

## 置位規則（重繪的六條）

| 觸發 | 是否請求重繪 |
|---|---|
| 輸入事件 | **只有 `wants_redraw()` 為真** |
| 系統事件（`Resized` / `Focused` / 視窗重新暴露 / 引導幀） | **一律** |
| `RedrawRequested` 到達 | 才調 `redraw()` |
| `RedrawPolicy::Continuous` | 每畫完一幀續下一幀 |
| `Waker::wake()` | 問 `wants_redraw`，答真才畫 |
| `wake_after` / `next_deadline` 到點 | **一律**（App 自己下的單） |

事件迴圈預設睡在 `ControlFlow::Wait` 上 —— **沒有 App 宣告的 deadline 就一個奈秒的逾時都不設**（省電承諾）。啟動時列印自證行（策略解析結果），收尾列印「重繪帳本」與「喚醒帳本」。

## 使用範例

最小可執行 `App` 見[第 6 步](../getting_started/step_by_step/06_window.md)；
「樹 → 視窗」的完整樣板：

```sh
cargo run -p deer-gui --features window --example hello_window    # 樹 → 視窗 8 步
cargo run -p deer-gui --features window --example counter         # 最小可互動介面
cargo run -p deer-gui --features window --example window_parity   # 上屏 vs CPU 逐像素對照
```

```rust,ignore
// 省電模式下的定時動畫：用 Waker 排下一次，而不是退化成 Continuous
fn wake_handle(&mut self, waker: Waker) { self.waker = Some(waker); }
fn redraw(&mut self) -> Result<Flow, String> {
    if let Some(w) = &self.waker {
        w.wake_after(std::time::Duration::from_millis(16)); // 60fps 排下一幀
    }
    Ok(Flow::Continue)
}
```

## 注意事項

- **`run()` 必須在主執行緒呼叫**（winit 的要求）；
- `next_deadline()` 必須給出**固定的時刻**並自己往前推：每次都回傳 `Instant::now() + 50ms`
  會讓它**永遠不到點**（每 50ms 醒一次卻一幀不畫，空轉）。定時推進用 `Waker::wake_after`；
- 已過期的 deadline 視為「立刻到點」⇒ 畫一幀；不清理就等於自己要求連續重繪；
- 輸入事件的座標是**實體像素**（本層不做 DPI 換算）；字元與實體鍵是**兩條事件**
  （文字走 `TextInput`，`Enter`/`Tab`/`Backspace`/`Esc` 只有 `KeyDown`）；
- IME：預編輯不建模（只用來抑制重複上屏）；觸控/拖放/裝置事件未接線；
- 別只看結束代碼：視窗層的帳本是列印出來的行，驗收要 grep。
