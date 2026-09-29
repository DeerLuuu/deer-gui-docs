# The Text Engine & Font Metrics (TextEngine / FontMeasure)

**Module**: `deer_gpu::text` / `deer_gpu::measure`

## What it does

A zero-dependency real font stack: TTF parsing → glyph rasterization → atlas → real metrics → wrapping. The text engine (`TextEngine`) owns the font and the glyph atlas; `FontMeasure` exposes the real advances as the layout [`Measure`](layout.md) interface — **layout and drawing share the same font and the same font size**, which is the guarantee that "the width layout computed == the width actually drawn".

## `TextEngine`

| Method | Signature | Notes |
|---|---|---|
| `from_font_file` | `(path: &Path, font_size: f32) -> GpuResult<TextEngine>` | Build an engine from a font file |
| `from_font_bytes` | `(data: Vec<u8>, font_size: f32) -> GpuResult<TextEngine>` | Build an engine from in-memory bytes |
| `from_system_font` | `(font_size: f32) -> GpuResult<TextEngine>` | Searches `%WINDIR%\Fonts` for `consola.ttf` / `arial.ttf` / `segoeui.ttf` in order; if none is found it **errors clearly** (never silently) |
| `from_font` | `(font: Font, font_size: f32) -> TextEngine` | Build from an already-parsed `Font` |
| `measure()` | `-> FontMeasure<'_>` | The metrics interface (feed into `layout` / `build_draw_list`) |
| `glyph(ch, px_size)` | `-> Option<GlyphPlacement>` | Typing info for a character; rasterizes into the atlas on demand (cached); missing glyphs fall back to `.notdef` and are counted in diagnostics |
| `text_width(text, px_size)` | `-> f32` | The real width of a run of text |
| `set_font_size(px)` / `font_size()` | | Change/read the default font size (existing atlas caches stay valid: different sizes are different `GlyphKey`s) |

**Format support**: TrueType (with a `glyf` table, `.ttf` / `.ttc`). **CFF/OTTO is not supported** — it errors out clearly; never silently produces blank glyphs.

## `FontMeasure`

Real metrics implementing the `Measure` trait:

| Method | Notes |
|---|---|
| `width(text, _style)` | The sum of real advances (ignores `style.font_size`; the size is fixed at construction) |
| `wrap(text, _style, max_width)` | The same word-splitting rules as `wrap_greedy` (the guarantee that lines reserved by layout == lines drawn by rendering) |
| `height(text, _style, max_width)` | `wrap().len() × line_height` (**not** a separate algorithm) |

Fields: `pub font: &Font`, `pub font_size: f32`.

## Companion types (available from the prelude)

| Type | Notes |
|---|---|
| `GlyphAtlas` | The glyph atlas (packed bitmap coverage, sampled by CPU/GPU) |
| `GlyphKey` | Cache key: character + size |
| `GlyphImage` | A single glyph's bitmap |
| `GlyphPlacement` | The bitmap's position in the atlas + offset relative to the pen position/baseline + advance |
| `Rasterizer` | Glyph rasterization |
| `find_system_font()` | System font probing in the `measure` module (`Option<PathBuf>`) |

## Example

```rust
use deer_gui::prelude::*;

// Path one: the convenience entry point (pins all three font sizes for you internally)
// let png = deer_gui::render_tree_to_png_with_font(
//     &tree, 320, 200, Theme::default(), Path::new("C:/Windows/Fonts/consola.ttf"), 16.0)?;

// Path two: drive the engine yourself (reuse a parsed font, or pair with the windowed path)
let engine = TextEngine::from_system_font(16.0)?;
let geo = layout(&tree, Rect::new(0.0, 0.0, 320.0, 200.0),
                 TextStyle { font_size: 16.0, line_height: 18.0 }, &engine.measure());
let list = build_draw_list(&tree, &geo, theme, &engine.measure());
let mut renderer = CpuRenderer::with_text(engine);
let fb = renderer.render(Extent { width: 320, height: 200 }, &list, theme.surface)?;
```

Runnable examples: `cargo run -p deer-gui --example text_render` (real glyphs to PNG),
`--example glyph_atlas` (atlas packing).

## Notes

- **The font size must agree in three places**: the engine's size, the layout `TextStyle.font_size`, and `theme.font_size` —
  a mismatch is "layout width drifts from draw width" (see the table in [Step 5](../getting_started/step_by_step/05_text.md));
- `FontMeasure::width` ignores `TextStyle.font_size` (the size comes from the `font_size` given at construction),
  so when assembling the pipeline yourself, don't expect changing `TextStyle` to change the font size;
- **No hinting** (backed by measurements: even the cheapest hinting-lite has no net benefit); subpixel horizontal positioning is an
  opt-in path in the rasterizer; by default glyphs still land on integer positions;
- Chinese glyphs: the atlas rasterizes on demand with caching, but **the font file itself must contain the glyphs you need** —
  system font probing only recognizes the three Western fonts, so pass a Chinese font path explicitly for Chinese UIs;
- Wrapping details (Chinese is hard-cut per character, etc.) in [Step 8](../getting_started/step_by_step/08_scroll_wrap.md).
