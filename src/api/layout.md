# 布局引擎（layout / hit_test）

**模块**：`deer-core::layout`（原 `deer-layout::layout`，2026-10 分层重组）

## 功能说明

纯函数、确定性、可重放的布局引擎：喂一棵树 + 一个根盒子，回一张几何表。行为由八条不变式定义（I-1～I-8，每条都有测试，详见[布局不变式](../advanced/invariants.md)）。命中测试 `hit_test` 是输入路由的唯一依据。

核心语义（详见[第 3 步](../getting_started/step_by_step/03_layout_props.md)）：

- 优先级：**显式尺寸 > 父分配尺寸 > 固有尺寸**；显式尺寸也被夹在可用空间内（I-6）；
- 容器固有尺寸：主轴 = **sum(子)**，交叉轴 = **max(子)**（I-8）；
- 百分比相对**父内容盒**解析（不是「父分配的空间」，I-7 的静默错误来源）；
- 根盒子是**上限不是命令**：根不撑满，除非根自己有显式尺寸（I-5）。

## 函数与类型

| 名称 | 签名要点 | 说明 |
|---|---|---|
| `layout` | `(root: &Node, box_: Rect, style: TextStyle, m: &impl Measure) -> Geometry` | 排布（不滚动，等价于所有偏移为 0） |
| `layout_with_scroll` | `+ (offsets: &ScrollOffsets) -> (Geometry, ScrollMetrics)` | 排布 + 滚动：偏移参与几何（子节点整体位移 `-offset`），返回每个滚动容器的 `max_scroll` |
| `measure_tree` | `(root, style, m) -> Intrinsics`（`HashMap<String, (f32, f32)>`） | 每节点在「无限约束」下的固有尺寸（调试用） |
| `hit_test` | `(root: &Node, geo: &Geometry, px: f32, py: f32) -> Option<&Node>` | 最深命中者胜出；半开区间 `[x, x+w)`；**不查**裁剪与禁用（那是[交互层 `hit`](interaction.md) 的事） |
| `wrap_greedy` | `(text, max_width, width_of: impl Fn(&str) -> f32) -> Vec<String>` | 唯一的换行算法：按空格/制表切词贪心塞行；单词超宽按字符硬切；`max_width <= 0` 不换行 |
| `Geometry` | `HashMap<String, Rect>` | id → 整数像素矩形（取用时按树的顺序保证确定） |
| `TextStyle` | `{ font_size: f32, line_height: f32 }` | 默认 `13.0` / `18.0` |
| `metrics` | 模块常量 | `BUTTON_PAD_X=10.0`、`BUTTON_MIN_W=28.0`、`BUTTON_MIN_H=22.0`、`FIELD_MIN_W=60.0`、`FIELD_H=22.0` |

### `Measure` trait（文本度量接口）

| 方法 | 说明 |
|---|---|
| `width(text, style) -> f32` | 单行宽度 |
| `height(text, style, max_width) -> f32` | 高度（必须与 `wrap().len() × line_height` 一致） |
| `wrap(text, style, max_width) -> Vec<String>` | 换行点；**默认实现是不换行**（保守默认：「不假装能做」） |

两个内置实现：

| 实现 | 宽度 | 用途 |
|---|---|---|
| `ApproxMeasure` | 每字符 0.6em（`ceil`） | 布局测试、无字体环境 |
| [`FontMeasure`](text.md) | 字体真实 advance | 真实渲染路径（与布局共用同一字号） |

### 滚动类型

| 类型 | 方法 | 说明 |
|---|---|---|
| `ScrollOffsets`（布局的**输入**） | `with(id, px)`（链式）、`set(id, px)`、`get(id) -> i32`、`ids()`、`iter()` | 没登记的 id ⇒ 偏移 0（不是「未知」） |
| `ScrollMetrics`（布局的**输出**） | `max_of(id) -> i32`、`clamp(id, px) -> i32`、`ids()`、`iter()` | `max_scroll = max(0, 内容高 − 视口高)`；没登记 ⇒ 0（fail-closed：忘了灌表，滚轮就什么都滚不动，而不是滚进没有上限的虚空） |

## L1–L4 布局代数

布局能力按四层代数分层递进（每层都有独立测试，住在 `deer-core/tests/l1_position.rs` ~ `l4_anchors.rs`）：

