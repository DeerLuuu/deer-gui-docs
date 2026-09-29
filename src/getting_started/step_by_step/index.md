# 分步教程

这是一套循序渐进的分步教程：从「渲染出第一张 PNG」走到「写出带断言的界面测试」。
每一步都对应一个可独立运行的完整示例，可以直接复制到 `src/main.rs` 或
`examples/` 里跑。

## 教程结构约定

每一节的行文都是同一个结构：

| 小节 | 内容 |
|---|---|
| **目标** | 这一步做完你会得到什么 |
| **操作步骤** | 一步一步的操作说明 |
| **完整示例** | 可直接运行的完整代码 + 运行命令 |
| **下一步** | 通向下一节的链接 |

## 路线图

| 步骤 | 内容 | 涉及的 API |
|---|---|---|
| [第 1 步](01_first_render.md) | 环境就绪，离屏渲染第一张 PNG | `render_tree_to_png`、`render_tree_to_rgba` |
| [第 2 步](02_builder.md) | 用 `Builder` 搭一棵有层次的界面树 | [`Builder`](../../api/builder.md)、[`Node`](../../api/node.md) |
| [第 3 步](03_layout_props.md) | 尺寸、间距、对齐、grow | `L`、`LayoutProps`、[`layout()`](../../api/layout.md) |
| [第 4 步](04_scene_file.md) | 用 `.dui` 场景文件描述同一棵树 | [`parse_scene`](../../api/scene.md) |
| [第 5 步](05_text.md) | 真实字体：布局、绘制与度量统一 | [`TextEngine`](../../api/text.md)、`render_tree_to_png_with_font` |
| [第 6 步](06_window.md) | 打开一个真窗口（Windows） | [`App` / `run`](../../api/window.md) |
| [第 7 步](07_interaction.md) | 输入、点击、焦点与文本输入 | [`interaction::handle`](../../api/interaction.md) |
| [第 8 步](08_scroll_wrap.md) | 滚轮垂直滚动与文本换行 | `ScrollOffsets`、`wrap` |
| [第 9 步](09_testing.md) | 用 testkit 写十几行的界面测试 | [`Harness`](../../api/testing.md) |

## 前置条件

- 已按[安装与环境要求](../installation.md)装好 Rust 1.85+ 并拿到仓库；
- 读过[核心概念](../core_concepts.md)。

不需要窗口的第 1–5、8–9 步在任何平台都能跑；第 6–7 步需要 Windows。

## 遇到问题？

- 先查 [已知边界与常见陷阱](../../advanced/pitfalls.md) —— 很多「反直觉」行为是刻意的；
- 某个功能到底做了没有，以仓库根目录的
  [`FEATURES.md`](https://github.com/DeerLuuu/deer-gui/blob/master/FEATURES.md) 为唯一真相；
- 每一步的完整示例在 `crates/deer-gui/examples/` 里都有对应的可运行版本，见[示例索引](../../appendix/examples.md)。
