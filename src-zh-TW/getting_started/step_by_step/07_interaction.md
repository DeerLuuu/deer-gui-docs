# 第 7 步：輸入、點擊與焦點

## 目標

把視窗層的輸入事件接進**互動層**：命中測試（含裁剪與停用）、懸停 / 按下 / 點擊狀態機、`Tab` 焦點循環、輸入框文字，以及「有事件 = 需要重繪」的約定。

## 操作步驟

1. 每幀先算幾何（要捲動就用 `layout_with_scroll`，見第 8 步），並從繪製清單衍生裁剪快照 `ClipSnapshot::from_draw_list`。
2. 維護一個 `UiState`（互動狀態的唯一真相），把每條 `InputEvent` 餵給 `interaction::handle`。
3. `handle` 回傳一串 `UiEvent` —— **有事件 = 狀態變了 = 需要重繪**；不發事件但改了 `pressed` 這類情況用 `UiState::same_visual` 兜底比對。
4. 事件用 **id** 關聯：`UiEvent::Clicked(id)` 告訴你點的是誰，樹裡沒有回呼可註冊。
5. 輸入框文字在 `state.texts`（id → 內容），游標在 `state.carets`（id → **字元位**，不在表裡 = 末尾）；不在 `texts` 表裡的輸入框視為空字串。

## 完整範例

下面是「樹 + 幾何 + 互動」三件套接進視窗回呼的最小骨架（完整可執行版見
`cargo run -p deer-gui --features window --example counter`）：

```rust,ignore
use deer_gui::gpu::build_draw_list;
use deer_gui::interaction::{self, ClipSnapshot, UiEvent, UiState};
use deer_gui::prelude::*;

struct Counter { tree: Node, state: UiState }

impl Counter {
    /// 一幀的閉環：幾何 → 繪製清單 →（交給算繪器）；輸入事件在別處餵進來
    fn draw_list(&self, w: u32, h: u32, theme: &Theme) -> DrawList {
        let geo = layout(&self.tree, Rect::new(0.0, 0.0, w as f32, h as f32),
                         TextStyle { font_size: theme.font_size, line_height: theme.line_height },
                         &ApproxMeasure);
        build_draw_list(&self.tree, &geo, theme.clone(), &ApproxMeasure)
    }

    /// 餵一條輸入：回傳是否需要重繪
    fn feed(&mut self, geo: &Geometry, clip: ClipSnapshot, ev: &InputEvent) -> bool {
        let events = interaction::handle(&mut self.state, &self.tree, geo, clip, ev);
        for ev in events {
            if let UiEvent::Clicked(id) = ev {
                println!("點擊了 {id}");
            }
        }
        !events.is_empty()
    }
}
```

## `handle` 的事件 → 效果對照表

