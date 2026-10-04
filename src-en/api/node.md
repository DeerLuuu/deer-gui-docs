# The Node Data Model (Node / Kind / Size / Align)

**Module**: `deer-core::node` (formerly `deer-layout::node`, 2026-10 layered reorganization)

## What it does

The node tree is deer-gui's **single source of truth**: both authoring paths ([Builder](builder.md) / [scene files](scene.md)) produce it, and layout, hit testing, and rendering all consume only it.

Three design decisions:

1. **The tree is pure data**: no functions/callbacks; events are associated by id (see the [interaction layer](interaction.md));
2. **Deterministic ids**: `IdGen` counts per kind and generates `kind_N`; explicit names "reserve" their number, so auto ids never collide;
3. **Both paths share the id rules**: otherwise the two trees wouldn't be structurally equal (`Node::structurally_eq`, the core invariant).

## Types and fields

### `Kind` (node type)

| Variant | Role | `is_container()` |
|---|---|---|
| `Column` | Vertical container | ✅ |
| `Row` | Horizontal container | ✅ |
| `Text` | Plain text | ❌ |
| `Button` | Button | ❌ |
| `Field` | Input field (the baseline of the text-editing family) | ❌ |
| `Segmented` | Segmented selection group: mutually exclusive single select, children = segments, a click emits `SelectionChanged` | ✅ |
| `ChipGroup` | Chip group: multi-select, each chip toggles independently, emits `ChipToggled` | ✅ |
| `TabBar` | Tab bar: single-select tabs, emits `TabChanged { index }`; switching content is the App's job | ✅ |
| `NumberField` | Number input field: parsed only on commit (blur/`Enter`), emits `NumberChanged` | ❌ |
| `ScrubNum` | Scrubbing number: hold and drag left/right to change the value, continuously emits `NumberChanged` | ❌ |
| `Switch` | Switch: click/`Enter`/`Space` toggles, emits `Toggled { id, on }` | ❌ |
| `ColorField` | Color input field: enter `#RRGGBB` + swatch preview, commit emits `ColorChanged` | ❌ |

Helpers: `Kind::as_str()` (`"column"` etc., same names as in scene files), `Kind::parse(&str) -> Option<Kind>`;
predicates `is_horizontal()` (`Row` and the three selection-family groups), `is_selection_group()`, `is_value_field()` (Field/NumberField/ColorField).

### `Node`

