# Step 5: Rendering Text with Real Fonts

## Goal

Turn the text in your UI from "monospaced placeholder blocks" into **real glyphs**: understand the iron rule that "layout metrics, the draw list and rasterization must all use the same font size and the same metrics", and learn to use the text-engine path.

## Steps

1. Prepare a TrueType font (`.ttf` / `.ttc` with a `glyf` table; **CFF/OTTO is not supported** and fails with a clear error).
   On Windows you can use `C:\Windows\Fonts\consola.ttf` directly.
2. Switch the render entry point to `render_tree_to_png_with_font` (or build a `TextEngine` first and use `…_with_engine`).
3. Remember the font size must agree in three places: the engine's font size, the layout's `TextStyle.font_size`, and `theme.font_size` —
   these entry points already pin them to the same value for you; don't lose that when wiring things up yourself.

## Complete example

```rust
use deer_gui::prelude::*;
use deer_gui::render_tree_to_png_with_font;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut app = Builder::new(Kind::Column, "app").padding(12.0).gap(8.0);
    app.text("Title: real glyphs");
    app.button("Click me");
    let tree = app.build();

    // Font size unified in three places: engine / TextStyle / Theme all pinned to 16.0
    let png = render_tree_to_png_with_font(
        &tree,
        320,
        200,
        Theme::default(),
        std::path::Path::new("C:/Windows/Fonts/consola.ttf"),
        16.0,
    )?;
    std::fs::write("text_render.png", png)?;
    Ok(())
}
```

```sh
cargo run
```

Don't want to hand-write the font path? `TextEngine::from_system_font(16.0)` looks for
`consola.ttf` / `arial.ttf` / `segoeui.ttf` under `%WINDIR%\Fonts` in order, and fails with a clear error if none is found.

Run it directly in the repository:

```sh
cargo run -p deer-gui --example text_render     # render_out/text_render.png
cargo run -p deer-gui --example glyph_atlas     # glyph atlas packing
```

## Why the font size must agree in three places

| Place | Who uses it | What goes wrong otherwise |
|---|---|---|
| Engine font size (`TextEngine` constructor argument) | Glyph rasterization, real advance metrics | Layout computes widths with font size A while drawing uses B ⇒ width drift |
| Layout `TextStyle.font_size` | Text node widths, line height, wrapping | Same as above |
| `theme.font_size` | The source of `DrawCmd::Text.size` in the draw list | The drawn text doesn't match the reserved space |

`render_tree_to_rgba_with_engine` takes the **single-definition** approach: `theme.font_size` is pinned
directly to the `font_size` you pass in. Follow the same pattern when assembling the path yourself.

## Meet the two measure implementations

| Implementation | Width algorithm | Use |
|---|---|---|
| `ApproxMeasure` | 0.6em per character (deterministic approximation) | Layout tests, environments without fonts |
| `FontMeasure` (`TextEngine::measure()`) | The font's real advance | The real rendering path |

Both share the **same** wrapping algorithm, `wrap_greedy` — however many lines layout reserves, rendering draws
exactly that many, and the two can never diverge (that's exactly why the line count has only one definition). For wrapping
details and caveats about CJK text, see [Step 8](08_scroll_wrap.md).

## APIs used in this step

| API | Purpose | Detailed docs |
|---|---|---|
| `render_tree_to_png_with_font` | Tree → PNG (real glyphs) | [Facade crate](../../api/deer_gui.md) |
| `TextEngine::from_font_file` / `from_system_font` | Build a text engine | [Text engine](../../api/text.md) |
| `FontMeasure` | Real font metrics | [Text engine](../../api/text.md) |
| `Measure` trait | The measure interface (injectable) | [Layout engine](../../api/layout.md) |

## Next step

You can produce images now; next, put them on screen: [Step 6: Opening a Window](06_window.md).
