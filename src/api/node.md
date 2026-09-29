# 节点数据模型（Node / Kind / Size / Align）

**模块**：`deer_layout::node`

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
| `Field` | 输入框 | ❌ |

辅助：`Kind::as_str()`（`"column"` 等，场景文件同名）、`Kind::parse(&str) -> Option<Kind>`。

### `Node`

| 字段 | 类型 | 说明 |
|---|---|---|
| `kind` | `Kind` | 节点类型 |
| `id` | `String` | 确定性 id |
| `layout` | `LayoutProps` | 布局参数（见下） |
| `props` | `NodeProps` | `{ label: Option<String>, disabled: bool }` |
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
- 零尺寸节点仍留在焦点序列里（`focusables` 只依赖树）—— 刻意不引入第二套几何真相。

相关教程：[第 2 步](../getting_started/step_by_step/02_builder.md)、[第 3 步](../getting_started/step_by_step/03_layout_props.md)。
