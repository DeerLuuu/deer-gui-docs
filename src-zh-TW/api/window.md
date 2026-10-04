# 視窗層（App / run / Waker）

**crate**：`deer-window`（`deer-gui` 開 `window` feature 後經 `deer_gui::window` 使用）

## 功能說明

「原生視窗 + 事件迴圈」層，也是本 workspace **唯一引入第三方相依**（`winit 0.30`）的地方。它把視窗的原生句柄以 HAL 的不透明形式（`RawWindowHandle`）交給渲染層 —— 渲染後端不依賴 winit，所以換視窗實作不動渲染堆疊。

crate 按兩層實體拆分（公開路徑與拆分前**逐字相同**，`lib.rs` 只做模組宣告 + `pub use` 樞紐）：

| 模組 | 層 | 內容 |
|---|---|---|
| `deer_window::display`（`display.rs`） | **L1 DisplayServer** | 平台映射：`WindowConfig` / `WindowInfo`、輸入翻譯（`InputEvent`/`Key`/`Mods`/`PointerButton` 與 `map_key`/`map_mouse_button`/`map_mods`/`map_wheel`/`printable_text`）、DPI 的 `scale_factor` 記帳、**剪貼簿**（AF-2）、句柄打包（`raw_handle_from_win32` 等）、`UNSUPPORTED_PLATFORM_MSG` |
| `deer_window::host`（`host.rs`） | **L3 host** | `App` trait + `run()`/`run_multi()`（事件迴圈與髒重繪）、`Waker`、`WindowId`、`WindowSpawner`（多視窗基建）、`RedrawPolicy`、`WakePlan`/`plan_wake`/`earliest`（測試用純邏輯）、`WakeStats`/`FrameCounter`（帳本）、`Flow` |

邊界：**只有 Windows** 的句柄填法實作了；其它平台 `run()` 明確回傳
`UNSUPPORTED_PLATFORM_MSG`，**不靜默填 0**。視窗本身用 winit，其它平台「能開窗」，只是句柄交給 HAL 這一步未實作。

## `App` trait（你實作它，`run` 負責其餘）

`App` 是**雙鉤子**結構：一套**單窗鉤子**（多視窗出現前的原始簽名），一套**按窗鉤子**（多帶一個 `WindowId`）。兩者的關係是一條紀律：**按窗鉤子的預設實作轉發對應的單窗鉤子（忽略 id）⇒ 單視窗使用者零改動；一旦覆蓋按窗鉤子，對應的單窗鉤子不再被調**（轉發只發生在預設實作裡 —— 兩條路不能同時響）。

### 單窗鉤子

| 方法 | 時機 | 預設實作 |
|---|---|---|
| `init(&mut self, &WindowInfo) -> Result<(), String>` | **每建一扇窗調一次**（按建窗順序；建立渲染器/交換鏈） | 必須實作（即使覆蓋了 `window_init` 也要給空實作） |
| `resized(w, h)` | 尺寸變化（實體像素；應重建交換鏈） | 什麼都不做 |
| `redraw() -> Result<Flow, String>` | 每一幀 | 必須實作 |
| `input(&mut self, &WindowInfo, &InputEvent) -> Result<Flow, String>` | 每條輸入事件 | 什麼都不做，回傳 `Flow::Continue` |
| `close_requested() -> Flow` | 關閉請求 | `Flow::Exit` |
| `wants_redraw() -> bool` | **每條輸入之後**問一次（只對輸入事件生效） | `false` |
| `redraw_policy() -> RedrawPolicy` | 啟動時讀一次 | `OnDemand` |
| `wake_handle(Waker)` | 主窗建好後調一次（**存下來**；整個 `run()` 只調一次） | 什麼都不做 |
| `window_spawner(WindowSpawner)` | 與 `wake_handle` **同批**（多窗排隊的建窗句柄） | 什麼都不做 |
| `next_deadline() -> Option<Instant>` | 每輪事件迴圈收斂時問（拉式預約） | `None` |
| `on_wake_stats(&WakeStats)` | 收尾調一次（喚醒帳本；只適合記帳/斷言） | 什麼都不做 |

### 按窗鉤子（T4.4-R1/R3，多視窗路由）

