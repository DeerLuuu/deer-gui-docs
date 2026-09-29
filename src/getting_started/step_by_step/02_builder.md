# 第 2 步：用 Builder 搭界面树

## 目标

掌握 `Builder` 的三种挂载方式（叶子、带参数叶子、容器嵌套），理解它返回的 **id** 有什么用，以及 id 是如何保证确定性的。

## 操作步骤

1. `Builder::new(kind, id)` 创建根节点；`.padding()` / `.gap()` / `.size()` 链式设置**根节点**的布局参数。
2. 用 `app.text("…")` / `app.button("…")` / `app.field("…")` 追加叶子控件 —— 返回值就是该节点的 **id**（留着给事件用）。
3. 需要就地改参数时用 `_opts` 变体：`app.text_opts("…", |n| n.layout.wrap = true)`。
4. 用 `container` / `container_opts` + 闭包嵌套容器；闭包里 `push` 的节点都挂在容器下。
5. `app.build()` 把树**克隆**出来交给布局 / 渲染 —— `Builder` 本身还在，可以继续改。

## 完整示例

```rust
use deer_gui::prelude::*;
use deer_gui::render_tree_to_png;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut app = Builder::new(Kind::Column, "app").padding(12.0).gap(8.0);

    // 叶子控件：返回 id（事件关联用，不进树 —— 树是纯数据）
    let ok_id = app.text("准备好了吗？");

    // 带参数的叶子：就地改 Node（这里是禁用一个按钮）
    let cancel_id = app.button_opts("取消", |b| {
        b.props.disabled = true;
    });

    // 容器 + 闭包式嵌套：闭包里的调用都挂到这个 Row 下
    app.container(Kind::Row, "actions", |r| {
        r.button("确定");
        r.button("再想想");
    });

    let tree = app.build();
    std::fs::write("builder.png", render_tree_to_png(&tree, 320, 180, Theme::default())?)?;

    println!("确定按钮 id = {ok_id}，取消按钮 id = {cancel_id}");
    println!("根节点 id = {}", app.root_id());
    Ok(())
}
```

```sh
cargo run
```

## 关键规则（踩过的坑，别绕回来）

- **id 是确定性的**：不命名时由 `IdGen` 按 kind 计数生成 `text_1` / `button_1` 这样的 id；
  显式命名的节点会「占号」，自动 id 永远不会撞上它。两条构筑路径（Builder / 场景文件）
  共用同一规则 —— 否则两棵树就不结构相等了。
- **id 会随树的结构漂移**：自动 id 依赖「第几个出现的同 kind 节点」。某个节点的内容每帧都变、
  你要按 id 定位它（比如脚本 `move @count`）—— 那就给它**显式 id**（用 `Node` 链式构造或
  `container_opts` 的 id 参数）。
- **`Builder::new().padding()` 只作用于根节点**。给嵌套容器设布局参数要用
  `container_opts(kind, id, L::new().pad(8.0).to_props(), |…| …)`。
- **先设参数、最后定 id** 是库内部的事，但如果你直接用 `Node::with_props` 链式构造，
  顺序写反会把 id 整块覆盖掉（源码注释里记的踩坑）。

需要更强的布局控制（尺寸、对齐、grow）？那是下一步的内容。

## 本节用到的 API

| API | 作用 | 详细文档 |
|---|---|---|
| `Builder::text` / `button` / `field` | 追加叶子，返回 id | [命令式构筑](../../api/builder.md) |
| `Builder::text_opts` / `button_opts` | 叶子 + 就地改参数 | [命令式构筑](../../api/builder.md) |
| `Builder::container` / `container_opts` | 容器 + 闭包嵌套 | [命令式构筑](../../api/builder.md) |
| `Builder::build` | 克隆出 `Node` 树 | [节点数据模型](../../api/node.md) |
| `IdGen` | 确定性 id 生成规则 | [节点数据模型](../../api/node.md) |

## 下一步

[第 3 步：布局参数与对齐](03_layout_props.md) —— 让子节点真正排成你想要的样子。
