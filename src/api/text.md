# 文本引擎与字体度量（TextEngine / FontMeasure）

**模块**：`deer_text::text` / `deer_text::measure`（2026-10 分层重组：文本栈从 `deer-gpu` 迁入新 crate **deer-text**）

> **名字一个都没变**：`TextEngine` / `FontMeasure` / `Rasterizer` / `GlyphAtlas` / `GlyphKey` / `GlyphImage` / `GlyphPlacement` 的 API 名与签名不变，只是 crate 归属从 `deer-gpu` 变成 `deer-text`；`deer_gui::prelude::*` 里的导出名也保持不变，既有 `use deer_gui::prelude::*` 的代码不用改。

依赖方向是单向的 `deer-gpu → deer-text → deer-core`，deer-text 零第三方依赖。

## 功能说明

零依赖的真实字体栈：TTF 解析 → 字形光栅化 → 图集 → 真实度量 → 换行。文本引擎（`TextEngine`）持有字体与字形图集；`FontMeasure` 把真实 advance 暴露成布局的 [`Measure`](layout.md) 接口 —— **布局与绘制共用同一份字体、同一个字号**，这是「布局算出来的宽度 == 画出来的宽度」的保证。

## `TextEngine`

| 方法 | 签名 | 说明 |
|---|---|---|
| `from_font_file` | `(path: &Path, font_size: f32) -> GpuResult<TextEngine>` | 从字体文件建引擎 |
| `from_font_bytes` | `(data: Vec<u8>, font_size: f32) -> GpuResult<TextEngine>` | 从内存字节建引擎 |
| `from_system_font` | `(font_size: f32) -> GpuResult<TextEngine>` | 依次找 `%WINDIR%\Fonts` 里的 `consola.ttf` / `arial.ttf` / `segoeui.ttf`；找不到**明确报错**（不静默） |
| `from_font` | `(font: Font, font_size: f32) -> TextEngine` | 从已解析的 `Font` 建 |
| `measure()` | `-> FontMeasure<'_>` | 度量接口（喂给 `layout` / `build_draw_list`） |
| `glyph(ch, px_size)` | `-> Option<GlyphPlacement>` | 取字符的排版信息；必要时光栅化并入图集（带缓存）；缺字回退 `.notdef` 并计入诊断 |
| `text_width(text, px_size)` | `-> f32` | 一串文本的实宽 |
| `set_font_size(px)` / `font_size()` | | 改/读默认字号（已有图集缓存不失效：不同字号是不同的 `GlyphKey`） |

**格式支持**：TrueType（含 `glyf` 表，`.ttf` / `.ttc`）。**不支持 CFF/OTTO** —— 明确报错，不静默给空白字形。

## `FontMeasure`

实现 `Measure` trait 的真实度量：

| 方法 | 说明 |
|---|---|
| `width(text, _style)` | 真实 advance 之和（忽略 `style.font_size`，字号由构造时给定） |
| `wrap(text, _style, max_width)` | 与 `wrap_greedy` 同一套词切分规则（布局预留行数 == 渲染绘制行数的保证） |
| `height(text, _style, max_width)` | `wrap().len() × line_height`（**不是**另一套算法） |

字段：`pub font: &Font`、`pub font_size: f32`。

## 配套类型（prelude 可用）

| 类型 | 说明 |
|---|---|
| `GlyphAtlas` | 字形图集（打包位图Coverage，供 CPU/GPU 采样） |
| `GlyphKey` | 字符 + 字号的缓存键 |
| `GlyphImage` | 单个字形位图 |
| `GlyphPlacement` | 位图在图集的位置 + 相对笔位/基线的偏移 + advance |
| `Rasterizer` | 字形光栅化 |
| `find_system_font()` | `measure` 模块的系统字体探测（`Option<PathBuf>`） |

另：零依赖 PNG 编码器 `png` 随迁到 deer-text（`TextEngine::atlas_png()` 需要它）；`deer-gpu` 用 `pub use deer_text::png;` 保留原路径 —— `deer_gpu::png::encode_rgba` 逐字不变。

## 使用示例

```rust
use deer_gui::prelude::*;

// 路径一：便捷入口（内部帮你钉住三处字号一致）
// let png = deer_gui::render_tree_to_png_with_font(
//     &tree, 320, 200, Theme::default(), Path::new("C:/Windows/Fonts/consola.ttf"), 16.0)?;

// 路径二：自己掌控引擎（复用已解析字体、或配合窗口路径）
let engine = TextEngine::from_system_font(16.0)?;
let geo = layout(&tree, Rect::new(0.0, 0.0, 320.0, 200.0),
                 TextStyle { font_size: 16.0, line_height: 18.0 }, &engine.measure());
let list = build_draw_list(&tree, &geo, theme, &engine.measure());
let mut renderer = CpuRenderer::with_text(engine);
let fb = renderer.render(Extent { width: 320, height: 200 }, &list, theme.surface)?;
```

完整可运行示例：`cargo run -p deer-gui --example text_render`（真实字形出 PNG）、
`--example glyph_atlas`（图集打包）。

## 注意事项

- **字号三处必须一致**：引擎字号、布局 `TextStyle.font_size`、`theme.font_size` ——
  不一致就是「布局宽度与绘制宽度漂移」（见[第 5 步](../getting_started/step_by_step/05_text.md)的表格）；
- `FontMeasure::width` 忽略 `TextStyle.font_size`（字号来自构造时的 `font_size`），
  自己拼路径时别指望改 `TextStyle` 就能换字号；
- **hinting 不做**（有实测依据：最省的 hinting-lite 没有净收益）；亚像素水平定位是光栅化层的
  opt-in 路径，默认仍整数落位 —— 且已**决定不接线**进文本引擎（实测落位误差改善约 4 倍，
  但边缘锐度代价更高 ⇒ 无净视觉收益；将来做 LCD 子像素或高 DPI 半像素落位时再评估）；
- 中文字形：图集按需光栅化、带缓存，但**字体文件本身必须含所需字形** ——
  系统字体探测只认三款西文字体，中文界面请显式传中文字体路径；
- 换行细节（中文按字符硬切等）见[第 8 步](../getting_started/step_by_step/08_scroll_wrap.md)。
