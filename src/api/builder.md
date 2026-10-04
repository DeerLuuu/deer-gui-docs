# 命令式构筑（Builder / L）

**模块**：`deer-core::builder`（原 `deer-layout::builder`，2026-10 分层重组；prelude 直接可用）

## 功能说明

imgui 式手感的命令式声明 API：调用点即控件、无样板、可链式。内部维持一棵**保留式节点树**——布局、命中测试、渲染都需要树，「立即」的只是提交方式。与[场景文件](scene.md)共用同一套确定性 id 规则，两条路径产出结构相等的树（核心不变式，见[第 2 步](../getting_started/step_by_step/02_builder.md)）。

## `Builder` 方法

| 方法 | 参数 | 返回 | 说明 |
|---|---|---|---|
| `Builder::new` | `(kind: Kind, id: impl Into<String>)` | `Builder` | 显式命名的根；id 会被「占号」，避免自动 id 撞名 |
| `Builder::auto` | `(kind: Kind)` | `Builder` | 根 id 由 `IdGen` 生成（与场景文件默认行为一致） |
| `.padding(v: f32)` | 链式 | `Builder` | **只对根节点**生效的内边距 |
| `.gap(v: f32)` | 链式 | `Builder` | **只对根节点**生效的子节点间距 |
| `.size(w, h)` | `(Option<Size>, Option<Size>)` | `Builder` | **只对根节点**生效的显式尺寸 |
| `.text(label)` | `impl Into<String>` | `String`（id） | 追加 `Text` 叶子 |
| `.button(label)` | 同上 | `String`（id） | 追加 `Button` 叶子 |
| `.field(label)` | 同上 | `String`（id） | 追加 `Field` 叶子 |
| `.text_opts(label, f)` / `.button_opts(label, f)` | `FnOnce(&mut Node)` | `String`（id） | 追加叶子并**就地改参数**（如 `n.layout.wrap = true`） |
| `.container(kind, id, body)` | `FnOnce(&mut Builder)` | `()` | 容器 + 闭包嵌套；断言 `kind` 是容器（`Column`/`Row`/选择类组） |
| `.container_auto(kind, body)` | 同上 | `()` | 容器 + 自动 id |
| `.container_opts(kind, id, layout: LayoutProps, body)` | 同上 | `()` | 容器 + 布局参数（嵌套容器设布局的正道） |
| `.build()` | — | `Node` | **克隆**整棵树；`Builder` 可继续复用 |
| `.root_id()` | — | `&str` | 根的 id |

### M6 控件族（便捷构筑）

以下方法均已从源码核对（`crates/deer-core/src/builder.rs`）。**返回的 id 是事件与 `UiState` 状态表的键**；`*_opts` 版本可指定 id（**传空串 = 自动生成**）并就地改节点（`FnOnce(&mut Node)`）。

| 方法 | 参数 | 返回 | 说明 |
|---|---|---|---|
| `.segmented(labels)` / `.segmented_opts(id, layout, labels)` | `labels: &[&str]` | `Vec<String>`（段 id） | **分段选择组**（`Kind::Segmented`）：互斥单选，每标签一个 `button`；选中住 `UiState::segments`（组 id → 段 id），没塞 = 无选中段 |
| `.chip_group(labels)` / `.chip_group_opts(id, layout, labels)` | 同上 | `Vec<String>`（芯片 id） | **标签组**（`Kind::ChipGroup`）：多选，每个芯片独立开/关；开关表 `UiState::chips`，表里没有 = 关 |
| `.tab_bar(labels)` / `.tab_bar_opts(id, layout, labels)` | 同上 | `Vec<String>`（页签 id） | **页签栏**（`Kind::TabBar`）：单选页签，点击发 `TabChanged { id, index }`（index 按直接子节点树序，禁用页也计入）；内容切换是 App 的事 |
| `.number_field(label)` / `.number_field_opts(id, label, f)` | `impl Into<String>` | `String`（id） | **数值输入框**（`Kind::NumberField`）：草稿与 `Field` 同一套机械，提交时（失焦 / `Enter`）解析并发 `NumberChanged`；值域/步长住 `UiState::num_opts` |
| `.scrub_num(label)` / `.scrub_num_opts(id, label, f)` | 同上 | `String`（id） | **拖动调值**（`Kind::ScrubNum`）：`label` 必须是 App 格式化的当前值，按住左右拖持续发 `NumberChanged` |
| `.switch(label)` / `.switch_opts(id, label, f)` | 同上 | `String`（id） | **开关**（`Kind::Switch`）：点击 / `Enter` / `Space` 翻转并发 `Toggled { id, on }`；开/关住 `UiState::switches`（键 = 自己的 id），表里没有 = 关 |
| `.color_field(label)` / `.color_field_opts(id, label, f)` | 同上 | `String`（id） | **颜色输入框**（`Kind::ColorField`）：文本输入 `#RRGGBB` + 色块预览，提交成功发 `ColorChanged { rgb }` 并回写规范化串 |
| `.row_actions(labels)` / `.row_actions_opts(id, layout, labels)` | `labels: &[&str]` | `Vec<String>`（按钮 id） | **行尾动作按钮组**（组合层）：等价于「Row + 每标签一个 button」，不扩 Kind；组 id 自动生成 |