| 方法 | 時機 | 預設實作 |
|---|---|---|
| `window_init(id, &WindowInfo)` | 與 `init` 同時機（每窗一次），帶 id —— 多窗 App 在這裡建立渲染器，把 `id.raw()` 直傳渲染層視窗表 | 轉發 `init`（忽略 id） |
| `window_input(id, &WindowInfo, &InputEvent)` | 這條輸入屬於哪個窗，連同**該窗自己的** `WindowInfo` 一起交付；只收這一個窗的事件 | 轉發 `input`（忽略 id） |
| `window_resized(id, w, h)` | 哪扇窗變了尺寸必須可區分 | 轉發 `resized` |
| `window_redraw(id)` | 該窗的 `RedrawRequested` ⇒ 多視窗下一次只畫這一扇 | 轉發 `redraw` |
| `window_close_requested(id) -> Flow` | 使用者點了**那一扇**窗的 X。回傳 `Flow::Exit` = **允許關閉這一扇窗**（不是結束事件迴圈 —— 只剩這一扇時關它才會退出）；回傳 `Flow::Continue` = **否決**（哪扇都不關） | 轉發 `close_requested` |
| `window_destroyed(id)` | 一扇窗已從活窗表移除後調一次（**至多一次**）；App 在這裡釋放該窗的渲染資源 | **純新增鉤子**（沒有舊方法可轉發），什麼都不做 |

所有回呼都在**主執行緒**呼叫。任何回呼回傳 `Err` ⇒ `run()` 列印原因並回傳 `Err`（絕不吞掉）；`Flow::Exit` 請求結束事件迴圈。

## 多視窗（T4.4-R1）

| 入口 | 說明 |
|---|---|
| `WindowId(u64)` | 本層的視窗編號；`raw()` 直傳渲染層視窗表（兩層同源編號，映射是恆等式 —— 禁止靠「0/1 恰好錯位對上」的隱式約定） |
| `WindowSpawner::spawn_window(config: WindowConfig)` | **排隊**建一扇新窗，在事件迴圈的安全點（持 `ActiveEventLoop` 的 `user_event` 臂）真正建。句柄經 `App::window_spawner` 交付（與 `Waker` 同一根通道），存下後任何回呼裡都能排 |
| `run(config, app)` | 主窗仍由 `run()` 首建 |
| `run_multi(configs: &[WindowConfig], app)` | **多配置啟動**：每一項各建一扇窗（第一項 = 主窗），與 `run()` 同一條程式碼路徑 |
| 關閉語意 | `CloseRequested` **只關該窗**（可被 `window_close_requested` 否決）；**全部視窗關閉** ⇒ 事件迴圈退出 |

多窗渲染側（按窗的交換鏈/資源表，`WindowedRenderer::new_with_primary_id`/`add_window`）屬 [deer-vk]（T4.4-R2），本頁不展開。喚醒是 App 級的：`Waker` 多窗共享，喚醒會讓**所有活窗**一起重畫。

## 剪貼簿（AF-2）

`display` 模組的 `Clipboard`（自寫 Win32 `CF_UNICODETEXT`，**純文字一種格式，不引第三方**）：

| 方法 | 說明 |
|---|---|
| `Clipboard::new(hwnd: usize) -> Result<Clipboard, String>` | 公共建構器（不是經 `App` 交接 —— 剪貼簿是 OS 全域資源，與視窗/事件迴圈無生命週期耦合；非 Windows 上明確 `Err(CLIPBOARD_UNSUPPORTED_MSG)`，不靜默）。建構本身**不碰**剪貼簿 |
| `set_text(&self, text: &str) -> Result<(), String>` | 寫入。**必須用真實視窗句柄**（`hwnd = 0` 是 NULL 屬主，Win32 規定此時 `SetClipboardData` 會失敗 —— `set_text` 會在動手前明確拒絕）；含 NUL 的文字明確拒絕 |
| `get_text(&self) -> Result<String, String>` | 讀出（不需要屬主，`0` 可用）；剪貼簿為空或非文字格式 ⇒ 明確 `Err`，**不靜默給空字串**；內容不是合法 UTF-16 ⇒ 同樣明確 `Err`，不做 lossy 替換 |

即用即走是慣例：`App::input` 的簽名裡就帶著 `info: &WindowInfo`，現場 `Clipboard::new(info.raw.handle)` 即可，不必為存句柄加狀態。每次呼叫內部原子完成「開（重試）→ 幹活 → 關」，不跨呼叫持有（不卡全系統的複製貼上）；**可在任意執行緒呼叫**。

## DPI（AF-3，只直通）

`scale_factor` 初值 = 建窗時 winit 的 `window.scale_factor()`（與 extent 同一來源），住在 `WindowInfo::scale_factor`；之後 OS 報變化 ⇒ 派發 `InputEvent::ScaleFactorChanged { scale_factor: f64 }`（OS 報多少帶多少，派發前已把 `WindowInfo::scale_factor` 記帳到新值）。本層**不換算任何座標**：事件座標與尺寸仍是實體像素，版面配置是像素級純函式；視窗實體尺寸也**不**因 DPI 變化而改（所以不會跟著一條 `Resized`）。要按 DPI 縮放是上層自己的事。

