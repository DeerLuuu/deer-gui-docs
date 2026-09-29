# Step 9: Writing UI Tests with testkit

## Goal

Put the chain "build UI → inject input → run a frame → pixel/state assertions → CPU↔GPU comparison" into your tests —
no need to copy 600 lines of boilerplate; a dozen lines suffice, and you get **by default** pre-assertions, zero outside the diff region, and a reproducible command printed on failure.

> **Prerequisite**: testkit sits behind the `testing` feature (zero cost in production builds):
> write `features = ["testing"]` in your own project; this repository's test targets include it automatically.

## Steps

1. `Harness::new(tree, w, h, theme)` builds the UI (it automatically loads a system font for **real glyphs**;
   in a font-less environment use `Harness::without_font`, which goes through `ApproxMeasure`'s approximate metrics). The parameters accept
   a `Node` or a `Builder` directly.
2. Inject input with `tap(id)` / `send(&InputEvent)` / `run_script(src)` — every step returns a
   `Step` (whether state changed, which events were emitted).
3. `shoot()` / `shoot_named("…")` grabs offscreen CPU pixels (`Shot`) for pixel assertions.
4. For state assertions, use the ready-made helpers `assert_hover` / `assert_focus` / `assert_pressed` / `assert_text` etc. —
   each one has a "reverse self-check" test: feeding a wrong expectation must turn red.
5. Register a reproduction command with `set_repro`; on assertion failure the error message includes it.

## Complete example

```rust
use deer_gui::prelude::*;
use deer_gui::testing::{Harness, Repro};

fn main() -> Result<(), String> {
    // ① Build the UI: one button (the test subject), with pre-assertions and a repro command
    let mut h = Harness::without_font(
        Builder::new(Kind::Column, "app").gap(4.0),
        320, 200, Theme::default(),
    );
    h.set_case("button_click");
    h.set_repro(Repro::test("my-app", "testing", "my_test", "button_click", &[]));

    // ② Take a shot before the click
    let before = h.shoot_named("before click")?;

    // ③ Inject input: tap = move to the node's center + press + release (coordinates computed by layout, never hard-coded)
    let step = h.tap("button_1")?;
    assert!(step.changed, "clicking a button must change state");

    // ④ Take a shot after the click; assert the diff falls only inside the changed node's rect (must be 0 outside)
    let after = h.shoot_named("after click")?;
    after.assert_state_change_only(&before, "button_1")?;

    // ⑤ State assertion: hover rests on the button
    h.assert_hover(Some("button_1"))?;
    Ok(())
}
```

```sh
# Run the equivalent example in this repository (a runnable demo of the testing feature):
cargo run -q -p deer-gui --features testing --example testkit_demo
```

## Capability surface quick reference

| Capability | Entry point |
|---|---|
| Build the UI | `Harness::new` / `without_font` (accepts a `Node` or `Builder`) |
| Input injection | `send` (single event) / `tap(id)` / `run_script` (script, supports `move @id`) |
| One frame | `frame()` (**built-in pre-assertions**) → `Frame` (geometry, draw list, drawn text) |
| Offscreen pixels | `shoot` / `shoot_named` / `shoot_png` / `GpuProbe` (offscreen Vulkan) |
| Pixel assertions | `Shot::pixel`, `assert_bytes_eq`, `assert_state_change_only`, `assert_diff_only_inside`, `assert_no_diff_outside` |
| State assertions | `assert_hover` / `assert_focus` / `assert_pressed` / `assert_text` / `assert_state` / `assert_focus_order` |
| Draw-list assertions | `assert_counts` / `assert_drawn_text` / `assert_text_size` / `assert_clip_nodes` |
| CPU↔GPU comparison | `compare_cpu_gpu` → `ParityReport` (max channel diff / number of differing pixels) |
| Gates and self-evidence | `gate()` / `require_gate()` / `print_gate()` (environment-variable switches; values are `trim()`ed before comparing) |

## Criteria discipline (testkit never loosens a threshold)

- CPU↔GPU comparison has only two grades of rules: opaque content must be **byte-for-byte equal** (tolerance 0), translucent content at most 1 LSB —
  there is no "loosen" knob;
- Every assertion helper's failure message carries a **copyable repro command** and the key numbers;
- "An assertion that can never turn red" is not a guardrail — every helper has been fed a wrong expectation by a table-driven test.

## APIs used in this step

| API | Purpose | Detailed docs |
|---|---|---|
| `Harness` | The main test handle | [Testing interface](../../api/testing.md) |
| `tap` / `send` / `run_script` | Input injection | [Testing interface](../../api/testing.md) |
| `Shot` | Offscreen pixels and pixel assertions | [Testing interface](../../api/testing.md) |
| `Repro` | The reproducible command | [Testing interface](../../api/testing.md) |

## Next step

The tutorial has now been walked through end to end. From here:

- Need to look up an API? Go to the [API Reference](../../api/index.md);
- Want to understand the "why"? Read the [Architecture Overview](../../advanced/architecture.md) and [Known Pitfalls](../../advanced/pitfalls.md);
- Want to run more examples? See the [Examples Index](../../appendix/examples.md).
