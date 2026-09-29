# 節點資料模型（Node / Kind / Size / Align）

**模組**：`deer_layout::node`

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
| `Field` | 輸入框 | ❌ |

輔助：`Kind::as_str()`（`"column"` 等，場景檔同名）、`Kind::parse(&str) -> Option<Kind>`。

### `Node`

| 欄位 | 型別 | 說明 |
|---|---|---|
| `kind` | `Kind` | 節點型別 |
| `id` | `String` | 確定性 id |
| `layout` | `LayoutProps` | 版面配置參數（見下） |
| `props` | `NodeProps` | `{ label: Option<String>, disabled: bool }` |
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
- 零尺寸節點仍留在焦點序列裡（`focusables` 只依賴樹）—— 刻意不引入第二套幾何真相。

相關教學：[第 2 步](../getting_started/step_by_step/02_builder.md)、[第 3 步](../getting_started/step_by_step/03_layout_props.md)。
