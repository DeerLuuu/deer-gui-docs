# Installation and Requirements

## Goal

Set up the toolchain, bring deer-gui into your project as a path dependency, and confirm that it compiles.

## Requirements

| Requirement | Notes |
|---|---|
| **Rust 1.85 or newer** | The workspace uses edition 2024; older toolchains won't compile |
| **Windows** | Only required when you need a **real window** (the window layer is currently Windows only); layout, CPU rasterization, offscreen PNG output, and the Vulkan offscreen path run on other platforms too |
| **No Vulkan SDK needed** | `deer-vk` declares the Vulkan symbols itself and loads `vulkan-1.dll` at runtime with `LoadLibraryW` + `GetProcAddress`; it only links `kernel32` |

## Steps

### 1. Get the repository

```sh
git clone https://github.com/DeerLuuu/deer-gui.git
cd deer-gui
```

These crates are not published to crates.io; use the workspace directly or depend on them by path.

### 2. Add it to your own project

```toml
[dependencies]
deer-gui = { path = "path/to/deer-gui/crates/deer-gui" }
```

> **Important**: Only add `--features window` when you need a real window. Without this
> feature, `winit` is not pulled in and `deer-gui` has **no third-party dependencies at
> all**. Offscreen rendering (PNG / RGBA output) does not need a window.

```toml
# When you need a window / interaction:
[dependencies]
deer-gui = { path = "path/to/deer-gui/crates/deer-gui", features = ["window"] }

# Add this when you want the testing interface (testkit):
# features = ["window", "testing"]
```

### 3. Confirm everything works

Run the self-checks inside the repository:

```sh
# Run all assertions (the count grows with milestones; trust the run output)
cargo test --workspace

# Render an image offscreen (CI friendly) → render_out/render_to_png.png
cargo run -p deer-gui --example render_to_png
```

If `render_to_png` runs and writes out a PNG, your toolchain is fine.

## Next step

- Read [Core Concepts: A Node Tree](core_concepts.md) to build a mental model;
- Then move on to [Step-by-Step Tutorial · Step 1](step_by_step/01_first_render.md) and render your first image.

Related APIs: [Facade crate (deer_gui)](../api/deer_gui.md), [Window layer](../api/window.md).
