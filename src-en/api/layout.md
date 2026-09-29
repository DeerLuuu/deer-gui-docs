# The Layout Engine (layout / hit_test)

**Module**: `deer_layout::layout`

## What it does

A pure, deterministic, replayable layout engine: feed it a tree + a root box, and it returns a geometry table. Its behavior is defined by eight invariants (I-1 to I-8, each with a test — see [layout invariants](../advanced/invariants.md)). The hit test `hit_test` is the single basis for input routing.

Core semantics (details in [Step 3](../getting_started/step_by_step/03_layout_props.md)):

- Priority: **explicit size > parent-assigned size > intrinsic size**; explicit sizes are also clamped to the available space (I-6);
- Container intrinsic size: main axis = **sum(children)**, cross axis = **max(children)** (I-8);
- Percentages resolve against the **parent content box** (not "the space the parent assigned" — the source of I-7's silent error);
- The root box is **a cap, not a command**: the root doesn't fill it unless the root has an explicit size of its own (I-5).

## Functions and types

| Name | Signature highlights | Notes |
|---|---|---|
| `layout` | `(root: &Node, box_: Rect, style: TextStyle, m: &impl Measure) -> Geometry` | Arrange (no scrolling; equivalent to all offsets being 0) |
| `layout_with_scroll` | `+ (offsets: &ScrollOffsets) -> (Geometry, ScrollMetrics)` | Arrange + scroll: offsets participate in geometry (children as a whole shift by `-offset`), and each scroll container's `max_scroll` is returned |
| `measure_tree` | `(root, style, m) -> Intrinsics` (`HashMap<String, (f32, f32)>`) | Each node's intrinsic size under "unbounded constraints" (for debugging) |
| `hit_test` | `(root: &Node, geo: &Geometry, px: f32, py: f32) -> Option<&Node>` | Deepest hit wins; half-open interval `[x, x+w)`; does **not** check clipping or disabled state (that's the [interaction layer's `hit`](interaction.md)) |
| `wrap_greedy` | `(text, max_width, width_of: impl Fn(&str) -> f32) -> Vec<String>` | The only wrapping algorithm: splits words at spaces/tabs and greedily packs lines; overlong words are hard-cut per character; `max_width <= 0` means no wrapping |
| `Geometry` | `HashMap<String, Rect>` | id → integer-pixel rectangle (deterministic when consumed in tree order) |
| `TextStyle` | `{ font_size: f32, line_height: f32 }` | Defaults `13.0` / `18.0` |
| `metrics` | module constants | `BUTTON_PAD_X=10.0`, `BUTTON_MIN_W=28.0`, `BUTTON_MIN_H=22.0`, `FIELD_MIN_W=60.0`, `FIELD_H=22.0` |

### The `Measure` trait (text metrics interface)

| Method | Notes |
|---|---|
| `width(text, style) -> f32` | Single-line width |
| `height(text, style, max_width) -> f32` | Height (must equal `wrap().len() × line_height`) |
| `wrap(text, style, max_width) -> Vec<String>` | Wrap points; **the default implementation never wraps** (a conservative default: "don't pretend to do what you can't") |

Two built-in implementations:

| Implementation | Width | Use |
|---|---|---|
| `ApproxMeasure` | 0.6em per character (`ceil`) | Layout tests, font-less environments |
| [`FontMeasure`](text.md) | Real font advances | The real rendering path (shares one font size with layout) |

### Scroll types

| Type | Methods | Notes |
|---|---|---|
| `ScrollOffsets` (layout's **input**) | `with(id, px)` (chained), `set(id, px)`, `get(id) -> i32`, `ids()`, `iter()` | Unregistered ids ⇒ offset 0 (not "unknown") |
| `ScrollMetrics` (layout's **output**) | `max_of(id) -> i32`, `clamp(id, px) -> i32`, `ids()`, `iter()` | `max_scroll = max(0, content height − viewport height)`; unregistered ⇒ 0 (fail-closed: if you forget to feed the table, the wheel simply scrolls nothing instead of scrolling into an unbounded void) |

## Example

```rust
use deer_gui::prelude::*;

let tree = Builder::new(Kind::Column, "app").padding(8.0).gap(4.0);
// …fill in children…
let tree = tree.build();

// ① Layout: the root box is supplied by the host
let geo = layout(&tree, Rect::new(0.0, 0.0, 320.0, 200.0), TextStyle::default(), &ApproxMeasure);

// ② Hit testing: deepest hit wins
if let Some(node) = hit_test(&tree, &geo, 50.0, 30.0) {
    println!("点到了 {}", node.id);
}

// ③ Layout with scrolling (offsets are input, caps are output)
let offsets = ScrollOffsets::new().with("list", 40);
let (geo, metrics) = layout_with_scroll(
    &tree, Rect::new(0.0, 0.0, 320.0, 200.0), TextStyle::default(), &ApproxMeasure, &offsets,
);
println!("list 可滚 {}px", metrics.max_of("list"));
```

## Notes

- **Layout never mutates the tree** (I-1): to change layout props, mutate the tree yourself and recompute; the same input always yields the same output (I-2);
- All geometry is integer pixels (I-4), though the types remain `f32`;
- Inside a scroll container (`Column + scroll`): children's main axis is **not clamped to the viewport** (otherwise content would never overflow and could never scroll),
  and `grow` becomes inert; the cross axis is still clamped to the content box;
- Out-of-range offsets are **silently clamped** (scrolling stops at the boundary, never past it) — no errors are raised; this is deliberate;
- Wrapping only honors "an explicit pixel width + `wrap`": percentage widths can't be resolved at measure time ⇒ no wrapping (a test-pinned edge case);
- In the real rendering path, layout metrics and draw metrics must be **the same font size and the same implementation** (see [Step 5](../getting_started/step_by_step/05_text.md)).
