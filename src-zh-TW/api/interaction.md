# 互動層（UiState / handle / 命中測試）

**模組**：`deer_gui::interaction`

## 功能說明

**純邏輯**的互動核心：命中測試（含裁剪與停用）、懸停/按下/點擊/焦點/文字輸入狀態機。不碰視窗、不碰 GPU —— 輸入是值、輸出是值，所以整條互動鏈能在無 winit / 無 Vulkan 的環境裡被單測覆蓋。

三個入口函式：

| 函式 | 簽名 | 說明 |
|---|---|---|
| `handle` | `(state: &mut UiState, root: &Node, geo: &Geometry, clip: ClipSnapshot, ev: &InputEvent) -> Vec<UiEvent>` | **唯一入口**：餵事件、更新狀態、產出「發生了什麼」 |
| `hit` | `(root, geo, clip: ClipSnapshot, x, y) -> Option<&Node>` | 在 [`hit_test`](layout.md) 之上多查兩道：**裁剪**與**停用**；點在停用子樹或被裁掉處 ⇒ 沒有命中，**不回退**到祖先 |
| `focusables` | `(root: &Node) -> Vec<String>` | 可聚焦節點（Button/Field 且不在停用子樹）的**樹序**（`Tab` 循環用；只依賴樹，不依賴幾何） |

## `InputEvent`（輸入事件）

| 變體 | 欄位 |
|---|---|
| `PointerMoved` | `x, y: f32` |
| `PointerDown` / `PointerUp` | `button: PointerButton, x, y` |
| `Wheel` | `dx, dy: f32` |
| `KeyDown` / `KeyUp` | `key: Key, mods: Mods` |
| `TextInput` | `text: String` |
| `FocusChanged` | `focused: bool` |

配套：`PointerButton::{Left, Right, Middle}`；`Mods { shift, ctrl, alt, sup }`；
`Key::{Tab, Escape, Enter, Backspace, Left, Right, Up, Down, Char(char), Other}`（**實體鍵**，不含文字語意 —— 文字一律走 `TextInput`）。開 `window` feature 時這些型別直接 re-export 自 `deer-window`，否則用逐字相同的本地鏡像 —— 兩條路徑簽名與語意完全一致。

## `UiState`（狀態的唯一真相）

| 欄位 | 型別 | 說明 |
|---|---|---|
| `hover` | `Option<String>` | 指標壓著的節點 |
| `focus` | `Option<String>` | 鍵盤焦點（`Tab` 改它，`Escape` 清它） |
| `pressed` | `Option<String>` | 被左鍵按下的節點 |
| `texts` | `BTreeMap<String, String>` | 輸入框文字緩衝（不在表裡 = 空字串） |
| `scroll` | `ScrollState` | 捲動狀態（偏移 + 上限，見下） |

`same_visual(&other)`：三個視覺欄位（hover/focus/pressed）是否完全一樣 ——
`PointerDown` 這類不發事件卻改 `pressed` 的情況，靠它判定要不要重繪。

### `ScrollState`

| 方法 | 說明 |
|---|---|
| `set_metrics(&ScrollMetrics)` | **每幀必調**：灌入版面配置產出的上限，並把舊偏移夾回新上限（視口/內容變了也不殘留越界偏移） |
| `offset_of(id) -> i32` / `max_of(id) -> i32` | 查詢 |
| `scroll_to(id, v) -> Option<i32>` / `scroll_by(id, delta) -> Option<i32>` | 程序化捲動（夾取後回傳新值；目標不是捲動容器 ⇒ `None`） |

## `UiEvent`（發生了什麼）

| 變體 | 含義 |
|---|---|
| `HoverChanged(Option<String>)` | 懸停變了 |
| `FocusChanged(Option<String>)` | 焦點變了 |
| `Clicked(String)` | 點擊完成（抬起處 == 按下處；`Enter` 鍵啟用也算） |
| `TextChanged { id, value }` | 輸入框內容變了（追加 / Backspace 刪一個 Unicode 字元） |
| `Scrolled { id, offset }` | 捲動偏移變了（夾取後的整數值；到頂/到底再滾不發） |

