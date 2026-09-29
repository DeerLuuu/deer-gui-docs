# Step 7: Input, Clicks and Focus

## Goal

Connect the window layer's input events into the **interaction layer**: hit testing (including clipping and disabled subtrees), the hover / pressed / clicked state machine, the `Tab` focus loop, input-field text, and the "an event = a redraw is needed" contract.

## Steps

1. Compute the geometry first each frame (use `layout_with_scroll` if you need scrolling; see Step 8), and derive the clipping snapshot `ClipSnapshot::from_draw_list` from the draw list.
2. Maintain a `UiState` (the single source of truth for interaction state) and feed every `InputEvent` to `interaction::handle`.
3. `handle` returns a list of `UiEvent`s — **an event = state changed = redraw needed**; for cases like "no event emitted but `pressed` changed", fall back to the `UiState::same_visual` comparison.
4. Events are associated by **id**: `UiEvent::Clicked(id)` tells you who was clicked; there are no callbacks to register in the tree.
5. Input-field text lives in `state.texts` (id → content); a field not in the map is treated as an empty string.

## Complete example

Below is the minimal skeleton for wiring "tree + geometry + interaction" into the window callbacks (for the fully
runnable version, see `cargo run -p deer-gui --features window --example counter`):

```rust,ignore
use deer_gui::gpu::build_draw_list;
use deer_gui::interaction::{self, ClipSnapshot, UiEvent, UiState};
use deer_gui::prelude::*;

struct Counter { tree: Node, state: UiState }

impl Counter {
    /// One frame's closed loop: geometry → draw list → (hand to the renderer); input events are fed in elsewhere
    fn draw_list(&self, w: u32, h: u32, theme: &Theme) -> DrawList {
        let geo = layout(&self.tree, Rect::new(0.0, 0.0, w as f32, h as f32),
                         TextStyle { font_size: theme.font_size, line_height: theme.line_height },
                         &ApproxMeasure);
        build_draw_list(&self.tree, &geo, theme.clone(), &ApproxMeasure)
    }

    /// Feed one input: returns whether a redraw is needed
    fn feed(&mut self, geo: &Geometry, clip: ClipSnapshot, ev: &InputEvent) -> bool {
        let events = interaction::handle(&mut self.state, &self.tree, geo, clip, ev);
        for ev in events {
            if let UiEvent::Clicked(id) = ev {
                println!("clicked {id}");
            }
        }
        !events.is_empty()
    }
}
```

## `handle`'s event → effect table

| Event | Effect |
|---|---|
| `PointerMoved` | Syncs `hover` (emits `HoverChanged` only when it changed) |
| `PointerDown { Left }` | Syncs `hover`; the hit **focusable widget** ⇒ focus it; records `pressed` |
| `PointerUp { Left }` | Release position == press position ⇒ `Clicked`; clears `pressed` regardless |
| `KeyDown { Tab }` | Cycles focus in tree order (`Shift` reverses) ⇒ `FocusChanged` |
| `KeyDown { Escape }` | Clears focus |
| `KeyDown { Enter }` | Focus on an enabled button ⇒ `Clicked` (keyboard activation = click) |
| `KeyDown { Backspace }` | Focus is an enabled field ⇒ delete **one Unicode character** |
| `TextInput` | Focus is an enabled field ⇒ append the text |
| `FocusChanged { focused: false }` | Window lost focus: clears `hover` / `pressed` (`focus` / `texts` untouched) |
| `Wheel { dy }` | Scrolls the nearest scrollable ancestor of `hover` by `-dy × 40px` (see Step 8) |

Events are only produced when **state really changed**. Right / middle mouse buttons, arrow keys, key repeat and IME pre-edit are not consumed in this phase (see [Known Limits](../../advanced/pitfalls.md) for details).

## Hit-testing semantics

- A hit returns the **deepest** node (later siblings override), and the interval is half-open `[x, x+w)`;
- The interaction layer's `hit` adds two more checks on top of `hit_test`: **clipping** and **disabled** — clicking a point inside a disabled subtree or a clipped-away point ⇒ **no hit**, with **no fallback** to ancestors;
- The focus sequence `focusables()` depends only on the tree (Button / Field and not inside a disabled subtree), so a zero-sized button can still receive `Tab` focus but cannot be clicked on screen — deliberate: the focus order doesn't introduce a second geometric source of truth.

## Scripted replay (a debugging gem)

Input events are all plain values (no handles, no closures), so they can be written as a text script and replayed offscreen —
for the script syntax, see [Input Script Syntax](../../appendix/input_script.md):

```sh
# Deterministic replay mode for the counter example (exits by itself when done; exit code 0 = all assertions passed)
cmd /c "set DEER_COUNTER_SCRIPT=@builtin&& cargo run -q -p deer-gui --features window --example counter"
```

## APIs used in this step

| API | Purpose | Detailed docs |
|---|---|---|
| `handle` | Input event → state machine + `UiEvent` | [Interaction layer](../../api/interaction.md) |
| `UiState` | Single source of truth for interaction state | [Interaction layer](../../api/interaction.md) |
| `ClipSnapshot::from_draw_list` | Derive clipping from the draw list | [Interaction layer](../../api/interaction.md) |
| `hit` | Hit testing (including clipping + disabled) | [Interaction layer](../../api/interaction.md) |
| `focusables` | The `Tab` focus sequence | [Interaction layer](../../api/interaction.md) |

## Next step

[Step 8: Scrolling and Text Wrapping](08_scroll_wrap.md) — make long content scroll and long text wrap.
