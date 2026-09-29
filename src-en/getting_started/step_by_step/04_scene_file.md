# Step 4: Describing a UI with a .dui Scene File

## Goal

Learn the `.dui` scene file syntax (conceptually similar to Godot's `.tscn`), describe a tree **structurally equal** to the imperative API's in plain text, and understand how strict parsing is: a misspelled attribute is an error, not a silent no-op.

## Steps

1. Write a `ui.dui` file: one node per line, `[type attr=value …]`, **indentation must be a multiple of 2**, and indentation depth is the parent–child relationship.
2. Parse it into a `Node` with `parse_scene(text, "ui.dui")` — it returns a `Result`, and errors carry **line numbers**.
3. It's just as safe when the scene file comes from data: parsing is pure text processing and **executes nothing**.

## Complete example

`ui.dui`:

```text
# Everything from # to end of line is a comment (a # inside quotes doesn't count)
[column name=app pad=12 gap=8]
  [text label=Title]
  [row name=bar gap=8]
    [button label=OK]
    [button label=Cancel disabled]
```

`main.rs`:

```rust
use deer_gui::prelude::*;
use deer_gui::render_tree_to_png;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let src = std::fs::read_to_string("ui.dui")?;
    let tree = parse_scene(&src, "ui.dui")?; // Err carries the line number and source file name

    // The equivalent of the imperative path (the two trees are structurally equal):
    //   let mut app = Builder::new(Kind::Column, "app").padding(12.0).gap(8.0);
    //   app.text("Title");
    //   app.container_opts(Kind::Row, "bar", L::new().gap(8.0).to_props(), |r| {
    //       r.button("OK");
    //       r.button_opts("Cancel", |b| { b.props.disabled = true; });
    //   });

    std::fs::write("scene.png", render_tree_to_png(&tree, 320, 200, Theme::default())?)?;
    Ok(())
}
```

```sh
cargo run
```

## Attribute quick reference

| Attribute | Accepted values | Corresponding `LayoutProps` / `NodeProps` |
|---|---|---|
| `name` | string (optional → auto-generated `kind_N`) | `Node.id` |
| `w` / `h` | number or percentage (`280` / `50%`) | `width` / `height` |
| `pad` / `gap` | number | `padding` / `gap` |
| `main` / `cross` | `start` / `center` / `end` / `stretch` | `main_axis` / `cross_axis` |
| `grow` | number | `grow` |
| `scroll` | **bare attribute** (takes no value) | `scroll` (see Step 8) |
| `wrap` | **bare attribute** | `wrap` (see Step 8) |
| `label` | string (quote it if it contains spaces: `label="OK Cancel"`) | `props.label` |
| `disabled` | **bare attribute** | `props.disabled` |

## The three rules of strictness

1. **A switch attribute with a value is an error**: `scroll=1` isn't "taken as true" — it's an `Err`. "Written wrong but not taking effect" is one of the hardest bugs to track down, so the parser prefers to fail loudly.
2. **Unknown attributes are errors**: the list of usable attributes is exactly the table above; not one extra letter is allowed.
3. **There can only be one root node**; leaf nodes (`text` / `button` / `field`) cannot have children attached below them.

Need to serialize a tree back to text (building an editor, doing snapshot tests)? `encode_scene(&tree)` —
and `parse_scene(encode_scene(t))` is structurally equal to `t` (the round-trip invariant is pinned by a test).

## APIs used in this step

| API | Purpose | Detailed docs |
|---|---|---|
| `parse_scene` | `.dui` text → `Node` | [Scene files](../../api/scene.md) |
| `encode_scene` | `Node` → `.dui` text | [Scene files](../../api/scene.md) |
| `SceneError` | Parse errors with line numbers | [Scene files](../../api/scene.md) |

## Next step

[Step 5: Rendering Text with Real Fonts](05_text.md) — give your text real glyphs.
