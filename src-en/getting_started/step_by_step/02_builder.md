# Step 2: Building a UI Tree with the Builder

## Goal

Master the three mounting styles of `Builder` (leaf, leaf with parameters, nested containers), understand what the returned **id** is for, and how ids stay deterministic.

## Steps

1. `Builder::new(kind, id)` creates the root node; `.padding()` / `.gap()` / `.size()` chain layout parameters onto the **root node**.
2. Use `app.text("…")` / `app.button("…")` / `app.field("…")` to append leaf widgets — the return value is that node's **id** (keep it for event handling).
3. When you need to modify parameters in place, use the `_opts` variants: `app.text_opts("…", |n| n.layout.wrap = true)`.
4. Use `container` / `container_opts` + a closure to nest containers; every node `push`ed inside the closure hangs under that container.
5. `app.build()` **clones** the tree out for layout / rendering — the `Builder` itself remains and can keep being modified.

## Complete example

```rust
use deer_gui::prelude::*;
use deer_gui::render_tree_to_png;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut app = Builder::new(Kind::Column, "app").padding(12.0).gap(8.0);

    // Leaf widget: returns an id (for event association, not stored in the tree — the tree is pure data)
    let ok_id = app.text("Ready?");

    // Leaf with parameters: modify the Node in place (here, disabling a button)
    let cancel_id = app.button_opts("Cancel", |b| {
        b.props.disabled = true;
    });

    // Container + closure-style nesting: calls inside the closure attach to this Row
    app.container(Kind::Row, "actions", |r| {
        r.button("OK");
        r.button("Let me think");
    });

    let tree = app.build();
    std::fs::write("builder.png", render_tree_to_png(&tree, 320, 180, Theme::default())?)?;

    println!("OK button id = {ok_id}, cancel button id = {cancel_id}");
    println!("root node id = {}", app.root_id());
    Ok(())
}
```

```sh
cargo run
```

## Key rules (learned the hard way — don't loop back into them)

- **Ids are deterministic**: when unnamed, `IdGen` counts per kind and generates ids like `text_1` / `button_1`;
  explicitly named nodes "reserve their number", and automatic ids never collide with them. Both authoring paths
  (Builder / scene file) share the same rule — otherwise the two trees would no longer be structurally equal.
- **Ids drift with the tree's structure**: automatic ids depend on "which same-kind node appears in which order". If a
  node's content changes every frame and you need to locate it by id (e.g. a script's `move @count`) — give it an
  **explicit id** (via `Node` chained construction or the id parameter of `container_opts`).
- **`Builder::new().padding()` only affects the root node**. To set layout parameters on a nested container, use
  `container_opts(kind, id, L::new().pad(8.0).to_props(), |…| …)`.
- **Set parameters first, assign the id last** is what the library does internally; but if you build directly with
  `Node::with_props` chaining, getting the order wrong will overwrite the whole id block (a pitfall recorded in the
  source comments).

Need stronger layout control (sizes, alignment, grow)? That's the next step.

## APIs used in this step

| API | Purpose | Detailed docs |
|---|---|---|
| `Builder::text` / `button` / `field` | Append a leaf, return its id | [Imperative construction](../../api/builder.md) |
| `Builder::text_opts` / `button_opts` | Leaf + in-place parameter changes | [Imperative construction](../../api/builder.md) |
| `Builder::container` / `container_opts` | Container + closure nesting | [Imperative construction](../../api/builder.md) |
| `Builder::build` | Clone out a `Node` tree | [Node data model](../../api/node.md) |
| `IdGen` | Deterministic id generation rules | [Node data model](../../api/node.md) |

## Next step

[Step 3: Layout Parameters and Alignment](03_layout_props.md) — make children actually line up the way you want.
