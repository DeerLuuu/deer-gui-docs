# API 總覽

deer-gui 對使用者暴露的是一個**門面 crate**（`deer_gui`）加四個分層 crate。
絕大多數場景下，一行 `use deer_gui::prelude::*;` 就能拿到全部常用型別。

## crate 分層

| Crate | 職責 | 文件 |
|---|---|---|
| `deer-gui` | 門面：re-export 一切 + 離屏渲染便捷入口 + 互動層 + testkit | [門面 crate](deer_gui.md) |
| `deer-core` | 節點樹、版面配置代數（L1–L4）、命中測試、`.dui` 場景解析、繪製原語、屬性註冊表（**零平台相依**；原 `deer-layout` 內容遷入） | [Builder](builder.md) · [Node](node.md) · [版面配置](layout.md) · [場景](scene.md) |
| `deer-text` | 文字堆疊：TTF 解析、光柵化、字形圖集、度量、TextEngine（API 名不變，隨 LY2 自 deer-gpu 遷出） | [文字引擎](text.md) |
| `deer-gpu` | GPU HAL 契約、DefaultRenderer/CpuRenderer、主題、BMP 影像解碼 | [繪製與主題](draw.md) |
| `deer-log` | 零相依日誌門面（`DEER_LOG` 開關，預設完全靜默） | 見儲存庫 `crates/deer-log` 原始碼文件 |
| `deer-vk` | Vulkan 後端（自宣告符號 + 執行時動態載入，不需要 SDK） | 見儲存庫 `crates/deer-vk` 原始碼文件 |
| `deer-window` | 視窗 + 事件迴圈 + 多視窗基建（`winit`，唯一第三方相依；`window` feature） | [視窗層](window.md) |

## prelude 一覽

`use deer_gui::prelude::*;` 會匯入這些（全部來自真實程式碼，隨版本演進以原始碼為準）：

| 類別 | 型別 / 函式 |
|---|---|
| 渲染入口 | `DefaultRenderer`、`build_draw_list`、`CpuRenderer`、`Framebuffer` |
| 繪製型別 | `Color`、`DrawCmd`、`DrawList`、`Extent`、`RectI`、`Theme` |
| 文字 | `GlyphAtlas`、`GlyphImage`、`GlyphKey`、`FontMeasure`、`Rasterizer`、`GlyphPlacement`、`TextEngine` |
| 構築 | `Builder`、`L` |
| 版面配置 | `ApproxMeasure`、`Measure`、`TextStyle`、`hit_test`、`layout`、`measure_tree` |
| 節點 | `Align`、`Kind`、`Node`、`Rect`、`Size` |
| 場景 | `SceneError`、`encode_scene`、`parse_scene` |

不在 prelude 裡、但常用的：`deer_gui::{render_tree_to_png, render_tree_to_rgba, layout_tree, interaction, input_script, testing, window}`。

## feature 開關

| Feature | 引入的內容 | 何時開 |
|---|---|---|
| `window` | `deer_window`（winit）+ 視窗渲染路徑 | 需要真視窗時；離屏渲染不需要 |
| `testing` | `deer_gui::testing`（testkit） | 寫介面測試時；生產建置零成本 |

## 閱讀路徑

- 新手：跟著[分步教學](../getting_started/step_by_step/index.md)走，遇到 API 再回來查；
- 查用法：每篇 API 文件統一包含**功能說明 → 參數與回傳值 → 使用範例 → 注意事項**，並附相關教學連結；
- 查行為細節：[版面配置不變式](../advanced/invariants.md)與[已知陷阱](../advanced/pitfalls.md)。
