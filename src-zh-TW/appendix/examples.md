# 可執行範例索引

[`crates/deer-gui/examples/`](https://github.com/DeerLuuu/deer-gui/tree/master/crates/deer-gui/examples) 是看到功能跑起來的最快方式 —— **每個範例都帶自檢斷言**。範例清單會隨里程碑增長，最權威的來源永遠是目錄本身；本頁是導覽。

## 離屏（無視窗，任何平台）

| 命令 | 內容 | 相關教學 |
|---|---|---|
| `cargo run -p deer-gui --example render_to_png` | 最小樹 → PNG（`render_out/`） | [第 1 步](../getting_started/step_by_step/01_first_render.md) |
| `--example geometry` | 版面配置計算與命中測試，帶斷言 | [第 3 步](../getting_started/step_by_step/03_layout_props.md) |
| `--example scene_file` | `.dui` 建樹，與命令式等價 | [第 4 步](../getting_started/step_by_step/04_scene_file.md) |
| `--example text_render` | 真實字形 → PNG | [第 5 步](../getting_started/step_by_step/05_text.md) |
| `--example glyph_atlas` | 字形圖集打包 | [文字引擎](../api/text.md) |
| `--example pixels` / `--example draw_list` | 像素緩衝 / 繪製清單的最小通路 | [繪製與主題](../api/draw.md) |
| `--example theme` | 自訂主題配色 | [繪製與主題](../api/draw.md) |
| `--example scroll` | 滾輪驅動的垂直捲動（離屏版） | [第 8 步](../getting_started/step_by_step/08_scroll_wrap.md) |
| `--example tutorial` | 全流程導覽，產出多張 PNG | [分步教學](../getting_started/step_by_step/index.md) |

## GPU / Vulkan

| 命令 | 內容 |
|---|---|
| `cargo test -p deer-vk -- --nocapture` | 列舉本機 GPU |
| `--example vulkan_devices` / `--example vulkan_pipeline` | Vulkan 裝置 / 管線 |
| `--example gpu_geometry` / `--example gpu_offscreen` | GPU 幾何 / 離屏，與 CPU 後端逐像素對照 |
| `--example indirect_draw` | 間接繪製（`vkCmdDrawIndexedIndirect`） |
| `--example textures` | 通用紋理（RGBA8 建立/上傳/回讀） |

## 視窗（`--features window`，Windows）

| 命令 | 內容 | 相關教學 |
|---|---|---|
| `--example window_preview` | 真視窗預覽 | [第 6 步](../getting_started/step_by_step/06_window.md) |
| `--example hello_window` | 「只有一棵 UI 樹」→ 視窗的 8 步樣板 | [第 6 步](../getting_started/step_by_step/06_window.md) |
| `--example counter` | 最小但真有功能的互動介面（標題/計數/按鈕/輸入框） | [第 7 步](../getting_started/step_by_step/07_interaction.md) |
| `--example interactive_form` | 完整互動表單（四檔像素數字、腳本重放分檔） | [第 7 步](../getting_started/step_by_step/07_interaction.md) |
| `--example window_parity` | 上屏像素 vs CPU 後端逐像素對照（門禁 `DEER_VK_WINDOW_TESTS=1`） | [已知陷阱](../advanced/pitfalls.md) |

## 測試（`--features testing`）

| 命令 | 內容 | 相關教學 |
|---|---|---|
| `cargo run -q -p deer-gui --features testing --example testkit_demo` | testkit 的可執行示範 | [第 9 步](../getting_started/step_by_step/09_testing.md) |

> 哪個功能對應哪個範例，以 [`FEATURES.md`](https://github.com/DeerLuuu/deer-gui/blob/master/FEATURES.md) 為準；
> 新功能按儲存庫紀律必須同時帶範例、指南與 `FEATURES.md` 登記。
