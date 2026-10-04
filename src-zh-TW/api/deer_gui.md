# 門面 crate（deer_gui）

## 功能說明

`deer_gui` 是**門面 crate**：一條 `use` 拿到執行時全部能力，並提供「離屏渲染成圖片」的便捷入口。它還承載三個純邏輯模組：[互動層](interaction.md)、[輸入腳本](../appendix/input_script.md)與 [testkit](testing.md)，以及可選的[視窗層](window.md)。

模組地圖：

| 模組 | 內容 | 開關 |
|---|---|---|
| `deer_gui::prelude` | 常用型別集中匯入（清單見 [API 總覽](index.md)） | 恆有 |
| `deer_gui::interaction` | 命中測試、狀態機、`UiState` / `UiEvent` | 恆有 |
| `deer_gui::input_script` | 腳本文本 → `InputEvent` 序列 | 恆有 |
| `deer_gui::env_gate` | 環境變數門檻判定（先 `trim()` 再比） | 恆有 |
| `deer_gui::testing` | testkit（`Harness` 等） | `testing` feature 或 `cfg(test)` |
| `deer_gui::window` | `deer_window` 的 re-export | `window` feature |
| `deer_gui::gpu` / `::layout` / `::vk` | 下層 crate 的 crate 別名：`gpu` = `deer_gpu`、`layout` = `deer_core`、`vk` = `deer_vk` | 恆有 |

三個 crate 別名由 lib.rs 的一組 `pub use` 定義：

```rust,ignore
pub use deer_gpu::{ self as gpu, Theme };
pub use deer_core::{self as layout, Node};
pub use deer_vk::{self as vk, VkBackend};
pub use deer_core::{ DrawCmd, DrawList, GpuError, GpuResult };
```

即頂層 re-export 與別名合起來是：`Theme`、`DrawCmd`、`DrawList`、`GpuError`、`GpuResult`、`Node`、`VkBackend`，加上 `gpu`/`layout`/`vk` 三個別名 —— 注意 **`layout` 別名指向的是 `deer_core`**（版面配置、命中測試、`ScrollMetrics` 等契約都在它裡面），不是某個叫 `deer-layout` 的 crate。

**LY2 說明（prelude 名字不變）**：文字堆疊的實作在 L1 crate `deer-text`（`TextEngine`、`GlyphAtlas` 等），但 `deer_gui::prelude::*` 裡的**名字全部保持不變** —— 門面替你把 `deer_text` 的型別 re-export 進來，下游程式碼一行不用改（`deer_gui::gpu` 別名只覆蓋 deer-gpu 自己的東西，文字型別不在其中）。

## 便捷渲染函式（參數與回傳值）

| 函式 | 簽名要點 | 回傳 | 字型 |
|---|---|---|---|
| `render_tree_to_rgba` | `(tree: &Node, width: u32, height: u32, theme: Theme)` | `GpuResult<(u32, u32, Vec<u8>)>`（行優先 RGBA8，無 padding） | 無（佔位方塊） |
| `render_tree_to_png` | 同上 | `Result<Vec<u8>, String>`（PNG 位元組流，可直接 `fs::write`） | 無（佔位方塊） |
| `render_tree_to_rgba_with_font` | `+ (font_path: &Path, font_size: f32)` | 同 `…_rgba` | **真實字形**（內部建 `TextEngine`） |
| `render_tree_to_png_with_font` | 同上 | 同 `…_png` | **真實字形** |
| `render_tree_to_rgba_with_engine` | `+ (font_size: f32, engine: TextEngine)`（複用已解析的字型） | 同 `…_rgba` | 真實字形；`theme.font_size` 會被釘成傳入的 `font_size` |
| `layout_tree` | `(tree, width, height, theme)` | `layout::layout::Geometry`（id → `Rect`，除錯版面配置用，不出像素；固定走 `ApproxMeasure` 近似度量） | — |

這些入口內部固定走：`layout()`（`ApproxMeasure` 或引擎度量）→ `build_draw_list` → CPU 後端渲染。

## 使用範例

```rust
use deer_gui::prelude::*;
use deer_gui::render_tree_to_png;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut app = Builder::new(Kind::Column, "app").padding(12.0).gap(8.0);
    app.text("标题");
    let tree = app.build();

    let png = render_tree_to_png(&tree, 320, 200, Theme::default())?;
    std::fs::write("ui.png", png)?;
    Ok(())
}
```

## 注意事項

- **`render_tree_to_png` / `render_tree_to_rgba` 不載入字型**：畫出的「字」是等寬佔位方塊。
  要真實字形請用 `…_with_font` / `…_with_engine`（見[第 5 步](../getting_started/step_by_step/05_text.md)）；
- `GpuResult` 的錯誤型別是 `GpuError`（例如字型檔讀不到、格式不支援時會明確報錯，不靜默給空白字形）；
- 像素緩衝行優先、無 padding；顏色是 RGBA8（`render_tree_to_png` 內部再編碼成 PNG）；
- 想自定渲染管線：`prelude` 裡的 `build_draw_list`（樹+幾何 → `DrawList`）與
  `CpuRenderer`（`DrawList` → `Framebuffer`）可拆開使用。
