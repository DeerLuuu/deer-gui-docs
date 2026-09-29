# Summary

[Introduction](introduction.md)

---

# Getting Started

- [Installation and Requirements](getting_started/installation.md)
- [Core Concepts: A Node Tree](getting_started/core_concepts.md)

## Step-by-Step Tutorial

- [Step-by-Step Tutorial](getting_started/step_by_step/index.md)
  - [Step 1: Environment Ready, First Render](getting_started/step_by_step/01_first_render.md)
  - [Step 2: Building a UI Tree with the Builder](getting_started/step_by_step/02_builder.md)
  - [Step 3: Layout Parameters and Alignment](getting_started/step_by_step/03_layout_props.md)
  - [Step 4: Describing a UI with a .dui Scene File](getting_started/step_by_step/04_scene_file.md)
  - [Step 5: Rendering Text with Real Fonts](getting_started/step_by_step/05_text.md)
  - [Step 6: Opening a Window](getting_started/step_by_step/06_window.md)
  - [Step 7: Input, Clicks and Focus](getting_started/step_by_step/07_interaction.md)
  - [Step 8: Scrolling and Text Wrapping](getting_started/step_by_step/08_scroll_wrap.md)
  - [Step 9: Writing UI Tests with testkit](getting_started/step_by_step/09_testing.md)

# API Reference

- [API Overview](api/index.md)
  - [Facade crate (deer_gui)](api/deer_gui.md)
  - [Imperative construction (Builder / L)](api/builder.md)
  - [Node data model (Node / Kind / Size / Align)](api/node.md)
  - [Layout engine (layout / hit_test)](api/layout.md)
  - [Scene files (parse_scene / encode_scene)](api/scene.md)
  - [Drawing and themes (DrawList / Theme / Color)](api/draw.md)
  - [Text engine and font metrics (TextEngine / FontMeasure)](api/text.md)
  - [Interaction layer (UiState / handle / hit testing)](api/interaction.md)
  - [Window layer (App / run / Waker)](api/window.md)
  - [Testing interface (testkit / Harness)](api/testing.md)

# Advanced

- [Architecture Overview](advanced/architecture.md)
- [Layout Invariants (I-1 – I-8)](advanced/invariants.md)
- [Known Limits and Common Pitfalls](advanced/pitfalls.md)

# Appendix

- [Runnable Examples Index](appendix/examples.md)
- [Input Script Syntax](appendix/input_script.md)
- [Documentation Contributing Guide](appendix/contributing.md)
