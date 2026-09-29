# API Overview

To users, deer-gui exposes a **facade crate** (`deer_gui`) plus four layered crates.
In the vast majority of cases, a single `use deer_gui::prelude::*;` gets you all the commonly used types.

## Crate layering

| Crate | Responsibility | Docs |
|---|---|---|
| `deer-gui` | Facade: re-exports everything + convenient offscreen rendering + the interaction layer + the testkit | [Facade crate](deer_gui.md) |
| `deer-layout` | Node tree, layout algebra, hit testing, `.dui` scene parsing (**zero platform dependencies**) | [Builder](builder.md) · [Node](node.md) · [Layout](layout.md) · [Scene](scene.md) |
| `deer-gpu` | GPU HAL, draw list, theme, text engine, CPU reference backend | [Drawing & theme](draw.md) · [Text engine](text.md) |
| `deer-vk` | The Vulkan backend (self-declared symbols + runtime dynamic loading; no SDK needed) | See the source docs of `crates/deer-vk` in the repo |
| `deer-window` | Window + event loop (`winit`, the only third-party dependency; the `window` feature) | [Window layer](window.md) |

## The prelude at a glance

`use deer_gui::prelude::*;` imports these (all taken from real code; as versions evolve, the source is authoritative):

| Category | Types / functions |
|---|---|
| Rendering entry points | `DefaultRenderer`, `build_draw_list`, `CpuRenderer`, `Framebuffer` |
| Draw types | `Color`, `DrawCmd`, `DrawList`, `Extent`, `RectI`, `Theme` |
| Text | `GlyphAtlas`, `GlyphImage`, `GlyphKey`, `FontMeasure`, `Rasterizer`, `GlyphPlacement`, `TextEngine` |
| Authoring | `Builder`, `L` |
| Layout | `ApproxMeasure`, `Measure`, `TextStyle`, `hit_test`, `layout`, `measure_tree` |
| Nodes | `Align`, `Kind`, `Node`, `Rect`, `Size` |
| Scenes | `SceneError`, `encode_scene`, `parse_scene` |

Not in the prelude but commonly used: `deer_gui::{render_tree_to_png, render_tree_to_rgba, layout_tree, interaction, input_script, testing, window}`.

## Feature flags

| Feature | What it brings in | When to enable |
|---|---|---|
| `window` | `deer_window` (winit) + the windowed rendering path | When you need a real window; offscreen rendering doesn't need it |
| `testing` | `deer_gui::testing` (the testkit) | When writing UI tests; zero cost in production builds |

## Reading path

- Newcomers: follow the [step-by-step tutorial](../getting_started/step_by_step/index.md), and come back to look up APIs as you encounter them;
- Looking up usage: every API page uniformly contains **What it does → Parameters & return values → Example → Notes**, with links to related tutorials;
- Behavior details: [layout invariants](../advanced/invariants.md) and [known pitfalls](../advanced/pitfalls.md).
