# Step 1: Environment Ready, First Render

## Goal

Without touching a window or the GPU, render a two-line UI tree **offscreen to a PNG file** and confirm that the whole "tree → layout → draw → pixels" pipeline works on your machine.

## Steps

1. Create a new Rust project (or just use an example from the repository):

   ```sh
   cargo new hello_deer
   cd hello_deer
   ```

2. Add deer-gui as a path dependency (see [Installation](../installation.md)):

   ```toml
   [dependencies]
   deer-gui = { path = "path/to/deer-gui/crates/deer-gui" }
   ```

3. Put the code from the "Complete example" below into `src/main.rs`, then `cargo run`.

## Complete example

```rust
use deer_gui::prelude::*;
use deer_gui::render_tree_to_png;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    // ① Build a tree with the imperative API: a vertical column holding a text and a row of two buttons
    let mut app = Builder::new(Kind::Column, "app").padding(12.0).gap(8.0);
    app.text("Title");
    app.container_opts(Kind::Row, "bar", L::new().gap(8.0).to_props(), |r| {
        r.button("OK");
        r.button("Cancel");
    });
    let tree = app.build();

    // ② Render straight to a PNG file in one call (320×200 pixels)
    let png = render_tree_to_png(&tree, 320, 200, Theme::default())?;
    std::fs::write("ui.png", png)?;

    // ③ While you're at it, print the layout geometry (very useful when debugging layout)
    let geo = deer_gui::layout_tree(&tree, 320, 200, Theme::default());
    for (id, rect) in &geo {
        println!("{id}: x={} y={} w={} h={}", rect.x, rect.y, rect.w, rect.h);
    }
    Ok(())
}
```

Run it:

```sh
cargo run
```

On success, `ui.png` appears in the current directory — a dark-background UI with a title and two buttons.

Don't want to write a file, but want the pixels directly? `render_tree_to_rgba(&tree, w, h, theme)` returns
`(width, height, RGBA8 bytes)` (row-major, no padding). For layout only, use
`deer_gui::layout_tree`.

You can run the equivalent example directly in the repository:

```sh
cargo run -p deer-gui --example render_to_png    # produces render_out/render_to_png.png
cargo run -p deer-gui --example geometry         # layout and hit testing, with self-check assertions
```

> **Note**: `render_tree_to_png` **does not load fonts**; the "text" it draws is monospaced placeholder blocks.
> This is the established behavior of the old entry point — real glyphs require the text-engine path in Step 5. On
> both paths, geometry, hierarchy and colors are real.

## APIs used in this step

| API | Purpose | Detailed docs |
|---|---|---|
| `Builder::new(kind, id)` | Create a root node | [Imperative construction](../../api/builder.md) |
| `render_tree_to_png` | Tree → PNG byte stream | [Facade crate](../../api/deer_gui.md) |
| `render_tree_to_rgba` | Tree → RGBA8 pixels | [Facade crate](../../api/deer_gui.md) |
| `layout_tree` | Compute only the geometry table | [Layout engine](../../api/layout.md) |
| `Theme::default()` | The default dark theme | [Drawing and themes](../../api/draw.md) |

## Next step

How was that tree built? Head to [Step 2: Building a UI Tree with the Builder](02_builder.md).