**有事件 = 狀態變了 = 需要重繪**（視窗層的 dirty 約定）。
滾輪步長 `WHEEL_STEP_PX = 40`（≈兩行文字；`dy < 0` ⇒ 內容上移 ⇒ 偏移增大）。

## `ClipSnapshot`（裁剪快照）

每個節點的**有效裁剪**（嵌套 `PushClip` 已求交）：

| 方法 | 說明 |
|---|---|
| `from_draw_list(&DrawList, &Node, &Geometry)` | 從繪製清單衍生（把第 k 條 `NodeHint` 綁到前序走訪第 k 個有幾何的節點，長度 + 指紋雙重校驗，錯位即斷言失敗） |
| `unclipped()` | 全不裁剪 |
| `with_node_clip(id, Option<RectI>)` | 手工登記（測試用） |
| `allows(id, x, y) -> bool` | 點是否沒被裁掉；**未知 id 放行**（fail-open，測試裡要先斷言 `is_known`） |
| `is_known(id)` / `clip_of(id)` | 查詢 |

## `handle` 的事件 → 效果對照

| 事件 | 效果 |
|---|---|
| `PointerMoved` | 同步 `hover`（變了才發 `HoverChanged`） |
| `PointerDown { Left }` | 同步 `hover`；命中的可聚焦控制項 ⇒ 聚焦；記 `pressed` |
| `PointerUp { Left }` | 抬起處 == 按下處 ⇒ `Clicked`；無論如何清 `pressed` |
| `KeyDown { Tab }` | 樹序循環焦點（`Shift` 反向）；只有一個可聚焦時停在原地 |
| `KeyDown { Escape }` | 清焦點 |
| `KeyDown { Enter }` | 焦點在**啟用**的按鈕 ⇒ `Clicked` |
| `KeyDown { Backspace }` | 焦點是**啟用**的輸入框 ⇒ 刪一個 Unicode 字元 |
| `TextInput` | 焦點是**啟用**的輸入框 ⇒ 追加 |
| `FocusChanged { false }` | 視窗失焦：清 `hover`/`pressed`（`focus`/`texts` 不動） |
| `Wheel { dy }` | `hover` 最近的可捲動祖先（含自身）偏移 `-dy × 40`，夾取，變了才發 `Scrolled` |
| 其餘（右/中鍵、方向鍵、`KeyUp`、按鍵重複…） | 本期不消費（匹配是**窮盡**的：新增事件變體會編譯報錯，不會靜默忽略） |

## 使用範例

完整閉環見[第 7 步](../getting_started/step_by_step/07_interaction.md)；無視窗也能跑：

```sh
cargo test -p deer-gui --lib interaction   # 整條互動鏈的單測不依賴 winit/Vulkan
```

```rust
use deer_gui::interaction::{self, ClipSnapshot, InputEvent, UiState};

let mut state = UiState::default();
let events = interaction::handle(
    &mut state, &tree, &geo,
    ClipSnapshot::unclipped(),
    &InputEvent::PointerMoved { x: 60.0, y: 30.0 },
);
assert!(matches!(events.first(), Some(_)) == (state.hover.is_some()));
```

## 注意事項

- 事件座標是**實體像素**、視窗左上角原點（與 `WindowInfo::extent` 同一套口徑，無 DPI 換算）；
- 命中**不回退**到祖先：點在停用子樹或被裁掉的點上就是「沒點中」—— 回退需要第二套路由規則，
  與「`hit_test` 是輸入路由唯一依據」衝突（代價與討論見原始碼模組文件「已知邊界」）；
- `ClipSnapshot` 的 `allows` 對未知 id 放行（fail-open）：**測試裡必須先斷言 `is_known(id)`**，
  否則「被裁掉不命中」可能只是快照裡沒這個 id；
- 視窗層與測試腳本共用同一個 `handle`（腳本重放走同一入口），所以「腳本跑得通」與
  「人手點得動」不可能漂。
