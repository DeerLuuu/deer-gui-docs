# 文字引擎與字型度量（TextEngine / FontMeasure）

**模組**：`deer_text::text` / `deer_text::measure`（2026-10 分層重組：文字堆疊從 `deer-gpu` 遷入新 crate **deer-text**）

> **名字一個都沒變**：`TextEngine` / `FontMeasure` / `Rasterizer` / `GlyphAtlas` / `GlyphKey` / `GlyphImage` / `GlyphPlacement` 的 API 名與簽名不變，只是 crate 歸屬從 `deer-gpu` 變成 `deer-text`；`deer_gui::prelude::*` 裡的導出名也保持不變，既有 `use deer_gui::prelude::*` 的程式碼不用改。

相依方向是單向的 `deer-gpu → deer-text → deer-core`，deer-text 零第三方相依。

## 功能說明

零相依的真實字型堆疊：TTF 解析 → 字形光柵化 → 圖集 → 真實度量 → 換行。文字引擎（`TextEngine`）持有字型與字形圖集；`FontMeasure` 把真實 advance 暴露成版面配置的 [`Measure`](layout.md) 介面 —— **版面配置與繪製共用同一份字型、同一個字號**，這是「版面配置算出來的寬度 == 畫出來的寬度」的保證。

## `TextEngine`

| 方法 | 簽名 | 說明 |
|---|---|---|
| `from_font_file` | `(path: &Path, font_size: f32) -> GpuResult<TextEngine>` | 從字型檔建引擎 |
| `from_font_bytes` | `(data: Vec<u8>, font_size: f32) -> GpuResult<TextEngine>` | 從記憶體位元組建引擎 |
| `from_system_font` | `(font_size: f32) -> GpuResult<TextEngine>` | 依次找 `%WINDIR%\Fonts` 裡的 `consola.ttf` / `arial.ttf` / `segoeui.ttf`；找不到**明確報錯**（不靜默） |
| `from_font` | `(font: Font, font_size: f32) -> TextEngine` | 從已解析的 `Font` 建 |
| `measure()` | `-> FontMeasure<'_>` | 度量介面（餵給 `layout` / `build_draw_list`） |
| `glyph(ch, px_size)` | `-> Option<GlyphPlacement>` | 取字元的排版資訊；必要時光柵化並入圖集（帶快取）；缺字回退 `.notdef` 並計入診斷 |
| `text_width(text, px_size)` | `-> f32` | 一串文字的實寬 |
| `set_font_size(px)` / `font_size()` | | 改/讀預設字號（已有圖集快取不失效：不同字號是不同的 `GlyphKey`） |

**格式支援**：TrueType（含 `glyf` 表，`.ttf` / `.ttc`）。**不支援 CFF/OTTO** —— 明確報錯，不靜默給空白字形。

## `FontMeasure`

實作 `Measure` trait 的真實度量：

| 方法 | 說明 |
|---|---|
| `width(text, _style)` | 真實 advance 之和（忽略 `style.font_size`，字號由建構時給定） |
| `wrap(text, _style, max_width)` | 與 `wrap_greedy` 同一套詞切分規則（版面配置預留行數 == 渲染繪製行數的保證） |
| `height(text, _style, max_width)` | `wrap().len() × line_height`（**不是**另一套演算法） |

欄位：`pub font: &Font`、`pub font_size: f32`。

## 配套型別（prelude 可用）

| 型別 | 說明 |
|---|---|
| `GlyphAtlas` | 字形圖集（打包位圖Coverage，供 CPU/GPU 取樣） |
| `GlyphKey` | 字元 + 字號的快取鍵 |
| `GlyphImage` | 單個字形位圖 |
| `GlyphPlacement` | 位圖在圖集的位置 + 相對筆位/基線的偏移 + advance |
| `Rasterizer` | 字形光柵化 |
| `find_system_font()` | `measure` 模組的系統字型探測（`Option<PathBuf>`） |

另：零相依 PNG 編碼器 `png` 隨遷到 deer-text（`TextEngine::atlas_png()` 需要它）；`deer-gpu` 用 `pub use deer_text::png;` 保留原路徑 —— `deer_gpu::png::encode_rgba` 逐字不變。

## 使用範例

```rust
use deer_gui::prelude::*;

// 路徑一：便捷入口（內部幫你釘住三處字號一致）
// let png = deer_gui::render_tree_to_png_with_font(
//     &tree, 320, 200, Theme::default(), Path::new("C:/Windows/Fonts/consola.ttf"), 16.0)?;

// 路徑二：自己掌控引擎（複用已解析字型、或配合視窗路徑）
let engine = TextEngine::from_system_font(16.0)?;
let geo = layout(&tree, Rect::new(0.0, 0.0, 320.0, 200.0),
                 TextStyle { font_size: 16.0, line_height: 18.0 }, &engine.measure());
let list = build_draw_list(&tree, &geo, theme, &engine.measure());
let mut renderer = CpuRenderer::with_text(engine);
let fb = renderer.render(Extent { width: 320, height: 200 }, &list, theme.surface)?;
```

完整可執行範例：`cargo run -p deer-gui --example text_render`（真實字形出 PNG）、
`--example glyph_atlas`（圖集打包）。

## 注意事項

- **字號三處必須一致**：引擎字號、版面配置 `TextStyle.font_size`、`theme.font_size` ——
  不一致就是「版面配置寬度與繪製寬度漂移」（見[第 5 步](../getting_started/step_by_step/05_text.md)的表格）；
- `FontMeasure::width` 忽略 `TextStyle.font_size`（字號來自建構時的 `font_size`），
  自己拼路徑時別指望改 `TextStyle` 就能換字號；
- **hinting 不做**（有實測依據：最省的 hinting-lite 沒有淨收益）；亞像素水平定位是光柵化層的
  opt-in 路徑，預設仍整數落位 —— 且已**決定不接線**進文字引擎（實測落位誤差改善約 4 倍，
  但邊緣銳度代價更高 ⇒ 無淨視覺收益；將來做 LCD 子像素或高 DPI 半像素落位時再評估）；
- 中文字形：圖集按需光柵化、帶快取，但**字型檔本身必須含所需字形** ——
  系統字型探測只認三款西文字型，中文介面請顯式傳中文字型路徑；
- 換行細節（中文按字元硬切等）見[第 8 步](../getting_started/step_by_step/08_scroll_wrap.md)。
