# 互動層（UiState / handle / 命中測試）

**模組**：`deer_gui::interaction`

## 功能說明

**純邏輯**的互動核心：命中測試（含裁剪與停用）、懸停/按下（指標捕獲）/點擊/焦點/文字與 IME/控制項值狀態機。不碰視窗、不碰 GPU —— 輸入是值、輸出是值，所以整條互動鏈能在無 winit / 無 Vulkan 的環境裡被單測覆蓋。

三個入口函式：

| 函式 | 簽名 | 說明 |
|---|---|---|
| `handle` | `(state: &mut UiState, root: &Node, geo: &Geometry, clip: ClipSnapshot, ev: &InputEvent) -> Vec<UiEvent>` | **唯一入口**：餵事件、更新狀態、產出「發生了什麼」 |
| `hit` | `(root, geo, clip: ClipSnapshot, x, y) -> Option<&Node>` | 在 [`hit_test`](layout.md) 之上多查兩道：**裁剪**與**停用**；點在停用子樹或被裁掉處 ⇒ 沒有命中，**不回退**到祖先 |
| `focusables` | `(root: &Node) -> Vec<String>` | 可聚焦節點（Button/三個值輸入框/Switch 且不在停用子樹）的**樹序**（`Tab` 循環用；只依賴樹，不依賴幾何） |

## `InputEvent`（輸入事件）

| 變體 | 欄位 |
|---|---|
| `PointerMoved` | `x, y: f32` |
| `PointerDown` / `PointerUp` | `button: PointerButton, x, y` |
| `Wheel` | `dx, dy: f32` |
| `KeyDown` / `KeyUp` | `key: Key, mods: Mods`（`KeyDown` 多一個 `repeat: bool` —— **系統按鍵重複**，長按不鬆時 OS 補發的 KeyDown；互動層預設不區分、照常消費，建模的意義是「能區分」，要不要忽略重複由呼叫方決定） |
| `TextInput` | `text: String` |
| `ImePreedit` | `text: String`（**IME 預編輯（組字）**：中文/日文輸入法正在拼、還沒上屏的那一段；空 `text` = 預編輯被取消） |
| `FocusChanged` | `focused: bool`（視窗焦點，**不是**控制項焦點） |
| `ScaleFactorChanged` | `scale_factor: f64`（**DPI 縮放係數變了**，只直通：OS 報多少帶多少，互動層不換算任何座標） |

配套：`PointerButton::{Left, Right, Middle}`；`Mods { shift, ctrl, alt, sup }`；
`Key::{Tab, Escape, Enter, Backspace, Left, Right, Up, Down, PageUp, PageDown, Home, End, Char(char), Other}`（**實體鍵**，不含文字語意 —— 文字一律走 `TextInput`；`PageUp`/`PageDown`/`Home`/`End` 是捲動鍵）。開 `window` feature 時這些型別直接 re-export 自 `deer-window`，否則用逐字相同的本地鏡像 —— 兩條路徑簽名與語意完全一致。

## `UiState`（狀態的唯一真相）

