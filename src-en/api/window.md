# The Window Layer (App / run / Waker)

**crate**: `deer-window` (after enabling the `window` feature on `deer-gui`, used via `deer_gui::window`)

## What it does

The "native window + event loop" layer, and the **only place in this workspace that introduces a third-party dependency** (`winit 0.30`). It hands the window's native handle to the rendering layer in the HAL's opaque form (`RawWindowHandle`) — rendering backends don't depend on winit, so swapping window implementations never touches the rendering stack.

Boundary: **only the Windows** handle-filling is implemented; on other platforms `run()` explicitly returns
`UNSUPPORTED_PLATFORM_MSG`, **never silently filling 0**. The window itself uses winit, so other platforms "can open a window" — only the step of handing the handle to the HAL is unimplemented.

## The `App` trait (you implement it; `run` does the rest)

| Method | When | Default |
|---|---|---|
| `init(&mut self, &WindowInfo) -> Result<(), String>` | Called **once** after the window is created (create the renderer/swapchain) | must implement |
| `resized(w, h)` | Size change (physical pixels; rebuild the swapchain) | does nothing |
| `redraw() -> Result<Flow, String>` | Every frame | must implement |
| `input(&mut self, &WindowInfo, &InputEvent) -> Result<Flow, String>` | Each input event | does nothing |
| `close_requested() -> Flow` | Close request | `Flow::Exit` |
| `wants_redraw() -> bool` | Asked **after every input event** | `false` |
| `redraw_policy() -> RedrawPolicy` | Read once at startup | `OnDemand` |
| `wake_handle(Waker)` | Called once after window creation (**store it**) | does nothing |
| `next_deadline() -> Option<Instant>` | Asked each time the event loop settles (pull-based scheduling) | `None` |
| `on_wake_stats(&WakeStats)` | Called once at shutdown (the wake ledger; only good for bookkeeping/assertions) | does nothing |

All callbacks run on the **main thread**. Any callback returning `Err` ⇒ `run()` prints the reason and returns `Err` (never swallowed); `Flow::Exit` asks the event loop to end.

## The remaining types

| Type | Highlights |
|---|---|
| `WindowConfig` | `new(title, width, height)` (**logical** size, converted when the window is created); defaults to untitled 800×600; `display_title()` adds the `deer-gui — ` prefix |
| `WindowInfo` | `{ raw: RawWindowHandle, extent: Extent }` (current physical size; synced after `Resized`) |
| `Flow` | `Continue` / `Exit` |
| `RedrawPolicy` | `OnDemand` (default, power saving) / `Continuous` (each finished frame schedules the next); can be force-overridden at runtime by the env var `DEER_WINDOW_REDRAW=continuous` |
| `Waker` | `wake()` (a hint: asks `wants_redraw`, draws only if true) / `wake_after(Duration)` (a booking: at the due time it **always** draws one frame); `Clone` and `Send` |
| `InputEvent` / `Key` / `Mods` / `PointerButton` | The input model (the same definitions as the [interaction layer](interaction.md)) |
| `WakeStats` / `FrameCounter` | Ledgers (frames / requests / skipped / iters …) |

## The six redraw rules

| Trigger | Redraw requested? |
|---|---|
| Input event | **only when `wants_redraw()` is true** |
| System events (`Resized` / `Focused` / window re-exposed / bootstrap frame) | **always** |
| `RedrawRequested` arrives | only then is `redraw()` called |
| `RedrawPolicy::Continuous` | each finished frame schedules the next |
| `Waker::wake()` | asks `wants_redraw`, draws only if true |
| `wake_after` / `next_deadline` due | **always** (the App booked it itself) |

The event loop sleeps on `ControlFlow::Wait` by default — **without a deadline declared by the App, not a single nanosecond of timeout is set** (the power-saving promise). At startup it prints a self-attesting line (the parsed policy result); at shutdown it prints the "redraw ledger" and the "wake ledger".

## Example

A minimal runnable `App` is in [Step 6](../getting_started/step_by_step/06_window.md);
the full "tree → window" boilerplate:

```sh
cargo run -p deer-gui --features window --example hello_window    # tree → window in 8 steps
cargo run -p deer-gui --features window --example counter         # minimal interactive UI
cargo run -p deer-gui --features window --example window_parity   # on-screen vs CPU, pixel-by-pixel parity
```

```rust,ignore
// Timed animation in power-saving mode: book the next frame with the Waker instead of degrading to Continuous
fn wake_handle(&mut self, waker: Waker) { self.waker = Some(waker); }
fn redraw(&mut self) -> Result<Flow, String> {
    if let Some(w) = &self.waker {
        w.wake_after(std::time::Duration::from_millis(16)); // schedule the next frame at 60fps
    }
    Ok(Flow::Continue)
}
```

## Notes

- **`run()` must be called on the main thread** (a winit requirement);
- `next_deadline()` must return a **fixed instant** and advance it itself: returning `Instant::now() + 50ms` every time means it **never comes due**
  (waking every 50ms without drawing a single frame — idle spinning). For timed advancement use `Waker::wake_after`;
- An already-expired deadline counts as "due immediately" ⇒ one frame is drawn; failing to clear it is equivalent to asking for continuous redraw yourself;
- Input event coordinates are **physical pixels** (no DPI conversion in this layer); characters and physical keys are **two separate events**
  (text goes through `TextInput`; `Enter`/`Tab`/`Backspace`/`Esc` only produce `KeyDown`);
- IME: preedit isn't modeled (only used to suppress duplicate commits); touch/drag-and-drop/device events aren't wired up;
- Don't rely on the exit code alone: this layer's ledger is printed lines — acceptance means grepping them.