| Field | Type | Notes |
|---|---|---|
| `kind` | `Kind` | Node type |
| `id` | `String` | Deterministic id |
| `layout` | `LayoutProps` | Layout props (see below) |
| `props` | `NodeProps` | `{ label: Option<String>, disabled: bool, extra: BTreeMap<String, Option<String>> }` (`extra` = unknown properties preserved as-is; editors don't edit them directly) |
| `children` | `Vec<Node>` | Only containers should have children |

| Method | Notes |
|---|---|
| `Node::new(kind, id)` | Constructor |
| `.with_layout(l)` / `.with_props(p)` / `.with_id(id)` / `.with_label(label)` | Chained construction (**set props first, id last** — see the Builder's Notes) |
| `.disabled()` | Sets `props.disabled = true` (the entire subtree ignores input) |
| `.push(child)` | Chained child append |
| `.is_container()` / `.is_scroll_container()` / `.wraps_text()` | Predicates (scroll = `scroll && Column`; wrap = `wrap && Text`) |
| `.walk(&mut f, depth)` | Pre-order traversal |
| `.structurally_eq(&other)` | Structural equality (kind, id, props, layout, children compared level by level) |

### `LayoutProps`

| Field | Type | Default | Notes |
|---|---|---|---|
| `width` / `height` | `Option<Size>` | `None` | Explicit size; `Size::Px(f32)` or `Size::Pct(f32)` (resolved against the **parent content box**) |
| `padding` | `f32` | `0.0` | Padding on all four sides |
| `gap` | `f32` | `0.0` | Spacing between children |
| `main_axis` / `cross_axis` | `Option<Align>` | `None` (= `Start`) | Alignment; `Stretch` fills |
| `grow` | `f32` | `0.0` | Weight for distributing leftover main-axis space |
| `scroll` | `bool` | `false` | **Vertical** scroll container (meaningful only on `Column`; ignored on `Row`) |
| `wrap` | `bool` | `false` | Wraps text at width (the wrap width = the node's own **pixel** width) |
| `position` | `Option<Pos>` | `None` | Out-of-flow positioning (L1 `Offset` / L4 `Anchors`); once set, the node leaves in-flow layout |
| `cross_self` | `Option<Align>` | `None` | Per-child cross-axis alignment (L2), overrides the parent container's `cross_axis` |
| `min_w` / `max_w` / `min_h` / `max_h` | `Option<Size>` | `None` | Min/max sizes (L3); `min > max` ⇒ min wins |

### `Pos` (out-of-flow positioning)

The value of `LayoutProps.position`; both variants share the same out-of-flow predicate `Node::is_positioned()`:

- `Pos::Offset { x, y: i32 }` — pixel offsets relative to the parent container's **content-box** origin, may be negative;
- `Pos::Anchors { l, t, r, b: Option<f32>, ox, oy: i32 }` — **anchors on four edges**: `l/t/r/b` are anchor ratios of the parent content box (0.0 = left/top edge, 1.0 = right/bottom edge, `None` = no anchor on that edge); `ox/oy` are inset-style pixel corrections (added on the start edge, subtracted on the end edge). If both sides of one axis have anchors ⇒ that axis's size is derived from the anchor pair (explicit w/h don't participate; min/max clamp as usual); **when the parent box resizes, the anchored edges follow** — this is the whole point of this variant.

Companions: `Pos::parse(s)` / `Pos::to_attr()` are inverse to each other and to `.dui` attribute values (scene-side and command-side share the same syntax).

### `Align` / `Rect`

`Align::{Start, Center, End, Stretch}` (`Align::parse` accepts the lowercase names);
`Rect { x, y, w, h: f32 }`, `Rect::new(x, y, w, h)` — rectangles in the geometry table are **always rounded to integer pixels** (invariant I-4).

### `IdGen`

The deterministic id generator: `next(kind) -> String` generates `kind_N` and skips numbers already claimed by explicit ids; `reserve(id)` registers
an explicit id (and if it looks like `kind_N`, advances the corresponding counter). The Builder and scene parsing share the same instance rules.

## Example

```rust
use deer_gui::prelude::*;

// Chained construction (common in scene-file examples and tests; Builder is more ergonomic day-to-day)
let tree = Node::new(Kind::Column, "app")
    .with_layout(L::new().pad(8.0).gap(4.0).to_props())
    .push(Node::new(Kind::Text, "").with_label("你好"))
    .push(Node::new(Kind::Button, "ok").with_label("好").disabled());

assert!(tree.children[0].wraps_text() == false);
```

## Notes

- `Size::Pct` is only resolved in the **arrange phase** (it needs the parent content box); the measure phase doesn't accept it — only an explicit **pixel** size overrides the intrinsic size;
- `scroll` / `wrap` are opt-in switches, default `false`; a wrong container type is **ignored** (`scroll` on a `Row`),
  and only the [scene file](scene.md) path errors outright on "a switch attribute given a value";
- `disabled` affects the **entire subtree**: hit testing, focus, and text input all skip it (see the [interaction layer](interaction.md));
- Zero-size nodes still stay in the focus sequence (`focusables` depends only on the tree) — deliberately introducing no second geometric truth;
- `Node` also has a `comments: Vec<String>` field (the `#` comment lines of `.dui`), which does **not** participate in `structurally_eq` (comments don't affect layout/hit testing/rendering, otherwise the "both authoring paths are structurally equal" invariant would break);
- The tests for the core invariants (`Node::structurally_eq` etc.) and the L1–L4 layout algebra live under `deer-core/tests/` (`layout_invariants.rs`, `l1_position.rs` … `l4_anchors.rs`).

Related tutorials: [Step 2](../getting_started/step_by_step/02_builder.md), [Step 3](../getting_started/step_by_step/03_layout_props.md).
