# 简介

**deer-gui** 是一个从零实现的 Rust GUI 运行时 —— 不依赖 web、不依赖 DOM，也不依赖 `wgpu` / `ash` / `vulkano`。

它的核心是**一棵节点树**：你用两种方式中的任意一种描述界面，由本仓库自研的布局引擎算出几何，再交给可插拔的渲染后端（CPU 软件光栅化或 Vulkan）。

- **命令式 API**（[`Builder`]，imgui 式手感）；
- **场景文件**（`.dui`，思路类似 Godot 的 `.tscn`）。

两条路径产出**结构相等**的同一棵树 —— 这是整个运行时的核心不变式。

> **注意**：项目仍在活跃开发中。「有哪些功能、做到哪一步、哪些还没做」以仓库根目录的
> [`FEATURES.md`](https://github.com/DeerLuuu/deer-gui/blob/master/FEATURES.md) 为唯一真相。
> 假设某个功能可用之前，请先读它。

## 本文档适合谁

- 想用 deer-gui 写界面的人：从[安装](getting_started/installation.md)开始，跟着[分步教程](getting_started/step_by_step/index.md)走；
- 想查某个 API 的人：直接翻 [API 参考](api/index.md)，每篇都有参数表与示例；
- 想理解「为什么它这样做」的人：看[架构总览](advanced/architecture.md)与[已知陷阱](advanced/pitfalls.md)。

## 这个运行时的能力地图

| 能力 | 状态 |
|---|---|
| 构筑节点树（命令式 / `.dui` 场景文件） | ✅ |
| 布局计算（几何表）、命中测试 | ✅ |
| 树 + 几何 → 绘制列表 → **像素**（CPU 后端） | ✅ |
| 把像素写成 PNG 文件 | ✅ |
| **真实字体字形**（零依赖 TTF 解析 + 光栅化 + 图集 + 真实度量） | ✅ |
| 渲染到窗口 / 屏幕上（Vulkan，形状 + 文本） | ✅ 需开 `window` feature |
| 输入与焦点（悬停 / 点击 / `Tab`/`Escape` 焦点 / 文本输入 / 输入框光标 / 指针捕获 / 脚本重放 / 事件驱动重绘） | ✅ |
| 滚轮驱动的垂直滚动、文本按宽度换行 | ✅ |
| 可视滚动条（拖滑块改偏移、点轨道跳转）+ 惯性滚动（`advance_inertia` 接线） | ✅ |
| 方向键导航（`Up`/`Down` 几何邻近移动焦点）、按键滚动（`PageUp`/`PageDown`/`Home`/`End`） | ✅ |
| 右键透传（`PointerRight`）、按键重复（`repeat: bool`）、IME 预编辑 | ✅ |
| M6 控件族首批（`Segmented`/`ChipGroup`/`TabBar`/`NumberField`/`ScrubNum`/`Switch`/`ColorField`） | ✅ |
| 多窗口（`WindowId`/`WindowSpawner`，动态 spawn，仅 Windows） | ✅ |
| 剪贴板（Windows，`CF_UNICODETEXT` 纯文本，零第三方依赖） | ✅ |
| 图片解码（BMP → RGBA8；PNG 解码未做） | ✅ |
| DPI 缩放系数透传（只透传不换算） | ✅ |
| 日志（`deer-log` 零依赖门面，`DEER_LOG` 开关，默认完全静默） | ✅ |
| 停靠面板 dock、控件族全量（`Icon`/`DropMenu`/`Dialog`/`Overlay`/`HoverTip`） | ⬜ 未实现 |
| DX12 / Metal 后端、Linux / macOS 窗口层 | ⬜ 未实现 |

平台支持：布局 / CPU 光栅化 / 出 PNG / Vulkan 离屏在任何平台都可用；**窗口层目前只有 Windows**（Linux / macOS 会明确返回「平台不支持」错误，绝不静默）。

## 依赖

**除窗口层（`winit`，已登记）外零第三方依赖。** workspace 现为 7 个 crate：

| Crate | 角色 | 第三方依赖 |
|---|---|---|
| `deer-core` | L0 纯核心：节点树、布局、场景解析、命中测试、绘制命令、属性注册表、值解析 | 无 |
| `deer-text` | L1 文本栈：字体解析、字形光栅化、图集、度量（含零依赖 PNG 编码器） | 无 |
| `deer-gpu` | L1：GPU HAL trait、`DrawList`、CPU 参考后端、交互渲染辅助、BMP 解码 | 无 |
| `deer-window` | L1 显示服务（winit 循环 / `InputEvent` 映射 / DPI / 剪贴板）+ L3 宿主（`App`/`run`/多窗口） | `winit 0.30` |
| `deer-vk` | L2 Vulkan 后端（运行时动态加载，不需要 SDK） | 无 |
| `deer-log` | 横切日志门面（零依赖自研约 200 行，不引 `log`/`tracing`） | 无 |
| `deer-gui` | L4 门面：re-export 一切 + 交互层 + 输入脚本 + testkit | 无（`deer-window` 为可选依赖，随 `window` feature 引入 `winit`） |

`winit` 是唯一登记在案的例外（记录在 [`ROADMAP.md`](https://github.com/DeerLuuu/deer-gui/blob/master/ROADMAP.md) 的 Q-1）。

## 许可证

MIT —— 全文见仓库根目录的 [LICENSE](https://github.com/DeerLuuu/deer-gui/blob/master/LICENSE)。

[`Builder`]: api/builder.md