| 欄位 | 型別 | 說明 |
|---|---|---|
| `preedit` | `Option<Preedit>` | **IME 預編輯（組字）緩衝**（還沒上屏的那一段，掛在當時聚焦的輸入框上；`Preedit { id, text }`）。預設 `None` ⇒ 既有行為不變。與 `texts` 的分工是硬的：預編輯只進這裡、不進 `texts`；提交走 `TextInput` 進 `texts` 並同時清緩衝（無雙寫） |
| `hover` | `Option<String>` | 指標壓著的節點（含容器；捕獲期間釘在捕獲者身上，見下） |
| `focus` | `Option<String>` | 鍵盤焦點（`Tab`/`Shift+Tab`/方向鍵改它，`Escape` 清它） |
| `pressed` | `Option<String>` | **左鍵捕獲的節點**（指標捕獲，按下即預設捕獲）—— 語意見下文「指標捕獲（T3.7）」小節，不再是「按下時記住」 |
| `texts` | `BTreeMap<String, String>` | 輸入框文字緩衝（不在表裡 = 空字串）。普通 `Field` 與值輸入框（`NumberField`/`ColorField`）的**編輯期草稿**同住這裡 |
| `carets` | `BTreeMap<String, usize>` | 輸入框游標（id → 位置，單位是**字元位**不是位元組位；不在表裡 = 末尾，純增量欄位） |
| `scroll` | `ScrollState` | 捲動狀態（偏移 + 上限 + 捲軸拖動 + 慣性，見下） |
| `segments` | `BTreeMap<String, String>` | **分段選擇的目前選中**（組 id → 選中段的節點 id；表裡沒有 = 該組還沒有選中段）。App 塞初值，`handle` 點擊結算時更新並發 `SelectionChanged` |
| `chips` | `BTreeMap<String, bool>` | **標籤組的開/關**（晶片**自己**的 id → 是否開；表裡沒有 = 關）。每次點擊晶片都翻轉它並發 `ChipToggled` |
| `tabs` | `BTreeMap<String, String>` | **頁籤欄的活動頁**（組 id → 活動頁的節點 id，存 id 不存下標：標籤同名、樹增刪頁不錯位；發 `TabChanged` 時才換算成樹序下標） |
| `num_opts` | `BTreeMap<String, NumOpts>` | **數值類控制項的值域/步長**（控制項 id → `NumOpts { min: Option<f64>, max: Option<f64>, step: f64 }`；表裡沒有 = 無值域、步長 1.0）。**應用資料**：App 想約束就自己塞，控制項唯讀不寫 |
| `switches` | `BTreeMap<String, bool>` | **開關的開/關**（開關**自身** id → 是否開；表裡沒有 = 關）。與 `chips` 同形但獨立一張表（Switch 不是組的孩子） |
| `scrub` | `Option<ScrubAnchor>` | **拖動調值（`ScrubNum`）的瞬態錨點**。按下落在 `ScrubNum` 上才建立（`start_x` = 按下 x，`base` = 按下時 `parse_num(label)` 的基準值）；**抬起/視窗失焦即清** —— 它不是值，值的真相在 App 的資料裡，經 label 回到樹上 |

控制項值的讀寫紀律（`segments`/`chips`/`tabs`/`switches`/`num_opts` 同一條）：**按 id 鍵控、住在樹外** ⇒ 整樹重建不丟；**讀** = 直接查表（表裡沒有就是預設值）；**寫初值** = App 自己塞（如 `state.segments.insert("mode".into(), week_id)`、`state.num_opts.insert("age".into(), NumOpts { min: Some(0.0), max: Some(150.0), step: 1.0 })`）；**值的真相在 App 的資料裡** —— `handle` 只負責在點擊/激活結算時更新表並發事件，App 拿著事件改自己的資料、重建樹。

`same_visual(&other)`：三個視覺欄位（hover/focus/pressed）是否完全一樣 ——
`PointerDown` 這類不發事件卻改 `pressed` 的情況，靠它判定要不要重繪。

### `ScrollState`

| 方法 | 說明 |
|---|---|
| `set_metrics(&ScrollMetrics)` | **每幀必調**：灌入版面配置產出的上限，並把舊偏移夾回新上限（視口/內容變了也不殘留越界偏移） |
| `offset_of(id) -> i32` / `max_of(id) -> i32` | 查詢 |
| `scroll_to(id, v) -> Option<i32>` / `scroll_by(id, delta) -> Option<i32>` | 程序化捲動（夾取後**真的變了**才回傳新值；目標不是捲動容器 ⇒ `None`） |
| `inertia_active() -> bool` | **正在慣性捲動嗎** —— 視窗層據此決定「還要不要再排一次喚醒」；停了之後它必須為 `false`（喚醒帳本無空轉的判據面） |
| `stop_inertia()` | 讓慣性**停下**（開始拖動捲軸/失焦時呼叫）—— 冪等 |
| `inertia_step() -> Option<(String, i32)>` | **推進一步慣性**：偏移 += 速度，速度按整數衰減；回傳 `Some((id, 新偏移))` = 這步真的動了；`None` = 已停下（到邊界/速度太小），呼叫方據此不再排下一次喚醒 |

`ScrollState` 裡還有兩塊**瞬態**狀態：`drag: Option<ScrollDrag>`（正在拖動的捲軸，`ScrollDrag { id, grab_dy }`）與 `inertia: Option<ScrollInertia>`（正在慣性捲動，`ScrollInertia { id, velocity }`）—— 預設都是 `None`，不拖不滑時行為不變。捲軸幾何（滑塊/軌道、`scrollbar_geom()`/`scrollbar_offset_for_pointer()`）在 [`deer_core::layout`](layout.md)，本層只消費它。

## `UiEvent`（發生了什麼）

