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
| `deer_gui::gpu` / `::layout` / `::vk` | 下层 crate 的 re-export（`deer_gpu` / `deer_layout` / `deer_vk`） | 恒有 |

顶层 re-export：`DrawCmd`、`DrawList`、`GpuError`、`GpuResult`、`Theme`、`Node`、`VkBackend`。

## 便捷渲染函数（参数与返回值）

| 函数 | 签名要点 | 返回 | 字体 |
|---|---|---|---|
| `render_tree_to_rgba` | `(tree: &Node, width: u32, height: u32, theme: Theme)` | `GpuResult<(u32, u32, Vec<u8>)>`（行优先 RGBA8，无 padding） | 无（占位方块） |
| `render_tree_to_png` | 同上 | `Result<Vec<u8>, String>`（PNG 字节流，可直接 `fs::write`） | 无（占位方块） |
| `render_tree_to_rgba_with_font` | `+ (font_path: &Path, font_size: f32)` | 同 `…_rgba` | **真实字形**（内部建 `TextEngine`） |
| `render_tree_to_png_with_font` | 同上 | 同 `…_png` | **真实字形** |
| `render_tree_to_rgba_with_engine` | `+ (font_size: f32, engine: TextEngine)`（复用已解析的字体） | 同 `…_rgba` | 真实字形；`theme.font_size` 会被钉成传入的 `font_size` |
| `layout_tree` | `(tree, width, height, theme)` | `Geometry`（id → `Rect`，调试布局用，不出像素） | — |

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
