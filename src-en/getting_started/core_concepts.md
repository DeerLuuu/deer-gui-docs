# Core Concepts: A Node Tree

Everything in deer-gui revolves around **a `Node` tree**. Understanding this section will make every subsequent tutorial and API page much easier to follow.

## Data flow

```text
  Builder (imperative, imgui-style feel) ─┐
                                          ├─→ Node tree ─→ layout() → geometry table ─→ build_draw_list() → DrawList ─→ backend
  parse_scene(.dui, .tscn-style)         ─┘               └─→ hit_test() → input routing
```

Division of labor along the chain:

| Stage | Who | Output |
|---|---|---|
| Describe the UI | [`Builder`](../api/builder.md) or [`parse_scene`](../api/scene.md) | [`Node` tree](../api/node.md) |
| Compute geometry | [`layout()`](../api/layout.md) (**pure function**) | `Geometry`: node id → `Rect` |
| Route input | [`hit_test`](../api/layout.md) / [interaction-layer `hit`](../api/interaction.md) | The hit node |
| Generate draw commands | [`build_draw_list`](../api/draw.md) | [`DrawList`](../api/draw.md) |
| Produce pixels / put them on screen | [CPU backend `CpuRenderer`](../api/draw.md) or [Vulkan window path](../api/window.md) | RGBA8 / swapchain |

## The 7 crates of the workspace

The whole chain is carried by a workspace, layered bottom-up: `deer-core` (L0, **everything from the former `deer-layout` has moved in** — node tree, layout algebra, scene parsing, hit testing, draw commands, property registry, value parsing; platform-independent with zero platform dependencies), `deer-text` (L1 text stack: font parsing, glyph rasterization, atlas, metrics), `deer-gpu` (L1: GPU HAL traits and the CPU reference backend), `deer-window` (L1 display service + L3 window host), `deer-vk` (L2 Vulkan backend), `deer-gui` (L4 facade). There is also a cross-cutting `deer-log` (zero-dependency logging facade). For the dependency discipline, see the [Architecture Overview](../advanced/architecture.md).

## Two authoring paths, one tree

```rust,ignore
// Path one: imperative Builder
let mut app = Builder::new(Kind::Column, "app").padding(12.0).gap(8.0);
app.text("Title");
let tree = app.build();
```

```text
# Path two: .dui scene file (structurally identical)
[column name=app pad=12 gap=8]
  [text label=Title]
```

Both paths produce **structurally equal** trees (`Node::structurally_eq`), pinned by the test
`t1_two_authoring_paths_produce_the_same_tree`. The key that guarantees equality is
**deterministic ids**: `IdGen` counts per kind and generates ids of the form `kind_N`; explicitly
named nodes "reserve their number", and both paths follow the same rule.

## The tree is pure data

`Node` contains no functions and no callbacks — three consequences worth remembering:

1. **Events are associated by id**. What happens after a button is clicked is decided by your code querying the state of the [interaction layer](../api/interaction.md) (`UiState`); there is no callback to register in the tree;
2. **The tree can be serialized freely**. The `.dui` text ↔ `Node` round-trip is structurally equal (`parse_scene(encode_scene(t)) == t`);
3. **Layout is a pure function**. `layout()` never mutates the input tree; it only returns a geometry table; the same input always yields the same output (no time, no randomness, no environment probing).

## Node kinds (Kind)

`Kind` currently has **12 variants**:

| Kind | Role | Can have children |
|---|---|---|
| `Column` | Vertical container (children stacked top to bottom) | ✅ |
| `Row` | Horizontal container (children laid out left to right) | ✅ |
| `Text` | Plain text | ❌ |
| `Button` | Button | ❌ |
| `Field` | Input field | ❌ |
| `Segmented` | Segmented selector (mutually exclusive single choice; segments are child buttons) | ✅ |
| `ChipGroup` | Chip group (multi-select toggles; chips are child nodes) | ✅ |
| `TabBar` | Tab bar (single-select tabs) | ✅ |
| `NumberField` | Numeric input field (parsed on commit) | ❌ |
| `ScrubNum` | Drag-to-adjust number (drag to change the value) | ❌ |
| `Switch` | Switch (toggled by click/`Enter`/`Space`) | ❌ |
| `ColorField` | Color input field (`#RRGGBB` + swatch preview) | ❌ |

The widget vocabulary comes from the validated prototype of `deer-ui`; the M6 widget family is still growing (`Icon`, `DropMenu`, `Dialog`, `Overlay`, `HoverTip` are not done yet; see [`FEATURES.md`](https://github.com/DeerLuuu/deer-gui/blob/master/FEATURES.md)).

## The eight invariants of the layout engine

The behavior of `layout()` is defined by eight invariants (each guarded by tests; see [Layout Invariants](../advanced/invariants.md) for details):

| # | Invariant | In one sentence |
|---|---|---|
| I-1 | Pure function | Never mutates the input tree; only returns a geometry table |
| I-2 | Determinism | Same input ⇒ bit-identical output |
| I-3 | Bottom-up | Children's intrinsic sizes are computed first, then parents distribute |
| I-4 | Integer pixels | All geometry is in whole pixels |
| I-5 | No assumption of owning a window | The root box is given by the host; the root does not fill the screen |
| I-6 | No overflow | Results are clamped to the available space |
| I-7 | Assigned size ≠ available space | The parent's assigned main-axis size must be trusted; percentages resolve against the parent's **content box** |
| I-8 | Main axis = sum(children), cross axis = max(children) | A container's intrinsic size depends on directional semantics |

Behavior that looks "counter-intuitive" is usually deliberate — the complete list and the real bugs behind it are in [Known Limits and Common Pitfalls](../advanced/pitfalls.md).

## Next step

When you're ready, continue with [Step-by-Step Tutorial · Step 1: Render Your First Image](step_by_step/01_first_render.md).
