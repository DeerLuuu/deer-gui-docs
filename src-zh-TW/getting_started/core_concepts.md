# 核心概念：一棵節點樹

deer-gui 的一切都圍繞**一棵 `Node` 樹**運轉。理解這一節，後面每一篇教學與 API 文件都會順暢得多。

## 資料流

```text
  Builder（命令式，imgui 式手感）─┐
                                  ├─→ Node 樹 ─→ layout() → 幾何表 ─→ build_draw_list() → DrawList ─→ 後端
  parse_scene(.dui，.tscn 式）   ─┘               └─→ hit_test() → 輸入路由
```

整條鏈的分工：

| 環節 | 誰 | 產出 |
|---|---|---|
| 描述介面 | [`Builder`](../api/builder.md) 或 [`parse_scene`](../api/scene.md) | [`Node` 樹](../api/node.md) |
| 算幾何 | [`layout()`](../api/layout.md)（**純函式**） | `Geometry`：節點 id → `Rect` |
| 路由輸入 | [`hit_test`](../api/layout.md) / [互動層 `hit`](../api/interaction.md) | 命中的節點 |
| 產生繪製命令 | [`build_draw_list`](../api/draw.md) | [`DrawList`](../api/draw.md) |
| 出像素 / 上屏 | [CPU 後端 `CpuRenderer`](../api/draw.md) 或 [Vulkan 視窗路徑](../api/window.md) | RGBA8 / 交換鏈 |

## workspace 的 7 個 crate

整條鏈由一個 workspace 承載，自下而上分層：`deer-core`（L0，**原 `deer-layout` 的內容全部遷入**——節點樹、版面配置代數、場景解析、命中測試、繪製命令、屬性註冊表、值解析，語言無關零平台相依）、`deer-text`（L1 文字堆疊：字型解析、字形光柵化、圖集、度量）、`deer-gpu`（L1：GPU HAL trait 與 CPU 參考後端）、`deer-window`（L1 顯示服務 + L3 視窗宿主）、`deer-vk`（L2 Vulkan 後端）、`deer-gui`（L4 門面）。另有一個橫切的 `deer-log`（零相依日誌門面）。相依紀律見[架構總覽](../advanced/architecture.md)。

## 兩條構築路徑，一棵樹

```rust,ignore
// 路徑一：命令式 Builder
let mut app = Builder::new(Kind::Column, "app").padding(12.0).gap(8.0);
app.text("標題");
let tree = app.build();
```

```text
# 路徑二：.dui 場景檔（結構完全等價）
[column name=app pad=12 gap=8]
  [text label=標題]
```

兩條路徑產出**結構相等**的樹（`Node::structurally_eq`），由測試
`t1_two_authoring_paths_produce_the_same_tree` 釘住。保證相等的關鍵是
**確定性 id**：`IdGen` 按 kind 計數產生 `kind_N` 形式的 id，顯式命名的節點會「佔號」，
兩條路徑共用同一規則。

## 樹是純資料

`Node` 不含函式、不含回呼 —— 這三個後果值得記住：

1. **事件靠 id 關聯**。按鈕被點之後發生什麼，由你的程式碼查詢 [互動層](../api/interaction.md) 的狀態（`UiState`）決定，樹裡沒有回呼可註冊；
2. **樹可以隨便序列化**。`.dui` 文字 ↔ `Node` 的往返是結構相等的（`parse_scene(encode_scene(t)) == t`）；
3. **版面配置是純函式**。`layout()` 不改輸入樹，只回一張幾何表；同輸入必同輸出（無時間、無隨機、無環境探測）。

## 節點類型（Kind）

`Kind` 現有 **12 種變體**：

| Kind | 角色 | 可否有子節點 |
|---|---|---|
| `Column` | 直排容器（子節點從上往下排） | ✅ |
| `Row` | 橫排容器（子節點從左往右排） | ✅ |
| `Text` | 純文字 | ❌ |
| `Button` | 按鈕 | ❌ |
| `Field` | 輸入框 | ❌ |
| `Segmented` | 分段選擇（互斥單選，段是子按鈕） | ✅ |
| `ChipGroup` | 標籤組（多選開關，晶片是子節點） | ✅ |
| `TabBar` | 頁籤欄（單選頁籤） | ✅ |
| `NumberField` | 數值輸入框（提交才解析） | ❌ |
| `ScrubNum` | 拖動調值（拖動改數） | ❌ |
| `Switch` | 開關（點擊/`Enter`/`Space` 翻轉） | ❌ |
| `ColorField` | 顏色輸入框（`#RRGGBB` + 色塊預覽） | ❌ |

控制項詞彙來自 `deer-ui` 的驗證原型；M6 控制項族群仍在擴充（`Icon`、`DropMenu`、`Dialog`、`Overlay`、`HoverTip` 未做，見 [`FEATURES.md`](https://github.com/DeerLuuu/deer-gui/blob/master/FEATURES.md)）。

## 版面配置引擎的八條不變式

`layout()` 的行為由八條不變式定義（每條都有測試防護，詳見[版面配置不變式](../advanced/invariants.md)）：

| # | 不變式 | 一句話 |
|---|---|---|
| I-1 | 純函式 | 不改輸入樹，只回幾何表 |
| I-2 | 確定性 | 同輸入 ⇒ 逐位相同輸出 |
| I-3 | 自底向上 | 先算子節點固有尺寸，父容器再分配 |
| I-4 | 像素取整 | 幾何全部整數像素 |
| I-5 | 不假設擁有視窗 | 根盒子由宿主給，根不撐滿 |
| I-6 | 不越界 | 結果夾在可用空間內 |
| I-7 | 分配尺寸 ≠ 可用空間 | 父分配的主軸尺寸必須被採信；百分比相對父**內容盒**解析 |
| I-8 | 主軸 = sum(子)，交叉軸 = max(子) | 容器固有尺寸按方向語義不同 |

看起來「反直覺」的行為通常是刻意的 —— 完整清單與背後的真缺陷見[已知邊界與常見陷阱](../advanced/pitfalls.md)。

## 下一步

準備好了就進入 [分步教學 · 第 1 步：算繪第一張圖](step_by_step/01_first_render.md)。
