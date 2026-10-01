# The Interaction Layer (UiState / handle / hit testing)

**Module**: `deer_gui::interaction`

## What it does

A **pure-logic** interaction core: hit testing (including clipping and disabled state), hover/press/click/focus/text-input state machines. No window, no GPU — input is a value, output is a value, so the entire interaction chain can be covered by unit tests in an environment without winit / without Vulkan.

Three entry functions:

| Function | Signature | Notes |
|---|---|---|
| `handle` | `(state: &mut UiState, root: &Node, geo: &Geometry, clip: ClipSnapshot, ev: &InputEvent) -> Vec<UiEvent>` | **The single entry point**: feed an event, update state, produce "what happened" |
| `hit` | `(root, geo, clip: ClipSnapshot, x, y) -> Option<&Node>` | Two extra checks on top of [`hit_test`](layout.md): **clipping** and **disabled**; clicking on a disabled subtree or a clipped-away point ⇒ no hit, **no fallback** to ancestors |
| `focusables` | `(root: &Node) -> Vec<String>` | Focusable nodes (Button/Field, not inside a disabled subtree) in **tree order** (drives the `Tab` loop; depends only on the tree, not on geometry) |

## `InputEvent` (input events)

| Variant | Fields |
|---|---|
| `PointerMoved` | `x, y: f32` |
| `PointerDown` / `PointerUp` | `button: PointerButton, x, y` |
| `Wheel` | `dx, dy: f32` |
| `KeyDown` / `KeyUp` | `key: Key, mods: Mods` |
| `TextInput` | `text: String` |
| `FocusChanged` | `focused: bool` |

Companions: `PointerButton::{Left, Right, Middle}`; `Mods { shift, ctrl, alt, sup }`;
`Key::{Tab, Escape, Enter, Backspace, Left, Right, Up, Down, Char(char), Other}` (**physical keys**, no text semantics — text always goes through `TextInput`). With the `window` feature on, these types are re-exported directly from `deer-window`; otherwise byte-identical local mirrors are used — both paths have identical signatures and semantics.

## `UiState` (the single source of truth for state)

| Field | Type | Notes |
|---|---|---|
| `hover` | `Option<String>` | The node under the pointer |
| `focus` | `Option<String>` | Keyboard focus (`Tab` changes it, `Escape` clears it) |
| `pressed` | `Option<String>` | The node pressed by the left button |
| `texts` | `BTreeMap<String, String>` | Input field text buffers (absent from the map = empty string) |
| `carets` | `BTreeMap<String, usize>` | Input caret (id → position, measured in **characters**, not bytes; absent from the map = end of text; a purely additive field) |
| `scroll` | `ScrollState` | Scroll state (offsets + caps, see below) |

`same_visual(&other)`: whether the three visual fields (hover/focus/pressed) are completely identical —
cases like `PointerDown`, which changes `pressed` without emitting an event, rely on it to decide whether a redraw is needed.

### `ScrollState`

