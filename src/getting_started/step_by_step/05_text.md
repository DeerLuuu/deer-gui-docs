# 第 5 步：真实字体渲染文本

## 目标

让界面里的文字从「等宽占位方块」变成**真实字形**：理解「布局度量、绘制列表、光栅化必须用同一个字号、同一份度量」这条铁律，并会走文本引擎路径。

## 操作步骤

1. 准备一个 TrueType 字体（含 `glyf` 表的 `.ttf` / `.ttc`；**不支持 CFF/OTTO**，会明确报错）。
   Windows 上可以直接用 `C:\Windows\Fonts\consola.ttf`。
2. 把渲染入口换成 `render_tree_to_png_with_font`（或先建 `TextEngine` 再用 `…_with_engine`）。
3. 记住三处字号必须一致：引擎字号、布局 `TextStyle.font_size`、`theme.font_size` ——
   这些入口已经帮你钉成同一个值；自己拆开写时别弄丢。

## 完整示例

```rust
use deer_gui::prelude::*;
use deer_gui::render_tree_to_png_with_font;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut app = Builder::new(Kind::Column, "app").padding(12.0).gap(8.0);
    app.text("标题：真实字形");
    app.button("点我");
    let tree = app.build();

    // 字号三处统一：engine / TextStyle / Theme 都钉在 16.0
    let png = render_tree_to_png_with_font(
        &tree,
        320,
        200,
        Theme::default(),
        std::path::Path::new("C:/Windows/Fonts/consola.ttf"),
        16.0,
    )?;
    std::fs::write("text_render.png", png)?;
    Ok(())
}
```

```sh
cargo run
```

不想手写字体路径？`TextEngine::from_system_font(16.0)` 会依次找
`%WINDIR%\Fonts` 里的 `consola.ttf` / `arial.ttf` / `segoeui.ttf`，找不到就明确报错。

在仓库里可以直接跑：

```sh
cargo run -p deer-gui --example text_render     # render_out/text_render.png
cargo run -p deer-gui --example glyph_atlas     # 字形图集打包
```

## 为什么字号必须三处一致

| 处 | 谁用 | 错了会怎样 |
|---|---|---|
| 引擎字号（`TextEngine` 构造参数） | 字形光栅化、真实 advance 度量 | 布局按 A 字号算宽、绘制按 B 字号画 ⇒ 宽度漂移 |
| 布局 `TextStyle.font_size` | 文本节点宽度、行高、换行 | 同上 |
| `theme.font_size` | 绘制列表里 `DrawCmd::Text.size` 的来源 | 画的字与预留的位置对不上 |

`render_tree_to_rgba_with_engine` 的做法是**一处定义**：`theme.font_size` 直接被钉成你传入的
`font_size`。自己拼装路径时请照做。

## 顺带认识两个度量实现

| 实现 | 宽度算法 | 用途 |
|---|---|---|
| `ApproxMeasure` | 每字符 0.6em（确定性近似） | 布局测试、无字体环境 |
| `FontMeasure`（`TextEngine::measure()`） | 字体真实 advance | 真实渲染路径 |

两者共用**同一套**换行算法 `wrap_greedy` —— 布局预留几行、渲染画几行，永远不会分叉
（这正是行数定义只有一处的原因）。换行的细节与中文文本的注意事项见
[第 8 步](08_scroll_wrap.md)。

## 本节用到的 API

| API | 作用 | 详细文档 |
|---|---|---|
| `render_tree_to_png_with_font` | 树 → PNG（真实字形） | [门面 crate](../../api/deer_gui.md) |
| `TextEngine::from_font_file` / `from_system_font` | 建文本引擎 | [文本引擎](../../api/text.md) |
| `FontMeasure` | 真实字体度量 | [文本引擎](../../api/text.md) |
| `Measure` trait | 度量接口（可注入） | [布局引擎](../../api/layout.md) |

## 下一步

图片已经会出了，接下来把它搬上屏幕：[第 6 步：打开窗口](06_window.md)。
