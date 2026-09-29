# 可运行示例索引

[`crates/deer-gui/examples/`](https://github.com/DeerLuuu/deer-gui/tree/master/crates/deer-gui/examples) 是看到功能跑起来的最快方式 —— **每个示例都带自检断言**。示例清单会随里程碑增长，最权威的来源永远是目录本身；本页是导览。

## 离屏（无窗口，任何平台）

| 命令 | 内容 | 相关教程 |
|---|---|---|
| `cargo run -p deer-gui --example render_to_png` | 最小树 → PNG（`render_out/`） | [第 1 步](../getting_started/step_by_step/01_first_render.md) |
| `--example geometry` | 布局计算与命中测试，带断言 | [第 3 步](../getting_started/step_by_step/03_layout_props.md) |
| `--example scene_file` | `.dui` 建树，与命令式等价 | [第 4 步](../getting_started/step_by_step/04_scene_file.md) |
| `--example text_render` | 真实字形 → PNG | [第 5 步](../getting_started/step_by_step/05_text.md) |
| `--example glyph_atlas` | 字形图集打包 | [文本引擎](../api/text.md) |
| `--example pixels` / `--example draw_list` | 像素缓冲 / 绘制列表的最小通路 | [绘制与主题](../api/draw.md) |
| `--example theme` | 自定义主题配色 | [绘制与主题](../api/draw.md) |
| `--example scroll` | 滚轮驱动的垂直滚动（离屏版） | [第 8 步](../getting_started/step_by_step/08_scroll_wrap.md) |
| `--example tutorial` | 全流程导览，产出多张 PNG | [分步教程](../getting_started/step_by_step/index.md) |

## GPU / Vulkan

| 命令 | 内容 |
|---|---|
| `cargo test -p deer-vk -- --nocapture` | 枚举本机 GPU |
| `--example vulkan_devices` / `--example vulkan_pipeline` | Vulkan 设备 / 管线 |
| `--example gpu_geometry` / `--example gpu_offscreen` | GPU 几何 / 离屏，与 CPU 后端逐像素对照 |
| `--example indirect_draw` | 间接绘制（`vkCmdDrawIndexedIndirect`） |
| `--example textures` | 通用纹理（RGBA8 创建/上传/回读） |

## 窗口（`--features window`，Windows）

| 命令 | 内容 | 相关教程 |
|---|---|---|
| `--example window_preview` | 真窗口预览 | [第 6 步](../getting_started/step_by_step/06_window.md) |
| `--example hello_window` | 「只有一棵 UI 树」→ 窗口的 8 步样板 | [第 6 步](../getting_started/step_by_step/06_window.md) |
| `--example counter` | 最小但真有功能的交互界面（标题/计数/按钮/输入框） | [第 7 步](../getting_started/step_by_step/07_interaction.md) |
| `--example interactive_form` | 完整交互表单（四档像素数字、脚本重放分档） | [第 7 步](../getting_started/step_by_step/07_interaction.md) |
| `--example window_parity` | 上屏像素 vs CPU 后端逐像素对照（门禁 `DEER_VK_WINDOW_TESTS=1`） | [已知陷阱](../advanced/pitfalls.md) |

## 测试（`--features testing`）

| 命令 | 内容 | 相关教程 |
|---|---|---|
| `cargo run -q -p deer-gui --features testing --example testkit_demo` | testkit 的可运行演示 | [第 9 步](../getting_started/step_by_step/09_testing.md) |

> 哪个功能对应哪个示例，以 [`FEATURES.md`](https://github.com/DeerLuuu/deer-gui/blob/master/FEATURES.md) 为准；
> 新功能按仓库纪律必须同时带示例、指南与 `FEATURES.md` 登记。
