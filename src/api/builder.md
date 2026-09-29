# 命令式构筑（Builder / L）

**模块**：`deer_layout::builder`（prelude 直接可用）

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
| `.container(kind, id, body)` | `FnOnce(&mut Builder)` | `()` | 容器 + 闭包嵌套；断言 `kind` 是 `Column`/`Row` |
| `.container_auto(kind, body)` | 同上 | `()` | 容器 + 自动 id |
| `.container_opts(kind, id, layout: LayoutProps, body)` | 同上 | `()` | 容器 + 布局参数（嵌套容器设布局的正道） |
| `.build()` | — | `Node` | **克隆**整棵树；`Builder` 可继续复用 |
| `.root_id()` | — | `&str` | 根的 id |

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

另有自由函数 `props(label: Option<&str>, disabled: bool) -> NodeProps`。

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