| 變體 | 含義 |
|---|---|
| `HoverChanged(Option<String>)` | 懸停變了 |
| `FocusChanged(Option<String>)` | 控制項焦點變了 |
| `Clicked(String)` | 點擊完成（**按捕獲者結算**，抬起在哪都算；`Enter`/`Space` 鍵盤激活也算） |
| `TextChanged { id, value }` | 輸入框內容變了（在游標處插入 / Backspace 刪游標前一個 Unicode 字元） |
| `Scrolled { id, offset }` | 捲動偏移變了（夾取後的整數值；到頂/到底再滾不發；滾輪、捲軸拖動、按鍵捲動、慣性推進共用這一個事件） |
| `PointerRight { id }` | **右鍵**按在某個節點上（純直通，右鍵選單屬控制項層）：**按下即發**；不參與焦點/`pressed`；停用子樹/被裁剪的點拿不到 id ⇒ 不發 |
| `SelectionChanged { id, selected }` | **分段選擇**（`Segmented`）：點了組的一個段且**選中真的換了**（`id` = 組節點 id，`selected` = 新選中段的節點 id）。點已選中的段沒有變化 ⇒ 只發 `Clicked` 不發這條（**變了才發**）；停用段點不到 ⇒ 什麼都不發 |
| `ChipToggled { id, chip, on }` | **標籤開關**（`ChipGroup`）：點了組的一個晶片（`id` = 組 id，`chip` = 晶片節點 id，`on` = 翻轉後的新值）。翻轉語意：**每次點擊必翻轉發一次**（與單選的「變了才發」刻意不同 —— 點擊本身就是動作） |
| `TabChanged { id, index }` | **頁籤切換**（`TabBar`）：點了頁籤且活動頁**真的換了**（`index` = 新活動頁在組直接子節點裡的樹序下標，**停用頁也一起數**）。內容切換是 App 的事：TabBar 只報告。點目前活動頁 ⇒ 只發 `Clicked` |
| `NumberChanged { id, value: f64 }` | **數值變了**：`NumberField` 提交成功（失焦/`Enter`）或 `ScrubNum` 拖動中值真的變了（`value` 是**夾取之後**的新值）。提交失敗（不可解析）不發、拖動中值沒變不發（**變了才發**）；成功後草稿正規化回寫，但那**不發** `TextChanged` |
| `Toggled { id, on: bool }` | **開關翻轉**（`Switch` 被點擊/`Enter`/`Space` 激活；`on` = 翻轉後的新值）。翻轉語意：**每次激活必翻轉發一次** |
| `ColorChanged { id, rgb: [u8; 3] }` | **顏色提交成功**（`ColorField` 按 `#RRGGBB` 解析成功，失焦/`Enter`）：`rgb` = 解析出的三通道。解析失敗**不發**（色塊退回 `border` 色 = 標記）；成功後草稿回寫正規化字串 `#rrggbb`（同樣不發 `TextChanged`） |

