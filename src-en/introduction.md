# Introduction

**deer-gui** is a Rust GUI runtime built from scratch — no web, no DOM, and no `wgpu` / `ash` / `vulkano` dependency.

At its core is **a node tree**: you describe the UI in either of two ways, the layout engine developed in this repository computes the geometry, and a pluggable rendering backend (CPU software rasterization or Vulkan) draws it.

- **Imperative API** ([`Builder`], an imgui-style feel);
- **Scene files** (`.dui`, conceptually similar to Godot's `.tscn`).

Both paths produce the **structurally identical** tree — this is the core invariant of the entire runtime.

> **Note**: The project is under active development. For "what features exist, how far along they are, and what's missing", the single source of truth is
> [`FEATURES.md`](https://github.com/DeerLuuu/deer-gui/blob/master/FEATURES.md) at the repository root.
> Read it before assuming any feature is available.

## Who this documentation is for

- If you want to build UIs with deer-gui: start with [Installation](getting_started/installation.md) and follow the [step-by-step tutorial](getting_started/step_by_step/index.md);
- If you want to look up an API: go straight to the [API Reference](api/index.md); every page has parameter tables and examples;
- If you want to understand "why it does things this way": read the [Architecture Overview](advanced/architecture.md) and [Known Pitfalls](advanced/pitfalls.md).

## Capability map of this runtime

| Capability | Status |
|---|---|
| Building node trees (imperative / `.dui` scene files) | ✅ |
| Layout computation (geometry table), hit testing | ✅ |
| Tree + geometry → draw list → **pixels** (CPU backend) | ✅ |
| Writing pixels to a PNG file | ✅ |
| **Real font glyphs** (zero-dependency TTF parsing + rasterization + atlas + real metrics) | ✅ |
| Rendering to a window / on screen (Vulkan, shapes + text) | ✅ requires the `window` feature |
| Input and focus (hover / click / `Tab` focus / text input / **input caret** / script replay / event-driven redraws) | ✅ |
| Wheel-driven vertical scrolling, text wrapping to width | ✅ |
| Docking panels / multi-window, right / middle mouse buttons, arrow-key navigation **between widgets**, IME pre-edit | ⬜ Not implemented |

Platform support: layout / CPU rasterization / PNG output / Vulkan offscreen work on every platform; **the window layer is currently Windows only** (Linux / macOS return an explicit "platform not supported" error, never silently).

## Dependencies

Except for the window layer, the whole workspace has **no third-party dependencies**:

| Crate | Third-party dependencies |
|---|---|
| `deer-layout` (node tree, layout, scene parsing) | none |
| `deer-gpu` (GPU HAL + CPU reference backend) | none |
| `deer-vk` (Vulkan backend, dynamically loaded at runtime) | none |
| `deer-gui` (facade, without `window`) | none |
| `deer-window`, `deer-gui --features window` | `winit 0.30` |

`winit` is the only registered exception (recorded as Q-1 in [`ROADMAP.md`](https://github.com/DeerLuuu/deer-gui/blob/master/ROADMAP.md)).

## License

MIT — see [LICENSE](https://github.com/DeerLuuu/deer-gui/blob/master/LICENSE) at the repository root for the full text.

[`Builder`]: api/builder.md