| Method | Notes |
|---|---|
| `set_metrics(&ScrollMetrics)` | **Must be called every frame**: feeds in the caps produced by layout and clamps the old offsets to the new caps (viewport/content changes leave no stale out-of-range offsets) |
| `offset_of(id) -> i32` / `max_of(id) -> i32` | Queries |
| `scroll_to(id, v) -> Option<i32>` / `scroll_by(id, delta) -> Option<i32>` | Programmatic scrolling (returns the new value after clamping; the target isn't a scroll container ⇒ `None`) |

## `UiEvent` (what happened)

| Variant | Meaning |
|---|---|
| `HoverChanged(Option<String>)` | Hover changed |
| `FocusChanged(Option<String>)` | Focus changed |
| `Clicked(String)` | A click completed (release point == press point; `Enter` activation counts too) |
| `TextChanged { id, value }` | Input field content changed (inserted at the caret / Backspace deletes the Unicode character before the caret) |
| `Scrolled { id, offset }` | Scroll offset changed (the clamped integer value; scrolling past top/bottom emits nothing) |

**An event = state changed = a redraw is needed** (the window layer's dirty convention).
The wheel step is `WHEEL_STEP_PX = 40` (≈ two lines of text; `dy < 0` ⇒ content moves up ⇒ the offset grows).

## `ClipSnapshot` (clip snapshot)

Each node's **effective clip** (nested `PushClip`s already intersected):

| Method | Notes |
|---|---|
| `from_draw_list(&DrawList, &Node, &Geometry)` | Derived from the draw list (binds the k-th `NodeHint` to the k-th node with geometry in pre-order; double-checked by length + fingerprint; any misalignment fails the assertion) |
| `unclipped()` | Nothing is clipped |
| `with_node_clip(id, Option<RectI>)` | Manual registration (for tests) |
| `allows(id, x, y) -> bool` | Whether the point escapes clipping; **unknown ids pass** (fail-open; tests must assert `is_known` first) |
| `is_known(id)` / `clip_of(id)` | Queries |

## `handle` event → effect table

| Event | Effect |
|---|---|
| `PointerMoved` | Syncs `hover` (emits `HoverChanged` only when it changed) |
| `PointerDown { Left }` | Syncs `hover`; a hit focusable widget ⇒ focus it; records `pressed` |
| `PointerUp { Left }` | Release point == press point ⇒ `Clicked`; clears `pressed` regardless |
| `KeyDown { Tab }` | Cycles focus in tree order (`Shift` reverses); with a single focusable it stays put |
| `KeyDown { Escape }` | Clears focus |
| `KeyDown { Enter }` | Focus on an **enabled** button ⇒ `Clicked` |
| `KeyDown { Backspace }` | Focus is an **enabled** field ⇒ deletes the Unicode character **before the caret** — always on a char boundary, never splits a multi-byte character; the caret moves back one position |
| `TextInput` | Focus is an **enabled** field ⇒ **inserts at the caret** and advances it; an untouched caret sits at the end, so plain typing behaves exactly like before |
| `KeyDown { Left / Right }` | Focus is an **enabled** field ⇒ moves the caret (clamped to `[0, char_count]`); **emits no event** — `TextChanged` means "the value changed", and moving the caret doesn't |
| `FocusChanged { false }` | Window lost focus: clears `hover`/`pressed` (`focus`/`texts` untouched) |
| `Wheel { dy }` | Offsets the nearest scrollable ancestor of `hover` (including itself) by `-dy × 40`, clamped; emits `Scrolled` only on change |
| The rest (right/middle buttons, Up/Down arrow keys, `KeyUp`, key repeat…) | Not consumed at this stage (matching is **exhaustive**: adding an event variant becomes a compile error, never a silent ignore) |

## Example

The full closed loop is in [Step 7](../getting_started/step_by_step/07_interaction.md); it also runs without a window:

```sh
cargo test -p deer-gui --lib interaction   # unit tests for the whole interaction chain, no winit/Vulkan needed
```

```rust
use deer_gui::interaction::{self, ClipSnapshot, InputEvent, UiState};

let mut state = UiState::default();
let events = interaction::handle(
    &mut state, &tree, &geo,
    ClipSnapshot::unclipped(),
    &InputEvent::PointerMoved { x: 60.0, y: 30.0 },
);
assert!(matches!(events.first(), Some(_)) == (state.hover.is_some()));
```

## Notes

- Event coordinates are **physical pixels** with the window's top-left origin (the same convention as `WindowInfo::extent`; no DPI conversion);
- Hits **never fall back** to ancestors: clicking on a disabled subtree or a clipped-away point is simply "missed" — a fallback would require a second routing rule,
  conflicting with "`hit_test` is the single basis for input routing" (costs and discussion in the source module docs, "known limits");
- `ClipSnapshot`'s `allows` passes unknown ids (fail-open): **tests must assert `is_known(id)` first**,
  otherwise "clipped away, no hit" may just mean the id was missing from the snapshot;
- The window layer and test scripts share the same `handle` (script replay goes through the same entry point), so "the script passes" and
  "a human can click it" can never drift apart;
- The caret is measured in **characters**: `苹果x` is 3 chars / 7 bytes; byte-based indexing would split a multi-byte character in half;
- Nothing renders the caret yet, which is why moving it emits no event; once it gets rendered, a `UiEvent::CaretChanged` will be added and
  `carets` included in `same_visual`, following the `ScrollState` precedent — a deferred decision, registered as such.