注意：三个选择类组（Segmented/ChipGroup/TabBar）**是容器**（孩子就是选项），布局与 `Row` 同一套横排数学；便捷构造产出的树与手写 `container_opts` + `button` **结构相等**（有测试钉住）。

## `L` —— `LayoutProps` 便捷构造器

`L::new().…` 链式设置，最后 `.to_props()` 产出 `LayoutProps`：

| 方法 | 对应字段 | 备注 |
|---|---|---|
| `.w(px)` / `.h(px)` | `width` / `height` = `Some(Size::Px(px))` | 百分比用 `Size::Pct(p)` 手工塞 |
| `.pad(px)` / `.gap(px)` | `padding` / `gap` | |
| `.main(Align)` / `.cross(Align)` | `main_axis` / `cross_axis` | |
| `.grow(w)` | `grow` | 剩余主轴空间的分配权重 |
| `.scroll(bool)` | `scroll` | 垂直滚动容器，**只对 `Column` 有意义**（`Row` 上被忽略） |
| `.wrap(bool)` | `wrap` | 文本按宽度换行，**只对 `Text` 有意义** |
| `.pos(x, y)` | `position` = `Pos::Offset` | 流外定位（L1）：相对父内容盒原点的像素偏移，可为负；设了即脱离流内布局 |
| `.anchors(l, t, r, b, ox, oy)` | `position` = `Pos::Anchors` | 流外锚定（L4）：四边锚点比例（`None` = 该边无锚）+ 像素修正；一轴两侧都有锚 ⇒ 尺寸由锚点对导出，**resize 时锚定边跟随** |
| `.cross_self(a)` | `cross_self` | 每子节点交叉轴对齐（L2）：覆盖父容器的 `cross`，只对这一个流内子节点生效 |
| `.min_w(px)` / `.max_w(px)` / `.min_h(px)` / `.max_h(px)` | `min_w` / `max_w` / `min_h` / `max_h` | 最小/最大尺寸（L3，像素版）；百分比用 `Size::Pct` 直设字段；`min > max` ⇒ min 赢 |

另有自由函数 `props(label: Option<&str>, disabled: bool) -> NodeProps`。

## 属性注册表（registry）

`deer-core::registry`（重组后新增，E1）：按 [`Kind`](node.md) 枚举「可编辑属性」的**纯数据表**。

- `PropSpec` —— 一条属性登记：`name`（与结构体字段名逐字一致）、`ty: PropType`（编辑器该用什么控件改它）、`domain`（取值域，给人看 + 输入校验）、`default`（字面量默认值）、`kinds`（对哪些 `Kind` 有意义，非空）；
- `PropType` —— 取值类型：`F32` / `Bool` / `Size` / `Align` / `Pos` / `Text` / `Opaque`（`Opaque` = 未知属性的原样保留，编辑器**不该直接编辑**它）；
- `SPECS: &[PropSpec]` —— 全部登记项，声明顺序 = 编辑器显示顺序。

**给谁用**：同一张表服务四个消费者——Inspector 面板、「改一个属性」的 undo 粒度、`.dui` 2.0 的语法面、拖拽写回的映射规则。它是纯数据（`&'static [PropSpec]`，没有 trait object / `Any` / 过程宏），与「树是纯数据」同一立场；防漂移靠编译期穷尽解构——给 `LayoutProps`/`NodeProps` 加字段而忘了登记，registry 模块直接编译失败。

## 使用示例

```rust
use deer_gui::prelude::*;

let mut app = Builder::new(Kind::Column, "app").padding(12.0).gap(8.0);
let ok_id = app.text("准备好了吗？");                    // 记下 id 给事件用
app.button_opts("取消", |b| { b.props.disabled = true; }); // 就地改参数
app.container_opts(Kind::Row, "bar", L::new().gap(8.0).to_props(), |r| {
    r.button("确定");
});
let tree = app.build();
```

## 注意事项

- **`new().padding()` 等链式方法只作用于根节点**；给嵌套容器设参数必须用
  `container_opts` + `L` —— 这是最常见的混淆点；
- **id 随结构漂移**：自动 id 形如 `text_1`、`button_1`，按 kind 计数。节点要被按 id 定位
  （事件、脚本 `move @id`）时给它显式 id；
- `_opts` / `container_with` 内部的顺序是「先设 layout/props，最后 `with_id`」——
  整体赋值会覆盖 id。直接用 `Node` 链式构造时也要遵守这个顺序（踩过一次的坑）；
- `build()` 返回的是克隆，改 `Builder` 不会影响已 `build()` 出去的树；
- 事件不进树（树是纯数据）：点击后发生什么由[交互层](interaction.md)按 id 报告。
