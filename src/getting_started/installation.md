# 安装与环境要求

## 目标

装好工具链，把 deer-gui 作为路径依赖引入你的项目，并确认能编译。

## 环境要求

| 要求 | 说明 |
|---|---|
| **Rust 1.85 或更高** | workspace 使用 edition 2024，旧工具链编译不过 |
| **Windows** | 只有需要**真窗口**时才必须（窗口层目前只有 Windows）；布局、CPU 光栅化、离屏出 PNG、Vulkan 离屏路径在其它平台也能跑 |
| **不需要 Vulkan SDK** | `deer-vk` 自己声明 Vulkan 符号，运行时用 `LoadLibraryW` + `GetProcAddress` 加载 `vulkan-1.dll`，只链接 `kernel32` |

## 操作步骤

### 1. 拿到仓库

```sh
git clone https://github.com/DeerLuuu/deer-gui.git
cd deer-gui
```

这些 crate 尚未发布到 crates.io，直接用 workspace 或按路径依赖。

### 2. 在自己的项目里引入

```toml
[dependencies]
deer-gui = { path = "path/to/deer-gui/crates/deer-gui" }
```

> **重要**：只有需要真窗口时才加 `--features window`。不开这个 feature 就不会引入
> `winit`，`deer-gui` 也就**没有任何第三方依赖**。离屏渲染（出 PNG / RGBA）不需要窗口。

```toml
# 需要窗口 / 交互时：
[dependencies]
deer-gui = { path = "path/to/deer-gui/crates/deer-gui", features = ["window"] }

# 想用测试接口（testkit）时再加：
# features = ["window", "testing"]
```

### 3. 确认一切正常

在仓库里跑一遍自检：

```sh
# 跑全部断言（数量随里程碑增长，以运行输出为准）
cargo test --workspace

# 离屏渲染一张图（CI 友好）→ render_out/render_to_png.png
cargo run -p deer-gui --example render_to_png
```

`render_to_png` 跑通并写出 PNG，就说明工具链没问题。

## 下一步

- 读 [核心概念：一棵节点树](core_concepts.md)，建立整体模型；
- 然后进入 [分步教程 · 第 1 步](step_by_step/01_first_render.md)，渲染第一张图。

相关 API：[门面 crate（deer_gui）](../api/deer_gui.md)、[窗口层](../api/window.md)。
