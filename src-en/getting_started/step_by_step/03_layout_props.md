# Step 3: Layout Parameters and Alignment

## Goal

Learn to express sizes (pixels / percentages), spacing, main-axis / cross-axis alignment and `grow` with `L` (a convenience constructor for `LayoutProps`), and understand the precedence "explicit size > parent assignment > intrinsic size".

## Steps

1. Build a container's layout parameters with `L::new().…` chaining and hand `.to_props()` to `container_opts`:
   - `w(px)` / `h(px)`: explicit sizes; for percentages use `Size::Pct(50.0)` (resolved against the **parent content box**);
   - `pad(px)`: padding on all four sides; `gap(px)`: spacing between children;
   - `main(Align)`: main-axis alignment (horizontal for `Row` / vertical for `Column`);
   - `cross(Align)`: cross-axis alignment; `Align::Stretch` fills the cross axis;
   - `grow(w)`: weight for distributing leftover main-axis space.
2. Remember the intrinsic-size semantics (I-8): a container's main axis = **sum(children)**, cross axis = **max(children)**.
3. `layout()` is a pure function: feed it a tree + root box, get back a geometry table — not satisfied? Change the parameters and compute again; the tree is never modified.

## Complete example

```rust
use deer_gui::prelude::*;

fn main() {
    // Top bar: fixed height 40, horizontally centered, child spacing 8
    let tree = Node::new(Kind::Column, "app")
        .with_layout(L::new().w(280.0).h(160.0).pad(8.0).gap(8.0).to_props())
        .push(
            Node::new(Kind::Row, "topbar")
                .with_layout(
                    L::new().h(40.0).gap(8.0).main(Align::Center).cross(Align::Center).to_props(),
                )
                .push(Node::new(Kind::Button, "").with_label("Left"))
                .push(Node::new(Kind::Button, "").with_label("Right")),
        )
        // grow = 1: consume the remaining vertical space
        .push(
            Node::new(Kind::Text, "content")
                .with_layout(L::new().grow(1.0).to_props())
                .with_label("Body area"),
        )
        // Bottom button: cross-axis stretch (fills the width)
        .push(
            Node::new(Kind::Button, "wide")
                .with_layout(L::new().cross(Align::Stretch).to_props())
                .with_label("Fill the whole row"),
        );

    let geo = layout(
        &tree,
        Rect::new(0.0, 0.0, 300.0, 200.0), // the root box is given by the host (I-5: the root doesn't fill; the explicit sizes above win)
        TextStyle::default(),
        &ApproxMeasure,
    );
    for (id, r) in &geo {
        println!("{id}: {r:?}");
    }
}
```

```sh
cargo run
```

## Precedence and boundaries

| Case | Result |
|---|---|
| Explicit pixel size present | It is **trusted** (but clamped to the available space, I-6) |
| Percentage only | Resolved against the **parent content box** (not "the size the parent assigned" — the silent error source of I-7) |
| Neither present | Intrinsic size is used (Button ≥ 28×22, Field ≥ 60×22; see the `metrics` constants) |
| `main_axis: Stretch` | Leftover main-axis space is **split evenly** among children |
| `cross_axis: Stretch` | The cross axis is filled directly |

> **The percentage trap**: the resolution basis of `50%` is the parent's **content box** (the area inside the
> padding). Reading it as "half of the space my parent assigned me" is a silent error that really happened —
> the layout still produces values, just wrong ones.

## APIs used in this step

| API | Purpose | Detailed docs |
|---|---|---|
| `L` | Convenience constructor for `LayoutProps` | [Imperative construction](../../api/builder.md) |
| `Size::Px` / `Size::Pct` | Pixel / percentage sizes | [Node data model](../../api/node.md) |
| `Align` | Main-axis / cross-axis alignment | [Node data model](../../api/node.md) |
| `layout()` | Tree → geometry table (pure function) | [Layout engine](../../api/layout.md) |
| `measure_tree` | Look at intrinsic sizes only | [Layout engine](../../api/layout.md) |

## Next step

Could the same tree be written as text instead of Rust? [Step 4: Describing a UI with a .dui Scene File](04_scene_file.md).
