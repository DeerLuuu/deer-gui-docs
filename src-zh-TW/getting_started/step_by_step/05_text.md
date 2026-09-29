# 第 5 步：真實字型算繪文字

## 目標

讓介面裡的文字從「等寬佔位方塊」變成**真實字形**：理解「版面配置度量、繪製清單、光柵化必須用同一個字號、同一份度量」這條鐵律，並會走文字引擎路徑。

## 操作步驟

1. 準備一個 TrueType 字型（含 `glyf` 表的 `.ttf` / `.ttc`；**不支援 CFF/OTTO**，會明確報錯）。
   Windows 上可以直接用 `C:\Windows\Fonts\consola.ttf`。
2. 把算繪入口換成 `render_tree_to_png_with_font`（或先建 `TextEngine` 再用 `…_with_engine`）。
3. 記住三處字號必須一致：引擎字號、版面配置 `TextStyle.font_size`、`theme.font_size` ——
   這些入口已經幫你釘成同一個值；自己拆開寫時別弄丟。

## 完整範例

```rust
use deer_gui::prelude::*;
use deer_gui::render_tree_to_png_with_font;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut app = Builder::new(Kind::Column, "app").padding(12.0).gap(8.0);
    app.text("標題：真實字形");
    app.button("點我");
    let tree = app.build();

    // 字號三處統一：engine / TextStyle / Theme 都釘在 16.0
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

不想手寫字型路徑？`TextEngine::from_system_font(16.0)` 會依次找
`%WINDIR%\Fonts` 裡的 `consola.ttf` / `arial.ttf` / `segoeui.ttf`，找不到就明確報錯。

在倉庫裡可以直接跑：

```sh
cargo run -p deer-gui --example text_render     # render_out/text_render.png
cargo run -p deer-gui --example glyph_atlas     # 字形圖集打包
```

## 為什麼字號必須三處一致

| 處 | 誰用 | 錯了會怎樣 |
|---|---|---|
| 引擎字號（`TextEngine` 建構參數） | 字形光柵化、真實 advance 度量 | 版面配置按 A 字號算寬、繪製按 B 字號畫 ⇒ 寬度漂移 |
| 版面配置 `TextStyle.font_size` | 文字節點寬度、行高、換行 | 同上 |
| `theme.font_size` | 繪製清單裡 `DrawCmd::Text.size` 的來源 | 畫的字與預留的位置對不上 |

`render_tree_to_rgba_with_engine` 的做法是**一處定義**：`theme.font_size` 直接被釘成你傳入的
`font_size`。自己拼裝路徑時請照做。

## 順帶認識兩個度量實作

| 實作 | 寬度演算法 | 用途 |
|---|---|---|
| `ApproxMeasure` | 每字元 0.6em（確定性近似） | 版面配置測試、無字型環境 |
| `FontMeasure`（`TextEngine::measure()`） | 字型真實 advance | 真實算繪路徑 |

兩者共用**同一套**換行演算法 `wrap_greedy` —— 版面配置預留幾行、算繪畫幾行，永遠不會分叉
（這正是行數定義只有一處的原因）。換行的細節與中文文字的注意事項見
[第 8 步](08_scroll_wrap.md)。

## 本節用到的 API

| API | 作用 | 詳細文件 |
|---|---|---|
| `render_tree_to_png_with_font` | 樹 → PNG（真實字形） | [門面 crate](../../api/deer_gui.md) |
| `TextEngine::from_font_file` / `from_system_font` | 建文字引擎 | [文字引擎](../../api/text.md) |
| `FontMeasure` | 真實字型度量 | [文字引擎](../../api/text.md) |
| `Measure` trait | 度量介面（可注入） | [版面配置引擎](../../api/layout.md) |

## 下一步

圖片已經會出了，接下來把它搬上螢幕：[第 6 步：開啟視窗](06_window.md)。
