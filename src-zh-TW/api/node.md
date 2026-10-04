# 節點資料模型（Node / Kind / Size / Align）

**模組**：`deer-core::node`（原 `deer_layout::node`，2026-10 分層重組）

## 功能說明

節點樹是 deer-gui 的**唯一真相**：兩條構築路徑（[Builder](builder.md) / [場景檔](scene.md)）都產出它，版面配置、命中測試、渲染全部只消費它。

三個設計決定：

1. **樹是純資料**：不含函式/回呼，事件用 id 關聯（見[互動層](interaction.md)）；
2. **確定性 id**：`IdGen` 按 kind 計數產生 `kind_N`；顯式命名會「佔號」，自動 id 永不撞名；
3. **兩條路徑共用 id 規則**：否則兩棵樹不結構相等（`Node::structurally_eq`，核心不變式）。

## 型別與欄位

### `Kind`（節點型別）

| 變體 | 角色 | `is_container()` |
|---|---|---|
| `Column` | 直排容器 | ✅ |
| `Row` | 橫排容器 | ✅ |
| `Text` | 純文字 | ❌ |
| `Button` | 按鈕 | ❌ |
| `Field` | 輸入框（文字編輯家族的基準） | ❌ |
| `Segmented` | 分段選擇組：互斥單選，孩子 = 段，點擊發 `SelectionChanged` | ✅ |
| `ChipGroup` | 標籤組：多選，每個晶片獨立開/關，發 `ChipToggled` | ✅ |
| `TabBar` | 頁籤欄：單選頁籤，發 `TabChanged { index }`，內容切換是 App 的事 | ✅ |
| `NumberField` | 數值輸入框：提交時（失焦/`Enter`）才解析，發 `NumberChanged` | ❌ |
| `ScrubNum` | 拖動調值：按住左右拖改值，持續發 `NumberChanged` | ❌ |
| `Switch` | 開關：點擊/`Enter`/`Space` 翻轉，發 `Toggled { id, on }` | ❌ |
| `ColorField` | 顏色輸入框：輸入 `#RRGGBB` + 色塊預覽，提交發 `ColorChanged` | ❌ |

輔助：`Kind::as_str()`（`"column"` 等，場景檔同名）、`Kind::parse(&str) -> Option<Kind>`；
謂詞 `is_horizontal()`（Row 與三個選擇類組）、`is_selection_group()`、`is_value_field()`（Field/NumberField/ColorField）。

### `Node`

| 欄位 | 型別 | 說明 |
|---|---|---|
| `kind` | `Kind` | 節點型別 |
| `id` | `String` | 確定性 id |
| `layout` | `LayoutProps` | 版面配置參數（見下） |
| `props` | `NodeProps` | `{ label: Option<String>, disabled: bool, extra: BTreeMap<String, Option<String>> }`（`extra` = 未知屬性的原樣保留，編輯器不直接編輯） |
| `children` | `Vec<Node>` | 只有容器該有子節點 |

| 方法 | 說明 |
|---|---|
| `Node::new(kind, id)` | 建構 |
| `.with_layout(l)` / `.with_props(p)` / `.with_id(id)` / `.with_label(label)` | 鏈式建構（**先設參數最後定 id**，見 Builder 的注意事項） |
| `.disabled()` | 設 `props.disabled = true`（整棵子樹不回應輸入） |
| `.push(child)` | 鏈式追加子節點 |
| `.is_container()` / `.is_scroll_container()` / `.wraps_text()` | 判據（捲動 = `scroll && Column`；換行 = `wrap && Text`） |
| `.walk(&mut f, depth)` | 前序走訪 |
| `.structurally_eq(&other)` | 結構相等（kind、id、props、layout、children 逐層比） |

### `LayoutProps`

