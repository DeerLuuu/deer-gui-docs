# Known Limits and Common Pitfalls

Behavior that looks "counter-intuitive" is usually **deliberate**. This page collects the limits you hit most often in use; for the complete list (the real defect behind each constraint and its guard test), see the Design constraints and known traps section of [`CONTRIBUTING.md`](https://github.com/DeerLuuu/deer-gui/blob/master/CONTRIBUTING.md) (English).

## Rendering

| Pitfall | Truth | Way out |
|---|---|---|
| `render_tree_to_png` draws monospace boxes for text | The old entry point **loads no fonts** (established behavior, not a bug) | Use `render_tree_to_png_with_font` / `…_with_engine` ([Step 5](../getting_started/step_by_step/05_text.md)) |
| Font size inconsistent across the three places ⇒ text drifts | Layout metrics, `DrawCmd::Text.size`, and the engine's font size must be the same value | Use the convenience entry points; when assembling the pipeline yourself, pin `theme.font_size` to the same value |
| `_SRGB` color attachment ⇒ blending differs by ~44 bytes | The CPU baseline does no gamma conversion; sRGB attachments blend in linear space | Always use `R8G8B8A8_UNORM` for color attachments (same for the window swapchain; prefer linear) |
| The old claim that a "dynamic viewport draws no pixels" in Vulkan | **Refuted** by three controlled comparisons on this machine (it breaks when *not* set); but this is local testing and doesn't stand for all devices | The offscreen path still uses a static viewport/scissor (an implementation fact) |

## Layout

| Pitfall | Truth | Way out |
|---|---|---|
| The root node doesn't fill the window | I-5: the root box is a cap, not a command; the root doesn't fill it | Give the root an explicit size, or adjust the box supplied by the host |
| `50%` is bigger/smaller than "half the parent's assignment" | I-7: percentages resolve against the parent's **content box** | Don't use "the parent's assigned size" as your mental baseline |
| `grow` has no effect inside a scroll container | The scroll container's main axis isn't clamped and has no leftover space ⇒ `grow` is inert | Scrollable content shouldn't be compressed in the first place ([Step 8](../getting_started/step_by_step/08_scroll_wrap.md)) |
| Wrapping doesn't take effect | The wrap width = the node's own **pixel** width; not declared (or only a percentage) ⇒ no wrapping | `L::new().wrap(true).w(200.0)`, or `w=200 wrap` in a scene |
| English words break oddly / Chinese breaks per character | `wrap_greedy` splits words at spaces/tabs; space-free Chinese is "one word" ⇒ overlong runs are hard-cut per character | Deterministic behavior, as intended; word-level breaking for English requires spaces in the source text |

## Interaction

| Pitfall | Truth | Way out |
|---|---|---|
| A click does nothing | The click landed on a disabled subtree or a clipped-away region ⇒ **no hit**, no fallback to ancestors | Check `disabled` and ancestor clipping; this is deliberate (no second routing rule is introduced) |
| `Tab` can focus an invisible button | `focusables` depends only on the tree: zero-size nodes remain in the focus sequence | Deliberate (the focus order introduces no second geometric truth) |
| The wheel doesn't scroll | `ScrollMetrics` was never fed into `ScrollState` ⇒ all caps are 0 (fail-closed) | After `layout_with_scroll`, call `state.scroll.set_metrics(&metrics)` every frame |
| The window "freezes" and doesn't redraw | Default `OnDemand`: if input didn't change state, nothing is drawn (power saving) | If state really changed, return `wants_redraw() == true`; declare `Continuous` for animations or use a `Waker` |
| The old belief that "dragging off the button loses the click" | T3.7 pointer capture (ruled by D7): **capture happens on press**; while dragging outside, move events are still routed to the captor (`hover` is pinned to the captured node), and **release settles `Clicked` against the captor** — releasing anywhere counts | To model "drag out = cancel" you must build it yourself (queryable at both press and release); `ScrubNum` drag-to-adjust and the scrollbar thumb drag are both built on capture |
| Right-click "does nothing" | Right-click is **pure passthrough** (T3.3, Q1): `PointerDown { Right }` emits `UiEvent::PointerRight` on press and **does not participate** in focus/`pressed`/`Clicked` (disabled subtrees don't emit) | The upper layer receives `PointerRight(id)` and decides what to do itself (context menus belong to the M6 widget layer) |
| IME pre-edit "has no effect" | Pre-edit is attached to the **currently focused input field** (`UiState::preedit`, not into `texts`); with no focused field ⇒ it is ignored; empty `text` = cancel | Focus an input field first (click or `Tab`); commit goes through `TextInput` into `texts` and clears the buffer (no double-writing) |
| No inertia after releasing the wheel | Inertia is two halves: the pure logic is complete, but it **does not scroll by itself** — the caller must call `advance_inertia` in `redraw` on the `INERTIA_TICK_MS` cadence (the wheel already seeds it automatically; only the driving is missing) | Follow the wiring in the `scroll_inertia_window` example: `advance_inertia` advances + `inertia_deadline` supplies `next_deadline` |
| Logging pollutes tests that judge by stderr | It won't: without `DEER_LOG` set, `deer-log` turns off all levels ⇒ **not a single byte is output** (fully silent by default is a hard requirement) | To get logs you must set `DEER_LOG` explicitly (see the table below); this is also why the silent default cannot change |

## Environment variables and gates

| Variable | Effect |
|---|---|
| `DEER_LOG` | Logging switch (unset = fully silent; `off` / a global level like `debug` / `target=level`, comma-separated, later entries override earlier ones) |
| `DEER_WINDOW_REDRAW=continuous` | Unconditionally force continuous redraw (turns off power saving) |
| `DEER_VK_WINDOW_TESTS=1` | Turns on the gate for window parity tests (unset = explicitly prints "skipped") |
| `DEER_INPUT_SCRIPT` | The default input script for window examples (see [input script syntax](../appendix/input_script.md)) |

Gate checks **`trim()` before comparing**: `cmd /c "set X=1 && …"` folds the trailing space into the variable value (measured: `"1 "`),
strict equality then misclassifies "enabled" as "disabled" ⇒ silently skipped yet reported as a pass. `trim()` in your own gate checks too.

## Platform

| Boundary | Notes |
|---|---|
| The window layer is Windows-only | On other platforms `run()` explicitly reports "platform unsupported", never silently filling 0 |
| Layout / CPU rasterization / PNG / Vulkan offscreen | Works on any platform (CI friendly) |
| The Vulkan backend | No SDK needed; the driver must provide Vulkan 1.4 |

## How to tell whether it's a bug

1. First check [`FEATURES.md`](https://github.com/DeerLuuu/deer-gui/blob/master/FEATURES.md): is this feature actually implemented;
2. Then check the design constraints in [`CONTRIBUTING.md`](https://github.com/DeerLuuu/deer-gui/blob/master/CONTRIBUTING.md): is this deliberate;
3. Neither ⇒ file an issue per the process in [`CONTRIBUTING.md`](https://github.com/DeerLuuu/deer-gui/blob/master/CONTRIBUTING.md) (with a reproducible command).
