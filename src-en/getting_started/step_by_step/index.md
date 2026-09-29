# Step-by-Step Tutorial

This is a progressive, step-by-step tutorial: it goes from "rendering your first PNG" to "writing UI tests with assertions".
Each step corresponds to a complete, independently runnable example that you can copy straight into
`src/main.rs` or `examples/` and run.

## Tutorial structure convention

Every section follows the same structure:

| Section | Content |
|---|---|
| **Goal** | What you'll have once this step is done |
| **Steps** | Step-by-step instructions |
| **Complete example** | Complete runnable code + the command to run it |
| **Next step** | A link to the next section |

## Roadmap

| Step | Content | APIs involved |
|---|---|---|
| [Step 1](01_first_render.md) | Environment ready, render your first PNG offscreen | `render_tree_to_png`, `render_tree_to_rgba` |
| [Step 2](02_builder.md) | Build a hierarchical UI tree with `Builder` | [`Builder`](../../api/builder.md), [`Node`](../../api/node.md) |
| [Step 3](03_layout_props.md) | Sizes, spacing, alignment, grow | `L`, `LayoutProps`, [`layout()`](../../api/layout.md) |
| [Step 4](04_scene_file.md) | Describe the same tree with a `.dui` scene file | [`parse_scene`](../../api/scene.md) |
| [Step 5](05_text.md) | Real fonts: layout, drawing and metrics unified | [`TextEngine`](../../api/text.md), `render_tree_to_png_with_font` |
| [Step 6](06_window.md) | Open a real window (Windows) | [`App` / `run`](../../api/window.md) |
| [Step 7](07_interaction.md) | Input, clicks, focus and text input | [`interaction::handle`](../../api/interaction.md) |
| [Step 8](08_scroll_wrap.md) | Wheel-driven vertical scrolling and text wrapping | `ScrollOffsets`, `wrap` |
| [Step 9](09_testing.md) | UI tests in a dozen lines with testkit | [`Harness`](../../api/testing.md) |

## Prerequisites

- Rust 1.85+ installed and the repository cloned, per [Installation and Requirements](../installation.md);
- You've read [Core Concepts](../core_concepts.md).

Steps 1–5 and 8–9, which need no window, run on any platform; steps 6–7 require Windows.

## Running into trouble?

- First check [Known Limits and Common Pitfalls](../../advanced/pitfalls.md) — a lot of "counter-intuitive" behavior is deliberate;
- Whether a feature actually exists is decided by
  [`FEATURES.md`](https://github.com/DeerLuuu/deer-gui/blob/master/FEATURES.md) at the repository root — the single source of truth;
- The complete example for every step has a corresponding runnable version in `crates/deer-gui/examples/`; see the [Examples Index](../../appendix/examples.md).
