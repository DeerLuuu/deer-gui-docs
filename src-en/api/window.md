# The Window Layer (App / run / Waker)

**crate**: `deer-window` (after enabling the `window` feature on `deer-gui`, used via `deer_gui::window`)

## What it does

The "native window + event loop" layer, and the **only place in this workspace that introduces a third-party dependency** (`winit 0.30`). It hands the window's native handle to the rendering layer in the HAL's opaque form (`RawWindowHandle`) — rendering backends don't depend on winit, so swapping window implementations never touches the rendering stack.

The crate is physically split into two layers (public paths are **verbatim identical** to before the split; `lib.rs` only declares modules and acts as a `pub use` hub):

| Module | Layer | Contents |
|---|---|---|
| `deer_window::display` (`display.rs`) | **L1 DisplayServer** | Platform mapping: `WindowConfig` / `WindowInfo`, input translation (`InputEvent`/`Key`/`Mods`/`PointerButton` and `map_key`/`map_mouse_button`/`map_mods`/`map_wheel`/`printable_text`), DPI `scale_factor` bookkeeping, the **clipboard** (AF-2), handle packing (`raw_handle_from_win32` etc.), `UNSUPPORTED_PLATFORM_MSG` |
| `deer_window::host` (`host.rs`) | **L3 host** | The `App` trait + `run()`/`run_multi()` (the event loop and dirty redraws), `Waker`, `WindowId`, `WindowSpawner` (multi-window infrastructure), `RedrawPolicy`, `WakePlan`/`plan_wake`/`earliest` (pure logic for tests), `WakeStats`/`FrameCounter` (ledgers), `Flow` |

Boundary: **only the Windows** handle-filling is implemented; on other platforms `run()` explicitly returns
`UNSUPPORTED_PLATFORM_MSG`, **never silently filling 0**. The window itself uses winit, so other platforms "can open a window" — only the step of handing the handle to the HAL is unimplemented.

## The `App` trait (you implement it; `run` does the rest)

`App` has a **dual-hook** structure: one set of **single-window hooks** (the original signatures, from before multi-window existed), and one set of **per-window hooks** (each taking an extra `WindowId`). The relation between them is one discipline: **the per-window hooks' default implementations forward to the corresponding single-window hooks (ignoring the id) ⇒ single-window users change nothing; once you override a per-window hook, the corresponding single-window hook is no longer called** (forwarding happens only in the default implementations — both paths must not fire at once).

### Single-window hooks

| Method | When | Default |
|---|---|---|
| `init(&mut self, &WindowInfo) -> Result<(), String>` | Called **once per window created** (in creation order; create the renderer/swapchain) | must implement (even if you override `window_init`, supply an empty implementation) |
| `resized(w, h)` | Size change (physical pixels; rebuild the swapchain) | does nothing |
| `redraw() -> Result<Flow, String>` | Every frame | must implement |
| `input(&mut self, &WindowInfo, &InputEvent) -> Result<Flow, String>` | Each input event | does nothing, returns `Flow::Continue` |
| `close_requested() -> Flow` | Close request | `Flow::Exit` |
| `wants_redraw() -> bool` | Asked **after every input event** (applies to input events only) | `false` |
| `redraw_policy() -> RedrawPolicy` | Read once at startup | `OnDemand` |
| `wake_handle(Waker)` | Called once after the main window is created (**store it**; called only once across the whole `run()`) | does nothing |
| `window_spawner(WindowSpawner)` | In the **same batch** as `wake_handle` (the queued window-creation handle for multi-window) | does nothing |
| `next_deadline() -> Option<Instant>` | Asked each time the event loop settles (pull-based scheduling) | `None` |
| `on_wake_stats(&WakeStats)` | Called once at shutdown (the wake ledger; only good for bookkeeping/assertions) | does nothing |

### Per-window hooks (T4.4-R1/R3, multi-window routing)

