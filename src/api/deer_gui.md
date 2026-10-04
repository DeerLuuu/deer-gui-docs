# 门面 crate（deer_gui）

## 功能说明

`deer_gui` 是**门面 crate**：一条 `use` 拿到运行时全部能力，并提供「离屏渲染成图片」的便捷入口。它还承载三个纯逻辑模块：[交互层](interaction.md)、[输入脚本](../appendix/input_script.md)与 [testkit](testing.md)，以及可选的[窗口层](window.md)。

模块地图：

| 模块 | 内容 | 开关 |
|---|---|---|
| `deer_gui::prelude` | 常用类型集中导入（清单见 [API 总览](index.md)） | 恒有 |
| `deer_gui::interaction` | 命中测试、状态机、`UiState` / `UiEvent` | 恒有 |
| `deer_gui::input_script` | 脚本文本 → `InputEvent` 序列 | 恒有 |
| `deer_gui::env_gate` | 环境变量门槛判定（先 `trim()` 再比） | 恒有 |
| `deer_gui::testing` | testkit（`Harness` 等） | `testing` feature 或 `cfg(test)` |
| `deer_gui::window` | `deer_window` 的 re-export | `window` feature |
| `deer_gui::gpu` / `::layout` / `::vk` | 下层 crate 的 crate 别名：`gpu` = `deer_gpu`、`layout` = `deer_core`、`vk` = `deer_vk` | 恒有 |

三个 crate 别名由 lib.rs 的一组 `pub use` 定义：

```rust,ignore
pub use deer_gpu::{ self as gpu, Theme };
pub use deer_core::{self as layout, Node};
pub use deer_vk::{self as vk, VkBackend};
pub use deer_core::{ DrawCmd, DrawList, GpuError, GpuResult };
```

即顶层 re-export 与别名合起来是：`Theme`、`DrawCmd`、`DrawList`、`GpuError`、`GpuResult`、`Node`、`VkBackend`，加上 `gpu`/`layout`/`vk` 三个别名 —— 注意 **`layout` 别名指向的是 `deer_core`**（布局、命中测试、`ScrollMetrics` 等契约都在它里面），不是某个叫 `deer-layout` 的 crate。

**LY2 说明（prelude 名字不变）**：文本栈的实现在 L1 crate `deer-text`（`TextEngine`、`GlyphAtlas` 等），但 `deer_gui::prelude::*` 里的**名字全部保持不变** —— 门面替你把 `deer_text` 的类型 re-export 进来，下游代码一行不用改（`deer_gui::gpu` 别名只覆盖 deer-gpu 自己的东西，文本类型不在其中）。

## 便捷渲染函数（参数与返回值）

| 函数 | 签名要点 | 返回 | 字体 |
|---|---|---|---|
| `render_tree_to_rgba` | `(tree: &Node, width: u32, height: u32, theme: Theme)` | `GpuResult<(u32, u32, Vec<u8>)>`（行优先 RGBA8，无 padding） | 无（占位方块） |
| `render_tree_to_png` | 同上 | `Result<Vec<u8>, String>`（PNG 字节流，可直接 `fs::write`） | 无（占位方块） |
| `render_tree_to_rgba_with_font` | `+ (font_path: &Path, font_size: f32)` | 同 `…_rgba` | **真实字形**（内部建 `TextEngine`） |
| `render_tree_to_png_with_font` | 同上 | 同 `…_png` | **真实字形** |
| `render_tree_to_rgba_with_engine` | `+ (font_size: f32, engine: TextEngine)`（复用已解析的字体） | 同 `…_rgba` | 真实字形；`theme.font_size` 会被钉成传入的 `font_size` |
| `layout_tree` | `(tree, width, height, theme)` | `layout::layout::Geometry`（id → `Rect`，调试布局用，不出像素；固定走 `ApproxMeasure` 近似度量） | — |

这些入口内部固定走：`layout()`（`ApproxMeasure` 或引擎度量）→ `build_draw_list` → CPU 后端渲染。

## 使用示例

```rust
use deer_gui::prelude::*;
use deer_gui::render_tree_to_png;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut app = Builder::new(Kind::Column, "app").padding(12.0).gap(8.0);
    app.text("标题");
    let tree = app.build();

    let png = render_tree_to_png(&tree, 320, 200, Theme::default())?;
    std::fs::write("ui.png", png)?;
    Ok(())
}
```

## 注意事项

- **`render_tree_to_png` / `render_tree_to_rgba` 不加载字体**：画出的「字」是等宽占位方块。
  要真实字形请用 `…_with_font` / `…_with_engine`（见[第 5 步](../getting_started/step_by_step/05_text.md)）；
- `GpuResult` 的错误类型是 `GpuError`（例如字体文件读不到、格式不支持时会明确报错，不静默给空白字形）；
- 像素缓冲行优先、无 padding；颜色是 RGBA8（`render_tree_to_png` 内部再编码成 PNG）；
- 想自定渲染管线：`prelude` 里的 `build_draw_list`（树+几何 → `DrawList`）与
  `CpuRenderer`（`DrawList` → `Framebuffer`）可拆开使用。