**有事件 = 狀態變了 = 需要重繪**（視窗層的 dirty 約定）。
滾輪步長 `WHEEL_STEP_PX = 40`（≈兩行文字；`dy < 0` ⇒ 內容上移 ⇒ 偏移增大）。
注意 `UiEvent` 只保 `PartialEq` 不保 `Eq`（`NumberChanged` 攜帶 `f64`）—— 帶浮點的型別只用 `PartialEq`。

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
| `PointerMoved` | 同步 `hover`（變了才發 `HoverChanged`）；**捕獲中（`pressed` 在手）⇒ 路由給捕獲者**（見下節）；**捲軸拖動中** ⇒ 把指標 y 反解成偏移（變了才發 `Scrolled`）；**`ScrubNum` 拖動錨點在手且捕獲者仍是它** ⇒ 反解成值 `base + Δx × step`（夾值域，變了才發 `NumberChanged`） |
| `PointerDown { Left }` | 同步 `hover`；命中的**可聚焦控制項** ⇒ 聚焦（變了才發 `FocusChanged`）；記 `pressed` = **捕獲**；按在**捲軸豎帶**上 ⇒ 開始拖動/點軌道跳轉（不進點擊語意，慣性立刻停）；按在 `ScrubNum` 上 ⇒ 建立拖動錨點（label 解析失敗 = 不進入） |
| `PointerUp { Left }` | 同步 `hover`（捕獲隨抬起釋放，hover 回到實體位置）；**按捕獲者結算 `Clicked`**（抬起在哪都算 —— 拖出節點、拖出整棵樹再抬起照樣是它的點擊）並釋放捕獲、清拖動錨點；落點是選擇類組的直接子節點 ⇒ 追加選擇結算（`SelectionChanged`/`ChipToggled`/`TabChanged`）；落點本身是 `Switch` ⇒ 追加開關結算（`Toggled`）；捲軸拖動在此結束（不發點擊） |
| `PointerDown { Right }` | **按下即發** `PointerRight`（純直通；不置 `pressed`、不改焦點；停用子樹/被裁剪的點不發） |
| `PointerDown/Up { Middle }`（及右鍵抬起） | 只同步 `hover`，無額外语意 |
| `KeyDown { Tab }` | 樹序循環焦點（`Shift` 反向）；只有一個可聚焦時停在原地；**焦點從值輸入框離開 ⇒ 失焦提交**（見下） |
| `KeyDown { Escape }` | 清焦點；焦點從值輸入框離開 ⇒ 失焦提交 |
| `KeyDown { Enter }` | 焦點在**啟用**的按鈕 ⇒ `Clicked` + 選擇結算；焦點在**啟用的開關** ⇒ `Clicked` + 翻轉（與指標同路）；焦點在**值輸入框**（`NumberField`/`ColorField`）⇒ **提交**（解析 → 值事件 → 正規化回寫）；普通 `Field` 不受 `Enter` 影響 |
| `KeyDown { Char(' ') }`（winit 的 Space） | 焦點在**啟用的開關** ⇒ 與 `Enter` 同一條激活路徑；焦點在值輸入框上不消費（空格是草稿正文）；其餘不消費 |
| `KeyDown { Backspace }` | 焦點是**啟用**的輸入框 ⇒ 刪**游標前**那一個 Unicode 字元（取字元邊界，不切半個中文字；刪完游標退一位） |
| `TextInput` | 焦點是**啟用**的輸入框 ⇒ **插在游標處**，插完游標前進；**同時清預編輯緩衝**（那段文字從此由 `texts` 負責，不清就是雙寫） |
| `KeyDown { Left / Right }` | 焦點是**啟用**的輸入框 ⇒ 移動游標（兩端夾在 `[0, 字元數]`；**不發事件** —— `TextChanged` 的語意是「值變了」，游標移動沒改值） |
| `KeyDown { Up / Down }` | **幾何鄰近焦點移動**（焦點**不是**輸入框時）：把焦點移到「嚴格在按鍵方向上、幾何上最近」的可聚焦控制項（主判據垂直距離、平手看水平、再平手樹序；無焦點 ⇒ 不定義；到邊停；同行不算方向）⇒ `FocusChanged` |
| `KeyDown { PageUp / PageDown / Home / End }` | **按鍵捲動**（焦點不是輸入框時）：目標容器與滾輪同一來源（焦點所在容器優先，無焦點退 `hover`）；翻頁步長 = 容器視口高；`Home`/`End` 到頂/到底；變了才發 `Scrolled` |
| `KeyDown { repeat: true }` | 與 `false` **同語意**（照常消費；要不要忽略重複由呼叫方過濾） |
| `ImePreedit { text }` | 預編輯掛到**目前聚焦的輸入框**上（`UiState::preedit`）；沒有聚焦輸入框 ⇒ 忽略；**空字串 = 輸入法取消** ⇒ 清緩衝 |
| `FocusChanged { false }` | 視窗失焦：清 `hover`/`pressed`（捕獲）/`scrub`（拖動錨點）（`focus`/`texts` 不動）—— 抬起事件可能永遠不來，捕獲必須跟著丟 |
| `Wheel { dy }` | `hover` 最近的可捲動祖先（含自身）偏移 `-dy × 40`，夾取，變了才發 `Scrolled`；**同時播種慣性**（速度 = 這一步的位移，見下節） |
| `ScaleFactorChanged` | **不消費**（直通紅線：DPI 係數由視窗層轉給 App，座標/尺寸不換算，`UiState` 不動） |
| 其餘（`KeyUp`、非空格的 `Key::Char`/`Other`、`focused: true`） | 不消費（匹配是**窮盡**的：新增事件變體會編譯報錯，不會靜默忽略） |

**失焦提交**（所有事件共用的收尾鉤子）：處理前焦點在某個值輸入框、處理後焦點換了人（`Tab`/`Escape`/點到別處）⇒ 替它提交一次（解析 → 發值事件 → 正規化回寫）。視窗失焦**不動 UI 焦點** ⇒ 不觸發。

## 指標捕獲（T3.7）

`pressed` 的語意是**指標捕獲**（按下即預設捕獲）：

