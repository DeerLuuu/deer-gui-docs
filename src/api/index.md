# API 总览

deer-gui 对使用者暴露的是一个**门面 crate**（`deer_gui`）加四个分层 crate。
绝大多数场景下，一行 `use deer_gui::prelude::*;` 就能拿到全部常用类型。

## crate 分层

| Crate | 职责 | 文档 |
|---|---|---|
| `deer-gui` | 门面：re-export 一切 + 离屏渲染便捷入口 + 交互层 + testkit | [门面 crate](deer_gui.md) |
| `deer-layout` | 节点树、布局代数、命中测试、`.dui` 场景解析（**零平台依赖**） | [Builder](builder.md) · [Node](node.md) · [布局](layout.md) · [场景](scene.md) |
| `deer-gpu` | GPU HAL、绘制列表、主题、文本引擎、CPU 参考后端 | [绘制与主题](draw.md) · [文本引擎](text.md) |
| `deer-vk` | Vulkan 后端（自声明符号 + 运行时动态加载，不需要 SDK） | 见仓库 `crates/deer-vk` 源码文档 |
| `deer-window` | 窗口 + 事件循环（`winit`，唯一第三方依赖；`window` feature） | [窗口层](window.md) |

## prelude 一览

`use deer_gui::prelude::*;` 会导入这些（全部来自真实代码，随版本演进以源码为准）：

| 类别 | 类型 / 函数 |
|---|---|
| 渲染入口 | `DefaultRenderer`、`build_draw_list`、`CpuRenderer`、`Framebuffer` |
| 绘制类型 | `Color`、`DrawCmd`、`DrawList`、`Extent`、`RectI`、`Theme` |
| 文本 | `GlyphAtlas`、`GlyphImage`、`GlyphKey`、`FontMeasure`、`Rasterizer`、`GlyphPlacement`、`TextEngine` |
| 构筑 | `Builder`、`L` |
| 布局 | `ApproxMeasure`、`Measure`、`TextStyle`、`hit_test`、`layout`、`measure_tree` |
| 节点 | `Align`、`Kind`、`Node`、`Rect`、`Size` |
| 场景 | `SceneError`、`encode_scene`、`parse_scene` |

不在 prelude 里、但常用的：`deer_gui::{render_tree_to_png, render_tree_to_rgba, layout_tree, interaction, input_script, testing, window}`。

## feature 开关

| Feature | 引入的内容 | 何时开 |
|---|---|---|
| `window` | `deer_window`（winit）+ 窗口渲染路径 | 需要真窗口时；离屏渲染不需要 |
| `testing` | `deer_gui::testing`（testkit） | 写界面测试时；生产构建零成本 |

## 阅读路径

- 新手：跟着[分步教程](../getting_started/step_by_step/index.md)走，遇到 API 再回来查；
- 查用法：每篇 API 文档统一包含**功能说明 → 参数与返回值 → 使用示例 → 注意事项**，并附相关教程链接；
- 查行为细节：[布局不变式](../advanced/invariants.md)与[已知陷阱](../advanced/pitfalls.md)。