## 其餘型別

| 型別 | 要點 |
|---|---|
| `WindowConfig` | `new(title, width, height)`（**邏輯**尺寸，建窗時換算）；預設 800×600 無標題；`display_title()` 會加 `deer-gui — ` 前綴 |
| `WindowInfo` | `{ raw: RawWindowHandle, extent: Extent, scale_factor: f64 }`（目前實體尺寸 + DPI 係數；`Resized`/`ScaleFactorChanged` 後同步） |
| `Flow` | `Continue` / `Exit` |
| `RedrawPolicy` | `OnDemand`（預設，省電）/ `Continuous`（每幀續下一幀）；可被環境變數 `DEER_WINDOW_REDRAW=continuous` 執行時強制覆蓋（`REDRAW_ENV` 常數；取值先 `trim()` 再比、大小寫不敏感） |
| `Waker` | `wake()`（提示：問 `wants_redraw`，答真才畫）/ `wake_after(Duration)`（預約：到點**一律**畫一幀）；可 `Clone`、`Send` |
| `InputEvent` / `Key` / `Mods` / `PointerButton` | 輸入模型（與 [互動層](interaction.md) 同一份定義；`Key` 含 `PageUp`/`PageDown`/`Home`/`End`，`KeyDown` 帶 `repeat: bool`） |
| `WakePlan` / `plan_wake` / `earliest` | 事件迴圈「睡死 / 睡到點 / 到點了」的**純邏輯**真值表（測試用） |
| `WakeStats` / `FrameCounter` | 帳本（frames / requests / skipped / iters …） |

## 置位規則（重繪的六條）

| 觸發 | 是否請求重繪 |
|---|---|
| 輸入事件 | **只有 `wants_redraw()` 為真** |
| 系統事件（`Resized` / `Focused` / 視窗重新暴露 / 引導幀） | **一律** |
| `RedrawRequested` 到達 | 才調 `redraw()`（多窗下經 `window_redraw`，只畫那一扇） |
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

多視窗的最小骨架：

```rust,ignore
struct TwoWindows { spawner: Option<WindowSpawner>, spawned: bool }

impl App for TwoWindows {
    fn init(&mut self, _info: &WindowInfo) -> Result<(), String> { Ok(()) }
    // 主窗建好後拿到建窗句柄（與 wake_handle 同批），排一扇新窗。
    fn window_spawner(&mut self, spawner: WindowSpawner) { self.spawner = Some(spawner); }
    fn redraw(&mut self) -> Result<Flow, String> {
        if !self.spawned {
            self.spawned = true;
            if let Some(sp) = &self.spawner {
                sp.spawn_window(WindowConfig::new("第二扇", 320, 200)); // 只排隊，安全點才真建
            }
        }
        Ok(Flow::Continue)
    }
    // 多視窗 App 覆蓋這裡（覆蓋後 input 不再被調）：按 id 分發每窗狀態。
    fn window_input(&mut self, id: WindowId, _info: &WindowInfo, _ev: &InputEvent)
        -> Result<Flow, String> { Ok(Flow::Continue) }
}
```

## 注意事項

- **`run()` 必須在主執行緒呼叫**（winit 的要求）；
- `next_deadline()` 必須給出**固定的時刻**並自己往前推：每次都回傳 `Instant::now() + 50ms`
  會讓它**永遠不到點**（每 50ms 醒一次卻一幀不畫，空轉）。定時推進用 `Waker::wake_after`
  （慣性捲動有現成的拉式實作可參考：`interaction::inertia_deadline`）；
- 已過期的 deadline 視為「立刻到點」⇒ 畫一幀；不清理就等於自己要求連續重繪；
- 輸入事件的座標是**實體像素**（本層不做 DPI 換算）；字元與實體鍵是**兩條事件**
  （文字走 `TextInput`，`Enter`/`Tab`/`Backspace`/`Esc` 只有 `KeyDown`）；
- IME：**預編輯（組字）已接線**（`Ime::Preedit` ⇒ `InputEvent::ImePreedit` 派發，提交仍走 `TextInput`）；按鍵重複已建模（winit 的 `event.repeat` 進 `KeyDown.repeat`）；
  觸控/拖放/裝置事件未接線；
- 覆蓋按窗鉤子後對應的單窗鉤子不再被調 —— 別在兩邊都寫邏輯；
- 別只看結束代碼：視窗層的帳本是列印出來的行，驗收要 grep。
