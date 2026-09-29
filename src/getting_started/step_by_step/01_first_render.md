# 第 1 步：环境就绪，渲染第一张图

## 目标

不碰窗口、不碰 GPU，把一棵两行代码的界面树**离屏渲染成 PNG 文件**，确认整条「树 → 布局 → 绘制 → 像素」的通路在你机器上是通的。

## 操作步骤

1. 新建一个 Rust 项目（或直接用仓库里的示例）：

   ```sh
   cargo new hello_deer
   cd hello_deer
   ```

2. 把 deer-gui 加为路径依赖（见[安装](../installation.md)）：

   ```toml
   [dependencies]
   deer-gui = { path = "path/to/deer-gui/crates/deer-gui" }
   ```

3. 把下面「完整示例」的代码写进 `src/main.rs`，然后 `cargo run`。

## 完整示例

```rust
use deer_gui::prelude::*;
use deer_gui::render_tree_to_png;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    // ① 用命令式 API 建一棵树：一个竖排容器，里面一个文本、一行两个按钮
    let mut app = Builder::new(Kind::Column, "app").padding(12.0).gap(8.0);
    app.text("标题");
    app.container_opts(Kind::Row, "bar", L::new().gap(8.0).to_props(), |r| {
        r.button("确定");
        r.button("取消");
    });
    let tree = app.build();

    // ② 一步渲染成 PNG 文件（320×200 像素）
    let png = render_tree_to_png(&tree, 320, 200, Theme::default())?;
    std::fs::write("ui.png", png)?;

    // ③ 顺手把布局几何打印出来（调试布局时很有用）
    let geo = deer_gui::layout_tree(&tree, 320, 200, Theme::default());
    for (id, rect) in &geo {
        println!("{id}: x={} y={} w={} h={}", rect.x, rect.y, rect.w, rect.h);
    }
    Ok(())
}
```

运行：

```sh
cargo run
```

成功后当前目录会出现 `ui.png` —— 一个深色背景、带一个标题和两颗按钮的界面。

不想写文件、想直接拿像素？`render_tree_to_rgba(&tree, w, h, theme)` 返回
`(width, height, RGBA8 字节)`（行优先、无 padding）。只看布局用
`deer_gui::layout_tree`。

在仓库里可以直接跑等价示例：

```sh
cargo run -p deer-gui --example render_to_png    # 产出 render_out/render_to_png.png
cargo run -p deer-gui --example geometry         # 布局与命中测试，带自检断言
```

> **注意**：`render_tree_to_png` **不加载字体**，画出来的「字」是等宽占位方块。
> 这是老入口的既定行为 —— 真实字形要走第 5 步的文本引擎路径。两条路径上，
> 几何、层次、颜色都是真的。

## 本节用到的 API

| API | 作用 | 详细文档 |
|---|---|---|
| `Builder::new(kind, id)` | 建一个根节点 | [命令式构筑](../../api/builder.md) |
| `render_tree_to_png` | 树 → PNG 字节流 | [门面 crate](../../api/deer_gui.md) |
| `render_tree_to_rgba` | 树 → RGBA8 像素 | [门面 crate](../../api/deer_gui.md) |
| `layout_tree` | 只算几何表 | [布局引擎](../../api/layout.md) |
| `Theme::default()` | 默认深色主题 | [绘制与主题](../../api/draw.md) |

## 下一步

树是怎么搭出来的？去 [第 2 步：用 Builder 搭界面树](02_builder.md)。
