# Architecture Overview

## Layers

The workspace has **7 crates**, bottom-up L0–L4:

```text
crates/
├── deer-core/     L0 language-agnostic pure core: node tree (node), Builder, layout algebra (layout),
│                  .dui scene parsing (scene), property registry (registry), value parsing (values),
│                  draw commands (draw), errors (error)
│                  ── zero platform dependencies; fully assertable in CI without a GPU (former deer-layout has been merged in)
├── deer-text/     L1 text stack: font parsing, glyph rasterization, atlas, metrics + zero-dependency PNG encoder
│                  ── text capability has exactly one implementation, shared by the CPU/GPU backends
├── deer-gpu/      L1: GPU HAL traits (Backend/Device/Frame/Renderer), DrawList,
│                  CPU reference backend, interaction rendering helpers, BMP decoding (image.rs)
│                  ── adding a backend = implementing one trait
├── deer-window/   L1 display service (display.rs): winit event loop, InputEvent mapping, DPI, clipboard
│                  L3 host (host.rs): App/run/Waker/RedrawPolicy, multi-window (WindowId/WindowSpawner)
│                  ── the only place that introduces a third-party dependency (winit); it hands only the opaque
│                     RawWindowHandle to the rendering layer, so swapping window implementations
│                     never touches the rendering layer
├── deer-vk/       L2 Vulkan backend: hand-declared extern symbols + runtime dynamic loading; surface/swapchain/presentation
│                  ── no Vulkan SDK needed (links only kernel32; vulkan-1.dll loaded at runtime)
└── deer-gui/      L4 facade: re-exports everything, testkit, input scripts (input_script), convenient offscreen-rendering entry points
                   ── see the [API overview](../api/index.md)
```

Two additions:

- **The interaction layer (`deer_gui::interaction`) belongs to the L2 framework**: hit testing / state machines / `UiEvent` are framework logic, not part of `deer-core` — it lives in `deer-gui`, but it is pure logic (it never touches windows or the GPU) and can be unit-tested in a windowless environment;
- **`deer-log` is a cross-cutting logging facade**: zero-dependency, hand-written (~200 lines, no `log`/`tracing`), with levels + per-target filtering + stderr output, fully silent by default, shared across the whole workspace.

## Data flow (the closed loop of one frame)

```text
  Builder (imperative) ─┐
                        ├─→ Node tree ─→ layout() → geometry table ─→ build_draw_list() → DrawList ─→ backend
  parse_scene(.dui) ────┘               └─→ hit_test() → input routing
```

Key points:

- **Two authoring paths, one tree**: `Node::structurally_eq` is the core invariant, pinned by the test
  `t1_two_authoring_paths_produce_the_same_tree`;
- **Layout is a pure function**: it never mutates the tree, it is deterministic, and pixels are rounded (see [layout invariants](invariants.md));
- **Commands are "results", not "widgets"**: `DrawList` contains only rectangles/text/clipping; backends never need to know about widgets;
- **Input is a value**: `InputEvent` → `handle` → `UiEvent`; the entire interaction chain can be unit-tested in a windowless environment.

## Dependency discipline

| Crate | Third-party dependencies |
|---|---|
| `deer-core` | none |
| `deer-text` | none |
| `deer-gpu` | none |
| `deer-window` | `winit 0.30` |
| `deer-vk` | none (Vulkan symbols hand-declared + `LoadLibraryW` runtime loading; no SDK needed) |
| `deer-log` | none (deliberately zero-dependency, no `log`/`tracing`) |
| `deer-gui` | none (`deer-window` is an optional dependency; brings in `winit` via it when the `window` feature is on) |

`winit` is the only registered exception ([`ROADMAP.md`](https://github.com/DeerLuuu/deer-gui/blob/master/ROADMAP.md) Q-1). **Any new dependency must first be registered there, with a justification.**

## Milestone status

Milestones M1–M7 and their acceptance criteria are in [`ROADMAP.md`](https://github.com/DeerLuuu/deer-gui/blob/master/ROADMAP.md);
"which features exist, how far they've gotten, and what's still missing" uses [`FEATURES.md`](https://github.com/DeerLuuu/deer-gui/blob/master/FEATURES.md) as the single source of truth — this documentation site also defers to it before assuming any feature is available.

## Further reading

- [Layout invariants (I-1 to I-8)](invariants.md): the layout engine's behavioral contract;
- [Known limits and common pitfalls](pitfalls.md): deliberate design decisions and past pitfalls;
- [`agent.md`](https://github.com/DeerLuuu/deer-gui/blob/master/agent.md) (repo discipline and the pitfall log);
- [`CONTRIBUTING.md`](https://github.com/DeerLuuu/deer-gui/blob/master/CONTRIBUTING.md) (English: rules, gates, command cheat sheet, design constraints).
