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
| `--example scroll_bar` | 可视滚动条（拖滑块改偏移、点轨道跳转） | [第 8 步](../getting_started/step_by_step/08_scroll_wrap.md) |
| `--example overlay_demo` | 绝对定位 / 层叠（`pos=x,y`，声明序） | [第 3 步](../getting_started/step_by_step/03_layout_props.md) |
| `--example layout_refine_demo` | 每子节点交叉轴对齐（`cross_self`）+ 最小/最大尺寸 | [第 3 步](../getting_started/step_by_step/03_layout_props.md) |
| `--example anchors_demo` | anchors 锚定（一轴双锚导出尺寸、resize 跟随） | [第 3 步](../getting_started/step_by_step/03_layout_props.md) |
| `--example prop_registry` | 属性注册表（按 `Kind` 列可编辑属性） | [布局引擎](../api/layout.md) |
| `--example ime_preedit` | IME 预编辑（缓冲 / 提交 / 取消，画在光标处） | [第 7 步](../getting_started/step_by_step/07_interaction.md) |
| `--example logging` | `deer-log` 日志门面（分级 / 过滤 / `DEER_LOG` 开关） | [已知陷阱](../advanced/pitfalls.md) |
| `--example tutorial` | 全流程导览，产出多张 PNG | [分步教程](../getting_started/step_by_step/index.md) |

## GPU / Vulkan

| 命令 | 内容 |
|---|---|
| `cargo test -p deer-vk -- --nocapture` | 枚举本机 GPU |
| `--example vulkan_devices` / `--example vulkan_pipeline` | Vulkan 设备 / 管线 |
| `--example gpu_geometry` / `--example gpu_offscreen` | GPU 几何 / 离屏，与 CPU 后端逐像素对照 |
| `--example indirect_draw` | 间接绘制（`vkCmdDrawIndexedIndirect`） |
| `--example textures` | 通用纹理（RGBA8 创建/上传/回读） |
| `--example bmp_decode` | BMP 解码（24/32 位）→ RGBA8 顶行在前 → 喂纹理 |

## 窗口（`--features window`，Windows）

| 命令 | 内容 | 相关教程 |
|---|---|---|
| `--example window_preview` | 真窗口预览 | [第 6 步](../getting_started/step_by_step/06_window.md) |
| `--example hello_window` | 「只有一棵 UI 树」→ 窗口的 8 步样板 | [第 6 步](../getting_started/step_by_step/06_window.md) |
| `--example counter` | 最小但真有功能的交互界面（标题/计数/按钮/输入框） | [第 7 步](../getting_started/step_by_step/07_interaction.md) |
| `--example interactive_form` | 完整交互表单（四档像素数字、脚本重放分档；`DEER_FORM_MANUAL=1` 进纯手工模式——不重放脚本、不断言终态，自己点、Esc 退出） | [第 7 步](../getting_started/step_by_step/07_interaction.md) |
| `--example window_parity` | 上屏像素 vs CPU 后端逐像素对照（门禁 `DEER_VK_WINDOW_TESTS=1`） | [已知陷阱](../advanced/pitfalls.md) |
| `--example scroll_inertia_window` | 惯性滚动的窗口接线（`advance_inertia` + `inertia_deadline` 三件套） | [第 8 步](../getting_started/step_by_step/08_scroll_wrap.md) |
| `--example clipboard_probe` | 剪贴板读写探针（纯文本往返保真，含中文/emoji） | [窗口层](../api/window.md) |
| `--example dual_window` | 双窗口：动态 spawn 第二窗、两窗各自树/状态/事件，关一扇另一扇存活（门禁 `DEER_VK_WINDOW_TESTS=1`） | [窗口层](../api/window.md) |
| `--example hal_window_path` | HAL 窗口路径端到端验证（门禁 `DEER_VK_WINDOW_TESTS=1`） | [窗口层](../api/window.md) |

## 测试（`--features testing`）

| 命令 | 内容 | 相关教程 |
|---|---|---|
| `cargo run -q -p deer-gui --features testing --example testkit_demo` | testkit 的可运行演示 | [第 9 步](../getting_started/step_by_step/09_testing.md) |
| `--example m6_basics` | `Btn` 语义 / `RowActions` / `Keep`（离屏自检） | [第 7 步](../getting_started/step_by_step/07_interaction.md) |
| `--example m6_select` | 选择类控件：`Segmented` / `ChipGroup` / `TabBar` | [第 7 步](../getting_started/step_by_step/07_interaction.md) |
| `--example m6_values` | 数值类控件：`NumberField` / `ScrubNum` / `Switch` / `ColorField` | [第 7 步](../getting_started/step_by_step/07_interaction.md) |

> 哪个功能对应哪个示例，以 [`FEATURES.md`](https://github.com/DeerLuuu/deer-gui/blob/master/FEATURES.md) 为准；
> 新功能按仓库纪律必须同时带示例、指南与 `FEATURES.md` 登记。
