# 节点数据模型（Node / Kind / Size / Align）

**模块**：`deer-core::node`（原 `deer-layout::node`，2026-10 分层重组）

## 功能说明

节点树是 deer-gui 的**唯一真相**：两条构筑路径（[Builder](builder.md) / [场景文件](scene.md)）都产出它，布局、命中测试、渲染全部只消费它。

三个设计决定：

1. **树是纯数据**：不含函数/回调，事件用 id 关联（见[交互层](interaction.md)）；
2. **确定性 id**：`IdGen` 按 kind 计数生成 `kind_N`；显式命名会「占号」，自动 id 永不撞名；
3. **两条路径共用 id 规则**：否则两棵树不结构相等（`Node::structurally_eq`，核心不变式）。

## 类型与字段

### `Kind`（节点类型）

| 变体 | 角色 | `is_container()` |
|---|---|---|
| `Column` | 竖排容器 | ✅ |
| `Row` | 横排容器 | ✅ |
| `Text` | 纯文本 | ❌ |
| `Button` | 按钮 | ❌ |
| `Field` | 输入框（文本编辑家族的基准） | ❌ |
| `Segmented` | 分段选择组：互斥单选，孩子 = 段，点击发 `SelectionChanged` | ✅ |
| `ChipGroup` | 标签组：多选，每个芯片独立开/关，发 `ChipToggled` | ✅ |
| `TabBar` | 页签栏：单选页签，发 `TabChanged { index }`，内容切换是 App 的事 | ✅ |
| `NumberField` | 数值输入框：提交时（失焦/`Enter`）才解析，发 `NumberChanged` | ❌ |
| `ScrubNum` | 拖动调值：按住左右拖改值，持续发 `NumberChanged` | ❌ |
| `Switch` | 开关：点击/`Enter`/`Space` 翻转，发 `Toggled { id, on }` | ❌ |
| `ColorField` | 颜色输入框：输入 `#RRGGBB` + 色块预览，提交发 `ColorChanged` | ❌ |

辅助：`Kind::as_str()`（`"column"` 等，场景文件同名）、`Kind::parse(&str) -> Option<Kind>`；
谓词 `is_horizontal()`（Row 与三个选择类组）、`is_selection_group()`、`is_value_field()`（Field/NumberField/ColorField）。

### `Node`

| 字段 | 类型 | 说明 |
|---|---|---|
| `kind` | `Kind` | 节点类型 |
| `id` | `String` | 确定性 id |
| `layout` | `LayoutProps` | 布局参数（见下） |
| `props` | `NodeProps` | `{ label: Option<String>, disabled: bool, extra: BTreeMap<String, Option<String>> }`（`extra` = 未知属性的原样保留，编辑器不直接编辑） |
| `children` | `Vec<Node>` | 只有容器该有子节点 |

| 方法 | 说明 |
|---|---|
| `Node::new(kind, id)` | 构造 |
| `.with_layout(l)` / `.with_props(p)` / `.with_id(id)` / `.with_label(label)` | 链式构造（**先设参数最后定 id**，见 Builder 的注意事项） |
| `.disabled()` | 置 `props.disabled = true`（整棵子树不响应输入） |
| `.push(child)` | 链式追加子节点 |
| `.is_container()` / `.is_scroll_container()` / `.wraps_text()` | 判据（滚动 = `scroll && Column`；换行 = `wrap && Text`） |
| `.walk(&mut f, depth)` | 前序遍历 |
| `.structurally_eq(&other)` | 结构相等（kind、id、props、layout、children 逐层比） |

