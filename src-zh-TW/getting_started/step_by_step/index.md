# 分步教學

這是一套循序漸進的分步教學：從「算繪出第一張 PNG」走到「寫出帶斷言的介面測試」。
每一步都對應一個可獨立執行的完整範例，可以直接複製到 `src/main.rs` 或
`examples/` 裡跑。

## 教學結構約定

每一節的行文都是同一個結構：

| 小節 | 內容 |
|---|---|
| **目標** | 這一步做完你會得到什麼 |
| **操作步驟** | 一步一步的操作說明 |
| **完整範例** | 可直接執行的完整程式碼 + 執行命令 |
| **下一步** | 通向下一節的連結 |

## 路線圖

| 步驟 | 內容 | 涉及的 API |
|---|---|---|
| [第 1 步](01_first_render.md) | 環境就緒，離屏算繪第一張 PNG | `render_tree_to_png`、`render_tree_to_rgba` |
| [第 2 步](02_builder.md) | 用 `Builder` 搭一棵有層次的介面樹 | [`Builder`](../../api/builder.md)、[`Node`](../../api/node.md) |
| [第 3 步](03_layout_props.md) | 尺寸、間距、對齊、grow | `L`、`LayoutProps`、[`layout()`](../../api/layout.md) |
| [第 4 步](04_scene_file.md) | 用 `.dui` 場景檔描述同一棵樹 | [`parse_scene`](../../api/scene.md) |
| [第 5 步](05_text.md) | 真實字型：版面配置、繪製與度量統一 | [`TextEngine`](../../api/text.md)、`render_tree_to_png_with_font` |
| [第 6 步](06_window.md) | 開啟一個真視窗（Windows） | [`App` / `run`](../../api/window.md) |
| [第 7 步](07_interaction.md) | 輸入、點擊、焦點與文字輸入 | [`interaction::handle`](../../api/interaction.md) |
| [第 8 步](08_scroll_wrap.md) | 滾輪垂直捲動與文字換行 | `ScrollOffsets`、`wrap` |
| [第 9 步](09_testing.md) | 用 testkit 寫十幾行的介面測試 | [`Harness`](../../api/testing.md) |

## 前置條件

- 已按[安裝與環境需求](../installation.md)裝好 Rust 1.85+ 並拿到倉庫；
- 讀過[核心概念](../core_concepts.md)。

不需要視窗的第 1–5、8–9 步在任何平台都能跑；第 6–7 步需要 Windows。

## 遇到問題？

- 先查 [已知邊界與常見陷阱](../../advanced/pitfalls.md) —— 很多「反直覺」行為是刻意的；
- 某個功能到底做了沒有，以倉庫根目錄的
  [`FEATURES.md`](https://github.com/DeerLuuu/deer-gui/blob/master/FEATURES.md) 為唯一真相；
- 每一步的完整範例在 `crates/deer-gui/examples/` 裡都有對應的可執行版本，見[範例索引](../../appendix/examples.md)。
