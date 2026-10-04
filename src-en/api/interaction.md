# The Interaction Layer (UiState / handle / hit testing)

**Module**: `deer_gui::interaction`

## What it does

A **pure-logic** interaction core: hit testing (including clipping and disabled state), hover/press (pointer capture)/click/focus/text & IME/widget-value state machines. No window, no GPU — input is a value, output is a value, so the entire interaction chain can be covered by unit tests in an environment without winit / without Vulkan.

Three entry functions:

| Function | Signature | Notes |
|---|---|---|
| `handle` | `(state: &mut UiState, root: &Node, geo: &Geometry, clip: ClipSnapshot, ev: &InputEvent) -> Vec<UiEvent>` | **The single entry point**: feed an event, update state, produce "what happened" |
| `hit` | `(root, geo, clip: ClipSnapshot, x, y) -> Option<&Node>` | Two extra checks on top of [`hit_test`](layout.md): **clipping** and **disabled**; clicking on a disabled subtree or a clipped-away point ⇒ no hit, **no fallback** to ancestors |
| `focusables` | `(root: &Node) -> Vec<String>` | Focusable nodes (Button/the three value inputs/Switch, not inside a disabled subtree) in **tree order** (drives the `Tab` loop; depends only on the tree, not on geometry) |

## `InputEvent` (input events)

