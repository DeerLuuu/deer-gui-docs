# Step 8: Scrolling and Text Wrapping

## Goal

Add **wheel-driven vertical scrolling** to long content and make long text **wrap to width**. Both are opt-in, explicit declarations: `scroll` (meaningful only on `Column`) and `wrap` (meaningful only on `Text`).

## Steps

### Vertical scrolling

1. Declare scrolling on a container: `L::new().scroll(true).to_props()`, or write the bare attribute `scroll` in a scene file.
   The only test for "is this a scrollable container" is `Node::is_scroll_container()` (`Column` + `scroll`) —
   shared by layout, rendering and interaction; setting it on a `Row` is **ignored** (only vertical scrolling exists in this phase).
2. Scroll offsets live in `UiState.scroll` (`ScrollState`): **offsets are an input to layout; the limits are an output of layout**.
3. Each frame: `layout_with_scroll(root, box, style, &measure, &state.scroll.offsets)` returns
   `(geometry, metrics)`; then **immediately** pour it back with `state.scroll.set_metrics(&metrics)` —
   it clamps the old offsets into the new limits (no stale out-of-range offsets survive viewport/content changes).
4. You don't write wheel handling: in `handle`, `Wheel { dy }` finds the nearest scrollable ancestor of `hover`,
   scrolls by `dy × 40px` (`WHEEL_STEP_PX`), clamps to `[0, max_scroll]`, and emits a `Scrolled` event only when something changed.

### Text wrapping

1. Declare wrapping on a `Text` node: `L::new().wrap(true).w(200.0).to_props()` — **the wrap width =
   the node's own pixel width**. No pixel width declared ⇒ node width = text width ⇒ no wrapping possible (an edge case pinned by tests).
2. Scene file notation: `[text label=long text w=200 wrap]`.
3. Height comes out right automatically: intrinsic height = **actual line count × line height** — the line count has only one definition (`Measure::wrap`),
   so layout reserving and rendering drawing can never "reserve 2 lines but draw 3".

## Complete example

```rust
use deer_gui::prelude::*;

fn main() {
    // A scrollable Column 160 tall, stuffed with 6 text nodes; the second one declares wrapping at 200px width
    let mut list = Node::new(Kind::Column, "list")
        .with_layout(L::new().w(240.0).h(160.0).pad(8.0).gap(4.0).scroll(true).to_props());
    for i in 1..=6 {
        let mut t = Node::new(Kind::Text, "").with_label(format!("Text block {i}"));
        if i == 2 {
            t.layout.wrap = true;
            t.layout.width = Some(Size::Px(200.0)); // the wrap width = the node's own pixel width
        }
        list.children.push(t);
    }

    // Offsets are an input to layout; unregistered ids ⇒ offset 0 (a deterministic result is always given)
    let offsets = ScrollOffsets::new();
    let (geo, metrics) = layout_with_scroll(
        &list, Rect::new(0.0, 0.0, 260.0, 180.0), TextStyle::default(), &ApproxMeasure, &offsets,
    );
    println!("list's scroll limit = {}px", metrics.max_of("list"));

    // Want to jump somewhere directly: ScrollOffsets::new().with("list", 40), then run layout once more
}
```

```sh
cargo run
```

A runnable interactive version (the wheel actually scrolls):

```sh
cargo run -p deer-gui --example scroll
```

## Semantic essentials

| Rule | Notes |
|---|---|
| `max_scroll = max(0, content main-axis size + gaps + padding − viewport)` | An output of layout, in whole pixels |
| Offset clamping | Scrolling to the boundary never overflows; out-of-range offsets are **silently dropped** and never leak into geometry |
| The container's own rect doesn't move | Scrolling only changes the relative position of the **inner content** (shifted as a whole by `-offset`) |
| Children of a scroll container | Their main-axis explicit size is **not clamped to the viewport** (otherwise "content taller than the viewport" could never hold); `grow` is disabled (there's no leftover space to distribute) |
| Metrics were never poured back | All limits are 0 ⇒ the wheel does nothing (fail-closed; you never scroll into a "limitless void") |
| Wrapping algorithm `wrap_greedy` | Splits words on **spaces / tabs** and greedily packs lines; over-wide words are hard-split per character; `max_width <= 0` means no wrapping |

> **CJK text note**: word splitting only recognizes spaces / tabs. A run of Chinese without spaces is a single "word";
> when it exceeds the width it takes the **per-character hard split** — the result is deterministic, wraps character by
> character, and matches expectations; but if you expect "wrapping at word boundaries" in the middle of English words,
> make sure the source text contains spaces.

## Scrollbar and inertial scrolling (available)

- **Visible scrollbar**: `scrollbar_geom(viewport, offset, max_scroll)` gives the track + thumb geometry
  (width `SCROLLBAR_W`, edge inset `SCROLLBAR_INSET`, minimum thumb height `SCROLLBAR_MIN_THUMB`;
  if the content fits ⇒ returns `None` and nothing is drawn). After the interaction-layer wiring: **drag the thumb to change the offset**, and **clicking empty track jumps to the pointer** and can keep dragging.
- **Inertial scrolling**: wheel scrolling automatically seeds inertia (how far you wheel is how far it slides), but it **does not scroll by itself** —
  the caller must drive it explicitly: call `advance_inertia(&mut state)` inside `redraw` to advance one step,
  and use `inertia_deadline(state)` in `next_deadline` to schedule the next wake. For the complete wiring in a real window, see the
  `scroll_inertia_window` example.

For details, see the [layout engine](../../api/layout.md) and the [interaction layer](../../api/interaction.md).

```sh
cargo run -p deer-gui --example scroll_bar            # visible scrollbar (offscreen self-check)
cargo run -p deer-gui --features window --example scroll_inertia_window   # inertial scrolling (real window)
```

## APIs used in this step

| API | Purpose | Detailed docs |
|---|---|---|
| `layout_with_scroll` | Layout + scrolling (returns geometry and limits) | [Layout engine](../../api/layout.md) |
| `ScrollOffsets` / `ScrollMetrics` | Offsets (input) / limits (output) | [Layout engine](../../api/layout.md) |
| `ScrollState::set_metrics` | Pour the limits back each frame and clamp the old offsets | [Interaction layer](../../api/interaction.md) |
| `Node::is_scroll_container` / `wraps_text` | The only source of these predicates | [Node data model](../../api/node.md) |
| `wrap_greedy` | The wrapping algorithm (the only implementation) | [Layout engine](../../api/layout.md) |

## Next step

[Step 9: Writing UI Tests with testkit](09_testing.md) — turn everything above into assertable tests a dozen lines long.
