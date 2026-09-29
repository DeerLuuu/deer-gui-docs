# Drawing & Theme (DrawList / Theme / Color)

**crate**: `deer-gpu` (used via `deer_gui` / the prelude)

## What it does

This layer translates "tree + geometry" into a **list of draw commands**, which a backend (CPU software rasterization or Vulkan) then paints into pixels. The core design principle: **commands are "results", not "widgets"** — widgets (Button/Field…) are translated into rectangles/text/icons inside the renderer, and the backend only draws rectangles and glyphs; adding a new widget type requires touching no backend.

`Theme` is the central definition of widget colors and font size; `Color` is a simple color: 8-bit sRGB + f32 alpha.

## `DrawCmd` (draw commands)

| Variant | Fields | Notes |
|---|---|---|
| `FillRect` | `rect: RectI, color: Color` | Filled rectangle |
| `StrokeRect` | `rect, color, width: i32` | Outlined rectangle |
| `FillRoundRect` | `rect, radius: i32, color` | Rounded fill (rounding is done by the backend) |
| `Text` | `rect, text: String, color, size: f32, align: u8` (0=left 1=center 2=right) | A run of text (glyphs are sampled from the atlas; `size` is the font size in pixels) |
| `PushClip` | `rect: RectI` | Push a clip region (**intersected** with the current clip) |
| `PopClip` | — | Pop the clip stack (popping an empty stack ⇒ fall back to the full canvas) |
| `NodeHint` | `rect, node_id_len, node_id_fp` | Node hint: **produces no pixels**; backends quietly ignore it; [clip snapshots](interaction.md) rely on it to bind clips back to nodes (double-checked by length + FNV fingerprint) |

### `DrawList`

The command list of one frame, with a structural invariant: **the clip stack must be balanced** (`clip_balanced()`).

| Method | Notes |
|---|---|
| `push(cmd)` | Append (maintains clip balance internally) |
| `len()` / `is_empty()` | |
| `clip_balanced() -> bool` | Clip-stack balance check (backends may skip runtime checks based on it) |
| `counts() -> DrawCounts` | Per-variant command counts (for tests and diagnostics) |

### Producing and consuming

| Entry point | Signature highlights | Notes |
|---|---|---|
| `build_draw_list` | `(tree: &Node, geo: &Geometry, theme: Theme, m: &impl Measure) -> DrawList` | Tree + geometry → command list (the single production point) |
| `CpuRenderer` (`deer_gpu::null`) | `new()` / `with_text(engine: TextEngine)`; `render(Extent { width, height }, &list, clear: Color) -> GpuResult<Framebuffer>` | The CPU reference backend (software rasterization); `Framebuffer { width, height, pixels: Vec<u8> }` |

## `Theme`

| Field | Type | Default |
|---|---|---|
| `text` | `Color` | `#e6e8ef` |
| `text_dim` | `Color` | `#8b93a7` |
| `surface` | `Color` | `rgba(20, 22, 32, 0.55)` |
| `border` | `Color` | `#2a2f3f` |
| `accent` | `Color` | `#4c8dff` |
| `on_accent` | `Color` | `#ffffff` |
| `font_size` | `f32` | `13.0` |
| `line_height` | `f32` | `18.0` |

Interactive state colors derive from `Color::lighten(t)` (hover brightens) / `Color::darken(t)` (pressed darkens).

## `Color` / `RectI` / `Extent`

| Type | Fields / methods |
|---|---|
| `Color { r, g, b: u8, a: f32 }` | `rgb(r,g,b)` (a=1.0), `rgba(r,g,b,a)`, `TRANSPARENT`, `WHITE`, `packed() -> u32` (`0xRRGGBBAA`), `lighten(t)` / `darken(t)` (**alpha untouched**, keeping the CPU/GPU bytewise comparison over opaque content valid) |
| `RectI { x, y, w, h: i32 }` | `new`, `right()`, `bottom()`, `contains(px, py)` (half-open interval) |
| `Extent { width, height: u32 }` | Render target size |

## Example

```rust
use deer_gui::prelude::*;

// Used separately: control the "geometry → commands → pixels" steps yourself
let tree = /* … */;
let geo = layout(&tree, Rect::new(0.0, 0.0, 320.0, 200.0), TextStyle::default(), &ApproxMeasure);
let list = build_draw_list(&tree, &geo, Theme::default(), &ApproxMeasure);
assert!(list.clip_balanced());
println!("命令数：{}", list.counts().fill_rect);

let fb = CpuRenderer::new().render(Extent { width: 320, height: 200 }, &list, Theme::default().surface)?;
let (w, h, rgba) = (fb.width, fb.height, fb.pixels);
```

## Notes

- **Color attachment convention**: it must be `R8G8B8A8_UNORM`, **never** `_SRGB` — the CPU baseline does no gamma conversion;
  blending on sRGB attachments happens in linear space, measured to differ from the CPU's byte-level blending by ~44 bytes. Same for the window swapchain (prefer linear);
- `lighten` / `darken` deliberately leave alpha untouched — keeping the CPU/GPU bytewise comparison valid over opaque content;
- `NodeHint` doesn't carry the id itself (only length + fingerprint): backends may ignore it, but `ClipSnapshot::from_draw_list`
  depends on it being **co-walked** and bound with the tree + geometry — when building a draw list yourself, keep "one hint per node that has geometry";
- When customizing a theme, keep `font_size` / `line_height` consistent with the layout `TextStyle` (the font-size iron rule; see [Step 5](../getting_started/step_by_step/05_text.md)).

Related tutorials: [Step 1](../getting_started/step_by_step/01_first_render.md), [Step 7](../getting_started/step_by_step/07_interaction.md).