| 层 | 内容 | 一句话 |
|---|---|---|
| **L1** | `position` = `Pos::Offset` | 流外绝对定位：设了的子节点脱离流内——不参与主轴分配、不占流内空间、不计入父固有尺寸；位置 = 父内容盒原点 + 偏移 |
| **L2** | `cross_self` | 每子节点交叉轴对齐：覆盖父容器的 `cross_axis`，只对这一个流内子节点生效 |
| **L3** | `min_w` / `max_w` / `min_h` / `max_h` | 最小/最大尺寸：measure 与 place 两处都生效；`min > max` ⇒ min 赢 |
| **L4** | `position` = `Pos::Anchors` | 四边锚定：一轴两侧都有锚 ⇒ 尺寸由锚点对导出；**父盒子 resize 时锚定边跟随** |

四层全部 opt-in（默认 `None` ⇒ 既有树逐字节不变）。

## 滚动条几何

绘制侧（画轨道/滑块）与命中侧（判「按下点在滚动条上」）**共用**的唯一来源，全部定义在 `deer-core::layout`：

| 名称 | 签名 / 值 | 说明 |
|---|---|---|
| `SCROLLBAR_W` | `f32 = 8.0` | 滚动条**轨道**宽度（像素） |
| `SCROLLBAR_INSET` | `f32 = 2.0` | 轨道与视口边缘的间距（不贴着边框） |
| `SCROLLBAR_MIN_THUMB` | `f32 = 24.0` | 滑块**最小**高度（内容极长时仍看得见、点得中） |
| `ScrollbarGeom` | `{ track: Rect, thumb: Rect }` | 一个可滚动容器的滚动条几何（轨道 + 滑块） |
| `scrollbar_geom` | `(viewport: Rect, offset: i32, max_scroll: i32) -> Option<ScrollbarGeom>` | 由视口 + 当前偏移 + 滚动上限算几何；`max_scroll <= 0` ⇒ `None`（不画满格滑块）；返回**浮点**矩形——取整交给调用方（绘制要整数、命中要浮点） |
| `scrollbar_offset_for_pointer` | `(viewport: Rect, max_scroll: i32, pointer_y: f32, grab_dy: f32) -> i32` | **反解**：指针在 `pointer_y`、抓取点距滑块顶 `grab_dy` 像素时偏移该是多少；与 `scrollbar_geom` 是同一套映射的两个方向；结果夹在 `[0, max_scroll]` |

## 使用示例

```rust
use deer_gui::prelude::*;

let tree = Builder::new(Kind::Column, "app").padding(8.0).gap(4.0);
// …填充子节点…
let tree = tree.build();

// ① 布局：根盒子由宿主给
let geo = layout(&tree, Rect::new(0.0, 0.0, 320.0, 200.0), TextStyle::default(), &ApproxMeasure);

// ② 命中测试：最深命中者胜出
if let Some(node) = hit_test(&tree, &geo, 50.0, 30.0) {
    println!("点到了 {}", node.id);
}

// ③ 带滚动的布局（偏移是输入，上限是输出）
let offsets = ScrollOffsets::new().with("list", 40);
let (geo, metrics) = layout_with_scroll(
    &tree, Rect::new(0.0, 0.0, 320.0, 200.0), TextStyle::default(), &ApproxMeasure, &offsets,
);
println!("list 可滚 {}px", metrics.max_of("list"));
```

## 注意事项

- **布局不改树**（I-1）：想改布局参数要自己改树再重算；同输入必同输出（I-2）；
- 几何全部整数像素（I-4），但类型仍是 `f32`；
- 滚动容器（`Column + scroll`）里：子节点主轴**不被视口夹取**（否则内容永远不溢出、永远滚不动），
  `grow` 随之失效；交叉轴仍然夹到内容盒；
- 偏移越界会被**静默夹取**（滚到边界不越界）—— 不会产生错误，这是刻意设计；
- 换行只认「显式像素宽度 + `wrap`」：百分比宽度在测量阶段解析不了 ⇒ 换不了行（被测试钉住的边界）；
- 真实渲染路径里，布局度量与绘制度量必须是**同一个字号、同一份实现**（见[第 5 步](../getting_started/step_by_step/05_text.md)）。