### `LayoutProps`

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `width` / `height` | `Option<Size>` | `None` | 显式尺寸；`Size::Px(f32)` 或 `Size::Pct(f32)`（相对**父内容盒**解析） |
| `padding` | `f32` | `0.0` | 四边内边距 |
| `gap` | `f32` | `0.0` | 子节点间距 |
| `main_axis` / `cross_axis` | `Option<Align>` | `None`（= `Start`） | 对齐；`Stretch` 吃满 |
| `grow` | `f32` | `0.0` | 剩余主轴空间分配权重 |
| `scroll` | `bool` | `false` | **垂直**滚动容器（只对 `Column` 有意义，`Row` 上被忽略） |
| `wrap` | `bool` | `false` | 文本按宽度换行（换行宽度 = 节点自己的**像素**宽度） |
| `position` | `Option<Pos>` | `None` | 流外定位（L1 `Offset` / L4 `Anchors`），设了即脱离流内布局 |
| `cross_self` | `Option<Align>` | `None` | 每子节点交叉轴对齐（L2），覆盖父容器的 `cross_axis` |
| `min_w` / `max_w` / `min_h` / `max_h` | `Option<Size>` | `None` | 最小/最大尺寸（L3）；`min > max` ⇒ min 赢 |

### `Pos`（流外定位）

`LayoutProps.position` 的取值；两个变体共用同一条流外判据 `Node::is_positioned()`：

- `Pos::Offset { x, y: i32 }` —— 相对父容器**内容盒**原点的像素偏移，可为负；
- `Pos::Anchors { l, t, r, b: Option<f32>, ox, oy: i32 }` —— **四边锚定**：`l/t/r/b` 是父内容盒的锚点比例（0.0 = 左/上边、1.0 = 右/下边，`None` = 该边无锚），`ox/oy` 是内缩式像素修正（起点边加、终点边减）。一轴两侧都有锚 ⇒ 该轴尺寸由锚点对导出（显式 w/h 不参与，min/max 照常夹取）；**父盒子 resize 时锚定边跟随**——这是本变体的存在意义。

配套：`Pos::parse(s)` / `Pos::to_attr()` 与 `.dui` 属性值互逆（场景侧与命令侧共用同一份语法）。

### `Align` / `Rect`

`Align::{Start, Center, End, Stretch}`（`Align::parse` 接受同名小写字符串）；
`Rect { x, y, w, h: f32 }`、`Rect::new(x, y, w, h)` —— 几何表里的矩形**全部取整到整数像素**（不变式 I-4）。

### `IdGen`

确定性 id 生成器：`next(kind) -> String` 生成 `kind_N` 并跳过已被显式占用的号；`reserve(id)` 登记
显式 id（若形如 `kind_N` 还会推进对应计数）。Builder 与场景解析共用同一实例规则。

## 使用示例

```rust
use deer_gui::prelude::*;

// 链式构造（场景文件与测试常用；日常用 Builder 更顺手）
let tree = Node::new(Kind::Column, "app")
    .with_layout(L::new().pad(8.0).gap(4.0).to_props())
    .push(Node::new(Kind::Text, "").with_label("你好"))
    .push(Node::new(Kind::Button, "ok").with_label("好").disabled());

assert!(tree.children[0].wraps_text() == false);
```

## 注意事项

- `Size::Pct` 只在**排布阶段**解析（需要父内容盒），测量阶段不认它 —— 显式**像素**尺寸才覆盖固有尺寸；
- `scroll` / `wrap` 是 opt-in 开关，默认 `false`；写错容器类型会被**忽略**（`Row` 上 `scroll`），
  只有[场景文件](scene.md)路径会因「开关属性带值」直接报错；
- `disabled` 的影响是**整棵子树**：命中、焦点、文本输入全部跳过（见[交互层](interaction.md)）；
- 零尺寸节点仍留在焦点序列里（`focusables` 只依赖树）—— 刻意不引入第二套几何真相；
- `Node` 还有一个 `comments: Vec<String>` 字段（`.dui` 的 `#` 注释行），**不参与** `structurally_eq`（注释不影响布局/命中/渲染，否则「两条构筑路径结构相等」的不变式会失效）；
- 核心不变式（`Node::structurally_eq` 等）与 L1–L4 布局代数的测试都住在 `deer-core/tests/` 下（`layout_invariants.rs`、`l1_position.rs` … `l4_anchors.rs`）。

相关教程：[第 2 步](../getting_started/step_by_step/02_builder.md)、[第 3 步](../getting_started/step_by_step/03_layout_props.md)。