| Method | When | Default |
|---|---|---|
| `window_init(id, &WindowInfo)` | Same timing as `init` (once per window), with the id — multi-window Apps create their renderers here, passing `id.raw()` straight into the rendering layer's window table | forwards `init` (ignoring the id) |
| `window_input(id, &WindowInfo, &InputEvent)` | Which window the input belongs to, delivered together with **that window's own** `WindowInfo`; receives only that window's events | forwards `input` (ignoring the id) |
| `window_resized(id, w, h)` | Which window changed size must be distinguishable | forwards `resized` |
| `window_redraw(id)` | That window's `RedrawRequested` ⇒ under multi-window, only this one window is drawn | forwards `redraw` |
| `window_close_requested(id) -> Flow` | The user clicked the X of **that** window. Returning `Flow::Exit` = **allow closing this window** (not ending the event loop — exiting only happens when the last remaining window is closed); returning `Flow::Continue` = **veto** (no window closes) | forwards `close_requested` |
| `window_destroyed(id)` | Called once (at most once) after a window has been removed from the live-window table; the App releases that window's rendering resources here | **A purely new hook** (no old method to forward), does nothing |

All callbacks run on the **main thread**. Any callback returning `Err` ⇒ `run()` prints the reason and returns `Err` (never swallowed); `Flow::Exit` asks the event loop to end.

## Multi-window (T4.4-R1)

| Entry point | Notes |
|---|---|
| `WindowId(u64)` | This layer's window number; `raw()` goes straight into the rendering layer's window table (both layers share the same numbering source; the mapping is the identity — implicit conventions like "0/1 just happen to line up" are forbidden) |
| `WindowSpawner::spawn_window(config: WindowConfig)` | **Queues** the creation of a new window; it is really created at a safe point of the event loop (the `user_event` arm holding the `ActiveEventLoop`). The handle is delivered via `App::window_spawner` (the same root channel as the `Waker`); once stored, any callback can queue a window |
| `run(config, app)` | The main window is still first-created by `run()` |
| `run_multi(configs: &[WindowConfig], app)` | **Multi-config startup**: each entry creates one window (the first entry = the main window), on the same code path as `run()` |
| Close semantics | `CloseRequested` **closes only that window** (vetoable via `window_close_requested`); **all windows closed** ⇒ the event loop exits |

The multi-window rendering side (per-window swapchains/resource tables, `WindowedRenderer::new_with_primary_id`/`add_window`) belongs to [deer-vk] (T4.4-R2) and isn't covered on this page. Waking is App-level: the `Waker` is shared across windows, and a wake redraws **all live windows** together.

## Clipboard (AF-2)

The `display` module's `Clipboard` (self-written Win32 `CF_UNICODETEXT`, **plain text as the only format, no third-party dependencies**):

| Method | Notes |
|---|---|
| `Clipboard::new(hwnd: usize) -> Result<Clipboard, String>` | The public constructor (not handed over via `App` — the clipboard is an OS-global resource with no lifecycle coupling to windows/the event loop; on non-Windows it explicitly returns `Err(CLIPBOARD_UNSUPPORTED_MSG)`, never silently). Construction itself **doesn't touch** the clipboard |
| `set_text(&self, text: &str) -> Result<(), String>` | Write. **A real window handle must be used** (`hwnd = 0` is a NULL owner; Win32 mandates that `SetClipboardData` fails in that case — `set_text` explicitly refuses before acting); text containing NUL is explicitly refused |
| `get_text(&self) -> Result<String, String>` | Read (no owner needed; `0` works); an empty clipboard or a non-text format ⇒ an explicit `Err`, **never a silent empty string**; content that isn't valid UTF-16 ⇒ an explicit `Err` as well, no lossy replacement |

Open-use-close per call is the convention: `App::input`'s signature already carries `info: &WindowInfo`, so `Clipboard::new(info.raw.handle)` on the spot is enough; no state is needed just to store the handle. Each call internally atomically does "open (with retry) → do the work → close", holding nothing across calls (never jams the whole system's copy-paste); it is **callable from any thread**.

## DPI (AF-3, pass-through only)

`scale_factor` starts as winit's `window.scale_factor()` at window creation (the same source as the extent) and lives in `WindowInfo::scale_factor`; afterwards the OS reports changes ⇒ `InputEvent::ScaleFactorChanged { scale_factor: f64 }` is dispatched (whatever the OS reports is forwarded as-is; before dispatch, `WindowInfo::scale_factor` has already been booked to the new value). This layer **converts no coordinates**: event coordinates and sizes remain physical pixels, and layout is a pixel-level pure function; the window's physical size also does **not** change because of a DPI change (so no `Resized` follows it). Scaling by DPI is the upper layer's own business.