- **按下**命中節點 ⇒ 記下它 = **捕獲**（無論它是不是可聚焦控制項 —— 容器、文字同樣可以被捕獲；按下落在空白/停用/被裁剪處 ⇒ 沒有命中者 ⇒ 無捕獲）；
- **拖拽期間**（捕獲在手）`PointerMoved` **路由給捕獲者**：hover 釘在它身上，指標拖出節點、拖出整棵樹都不換人（按鈕的 hover/pressed 視覺因此保持，也不會對著路過的東西刷 `HoverChanged`）；
- **抬起**（無論在哪）**按捕獲者結算** `Clicked`，並**釋放捕獲** —— 改前是「抬起處 == 按下處才成點擊」（拖出即丟），現在是「按住的這個節點拿到這次點擊」；
- **視窗失焦**清空捕獲 —— 抬起事件可能永遠不來，否則視窗切回來一點就憑空成點擊。

兩條不變：**未捕獲**時照舊命中測試（這條路徑不變）；**捲軸拖動**是自己的捕獲（`scroll.drag`，從不置 `pressed`），它的 hover 行為原樣保留。`ScrubNum` 的拖動調值錨點與捕獲互鎖：錨點只在「捕獲者仍是它」時生效。

## 捲動慣性（T3.2b）

滾輪捲動一步之後**播種慣性**（速度 = 這一步的位移，「滾多遠」與「滑多遠」成比例），鬆手之後繼續滑一段並自己衰減停下：

- 衰減是**整數**的：每步 `v = v × INERTIA_DECAY_NUM / INERTIA_DECAY_DEN`（85/100）。整數是刻意的 —— 讓「滾一次之後停幾步、停在哪」**逐位可重現**（浮點會因平台/最佳化而漂）；
- 速度絕對值小於 `INERTIA_MIN_V`（2）就停；撞到邊界（夾取後沒動）也**立刻停** —— 不夾的話慣性會一直「撞牆」空轉（畫面沒動卻每 16ms 醒一次）；
- `INERTIA_TICK_MS = 16` 是推進一步的時間，視窗層按它排下一次喚醒。

視窗層的驅動方式（純邏輯與視窗層的唯一接縫）：

| 入口 | 說明 |
|---|---|
| `advance_inertia(state: &mut UiState) -> Vec<UiEvent>` | **推進一步慣性**並翻譯成事件（每步至多一條 `Scrolled`）。視窗層 `redraw` 每 `INERTIA_TICK_MS` 調一次；**回傳空 = 慣性已停，不必再排下一次喚醒** |
| `inertia_deadline(state: &UiState) -> Option<Instant>` | 慣性還在滾 ⇒ 下一次推進的 deadline（`now + INERTIA_TICK_MS`）；停了 ⇒ `None`。給 `App::next_deadline`（拉式）當實作；推式（`Waker::wake_after`）用同一個常數。兩條紀律：**只在 `inertia_active()` 時給 `Some`**（停了還給 ⇒ 空轉）；回傳的是**固定時刻**（不會「永遠差一點」追不到點） |

其它打斷手段：開始拖動捲軸時 `handle` 自動 `stop_inertia()`（兩種位移會打架）；視窗失焦同清。

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

- 事件座標是**實體像素**、視窗左上角原點（與 `WindowInfo::extent` 同一套口徑，無 DPI 換算 —— `ScaleFactorChanged` 只直通，互動層不消費）；
- 命中**不回退**到祖先：點在停用子樹或被裁掉的點上就是「沒點中」—— 回退需要第二套路由規則，
  與「`hit_test` 是輸入路由唯一依據」衝突（代價與討論見原始碼模組文件「已知邊界」）；
- `ClipSnapshot` 的 `allows` 對未知 id 放行（fail-open）：**測試裡必須先斷言 `is_known(id)`**，
  否則「被裁掉不命中」可能只是快照裡沒這個 id；
- 視窗層與測試腳本共用同一個 `handle`（腳本重放走同一入口），所以「腳本跑得通」與
  「人手點得動」不可能漂；
- 游標單位是**字元位**：`蘋果x` 是 3 字元 / 7 位元組，按位元組表達會把多位元組字元從中間切開；
- 目前**沒有任何東西渲染游標**，所以左右移動游標不發事件；真開始畫游標時，按
  `ScrollState` 的先例補 `UiEvent::CaretChanged` 並把 `carets` 加進 `same_visual`（登記在案的延遲決策）；
- 控制項值（`segments`/`chips`/`tabs`/`switches`）的**持久視覺**由繪製側讀同一份狀態表（`to_interact_state()` 統一搬運），渲染與互動不會各認一張表。
