# The Facade Crate (deer_gui)

## What it does

`deer_gui` is the **facade crate**: one `use` gets you the full runtime capability set, plus convenient "render offscreen to an image" entry points. It also hosts three pure-logic modules: the [interaction layer](interaction.md), [input scripts](../appendix/input_script.md), and the [testkit](testing.md), as well as the optional [window layer](window.md).

Module map:

| Module | Contents | Gate |
|---|---|---|
| `deer_gui::prelude` | Central re-import of common types (list in the [API overview](index.md)) | always |
| `deer_gui::interaction` | Hit testing, state machines, `UiState` / `UiEvent` | always |
| `deer_gui::input_script` | Script text → `InputEvent` sequence | always |
| `deer_gui::env_gate` | Environment-variable gate checks (`trim()` before comparing) | always |
| `deer_gui::testing` | The testkit (`Harness` etc.) | `testing` feature or `cfg(test)` |
| `deer_gui::window` | Re-export of `deer_window` | `window` feature |
| `deer_gui::gpu` / `::layout` / `::vk` | Re-exports of the lower crates (`deer_gpu` / `deer_layout` / `deer_vk`) | always |

Top-level re-exports: `DrawCmd`, `DrawList`, `GpuError`, `GpuResult`, `Theme`, `Node`, `VkBackend`.

## Convenience rendering functions (parameters & return values)

| Function | Signature highlights | Returns | Fonts |
|---|---|---|---|
| `render_tree_to_rgba` | `(tree: &Node, width: u32, height: u32, theme: Theme)` | `GpuResult<(u32, u32, Vec<u8>)>` (row-major RGBA8, no padding) | none (placeholder boxes) |
| `render_tree_to_png` | same | `Result<Vec<u8>, String>` (PNG bytes, writable straight with `fs::write`) | none (placeholder boxes) |
| `render_tree_to_rgba_with_font` | `+ (font_path: &Path, font_size: f32)` | same as `…_rgba` | **real glyphs** (builds a `TextEngine` internally) |
| `render_tree_to_png_with_font` | same | same as `…_png` | **real glyphs** |
| `render_tree_to_rgba_with_engine` | `+ (font_size: f32, engine: TextEngine)` (reuses an already-parsed font) | same as `…_rgba` | real glyphs; `theme.font_size` gets pinned to the passed `font_size` |
| `layout_tree` | `(tree, width, height, theme)` | `Geometry` (id → `Rect`, for debugging layout; produces no pixels) | — |

Internally these entry points always run: `layout()` (`ApproxMeasure` or engine metrics) → `build_draw_list` → CPU backend rendering.

## Example

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

## Notes

- **`render_tree_to_png` / `render_tree_to_rgba` do not load fonts**: the "text" they draw is monospace placeholder boxes.
  For real glyphs use `…_with_font` / `…_with_engine` (see [Step 5](../getting_started/step_by_step/05_text.md));
- The error type of `GpuResult` is `GpuError` (e.g. an unreadable font file or an unsupported format produces a clear error, never a silent blank glyph);
- The pixel buffer is row-major with no padding; colors are RGBA8 (`render_tree_to_png` encodes them into a PNG internally);
- To build your own pipeline: `build_draw_list` from the `prelude` (tree + geometry → `DrawList`) and
  `CpuRenderer` (`DrawList` → `Framebuffer`) can be used separately.
