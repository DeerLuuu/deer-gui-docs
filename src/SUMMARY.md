# Summary

[简介](introduction.md)

---

# 入门

- [安装与环境要求](getting_started/installation.md)
- [核心概念：一棵节点树](getting_started/core_concepts.md)

## 分步教程

- [分步教程](getting_started/step_by_step/index.md)
  - [第 1 步：环境就绪，渲染第一张图](getting_started/step_by_step/01_first_render.md)
  - [第 2 步：用 Builder 搭界面树](getting_started/step_by_step/02_builder.md)
  - [第 3 步：布局参数与对齐](getting_started/step_by_step/03_layout_props.md)
  - [第 4 步：用 .dui 场景文件描述界面](getting_started/step_by_step/04_scene_file.md)
  - [第 5 步：真实字体渲染文本](getting_started/step_by_step/05_text.md)
  - [第 6 步：打开窗口](getting_started/step_by_step/06_window.md)
  - [第 7 步：输入、点击与焦点](getting_started/step_by_step/07_interaction.md)
  - [第 8 步：滚动与文本换行](getting_started/step_by_step/08_scroll_wrap.md)
  - [第 9 步：用 testkit 写界面测试](getting_started/step_by_step/09_testing.md)

# API 参考

- [API 总览](api/index.md)
  - [门面 crate（deer_gui）](api/deer_gui.md)
  - [命令式构筑（Builder / L）](api/builder.md)
  - [节点数据模型（Node / Kind / Size / Align）](api/node.md)
  - [布局引擎（layout / hit_test）](api/layout.md)
  - [场景文件（parse_scene / encode_scene）](api/scene.md)
  - [绘制与主题（DrawList / Theme / Color）](api/draw.md)
  - [文本引擎与字体度量（TextEngine / FontMeasure）](api/text.md)
  - [交互层（UiState / handle / 命中测试）](api/interaction.md)
  - [窗口层（App / run / Waker）](api/window.md)
  - [测试接口（testkit / Harness）](api/testing.md)

# 进阶

- [架构总览](advanced/architecture.md)
- [布局不变式（I-1 ～ I-8）](advanced/invariants.md)
- [已知边界与常见陷阱](advanced/pitfalls.md)

# 附录

- [可运行示例索引](appendix/examples.md)
- [输入脚本语法](appendix/input_script.md)
- [文档贡献指南](appendix/contributing.md)
