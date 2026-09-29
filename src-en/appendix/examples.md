# Runnable Examples Index

[`crates/deer-gui/examples/`](https://github.com/DeerLuuu/deer-gui/tree/master/crates/deer-gui/examples) is the fastest way to see features running — **every example carries self-check assertions**. The example list grows with milestones; the directory itself is always the most authoritative source; this page is a guided tour.

## Offscreen (no window, any platform)

| Command | Content | Related tutorial |
|---|---|---|
| `cargo run -p deer-gui --example render_to_png` | Minimal tree → PNG (`render_out/`) | [Step 1](../getting_started/step_by_step/01_first_render.md) |
| `--example geometry` | Layout computation and hit testing, with assertions | [Step 3](../getting_started/step_by_step/03_layout_props.md) |
| `--example scene_file` | Build a tree from `.dui`, equivalent to the imperative path | [Step 4](../getting_started/step_by_step/04_scene_file.md) |
| `--example text_render` | Real glyphs → PNG | [Step 5](../getting_started/step_by_step/05_text.md) |
| `--example glyph_atlas` | Glyph atlas packing | [Text engine](../api/text.md) |
| `--example pixels` / `--example draw_list` | Minimal pipeline for the pixel buffer / draw list | [Drawing & theme](../api/draw.md) |
| `--example theme` | Custom theme colors | [Drawing & theme](../api/draw.md) |
| `--example scroll` | Wheel-driven vertical scrolling (offscreen) | [Step 8](../getting_started/step_by_step/08_scroll_wrap.md) |
| `--example tutorial` | Full-flow tour, producing several PNGs | [Step-by-step tutorial](../getting_started/step_by_step/index.md) |

## GPU / Vulkan

| Command | Content |
|---|---|
| `cargo test -p deer-vk -- --nocapture` | Enumerate the local GPUs |
| `--example vulkan_devices` / `--example vulkan_pipeline` | Vulkan devices / pipeline |
| `--example gpu_geometry` / `--example gpu_offscreen` | GPU geometry / offscreen, pixel-by-pixel parity against the CPU backend |
| `--example indirect_draw` | Indirect drawing (`vkCmdDrawIndexedIndirect`) |
| `--example textures` | Generic textures (RGBA8 create/upload/readback) |

## Window (`--features window`, Windows)

| Command | Content | Related tutorial |
|---|---|---|
| `--example window_preview` | Real window preview | [Step 6](../getting_started/step_by_step/06_window.md) |
| `--example hello_window` | The 8-step boilerplate from "just a UI tree" → window | [Step 6](../getting_started/step_by_step/06_window.md) |
| `--example counter` | Minimal but genuinely functional interactive UI (title/counter/buttons/input field) | [Step 7](../getting_started/step_by_step/07_interaction.md) |
| `--example interactive_form` | A complete interactive form (four-tier pixel counter, tiered script replay) | [Step 7](../getting_started/step_by_step/07_interaction.md) |
| `--example window_parity` | On-screen pixels vs the CPU backend, pixel-by-pixel parity (gated by `DEER_VK_WINDOW_TESTS=1`) | [Known pitfalls](../advanced/pitfalls.md) |

## Testing (`--features testing`)

| Command | Content | Related tutorial |
|---|---|---|
| `cargo run -q -p deer-gui --features testing --example testkit_demo` | A runnable demo of the testkit | [Step 9](../getting_started/step_by_step/09_testing.md) |

> Which feature maps to which example is governed by [`FEATURES.md`](https://github.com/DeerLuuu/deer-gui/blob/master/FEATURES.md);
> per repo discipline, a new feature must ship together with an example, a guide, and a `FEATURES.md` entry.
