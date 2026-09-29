# Scene Files (parse_scene / encode_scene)

**Module**: `deer_layout::scene`

## What it does

`.dui` scene files are deer-gui's declarative description format (similar in spirit to Godot's `.tscn`): a line-based syntax of indentation + section headers, producing trees **structurally equal** to the imperative [Builder](builder.md)'s.

Why "indentation + section headers" instead of JSON/TOML: the same family feel as `.tscn`; **zero dependencies** (a hard invariant of this repo); line-based parsing yields **line numbers**, so error messages are usable. **Safety**: pure parsing, executes nothing (scene files may come from data).

## Functions

| Function | Signature | Notes |
|---|---|---|
| `parse_scene` | `(src: &str, source: &str) -> Result<Node, SceneError>` | Text → tree; `source` is the name shown when an error occurs (usually the file name) |
| `encode_scene` | `(root: &Node) -> String` | Tree → text; `parse_scene(encode_scene(t))` is structurally equal to `t` (the round-trip invariant has a test) |

### `SceneError`

| Field | Type | Notes |
|---|---|---|
| `message` | `String` | The error description (includes the expected form) |
| `line` | `usize` | Line number (1-based) |
| `source` | `String` | The source name |

`Display` output looks like `ui.dui:5: indentation must be a multiple of 2, got 3`.

## Syntax

```text
# A `#` to end of line is a comment (a # inside quotes doesn't count; blank lines are ignored)
[column name=app pad=12 gap=8]
  [text label=标题]
  [row gap=8]
    [button label=确定]
    [button label=取消 disabled]
```

Rules:

- One node per line: `[type attr=value …]`; the type must be `column` / `row` / `text` / `button` / `field`;
- **Indentation must be a multiple of 2**; indentation depth encodes the parent-child relation;
- There must be exactly one root node; leaves cannot have children;
- Values containing spaces / quotes / `#` / `=` are wrapped in double quotes: `label="确 定"`.

### Attribute table

| Attribute | Value form | Corresponding field |
|---|---|---|
| `name` | string (optional → auto `kind_N`) | `Node.id` |
| `w` / `h` | number or percentage (`280` / `50%`) | `layout.width` / `layout.height` |
| `pad` / `gap` | number | `layout.padding` / `layout.gap` |
| `main` / `cross` | `start` / `center` / `end` / `stretch` | `main_axis` / `cross_axis` |
| `grow` | number | `layout.grow` |
| `scroll` / `wrap` | **bare attribute** (present means true; **error if given a value**) | `layout.scroll` / `layout.wrap` |
| `label` | string | `props.label` |
| `disabled` | **bare attribute** (error if given a value) | `props.disabled` |

## Example

```rust
use deer_gui::prelude::*;

let src = r#"
[column name=app pad=12 gap=8]  # inline comments work too
  [text label=标题]
  [row gap=8]
    [button label=确定]
"#;

let tree = parse_scene(src, "inline")?;
let back = encode_scene(&tree);
assert!(parse_scene(&back, "roundtrip")?.structurally_eq(&tree));
```

## Notes

- **Switch attributes error out when given a value**: `scroll=1` is not "treated as true", it's an `Err` —
  "written wrong but silently ineffective" is among the hardest bugs to track down, so the parser prefers to fail loudly (`disabled` follows the same rule: it used to silently treat any value as false);
- **Unknown attributes error**: the usable attributes are exactly the table above; unknown **types** error too;
- An explicit `name` gets reserved in `IdGen`, so auto ids never collide with it — the same rule as the Builder;
- Numeric attributes must parse as `f32`, otherwise an error (with the line number and original text);
- Equivalence with the Builder is pinned by a test (`t1_two_authoring_paths_produce_the_same_tree`);
  read the design constraints in `CONTRIBUTING.md` before changing the syntax.

Related tutorial: [Step 4](../getting_started/step_by_step/04_scene_file.md).