| 欄位 | 型別 | 預設 | 說明 |
|---|---|---|---|
| `width` / `height` | `Option<Size>` | `None` | 顯式尺寸；`Size::Px(f32)` 或 `Size::Pct(f32)`（相對**父內容盒**解析） |
| `padding` | `f32` | `0.0` | 四邊內邊距 |
| `gap` | `f32` | `0.0` | 子節點間距 |
| `main_axis` / `cross_axis` | `Option<Align>` | `None`（= `Start`） | 對齊；`Stretch` 吃滿 |
| `grow` | `f32` | `0.0` | 剩餘主軸空間分配權重 |
| `scroll` | `bool` | `false` | **垂直**捲動容器（只對 `Column` 有意義，`Row` 上被忽略） |
| `wrap` | `bool` | `false` | 文字按寬度換行（換行寬度 = 節點自己的**像素**寬度） |
| `position` | `Option<Pos>` | `None` | 流外定位（L1 `Offset` / L4 `Anchors`），設了即脫離流內版面配置 |
| `cross_self` | `Option<Align>` | `None` | 每子節點交叉軸對齊（L2），覆蓋父容器的 `cross_axis` |
| `min_w` / `max_w` / `min_h` / `max_h` | `Option<Size>` | `None` | 最小/最大尺寸（L3）；`min > max` ⇒ min 贏 |

### `Pos`（流外定位）

`LayoutProps.position` 的取值；兩個變體共用同一條流外判據 `Node::is_positioned()`：

- `Pos::Offset { x, y: i32 }` —— 相對父容器**內容盒**原點的像素偏移，可為負；
- `Pos::Anchors { l, t, r, b: Option<f32>, ox, oy: i32 }` —— **四邊錨點**：`l/t/r/b` 是父內容盒的錨點比例（0.0 = 左/上邊、1.0 = 右/下邊，`None` = 該邊無錨），`ox/oy` 是內縮式像素修正（起點邊加、終點邊減）。一軸兩側都有錨 ⇒ 該軸尺寸由錨點對導出（顯式 w/h 不參與，min/max 照常夾取）；**父盒子 resize 時錨定邊跟隨**——這是本變體的存在意義。

配套：`Pos::parse(s)` / `Pos::to_attr()` 與 `.dui` 屬性值互逆（場景側與命令側共用同一份語法）。

### `Align` / `Rect`

`Align::{Start, Center, End, Stretch}`（`Align::parse` 接受同名小寫字串）；
`Rect { x, y, w, h: f32 }`、`Rect::new(x, y, w, h)` —— 幾何表裡的矩形**全部取整到整數像素**（不變式 I-4）。

### `IdGen`

確定性 id 產生器：`next(kind) -> String` 產生 `kind_N` 並跳過已被顯式佔用的號；`reserve(id)` 登記
顯式 id（若形如 `kind_N` 還會推進對應計數）。Builder 與場景解析共用同一實例規則。

## 使用範例

```rust
use deer_gui::prelude::*;

// 鏈式建構（場景檔與測試常用；日常用 Builder 更順手）
let tree = Node::new(Kind::Column, "app")
    .with_layout(L::new().pad(8.0).gap(4.0).to_props())
    .push(Node::new(Kind::Text, "").with_label("你好"))
    .push(Node::new(Kind::Button, "ok").with_label("好").disabled());

assert!(tree.children[0].wraps_text() == false);
```

## 注意事項

- `Size::Pct` 只在**排布階段**解析（需要父內容盒），測量階段不認它 —— 顯式**像素**尺寸才覆蓋固有尺寸；
- `scroll` / `wrap` 是 opt-in 開關，預設 `false`；寫錯容器型別會被**忽略**（`Row` 上 `scroll`），
  只有[場景檔](scene.md)路徑會因「開關屬性帶值」直接報錯；
- `disabled` 的影響是**整棵子樹**：命中、焦點、文字輸入全部跳過（見[互動層](interaction.md)）；
- 零尺寸節點仍留在焦點序列裡（`focusables` 只依賴樹）—— 刻意不引入第二套幾何真相；
- `Node` 還有一個 `comments: Vec<String>` 欄位（`.dui` 的 `#` 註解行），**不參與** `structurally_eq`（註解不影響版面配置/命中/渲染，否則「兩條構築路徑結構相等」的不變式會失效）；
- 核心不變式（`Node::structurally_eq` 等）與 L1–L4 版面配置代數的測試都住在 `deer-core/tests/` 下（`layout_invariants.rs`、`l1_position.rs` … `l4_anchors.rs`）。

相關教學：[第 2 步](../getting_started/step_by_step/02_builder.md)、[第 3 步](../getting_started/step_by_step/03_layout_props.md)。