| Variant | Fields |
|---|---|
| `PointerMoved` | `x, y: f32` |
| `PointerDown` / `PointerUp` | `button: PointerButton, x, y` |
| `Wheel` | `dx, dy: f32` |
| `KeyDown` / `KeyUp` | `key: Key, mods: Mods` (`KeyDown` has one extra field `repeat: bool` — **OS key repeat**: the KeyDown the OS re-sends while a key is held; the interaction layer doesn't distinguish it by default and consumes it as usual; the point of modeling it is "it can be distinguished", and whether to ignore repeats is the caller's decision) |
| `TextInput` | `text: String` |
| `ImePreedit` | `text: String` (**IME pre-edit**: the segment a Chinese/Japanese IME is composing but hasn't committed yet; an empty `text` = the pre-edit was cancelled) |
| `FocusChanged` | `focused: bool` (window focus, **not** widget focus) |
| `ScaleFactorChanged` | `scale_factor: f64` (**the DPI scale factor changed**; pass-through only: whatever the OS reports is forwarded as-is, and the interaction layer converts no coordinates) |

Companions: `PointerButton::{Left, Right, Middle}`; `Mods { shift, ctrl, alt, sup }`;
`Key::{Tab, Escape, Enter, Backspace, Left, Right, Up, Down, PageUp, PageDown, Home, End, Char(char), Other}` (**physical keys**, no text semantics — text always goes through `TextInput`; `PageUp`/`PageDown`/`Home`/`End` are scroll keys). With the `window` feature on, these types are re-exported directly from `deer-window`; otherwise byte-identical local mirrors are used — both paths have identical signatures and semantics.

## `UiState` (the single source of truth for state)

| Field | Type | Notes |
|---|---|---|
| `preedit` | `Option<Preedit>` | **The IME pre-edit buffer** (the not-yet-committed segment, attached to the input field focused at the time; `Preedit { id, text }`). Default `None` ⇒ existing behavior unchanged. The division of labor with `texts` is hard: the pre-edit goes only here, never into `texts`; commit goes through `TextInput` into `texts` and clears the buffer at the same time (no double-writing) |
| `hover` | `Option<String>` | The node under the pointer (containers included; pinned to the captor during capture, see below) |
| `focus` | `Option<String>` | Keyboard focus (`Tab`/`Shift+Tab`/arrow keys change it, `Escape` clears it) |
| `pressed` | `Option<String>` | **The node captured by the left button** (pointer capture, pressing captures by default) — semantics in the "pointer capture (T3.7)" section below; no longer "remembered at press time" |
| `texts` | `BTreeMap<String, String>` | Input field text buffers (absent from the map = empty string). The **editing-time drafts** of plain `Field`s and value inputs (`NumberField`/`ColorField`) live here together |
| `carets` | `BTreeMap<String, usize>` | Input caret (id → position, measured in **characters**, not bytes; absent from the map = end of text; a purely additive field) |
| `scroll` | `ScrollState` | Scroll state (offsets + caps + scrollbar dragging + inertia, see below) |
| `segments` | `BTreeMap<String, String>` | **The current selection of segmented groups** (group id → selected segment's node id; absent from the map = no selected segment yet). The App seeds initial values; `handle` updates it when a click settles and emits `SelectionChanged` |
| `chips` | `BTreeMap<String, bool>` | **Chip on/off states** (the chip's **own** id → on or off; absent from the map = off). Every chip click flips it and emits `ChipToggled` |
| `tabs` | `BTreeMap<String, String>` | **The active tab of tab bars** (group id → active tab's node id; ids are stored, not indices, so duplicate labels and tree insertions/removals don't shift; the tree-order index is only computed when emitting `TabChanged`) |
| `num_opts` | `BTreeMap<String, NumOpts>` | **Value ranges/steps for value widgets** (widget id → `NumOpts { min: Option<f64>, max: Option<f64>, step: f64 }`; absent from the map = no range, step 1.0). **Application data**: the App fills it if it wants constraints; widgets only read, never write |
| `switches` | `BTreeMap<String, bool>` | **Switch on/off states** (the switch's **own** id → on or off; absent from the map = off). Same shape as `chips` but a separate table (a Switch is not a group's child) |
| `scrub` | `Option<ScrubAnchor>` | **The transient anchor of scrubbing (`ScrubNum`)**. Established only when a press lands on a `ScrubNum` (`start_x` = press x, `base` = the base value of `parse_num(label)` at press time); **cleared on release / window blur** — it is not the value; the truth of the value lives in the App's data and comes back to the tree via the label |

The read/write discipline for widget values (`segments`/`chips`/`tabs`/`switches`/`num_opts` share one rule): **keyed by id, living outside the tree** ⇒ whole-tree rebuilds lose nothing; **read** = query the table directly (absent = the default); **seed initial values** = the App fills them itself (e.g. `state.segments.insert("mode".into(), week_id)`, `state.num_opts.insert("age".into(), NumOpts { min: Some(0.0), max: Some(150.0), step: 1.0 })`); **the truth of the value lives in the App's data** — `handle` only updates the table and emits events when a click/activation settles; the App takes the events, updates its own data, and rebuilds the tree.

`same_visual(&other)`: whether the three visual fields (hover/focus/pressed) are completely identical —
cases like `PointerDown`, which changes `pressed` without emitting an event, rely on it to decide whether a redraw is needed.

### `ScrollState`

| Method | Notes |
|---|---|
| `set_metrics(&ScrollMetrics)` | **Must be called every frame**: feeds in the caps produced by layout and clamps the old offsets to the new caps (viewport/content changes leave no stale out-of-range offsets) |
| `offset_of(id) -> i32` / `max_of(id) -> i32` | Queries |
| `scroll_to(id, v) -> Option<i32>` / `scroll_by(id, delta) -> Option<i32>` | Programmatic scrolling (returns the new value only if it **really changed** after clamping; the target isn't a scroll container ⇒ `None`) |
| `inertia_active() -> bool` | **Is inertia currently scrolling** — the window layer uses it to decide "should another wake-up be scheduled"; once it stops it must be `false` (the observable side of the no-idle-wake ledger) |
| `stop_inertia()` | Makes inertia **stop** (called when scrollbar dragging starts / on blur) — idempotent |
| `inertia_step() -> Option<(String, i32)>` | **Advances inertia one step**: offset += velocity, the velocity decays in integers; `Some((id, new offset))` = this step really moved; `None` = already stopped (hit a boundary / velocity too small), and the caller then stops scheduling further wake-ups |

`ScrollState` also holds two blocks of **transient** state: `drag: Option<ScrollDrag>` (the scrollbar being dragged, `ScrollDrag { id, grab_dy }`) and `inertia: Option<ScrollInertia>` (inertia currently scrolling, `ScrollInertia { id, velocity }`) — both default to `None`, and behavior is unchanged when nothing is dragged or gliding. The scrollbar geometry (thumb/track, `scrollbar_geom()`/`scrollbar_offset_for_pointer()`) lives in [`deer_core::layout`](layout.md); this layer only consumes it.

## `UiEvent` (what happened)

| Variant | Meaning |
|---|---|
| `HoverChanged(Option<String>)` | Hover changed |
| `FocusChanged(Option<String>)` | Widget focus changed |
| `Clicked(String)` | A click completed (**settled on the captor**, wherever the release lands; `Enter`/`Space` keyboard activation counts too) |
| `TextChanged { id, value }` | Input field content changed (inserted at the caret / Backspace deletes the Unicode character before the caret) |
| `Scrolled { id, offset }` | Scroll offset changed (the clamped integer value; scrolling past top/bottom emits nothing; the wheel, scrollbar dragging, key scrolling, and inertia steps all share this one event) |
| `PointerRight { id }` | A **right button** press landed on a node (pure passthrough; context menus belong to the widget layer): **emitted on press**; not involved in focus/`pressed`; a disabled subtree or clipped-away point yields no id ⇒ not emitted |
| `SelectionChanged { id, selected }` | **Segmented selection** (`Segmented`): a segment of the group was clicked and **the selection really changed** (`id` = the group node's id, `selected` = the newly selected segment's node id). Clicking the already-selected segment is no change ⇒ only `Clicked` is emitted, not this one (**emitted only on change**); a disabled segment can't be clicked ⇒ nothing is emitted |
| `ChipToggled { id, chip, on }` | **Chip toggled** (`ChipGroup`): a chip of the group was clicked (`id` = the group id, `chip` = the chip node's id, `on` = the new value after the flip). Toggle semantics: **every click flips and emits once** (deliberately different from single-select's "only on change" — the click itself is the action) |
| `TabChanged { id, index }` | **Tab switched** (`TabBar`): a tab was clicked and the active tab **really changed** (`index` = the new active tab's tree-order index among the group's direct children, **disabled tabs counted too**). Switching content is the App's job: the TabBar only reports. Clicking the current active tab ⇒ only `Clicked` |
| `NumberChanged { id, value: f64 }` | **Number changed**: `NumberField` committed successfully (blur/`Enter`) or `ScrubNum` dragging really changed the value (`value` is the new value **after clamping**). A failed commit (unparseable) emits nothing; dragging without a change emits nothing (**emitted only on change**); after success the draft is written back normalized, but that **does not emit** `TextChanged` |
| `Toggled { id, on: bool }` | **Switch toggled** (`Switch` activated by click/`Enter`/`Space`; `on` = the new value after the flip). Toggle semantics: **every activation flips and emits once** |
| `ColorChanged { id, rgb: [u8; 3] }` | **Color committed successfully** (`ColorField` parsed as `#RRGGBB` successfully, on blur/`Enter`): `rgb` = the parsed three channels. A parse failure **doesn't emit** (the swatch falls back to the `border` color = the marker); after success the draft is written back as the normalized string `#rrggbb` (likewise no `TextChanged`) |

**An event = state changed = a redraw is needed** (the window layer's dirty convention).
The wheel step is `WHEEL_STEP_PX = 40` (≈ two lines of text; `dy < 0` ⇒ content moves up ⇒ the offset grows).
Note that `UiEvent` derives only `PartialEq`, not `Eq` (`NumberChanged` carries an `f64`) — types with floats use `PartialEq` only.

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
| `PointerMoved` | Syncs `hover` (emits `HoverChanged` only when it changed); **during capture (`pressed` held) ⇒ routed to the captor** (see next section); **during scrollbar dragging** ⇒ the pointer y is back-solved into an offset (emits `Scrolled` only on change); **with a `ScrubNum` drag anchor in hand and the captor still being it** ⇒ back-solved into a value `base + Δx × step` (clamped to the range, emits `NumberChanged` only on change) |
| `PointerDown { Left }` | Syncs `hover`; a hit **focusable widget** ⇒ focus it (emits `FocusChanged` only on change); records `pressed` = **capture**; a press on the **scrollbar band** ⇒ start dragging / jump to the clicked track position (doesn't enter click semantics; inertia stops immediately); a press on a `ScrubNum` ⇒ establishes the drag anchor (a label that fails to parse = doesn't engage) |
| `PointerUp { Left }` | Syncs `hover` (capture releases with the lift; hover returns to the physical position); **settles `Clicked` on the captor** (wherever the release lands — dragging out of the node or out of the whole tree and releasing there is still its click) and releases the capture, clears the drag anchor; the landing point is a direct child of a selection-family group ⇒ additional selection settlement (`SelectionChanged`/`ChipToggled`/`TabChanged`); the landing point itself is a `Switch` ⇒ additional switch settlement (`Toggled`); scrollbar dragging ends here (no click is emitted) |
| `PointerDown { Right }` | **Emits `PointerRight` on press** (pure passthrough; doesn't set `pressed`, doesn't change focus; disabled subtrees/clipped-away points don't emit) |
| `PointerDown/Up { Middle }` (and right-button release) | Only syncs `hover`, no other semantics |
| `KeyDown { Tab }` | Cycles focus in tree order (`Shift` reverses); with a single focusable it stays put; **focus leaving a value input ⇒ blur commit** (see below) |
| `KeyDown { Escape }` | Clears focus; focus leaving a value input ⇒ blur commit |
| `KeyDown { Enter }` | Focus on an **enabled** button ⇒ `Clicked` + selection settlement; focus on an **enabled** switch ⇒ `Clicked` + toggle (the same path as the pointer); focus on a **value input** (`NumberField`/`ColorField`) ⇒ **commit** (parse → value event → normalized write-back); a plain `Field` is unaffected by `Enter` |
| `KeyDown { Char(' ') }` (winit's Space) | Focus on an **enabled** switch ⇒ the same activation path as `Enter`; not consumed while focus is on a value input (space is draft content); the rest isn't consumed |
| `KeyDown { Backspace }` | Focus is an **enabled** field ⇒ deletes the Unicode character **before the caret** — always on a char boundary, never splits a multi-byte character; the caret moves back one position |
| `TextInput` | Focus is an **enabled** field ⇒ **inserts at the caret** and advances it; **also clears the pre-edit buffer** (that text is now `texts`' responsibility; not clearing it would double-write) |
| `KeyDown { Left / Right }` | Focus is an **enabled** field ⇒ moves the caret (clamped to `[0, char_count]`); **emits no event** — `TextChanged` means "the value changed", and moving the caret doesn't |
| `KeyDown { Up / Down }` | **Geometry-nearest focus movement** (when focus is **not** an input): moves focus to the focusable widget that is "strictly in the key's direction and geometrically nearest" (primary criterion vertical distance, ties broken horizontally, then by tree order; no focus ⇒ undefined; stops at the edge; same row doesn't count as a direction) ⇒ `FocusChanged` |
| `KeyDown { PageUp / PageDown / Home / End }` | **Key scrolling** (when focus is not an input): the target container comes from the same source as the wheel (the focused container first, falling back to `hover` with no focus); page step = the container's viewport height; `Home`/`End` go to top/bottom; emits `Scrolled` only on change |
| `KeyDown { repeat: true }` | **Same semantics** as `false` (consumed as usual; whether to ignore repeats is filtered by the caller) |
| `ImePreedit { text }` | The pre-edit is attached to **the currently focused input** (`UiState::preedit`); no focused input ⇒ ignored; **an empty string = the IME cancelled** ⇒ clears the buffer |
| `FocusChanged { false }` | Window lost focus: clears `hover`/`pressed` (capture)/`scrub` (the drag anchor) (`focus`/`texts` untouched) — the release event may never come, so the capture must be dropped with it |
| `Wheel { dy }` | Offsets the nearest scrollable ancestor of `hover` (including itself) by `-dy × 40`, clamped, emitting `Scrolled` only on change; **also seeds inertia** (velocity = this step's displacement, see next section) |
| `ScaleFactorChanged` | **Not consumed** (the pass-through red line: the DPI factor is forwarded by the window layer to the App; no coordinate/size conversion, `UiState` untouched) |
| The rest (`KeyUp`, `Key::Char`/`Other` other than Space, `focused: true`) | Not consumed (matching is **exhaustive**: adding an event variant becomes a compile error, never a silent ignore) |

**Blur commit** (a finishing hook shared by all events): if before handling, focus is on a value input and after handling the focus moved on (`Tab`/`Escape`/clicked elsewhere) ⇒ commit once on its behalf (parse → emit value event → normalized write-back). Window blur **doesn't move UI focus** ⇒ not triggered.

## Pointer capture (T3.7)

The semantics of `pressed` are **pointer capture** (pressing captures by default):

- **Press** hits a node ⇒ record it = **capture** (regardless of whether it's a focusable widget — containers and text can be captured too; a press on blank/disabled/clipped space ⇒ no hit ⇒ no capture);
- **During the drag** (capture in hand) `PointerMoved` is **routed to the captor**: hover is pinned to it; dragging the pointer out of the node or out of the whole tree doesn't change hands (a button's hover/pressed visuals are preserved accordingly, and passing things don't get spammed with `HoverChanged`);
- **Release** (wherever it happens) **settles `Clicked` on the captor** and **releases the capture** — the old rule was "release point == press point for a click" (dragging out loses it); now "the node being held gets the click";
- **Window blur** clears the capture — the release event may never come, otherwise the first click after switching back to the window would materialize out of nowhere.

Two things stay unchanged: **without capture** hit testing proceeds as before (this path is unchanged); **scrollbar dragging** is its own capture (`scroll.drag`, never sets `pressed`), and its hover behavior is preserved as-is. The `ScrubNum` scrubbing anchor interlocks with capture: the anchor is only effective while "the captor is still it".

## Scroll inertia (T3.2b)

After one wheel step, **inertia is seeded** (velocity = that step's displacement, so "how far you scrolled" and "how far it glides" are proportional); after release it keeps gliding for a while and decays to a stop on its own:

- The decay is **integer**: each step `v = v × INERTIA_DECAY_NUM / INERTIA_DECAY_DEN` (85/100). Integers are deliberate — making "how many steps after one scroll, and where it stops" **bit-for-bit reproducible** (floats would drift across platforms/optimizations);
- When the velocity's absolute value drops below `INERTIA_MIN_V` (2) it stops; hitting a boundary (no movement after clamping) also stops **immediately** — without clamping, inertia would keep "banging against the wall" (the picture doesn't move but it wakes every 16 ms);
- `INERTIA_TICK_MS = 16` is the time of one advance step; the window layer schedules the next wake-up by it.

How the window layer drives it (the only seam between the pure logic and the window layer):

| Entry point | Notes |
|---|---|
| `advance_inertia(state: &mut UiState) -> Vec<UiEvent>` | **Advances inertia one step** and translates it into events (at most one `Scrolled` per step). The window layer calls it in `redraw` every `INERTIA_TICK_MS`; **an empty return = inertia has stopped, no further wake-up needs scheduling** |
| `inertia_deadline(state: &UiState) -> Option<Instant>` | Inertia still scrolling ⇒ the deadline of the next advance (`now + INERTIA_TICK_MS`); stopped ⇒ `None`. Serves as the implementation for `App::next_deadline` (pull-style); push-style (`Waker::wake_after`) uses the same constant. Two disciplines: **only give `Some` while `inertia_active()`** (returning it while stopped ⇒ idle spinning); what's returned is a **fixed instant** (not something "always a bit short" that can never be caught) |

Other ways to interrupt: starting to drag the scrollbar makes `handle` automatically `stop_inertia()` (the two displacements would fight); window blur clears it too.

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

- Event coordinates are **physical pixels** with the window's top-left origin (the same convention as `WindowInfo::extent`; no DPI conversion — `ScaleFactorChanged` is pass-through only and not consumed by the interaction layer);
- Hits **never fall back** to ancestors: clicking on a disabled subtree or a clipped-away point is simply "missed" — a fallback would require a second routing rule,
  conflicting with "`hit_test` is the single basis for input routing" (costs and discussion in the source module docs, "known limits");
- `ClipSnapshot`'s `allows` passes unknown ids (fail-open): **tests must assert `is_known(id)` first**,
  otherwise "clipped away, no hit" may just mean the id was missing from the snapshot;
- The window layer and test scripts share the same `handle` (script replay goes through the same entry point), so "the script passes" and
  "a human can click it" can never drift apart;
- The caret is measured in **characters**: `苹果x` is 3 chars / 7 bytes; byte-based indexing would split a multi-byte character in half;
- Nothing renders the caret yet, which is why moving it emits no event; once it gets rendered, a `UiEvent::CaretChanged` will be added and
  `carets` included in `same_visual`, following the `ScrollState` precedent — a deferred decision, registered as such;
- The **persistent visuals** of widget values (`segments`/`chips`/`tabs`/`switches`) are drawn by the draw side reading the same state tables (`to_interact_state()` does the transport), so rendering and interaction never each read a different table.
