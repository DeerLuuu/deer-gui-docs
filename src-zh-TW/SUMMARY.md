# Summary

[簡介](introduction.md)

---

# 入門

- [安裝與環境需求](getting_started/installation.md)
- [核心概念：一棵節點樹](getting_started/core_concepts.md)

## 分步教學

- [分步教學](getting_started/step_by_step/index.md)
  - [第 1 步：環境就緒，算繪第一張圖](getting_started/step_by_step/01_first_render.md)
  - [第 2 步：用 Builder 搭介面樹](getting_started/step_by_step/02_builder.md)
  - [第 3 步：版面配置參數與對齊](getting_started/step_by_step/03_layout_props.md)
  - [第 4 步：用 .dui 場景檔描述介面](getting_started/step_by_step/04_scene_file.md)
  - [第 5 步：真實字型算繪文字](getting_started/step_by_step/05_text.md)
  - [第 6 步：開啟視窗](getting_started/step_by_step/06_window.md)
  - [第 7 步：輸入、點擊與焦點](getting_started/step_by_step/07_interaction.md)
  - [第 8 步：捲動與文字換行](getting_started/step_by_step/08_scroll_wrap.md)
  - [第 9 步：用 testkit 寫介面測試](getting_started/step_by_step/09_testing.md)

# API 參考

- [API 總覽](api/index.md)
  - [門面 crate（deer_gui）](api/deer_gui.md)
  - [命令式構築（Builder / L）](api/builder.md)
  - [節點資料模型（Node / Kind / Size / Align）](api/node.md)
  - [版面配置引擎（layout / hit_test）](api/layout.md)
  - [場景檔（parse_scene / encode_scene）](api/scene.md)
  - [繪製與主題（DrawList / Theme / Color）](api/draw.md)
  - [文字引擎與字型度量（TextEngine / FontMeasure）](api/text.md)
  - [互動層（UiState / handle / 命中測試）](api/interaction.md)
  - [視窗層（App / run / Waker）](api/window.md)
  - [測試介面（testkit / Harness）](api/testing.md)

# 進階

- [架構總覽](advanced/architecture.md)
- [版面配置不變式（I-1 ～ I-8）](advanced/invariants.md)
- [已知邊界與常見陷阱](advanced/pitfalls.md)

# 附錄

- [可執行範例索引](appendix/examples.md)
- [輸入腳本語法](appendix/input_script.md)
- [文件貢獻指南](appendix/contributing.md)
