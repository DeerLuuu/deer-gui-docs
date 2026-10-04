# Input Script Syntax

**Module**: `deer_gui::input_script`

An input script writes a sequence of input events as text for **deterministic replay**: the window examples (`counter`, `interactive_form`) and the testkit (`Harness::run_script`) share the same parser — the script syntax has a single definition, so the "works in the example, different in the tests" fork can never happen.

Environment variable: `DEER_INPUT_SCRIPT` (window examples read their default script from it; examples may define their own variable, e.g. `DEER_COUNTER_SCRIPT`, which takes precedence).

## Syntax rules

- Statements are separated by `;` (or newlines); **empty statements are ignored** (`;;` or a trailing extra `;` are not errors);
- `#` to end of line is a comment;
- Syntax errors (unknown statement, unknown key name, non-numeric coordinates…) ⇒ `Err(String)`, **with the statement index and original text** —
  deliberately no "skip statements it doesn't understand": the script is part of the acceptance criteria, and silently skipping means the criteria quietly stop holding.

## Statement table

| Syntax | Meaning |
|---|---|
| `move:X,Y` | Move the pointer to `(X, Y)` (f32; edge values and negatives are both allowed) |
| `down:left` / `down:right` / `down:middle` | Pointer press (coordinates = **the most recent `move`**; if there was none, `(0,0)`) |
| `up:left` (same three buttons) | Pointer release (same coordinate rule as `down`) |
| `key:Tab` | `KeyDown`. Also writable: `Escape` / `Enter` / `Backspace` / `Left` / `Right` / `Up` / `Down` / `PageUp` / `PageDown` / `Home` / `End` / `Other` / `Char(a)`. **A `*` after the key name (`key:Tab*`) = system key repeat** (`repeat: true`, T3.6); without `*` = a normal press (`repeat: false`) |
| `shift+key:Tab` (or `key:shift+Tab`) | With modifiers: `ctrl+` / `alt+` / `sup+` in the same slot, stacked with `+`; the prefix may sit on the verb side or the key name side |
| `text:hi` | A run of text input (verbatim, spaces and Chinese included; **appends**, doesn't overwrite) |
| `focus:off` / `focus:on` | Window lost focus / regained focus (`FocusChanged`) |
| `wheel:0,3` | A wheel event (`dy` drives the vertical scrolling of the nearest scrollable ancestor of `hover` and seeds inertia; see [Step 8](../getting_started/step_by_step/08_scroll_wrap.md); `dx` is ignored this round) |

## API

| Name | Signature | Notes |
|---|---|---|
| `parse_script` | `(src: &str) -> Result<Vec<InputEvent>, String>` | Script → event sequence |
| `ENV_VAR` | `&str` = `"DEER_INPUT_SCRIPT"` | The environment variable name constant |
| `DEFAULT_SCRIPT` | `"move:40,20;down:left;up:left;key:Tab;text:hi"` | The demo default script (every step has an assertable effect) |

The pure-logic entry point for replaying to a final state (script → final state) also lives in this module: feed the events one by one to
[`interaction::handle`](../api/interaction.md) — the window layer and the tests share this one chain.

## Example

```rust
use deer_gui::input_script::parse_script;
use deer_gui::interaction::{InputEvent, Key, PointerButton};

let evs = parse_script("move:10,20; down:left; up:left; key:Tab; text:hi").unwrap();
assert_eq!(evs.len(), 5);
assert_eq!(evs[0], InputEvent::PointerMoved { x: 10.0, y: 20.0 });
assert_eq!(
    evs[3],
    InputEvent::KeyDown { key: Key::Tab, mods: Default::default(), repeat: false }
);
assert_eq!(evs[4], InputEvent::TextInput { text: "hi".to_string() });
```

```sh
# counter example: built-in script replay (expected final state; exits by itself; exit code 0 = all assertions pass)
cmd /c "set DEER_COUNTER_SCRIPT=@builtin&& cargo run -q -p deer-gui --features window --example counter"
```

## Notes

- **Why `move:` must write coordinates explicitly**: `down`/`up` coordinates come from "the most recent `move`" —
  exactly the window layer's behavior (winit's `MouseInput` only carries the button; coordinates are booked by `CursorMoved`).
  The script must be self-sufficient: "where the pointer is now" cannot be implicit state outside the script;
- **Scripts should go through environment variables rather than command-line arguments** (measured): long arguments with spaces/semicolons/`@` get mangled in different shells,
  and the parser may receive a different but **valid** script — silently testing nothing;
- **`@id` lookup is not a library-level syntax**: the testkit's `Harness::run_script` and some examples extend
  `move @id` (coordinates from that node's center, computed by layout, never hardcoded); the library-level `parse_script` only accepts `move:X,Y`;
- Under Windows `cmd`, `set X=1 && …` produces a value with a trailing space (`"1 "`): the examples' gate checks all `trim()` before comparing;
  do the same in your own gate checks (see [known pitfalls](../advanced/pitfalls.md)).