## The remaining types

| Type | Highlights |
|---|---|
| `WindowConfig` | `new(title, width, height)` (**logical** size, converted when the window is created); defaults to untitled 800×600; `display_title()` adds the `deer-gui — ` prefix |
| `WindowInfo` | `{ raw: RawWindowHandle, extent: Extent, scale_factor: f64 }` (current physical size + DPI factor; synced after `Resized`/`ScaleFactorChanged`) |
| `Flow` | `Continue` / `Exit` |
| `RedrawPolicy` | `OnDemand` (default, power saving) / `Continuous` (each finished frame schedules the next); can be force-overridden at runtime by the env var `DEER_WINDOW_REDRAW=continuous` (the `REDRAW_ENV` constant; values are compared after `trim()`, case-insensitive) |
| `Waker` | `wake()` (a hint: asks `wants_redraw`, draws only if true) / `wake_after(Duration)` (a booking: at the due time it **always** draws one frame); `Clone` and `Send` |
| `InputEvent` / `Key` / `Mods` / `PointerButton` | The input model (the same definitions as the [interaction layer](interaction.md); `Key` includes `PageUp`/`PageDown`/`Home`/`End`, and `KeyDown` carries `repeat: bool`) |
| `WakePlan` / `plan_wake` / `earliest` | The **pure-logic** truth table of the event loop's "sleep dead / sleep until due / due now" (for tests) |
| `WakeStats` / `FrameCounter` | Ledgers (frames / requests / skipped / iters …) |

## The six redraw rules

| Trigger | Redraw requested? |
|---|---|
| Input event | **only when `wants_redraw()` is true** |
| System events (`Resized` / `Focused` / window re-exposed / bootstrap frame) | **always** |
| `RedrawRequested` arrives | only then is `redraw()` called (under multi-window via `window_redraw`, drawing only that window) |
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

A minimal multi-window skeleton:

```rust,ignore
struct TwoWindows { spawner: Option<WindowSpawner>, spawned: bool }

impl App for TwoWindows {
    fn init(&mut self, _info: &WindowInfo) -> Result<(), String> { Ok(()) }
    // Once the main window is built, get the window-creation handle (same batch as wake_handle), and queue a new window.
    fn window_spawner(&mut self, spawner: WindowSpawner) { self.spawner = Some(spawner); }
    fn redraw(&mut self) -> Result<Flow, String> {
        if !self.spawned {
            self.spawned = true;
            if let Some(sp) = &self.spawner {
                sp.spawn_window(WindowConfig::new("第二扇", 320, 200)); // only queued; really built at the safe point
            }
        }
        Ok(Flow::Continue)
    }
    // Multi-window Apps override this (after overriding, `input` is no longer called): dispatch per-window state by id.
    fn window_input(&mut self, id: WindowId, _info: &WindowInfo, _ev: &InputEvent)
        -> Result<Flow, String> { Ok(Flow::Continue) }
}
```

## Notes

- **`run()` must be called on the main thread** (a winit requirement);
- `next_deadline()` must return a **fixed instant** and advance it itself: returning `Instant::now() + 50ms` every time means it **never comes due**
  (waking every 50ms without drawing a single frame — idle spinning). For timed advancement use `Waker::wake_after`
  (inertia scrolling has a ready-made pull-style implementation to consult: `interaction::inertia_deadline`);
- An already-expired deadline counts as "due immediately" ⇒ one frame is drawn; failing to clear it is equivalent to asking for continuous redraw yourself;
- Input event coordinates are **physical pixels** (no DPI conversion in this layer); characters and physical keys are **two separate events**
  (text goes through `TextInput`; `Enter`/`Tab`/`Backspace`/`Esc` only produce `KeyDown`);
- IME: **pre-edit is wired up** (`Ime::Preedit` ⇒ dispatched as `InputEvent::ImePreedit`; commit still goes through `TextInput`); key repeat is modeled (winit's `event.repeat` goes into `KeyDown.repeat`);
  touch/drag-and-drop/device events aren't wired up;
- After overriding a per-window hook, the corresponding single-window hook is no longer called — don't write the logic on both sides;
- Don't rely on the exit code alone: this layer's ledger is printed lines — acceptance means grepping them.
