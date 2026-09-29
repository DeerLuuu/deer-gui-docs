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
| `deer_gui::gpu` / `::layout` / `::vk` | 下層 crate 的 re-export（`deer_gpu` / `deer_layout` / `deer_vk`） | 恆有 |

頂層 re-export：`DrawCmd`、`DrawList`、`GpuError`、`GpuResult`、`Theme`、`Node`、`VkBackend`。

## 便捷渲染函式（參數與回傳值）

| 函式 | 簽名要點 | 回傳 | 字型 |
|---|---|---|---|
| `render_tree_to_rgba` | `(tree: &Node, width: u32, height: u32, theme: Theme)` | `GpuResult<(u32, u32, Vec<u8>)>`（行優先 RGBA8，無 padding） | 無（佔位方塊） |
| `render_tree_to_png` | 同上 | `Result<Vec<u8>, String>`（PNG 位元組流，可直接 `fs::write`） | 無（佔位方塊） |
| `render_tree_to_rgba_with_font` | `+ (font_path: &Path, font_size: f32)` | 同 `…_rgba` | **真實字形**（內部建 `TextEngine`） |
| `render_tree_to_png_with_font` | 同上 | 同 `…_png` | **真實字形** |
| `render_tree_to_rgba_with_engine` | `+ (font_size: f32, engine: TextEngine)`（複用已解析的字型） | 同 `…_rgba` | 真實字形；`theme.font_size` 會被釘成傳入的 `font_size` |
| `layout_tree` | `(tree, width, height, theme)` | `Geometry`（id → `Rect`，除錯版面配置用，不出像素） | — |

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
