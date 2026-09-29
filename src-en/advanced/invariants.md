# Layout Invariants (I-1 to I-8)

The behavior of `layout()` is defined by eight invariants, **each backed by a corresponding test** (`crates/deer-layout/tests/layout_invariants.rs`). These eight are the layout engine's behavioral contract: when documentation and intuition conflict, the invariants win.

## At a glance

| # | Invariant | One-liner | Practical meaning |
|---|---|---|---|
| I-1 | **Pure function** | Never mutates the input tree; only returns a geometry table | To change layout, mutate the tree yourself and recompute; safe to reuse the same tree |
| I-2 | **Deterministic** | Same tree + same box ⇒ bit-identical output | No time, no randomness, no environment probing; snapshot tests are possible |
| I-3 | **Bottom-up** | Children's intrinsic sizes are computed first, then the parent container allocates | The intermediate quantities in `measure_tree` and `layout` agree |
| I-4 | **Pixel rounding** | All geometry is integer pixels | The types are `f32` but the values are always integers; no half-pixel fuzz |
| I-5 | **No window assumed** | The root box is supplied by the host; the root does not fill it | To make the root fill the window, give it an explicit size (or have the host size the box by content) |
| I-6 | **No overflow** | Results are clamped to the available space | An explicit size is merely "a request within the cap" |
| I-7 | **Assigned size ≠ available space** | The main-axis size assigned by the parent must be honored; percentages resolve against the parent's **content box** | Space assigned via `grow` is never silently dropped; `50%` ≠ "half of the parent's assigned space" |
| I-8 | **Main axis = sum(children), cross axis = max(children)** | Container intrinsic size follows direction-dependent semantics | A `Row`'s height is determined by its tallest child; a `Column`'s width by its widest child |

## The two most often misunderstood

### I-7: Assigned size vs available space

This is the explicit modeling of the **B-2 defect** from the deer-ui prototype era: the main-axis size a parent **assigns** to a child (the result of `grow`)
must be honored by the child; "available space" is only an upper bound. Conflate the two and the space assigned via `grow` gets silently dropped.

Likewise, **percentages resolve against the parent's content box** (the region inside the padding). Passing the wrong base is a silent error:
the layout still "has a value", just the wrong one — test `I-7` pins this specifically.

### I-5: The root does not fill

The box supplied by the host is **an upper bound, not a command**. The root's "assigned size" = its intrinsic size — unless the root has an explicit size of its own.
That's why the Step 3 example gives the root `.w(280.0).h(160.0)` while the canvas is 300×200 — the root occupies only 280×160.

## Interaction with scrolling / wrapping

- **Scroll containers** (`Column + scroll`): children's main axis is **not clamped to the viewport** (otherwise the premise "content is taller than the viewport"
  would defeat itself), and `grow` has no effect (no leftover space to distribute); the cross axis is still clamped to the content box;
- **Wrapped text** (`Text + wrap` + explicit pixel width): intrinsic height = actual line count × line height — the line count has a single definition
  (`Measure::wrap`), so layout reservation and render drawing never diverge.

## How to verify

```sh
cargo test -p deer-layout          # full layout invariant assertions (runs without a GPU)
cargo run -p deer-gui --example geometry   # visual example of layout and hit testing
```

When submitting a PR to the layout engine: each invariant's test is its acceptance criterion; a semantic change must first update the tests and explain
"which invariant changed and why", and update this page and the [layout engine API](../api/layout.md) in the same change.
