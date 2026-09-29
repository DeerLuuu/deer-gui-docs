# Step 6: Opening a Window

## Goal

Use the window layer (`deer-window`, based on `winit`) to open a real window, implement the `App` trait's lifecycle callbacks, and understand **event-driven redraws**: in the default power-saving mode (`OnDemand`), not a single frame is drawn when nothing changed.

> **Prerequisite**: requires `features = ["window"]`, and currently only **Windows** supports handing native handles to
> the rendering layer (on other platforms `run()` returns an explicit "platform not supported" error, never silently
> fills in 0).

## Steps

1. Write a struct implementing `deer_gui::window::App`;
2. Implement at least `init` (called once after the window is created, to create rendering resources) and `redraw` (draw one frame);
3. Start with `run(WindowConfig::new("Title", 800, 600), app)` — **must be called on the main thread**;
4. To only redraw when "input changed state", keep the books in `input` and answer honestly in `wants_redraw`.

## Complete example

```rust
use deer_gui::window::{App, Flow, InputEvent, Key, RedrawPolicy, WindowConfig, WindowInfo, run};

struct MyApp {
    /// Bookkeeping for "did the last input change state" (read by wants_redraw)
    dirty: bool,
}

impl App for MyApp {
    fn init(&mut self, info: &WindowInfo) -> Result<(), String> {
        println!(
            "window {}x{}, HWND=0x{:X}",
            info.extent.width, info.extent.height, info.raw.handle
        );
        Ok(()) // a real implementation creates the Vulkan device / swapchain here
    }

    fn redraw(&mut self) -> Result<Flow, String> {
        self.dirty = false; // this frame is drawn; clear the dirty flag
        Ok(Flow::Continue)
    }

    fn input(&mut self, _info: &WindowInfo, ev: &InputEvent) -> Result<Flow, String> {
        match ev {
            InputEvent::KeyDown { key: Key::Escape, .. } => return Ok(Flow::Exit),
            InputEvent::PointerDown { x, y, .. } => {
                println!("pressed ({x}, {y})");
                self.dirty = true; // state really changed
            }
            _ => {}
        }
        Ok(Flow::Continue)
    }

    fn wants_redraw(&self) -> bool {
        self.dirty // redraw is only requested when true; system events (Resized etc.) ignore this and always redraw
    }

    fn redraw_policy(&self) -> RedrawPolicy {
        RedrawPolicy::OnDemand // the default; only animation-style Apps return Continuous
    }
}

fn main() -> Result<(), String> {
    run(WindowConfig::new("hello", 800, 600), MyApp { dirty: false })
}
```

```sh
cargo run --features window
```

## App lifecycle quick reference

| Callback | When it fires | Default implementation |
|---|---|---|
| `init(&WindowInfo)` | Called **once** after the window is created | You must implement it |
| `resized(w, h)` | Size changed (physical pixels); you should rebuild the swapchain | Does nothing |
| `redraw()` | Every frame | You must implement it |
| `input(&WindowInfo, &InputEvent)` | Every input event | Does nothing |
| `close_requested()` | The close button was clicked | Allows closing (`Flow::Exit`) |
| `wants_redraw()` | Asked once after every input | `false` |
| `redraw_policy()` | Read once at startup | `OnDemand` |
| `wake_handle(Waker)` | Called once after the window is created (the wake handle for power-saving mode) | Does nothing |
| `next_deadline()` | Asked once when each round of the event loop settles | `None` (sleeps indefinitely) |
| `on_wake_stats(&WakeStats)` | Called once at shutdown (the observability ledger) | Does nothing |

## The six redraw-triggering rules (the key to power-saving mode)

| Trigger | Is a redraw requested? |
|---|---|
| Input event | Requested **only if `wants_redraw()` is true** |
| System events (`Resized` / `Focused` / window re-exposed / bootstrap frame) | **Always** requested (`wants_redraw` is not consulted) |
| `RedrawRequested` arrives | Only then is `redraw()` called |
| `RedrawPolicy::Continuous` | Every finished frame schedules the next one |
| `Waker::wake()` (a hint) | Asks `wants_redraw()`; draws only if the answer is true |
| `wake_after(d)` / `next_deadline` fires | **Always** draws a frame (the App placed the order itself) |

At runtime you can force power-saving mode off with the environment variable: `DEER_WINDOW_REDRAW=continuous`.
At startup and shutdown the window layer prints self-evidence lines ("redraw policy", "redraw ledger", "wake ledger") —
when verifying, grep those lines; don't rely on the exit code alone.

## "How does the tree get on screen?"

This section only built the App skeleton. For the complete template of drawing a UI tree into a window (the Vulkan
window path, `WindowedRenderer`), see the two runnable examples in the repository:

```sh
cargo run -p deer-gui --features window --example hello_window   # 8 steps: tree → window
cargo run -p deer-gui --features window --example counter        # a minimal interactive UI
```

Their accompanying explanations are in the repository's `docs/GETTING-STARTED-UI-STEPS.md` and `docs/GETTING-STARTED-UI.md`.

## APIs used in this step

| API | Purpose | Detailed docs |
|---|---|---|
| `App` trait | The lifecycle of a windowed application | [Window layer](../../api/window.md) |
| `run(config, app)` | Create the window + run the event loop | [Window layer](../../api/window.md) |
| `WindowConfig` | Title and logical size | [Window layer](../../api/window.md) |
| `Waker` | Timed / hint wake-ups in power-saving mode | [Window layer](../../api/window.md) |

## Next step

The window is up; next, make it **respond to you**: [Step 7: Input, Clicks and Focus](07_interaction.md).