| 事件 | 效果 |
|---|---|
| `PointerMoved` | 同步 `hover`（變了才發 `HoverChanged`）；**捕獲中 ⇒ 路由給捕獲者**：hover 釘在捕獲節點上（T3.7 指標捕獲，拖出不換人） |
| `PointerDown { Left }` | 同步 `hover`；命中的**可聚焦控制項** ⇒ 聚焦它；記 `pressed` = **捕獲**（按下即捕獲，D7） |
| `PointerUp { Left }` | **按捕獲者結算 `Clicked`**（抬起在哪都算 —— 拖出節點/整棵樹再抬起仍是它的點擊）；釋放捕獲；落點是選擇類組的直接子節點 ⇒ 追加 `SelectionChanged` / `ChipToggled` / `TabChanged`；落點是 `Switch` ⇒ 追加 `Toggled` |
| `PointerDown { Right }` | **按下即發 `PointerRight`**（T3.3 純直通：不參與焦點 / `pressed` / `Clicked`；停用子樹不發） |
| `KeyDown { Tab }` | 樹序循環焦點（`Shift` 反向）⇒ `FocusChanged`；焦點從值輸入框離開 ⇒ 失焦提交 |
| `KeyDown { Escape }` | 清焦點 |
| `KeyDown { Enter }` | 焦點在啟用的按鈕 ⇒ `Clicked`（鍵啟動 = 點擊）；焦點在啟用的開關 ⇒ `Clicked` + 翻轉；焦點在值輸入框 ⇒ **提交**（解析 → 值事件 → 正規化回寫） |
| `KeyDown { Char(' ') }`（= winit 的 Space） | 焦點在啟用的開關 ⇒ 與 `Enter` 同一條翻轉路徑；其餘不消費 |
| `KeyDown { Backspace }` | 焦點是啟用的輸入框 ⇒ 刪**游標前**一個 Unicode 字元（游標退一位） |
| `TextInput` | 焦點是啟用的輸入框 ⇒ **插在游標處**（沒動過游標時它在末尾） |
| `KeyDown { Left / Right }` | 焦點是啟用的輸入框 ⇒ 移動游標，**不發事件** |
| `KeyDown { Up / Down }` | 焦點**不是**輸入框時：**幾何鄰近移動焦點**（T3.1，嚴格方向；無焦點不定義，到邊停） |
| `KeyDown { PageUp / PageDown / Home / End }` | **按鍵捲動**（焦點不是輸入框時）：焦點容器優先、退 `hover`；翻頁 = 視口高，`Home`/`End` 到邊 |
| `KeyDown { repeat: true }` | 與 `false` 同語義（T3.6：能區分；要不要忽略重複由呼叫方決定） |
| `ImePreedit` | 預編輯只進聚焦輸入框的 `state.preedit` 緩衝（**不進 `texts`**，無雙寫）；空文字 = 取消；提交走 `TextInput` |
| `FocusChanged { focused: false }` | 視窗失焦：清 `hover` / `pressed` / 拖動錨點（`focus` / `texts` 不動） |
| `Wheel { dy }` | `hover` 最近的可捲動祖先偏移 `-dy × 40px` 並**播種慣性**（見第 8 步） |

只有**狀態真的變了**才產出事件。不消費的輸入：`KeyUp`、中鍵、非空格的 `Key::Char`/`Key::Other`、`ScaleFactorChanged`（DPI 只傳遞，座標/尺寸不換算）——
匹配是窮舉的，將來加事件變體會編譯報錯，不會靜默忽略（詳見[已知邊界](../../advanced/pitfalls.md)）。

## 命中測試的語義

- 命中回傳**最深**的節點（後序覆蓋），區間是半開的 `[x, x+w)`；
- 互動層的 `hit` 在 `hit_test` 之上多查兩道：**裁剪**與**停用** —— 點在停用子樹或被裁掉的點上 ⇒ **沒有命中**，**不回退**到祖先；
- 焦點序列 `focusables()` 只依賴樹（Button / Field 且不在停用子樹裡），所以零尺寸的按鈕仍可被 `Tab` 聚焦，但螢幕上按不到 —— 刻意的：焦點序不引入第二套幾何真相。

## 腳本化重放（除錯利器）

輸入事件全是值（沒有控制代碼、沒有閉包），所以可以寫成文字腳本離屏重放 ——
腳本語法見[輸入腳本語法](../../appendix/input_script.md)：

```sh
# counter 範例的確定性重放檔（跑完自己退，離開代碼 0 = 斷言全過）
cmd /c "set DEER_COUNTER_SCRIPT=@builtin&& cargo run -q -p deer-gui --features window --example counter"
```

## 本節用到的 API

| API | 作用 | 詳細文件 |
|---|---|---|
| `handle` | 輸入事件 → 狀態機 + `UiEvent` | [互動層](../../api/interaction.md) |
| `UiState` | 互動狀態唯一真相 | [互動層](../../api/interaction.md) |
| `ClipSnapshot::from_draw_list` | 從繪製清單衍生裁剪 | [互動層](../../api/interaction.md) |
| `hit` | 命中測試（含裁剪 + 停用） | [互動層](../../api/interaction.md) |
| `focusables` | `Tab` 焦點序列 | [互動層](../../api/interaction.md) |

## 下一步

[第 8 步：捲動與文字換行](08_scroll_wrap.md) —— 讓長內容捲起來、讓長文字折行。
