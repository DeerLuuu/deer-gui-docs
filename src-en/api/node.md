# The Node Data Model (Node / Kind / Size / Align)

**Module**: `deer_layout::node`

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
| `Field` | Input field | ❌ |

Helpers: `Kind::as_str()` (`"column"` etc., same names as in scene files), `Kind::parse(&str) -> Option<Kind>`.

### `Node`

| Field | Type | Notes |
|---|---|---|
| `kind` | `Kind` | Node type |
| `id` | `String` | Deterministic id |
| `layout` | `LayoutProps` | Layout props (see below) |
| `props` | `NodeProps` | `{ label: Option<String>, disabled: bool }` |
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
- Zero-size nodes still stay in the focus sequence (`focusables` depends only on the tree) — deliberately introducing no second geometric truth.

Related tutorials: [Step 2](../getting_started/step_by_step/02_builder.md), [Step 3](../getting_started/step_by_step/03_layout_props.md).
