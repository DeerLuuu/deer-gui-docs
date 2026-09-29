# 第 1 步：環境就緒，算繪第一張圖

## 目標

不碰視窗、不碰 GPU，把一棵兩行程式碼的介面樹**離屏算繪成 PNG 檔案**，確認整條「樹 → 版面配置 → 繪製 → 像素」的通路在你機器上是通的。

## 操作步驟

1. 新建一個 Rust 專案（或直接用倉庫裡的範例）：

   ```sh
   cargo new hello_deer
   cd hello_deer
   ```

2. 把 deer-gui 加為路徑相依（見[安裝](../installation.md)）：

   ```toml
   [dependencies]
   deer-gui = { path = "path/to/deer-gui/crates/deer-gui" }
   ```

3. 把下面「完整範例」的程式碼寫進 `src/main.rs`，然後 `cargo run`。

## 完整範例

```rust
use deer_gui::prelude::*;
use deer_gui::render_tree_to_png;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    // ① 用命令式 API 建一棵樹：一個直排容器，裡面一個文字、一排兩顆按鈕
    let mut app = Builder::new(Kind::Column, "app").padding(12.0).gap(8.0);
    app.text("標題");
    app.container_opts(Kind::Row, "bar", L::new().gap(8.0).to_props(), |r| {
        r.button("確定");
        r.button("取消");
    });
    let tree = app.build();

    // ② 一步算繪成 PNG 檔案（320×200 像素）
    let png = render_tree_to_png(&tree, 320, 200, Theme::default())?;
    std::fs::write("ui.png", png)?;

    // ③ 順手把版面配置幾何印出來（除錯版面配置時很有用）
    let geo = deer_gui::layout_tree(&tree, 320, 200, Theme::default());
    for (id, rect) in &geo {
        println!("{id}: x={} y={} w={} h={}", rect.x, rect.y, rect.w, rect.h);
    }
    Ok(())
}
```

執行：

```sh
cargo run
```

成功後當前目錄會出現 `ui.png` —— 一個深色背景、帶一個標題和兩顆按鈕的介面。

不想寫檔案、想直接拿像素？`render_tree_to_rgba(&tree, w, h, theme)` 回傳
`(width, height, RGBA8 位元組)`（列優先、無 padding）。只看版面配置用
`deer_gui::layout_tree`。

在倉庫裡可以直接跑等價範例：

```sh
cargo run -p deer-gui --example render_to_png    # 產出 render_out/render_to_png.png
cargo run -p deer-gui --example geometry         # 版面配置與命中測試，帶自檢斷言
```

> **注意**：`render_tree_to_png` **不載入字型**，畫出來的「字」是等寬佔位方塊。
> 這是老入口的既定行為 —— 真實字形要走第 5 步的文字引擎路徑。兩條路徑上，
> 幾何、層次、顏色都是真的。

## 本節用到的 API

| API | 作用 | 詳細文件 |
|---|---|---|
| `Builder::new(kind, id)` | 建一個根節點 | [命令式構築](../../api/builder.md) |
| `render_tree_to_png` | 樹 → PNG 位元組流 | [門面 crate](../../api/deer_gui.md) |
| `render_tree_to_rgba` | 樹 → RGBA8 像素 | [門面 crate](../../api/deer_gui.md) |
| `layout_tree` | 只算幾何表 | [版面配置引擎](../../api/layout.md) |
| `Theme::default()` | 預設深色主題 | [繪製與主題](../../api/draw.md) |

## 下一步

樹是怎麼搭出來的？去 [第 2 步：用 Builder 搭介面樹](02_builder.md)。
