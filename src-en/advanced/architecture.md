# Architecture Overview

## Layers

```text
crates/
├── deer-layout/   Language-agnostic core: Node tree, layout algebra, hit testing, .dui scene parsing
│                  ── zero platform dependencies; fully assertable in CI without a GPU
├── deer-gpu/      GPU HAL: Backend/Device/Swapchain/Frame traits, DrawList, CPU reference backend
│                  ── adding a backend = implementing one trait
├── deer-vk/       Vulkan backend: hand-declared extern symbols + runtime dynamic loading; surface/swapchain/presentation
│                  ── no Vulkan SDK needed (links only kernel32; vulkan-1.dll loaded at runtime)
└── deer-window/   Window layer: native window + event loop (winit)
                   ── the only place that introduces a third-party dependency; it hands only the opaque
                      RawWindowHandle to the rendering layer, so swapping window implementations
                      never touches the rendering layer
```

`deer-gui` is the **facade**: it re-exports everything, provides the interaction layer and the testkit, and offers convenient offscreen-rendering entry points
(see the [API overview](../api/index.md)).

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
| `deer-layout` | none |
| `deer-gpu` | none |
| `deer-vk` | none (Vulkan symbols hand-declared + `LoadLibraryW` runtime loading; no SDK needed) |
| `deer-gui` (without `window`) | none |
| `deer-window` / `deer-gui --features window` | `winit 0.30` |

`winit` is the only registered exception ([`ROADMAP.md`](https://github.com/DeerLuuu/deer-gui/blob/master/ROADMAP.md) Q-1). **Any new dependency must first be registered there, with a justification.**

## Milestone status

Milestones M1–M7 and their acceptance criteria are in [`ROADMAP.md`](https://github.com/DeerLuuu/deer-gui/blob/master/ROADMAP.md);
"which features exist, how far they've gotten, and what's still missing" uses [`FEATURES.md`](https://github.com/DeerLuuu/deer-gui/blob/master/FEATURES.md) as the single source of truth — this documentation site also defers to it before assuming any feature is available.

## Further reading

- [Layout invariants (I-1 to I-8)](invariants.md): the layout engine's behavioral contract;
- [Known limits and common pitfalls](pitfalls.md): deliberate design decisions and past pitfalls;
- [`agent.md`](https://github.com/DeerLuuu/deer-gui/blob/master/agent.md) (repo discipline and the pitfall log);
- [`CONTRIBUTING.md`](https://github.com/DeerLuuu/deer-gui/blob/master/CONTRIBUTING.md) (English: rules, gates, command cheat sheet, design constraints).
