# 版面配置引擎（layout / hit_test）

**模組**：`deer_layout::layout`

## 功能說明

純函式、確定性、可重放的版面配置引擎：餵一棵樹 + 一個根盒子，回一張幾何表。行為由八條不變式定義（I-1～I-8，每條都有測試，詳見[版面配置不變式](../advanced/invariants.md)）。命中測試 `hit_test` 是輸入路由的唯一依據。

核心語意（詳見[第 3 步](../getting_started/step_by_step/03_layout_props.md)）：

- 優先級：**顯式尺寸 > 父分配尺寸 > 固有尺寸**；顯式尺寸也被夾在可用空間內（I-6）；
- 容器固有尺寸：主軸 = **sum(子)**，交叉軸 = **max(子)**（I-8）；
- 百分比相對**父內容盒**解析（不是「父分配的空間」，I-7 的靜默錯誤來源）；
- 根盒子是**上限不是命令**：根不撐滿，除非根自己有顯式尺寸（I-5）。

## 函式與型別

| 名稱 | 簽名要點 | 說明 |
|---|---|---|
| `layout` | `(root: &Node, box_: Rect, style: TextStyle, m: &impl Measure) -> Geometry` | 排布（不捲動，等價於所有偏移為 0） |
| `layout_with_scroll` | `+ (offsets: &ScrollOffsets) -> (Geometry, ScrollMetrics)` | 排布 + 捲動：偏移參與幾何（子節點整體位移 `-offset`），回傳每個捲動容器的 `max_scroll` |
| `measure_tree` | `(root, style, m) -> Intrinsics`（`HashMap<String, (f32, f32)>`） | 每節點在「無限約束」下的固有尺寸（除錯用） |
| `hit_test` | `(root: &Node, geo: &Geometry, px: f32, py: f32) -> Option<&Node>` | 最深命中者勝出；半開區間 `[x, x+w)`；**不查**裁剪與停用（那是[互動層 `hit`](interaction.md) 的事） |
| `wrap_greedy` | `(text, max_width, width_of: impl Fn(&str) -> f32) -> Vec<String>` | 唯一的換行演算法：按空格/定位鍵切詞貪心塞行；單詞超寬按字元硬切；`max_width <= 0` 不換行 |
| `Geometry` | `HashMap<String, Rect>` | id → 整數像素矩形（取用時按樹的順序保證確定） |
| `TextStyle` | `{ font_size: f32, line_height: f32 }` | 預設 `13.0` / `18.0` |
| `metrics` | 模組常數 | `BUTTON_PAD_X=10.0`、`BUTTON_MIN_W=28.0`、`BUTTON_MIN_H=22.0`、`FIELD_MIN_W=60.0`、`FIELD_H=22.0` |

### `Measure` trait（文字度量介面）

| 方法 | 說明 |
|---|---|
| `width(text, style) -> f32` | 單行寬度 |
| `height(text, style, max_width) -> f32` | 高度（必須與 `wrap().len() × line_height` 一致） |
| `wrap(text, style, max_width) -> Vec<String>` | 換行點；**預設實作是不換行**（保守預設：「不假裝能做」） |

兩個內建實作：

| 實作 | 寬度 | 用途 |
|---|---|---|
| `ApproxMeasure` | 每字元 0.6em（`ceil`） | 版面配置測試、無字型環境 |
| [`FontMeasure`](text.md) | 字型真實 advance | 真實渲染路徑（與版面配置共用同一字號） |

### 捲動型別

| 型別 | 方法 | 說明 |
|---|---|---|
| `ScrollOffsets`（版面配置的**輸入**） | `with(id, px)`（鏈式）、`set(id, px)`、`get(id) -> i32`、`ids()`、`iter()` | 沒登記的 id ⇒ 偏移 0（不是「未知」） |
| `ScrollMetrics`（版面配置的**輸出**） | `max_of(id) -> i32`、`clamp(id, px) -> i32`、`ids()`、`iter()` | `max_scroll = max(0, 內容高 − 視口高)`；沒登記 ⇒ 0（fail-closed：忘了灌表，滾輪就什麼都滾不動，而不是滾進沒有上限的虛空） |

## 使用範例

```rust
use deer_gui::prelude::*;

let tree = Builder::new(Kind::Column, "app").padding(8.0).gap(4.0);
// …填充子節點…
let tree = tree.build();

// ① 版面配置：根盒子由宿主給
let geo = layout(&tree, Rect::new(0.0, 0.0, 320.0, 200.0), TextStyle::default(), &ApproxMeasure);

// ② 命中測試：最深命中者勝出
if let Some(node) = hit_test(&tree, &geo, 50.0, 30.0) {
    println!("点到了 {}", node.id);
}

// ③ 帶捲動的版面配置（偏移是輸入，上限是輸出）
let offsets = ScrollOffsets::new().with("list", 40);
let (geo, metrics) = layout_with_scroll(
    &tree, Rect::new(0.0, 0.0, 320.0, 200.0), TextStyle::default(), &ApproxMeasure, &offsets,
);
println!("list 可滚 {}px", metrics.max_of("list"));
```

## 注意事項

- **版面配置不改樹**（I-1）：想改版面配置參數要自己改樹再重算；同輸入必同輸出（I-2）；
- 幾何全部整數像素（I-4），但型別仍是 `f32`；
- 捲動容器（`Column + scroll`）裡：子節點主軸**不被視口夾取**（否則內容永遠不溢出、永遠滾不動），
  `grow` 隨之失效；交叉軸仍然夾到內容盒；
- 偏移越界會被**靜默夾取**（滾到邊界不越界）—— 不會產生錯誤，這是刻意設計；
- 換行只認「顯式像素寬度 + `wrap`」：百分比寬度在測量階段解析不了 ⇒ 換不了行（被測試釘住的邊界）；
- 真實渲染路徑裡，版面配置度量與繪製度量必須是**同一個字號、同一份實作**（見[第 5 步](../getting_started/step_by_step/05_text.md)）。
