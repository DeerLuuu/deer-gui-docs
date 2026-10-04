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
| Input and focus (hover / click / `Tab`/`Escape` focus / text input / input caret / pointer capture / script replay / event-driven redraws) | ✅ |
| Wheel-driven vertical scrolling, text wrapping to width | ✅ |
| Visible scrollbar (drag the thumb to change offset, click the track to jump) + inertial scrolling (`advance_inertia` wiring) | ✅ |
| Arrow-key navigation (`Up`/`Down` geometric-proximity focus movement), key scrolling (`PageUp`/`PageDown`/`Home`/`End`) | ✅ |
| Right-click passthrough (`PointerRight`), key repeat (`repeat: bool`), IME pre-edit | ✅ |
| M6 widget family first batch (`Segmented`/`ChipGroup`/`TabBar`/`NumberField`/`ScrubNum`/`Switch`/`ColorField`) | ✅ |
| Multi-window (`WindowId`/`WindowSpawner`, dynamic spawn, Windows only) | ✅ |
| Clipboard (Windows, `CF_UNICODETEXT` plain text, zero third-party dependencies) | ✅ |
| Image decoding (BMP → RGBA8; PNG decoding not yet done) | ✅ |
| DPI scale factor passthrough (passthrough only, no conversion) | ✅ |
| Logging (`deer-log` zero-dependency facade, `DEER_LOG` switch, fully silent by default) | ✅ |
| Docking panels dock, full widget family (`Icon`/`DropMenu`/`Dialog`/`Overlay`/`HoverTip`) | ⬜ Not implemented |
| DX12 / Metal backends, Linux / macOS window layer | ⬜ Not implemented |

Platform support: layout / CPU rasterization / PNG output / Vulkan offscreen work on every platform; **the window layer is currently Windows only** (Linux / macOS return an explicit "platform not supported" error, never silently).

## Dependencies

**Zero third-party dependencies except the window layer (`winit`, registered exception).** The workspace is now 7 crates:

| Crate | Role | Third-party dependencies |
|---|---|---|
| `deer-core` | L0 pure core: node tree, layout, scene parsing, hit testing, draw commands, property registry, value parsing | none |
| `deer-text` | L1 text stack: font parsing, glyph rasterization, atlas, metrics (includes a zero-dependency PNG encoder) | none |
| `deer-gpu` | L1: GPU HAL traits, `DrawList`, CPU reference backend, interaction rendering helpers, BMP decoding | none |
| `deer-window` | L1 display service (winit loop / `InputEvent` mapping / DPI / clipboard) + L3 host (`App`/`run`/multi-window) | `winit 0.30` |
| `deer-vk` | L2 Vulkan backend (dynamically loaded at runtime, no SDK needed) | none |
| `deer-log` | Cross-cutting logging facade (zero-dependency, ~200 hand-written lines, no `log`/`tracing`) | none |
| `deer-gui` | L4 facade: re-exports everything + interaction layer + input scripts + testkit | none (`deer-window` is an optional dependency; brings in `winit` via the `window` feature) |

`winit` is the only registered exception (recorded as Q-1 in [`ROADMAP.md`](https://github.com/DeerLuuu/deer-gui/blob/master/ROADMAP.md)).

## License

MIT — see [LICENSE](https://github.com/DeerLuuu/deer-gui/blob/master/LICENSE) at the repository root for the full text.

[`Builder`]: api/builder.md
