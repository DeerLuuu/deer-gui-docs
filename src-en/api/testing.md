# The Testing Interface (testkit / Harness)

**Module**: `deer_gui::testing` (compiled under the `testing` feature or `cfg(test)`; zero cost in production builds)

## What it does

Turns this project's testing discipline into an API: **build the scene → inject input → one frame + precondition assertions → offscreen pixels → pixel/state/draw-list assertions → CPU↔GPU parity**. Writing a UI test drops from copying 600 lines of boilerplate to a dozen lines, and it **ships by default** with precondition assertions, gate self-attestation, out-of-range = 0, CPU/GPU comparison tolerances, and a repro command on failure. **No threshold is ever loosened.**

Every assertion helper has a "reverse self-check": table-driven tests feed each helper deliberately wrong expectations and assert that it **really returns `Err`** (with a copyable repro command in the error) — an assertion that can never turn red is not a guardrail.

## `Harness` (the main handle)

| Method | Notes |
|---|---|
| `new(tree, width, height, theme)` | Build the scene; accepts a `Node` or a `Builder` (`IntoTree`); loads the system font automatically for **real glyphs** |
| `without_font(…)` | The variant for font-less environments (uses `ApproxMeasure` approximate metrics) |
| `set_case(name)` / `set_repro(Repro)` | Name the case, register the repro command (printed on assertion failure) |
| `require_ids(&[&str])` | **Precondition assertion**: these ids must have geometry (prevents "the script taps into nothing") |
| `set_tree(tree)` / `tree()` | Replace/read the tree |
| `send(&InputEvent) -> Step` | Inject a single event (returns whether state changed + the event list) |
| `tap(id) -> Step` | `move` to the node's center + press + release (coordinates computed by **layout**, never hardcoded) |
| `move_to(id)` / `center_of(id)` | Pointer move / query the center point |
| `run_script(src) -> ScriptRun` | Run an [input script](../appendix/input_script.md) (supports `move @id`, coordinates taken from the node's center; no geometry ⇒ hard error) |
| `frame() -> Frame` | Compute one frame (**precondition assertions built in**); `Frame` provides geometry, the draw list, `rect_of(id)`, `drawn_texts()`, and more |
| `shoot()` / `shoot_named(label) -> Shot` | Offscreen CPU pixels (real glyphs) |
| `shoot_png()` / `shoot_png_file(path)` | Direct PNG output |
| `compare_cpu_gpu()` | Offscreen Vulkan vs CPU parity (via `GpuProbe` → `ParityReport`) |
| `state()` | The current `UiState` |

### State assertions

`assert_hover(Option<&str>)`, `assert_focus`, `assert_pressed`, `assert_text(id, want)`,
`assert_texts(&[(&str, &str)])`, `assert_state(&UiState)`, `assert_focus_order(&[&str])`,
`assert_focus_order_excludes(&[&str])`.

### Pixel assertions (`Shot`)

| Method | Notes |
|---|---|
| `pixel(x, y) -> Option<[u8; 4]>` | A single pixel (out of range yields `None`, not a panic) |
| `assert_bytes_eq(before)` | Two frames byte-equal ("not a single byte may change in unchanged regions") |
| `assert_state_change_only(before, primary_id)` | Diffs confined to the changed node's rectangle |
| `assert_diff_only_inside(before, primary)` | Diffs confined to a single rectangle |
| `assert_no_diff_outside(before, rects)` | Diffs outside the boxes must be 0 |
| `diff_split(before, rects)` | Diff decomposition (inside/outside pixel counts) |
| `write_png(path)` / `to_png()` | Dump to disk for debugging |

### Draw-list assertions (`Frame` / `Harness`)

`assert_counts(frame, DrawCounts)`, `assert_drawn_text(frame, id, want)`,
`assert_drawn_text_contains`, `assert_text_size(frame, id, want)`,
`assert_command_count`, `assert_node_hint_count`, `assert_clip_nodes`, `assert_clip_known`.

### Gates (env-var switches)

| Function | Notes |
|---|---|
| `gate(name) -> bool` | `name` is on when non-zero (**`trim()` before comparing**: `cmd`'s `set X=1 && …` folds the trailing space into the value) |
| `require_gate(name) -> bool` | Not enabled ⇒ prints "this is a skip, not a pass" and returns false |
| `print_gate(name)` / `print_gates(&[&str])` | Self-attesting prints (a gate's value must be visible; don't trust exit codes alone) |

## `ParityRule` (CPU↔GPU comparison rules; no "loosening" knob)

| Tier | Cap |
|---|---|
| `Opaque` (opaque content) | `BYTE_EXACT` = 0 |
| `Translucent` (translucent content) | `LSB_TOLERANCE` = 1 LSB |

`ParityRule::for_list(&DrawList)` / `for_theme(&Theme)` pick the tier automatically; `ParityReport::check()` reports
the max channel difference / count of differing pixels / the worst pixel.

## Example

```rust
use deer_gui::prelude::*;
use deer_gui::testing::{Harness, Repro};

let mut h = Harness::without_font(
    Builder::new(Kind::Column, "app").gap(4.0), 320, 200, Theme::default(),
);
h.set_case("plus_click");
h.set_repro(Repro::test("deer-gui", "testing", "my_test", "plus_click", &[]));

let before = h.shoot_named("点击前")?;
let step = h.tap("button_1")?;
assert!(step.changed, "点按钮必须改状态");
let after = h.shoot_named("点击后")?;
after.assert_state_change_only(&before, "button_1")?;
h.assert_hover(Some("button_1"))?;
```

Runnable example: `cargo run -q -p deer-gui --features testing --example testkit_demo`.
For a step-by-step walkthrough see [Step 9](../getting_started/step_by_step/09_testing.md).

## Notes

- The testkit uses only this workspace's crates and std, **no third-party dependencies**;
- To use it in a downstream project: add `features = ["testing"]` to your existing `deer-gui` dependency (no extra crate needed);
- `tap` / `run_script`'s `@id` lookup goes through layout: an id without geometry is a **hard error** (`Err`), never a silent tap into the void —
  that's precisely all its value over hand-written coordinates;
- The comparison thresholds are not adjustable: when you find yourself "needing to loosen one", suspect the implementation first, not the rule
  (the measured evidence behind the rules is in the source module docs and `FEATURES.md`).
