# 第 4 步：用 .dui 场景文件描述界面

## 目标

学会 `.dui` 场景文件语法（思路类似 Godot 的 `.tscn`），用文本描述一棵与命令式 API **结构相等**的树，并理解解析的严格性：写错的属性会报错，而不是静默无效。

## 操作步骤

1. 写一个 `ui.dui` 文件：每行一个节点 `[类型 属性=值 …]`，**缩进必须是 2 的倍数**，缩进层级就是父子关系。
2. 用 `parse_scene(text, "ui.dui")` 解析成 `Node` —— 返回 `Result`，错误带**行号**。
3. 场景文件来自数据时也一样安全：解析是纯文本处理，**不执行任何东西**。

## 完整示例

`ui.dui`：

```text
# 井号到行尾是注释（引号里的 # 不算）
[column name=app pad=12 gap=8]
  [text label=标题]
  [row name=bar gap=8]
    [button label=确定]
    [button label=取消 disabled]
```

`main.rs`：

```rust
use deer_gui::prelude::*;
use deer_gui::render_tree_to_png;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let src = std::fs::read_to_string("ui.dui")?;
    let tree = parse_scene(&src, "ui.dui")?; // Err 里带行号与来源文件名

    // 与命令式路径完全等价的写法（两棵树结构相等）：
    //   let mut app = Builder::new(Kind::Column, "app").padding(12.0).gap(8.0);
    //   app.text("标题");
    //   app.container_opts(Kind::Row, "bar", L::new().gap(8.0).to_props(), |r| {
    //       r.button("确定");
    //       r.button_opts("取消", |b| { b.props.disabled = true; });
    //   });

    std::fs::write("scene.png", render_tree_to_png(&tree, 320, 200, Theme::default())?)?;
    Ok(())
}
```

```sh
cargo run
```

## 属性速查

| 属性 | 接受的值 | 对应 `LayoutProps` / `NodeProps` |
|---|---|---|
| `name` | 字符串（可省略 → 自动生成 `kind_N`） | `Node.id` |
| `w` / `h` | 数字或百分比（`280` / `50%`） | `width` / `height` |
| `pad` / `gap` | 数字 | `padding` / `gap` |
| `main` / `cross` | `start` / `center` / `end` / `stretch` | `main_axis` / `cross_axis` |
| `grow` | 数字 | `grow` |
| `scroll` | **裸属性**（不接受值） | `scroll`（见第 8 步） |
| `wrap` | **裸属性** | `wrap`（见第 8 步） |
| `label` | 字符串（含空格用引号：`label="确 定"`） | `props.label` |
| `disabled` | **裸属性** | `props.disabled` |

## 严格性的三条规则

1. **开关属性带值就报错**：`scroll=1` 不是「当真」，是 `Err` ——「写错了但不生效」属于最难查的 bug，解析器宁可大声失败。
2. **未知属性报错**：可用属性列表就是上面这张表，多一个字母都不行。
3. **只能有一个根节点**；叶子节点（`text` / `button` / `field`）下面不能再挂子节点。

需要把树序列化回文本（做编辑器、做快照测试）？`encode_scene(&tree)` ——
且 `parse_scene(encode_scene(t))` 与 `t` 结构相等（往返不变式有测试钉着）。

## 本节用到的 API

| API | 作用 | 详细文档 |
|---|---|---|
| `parse_scene` | `.dui` 文本 → `Node` | [场景文件](../../api/scene.md) |
| `encode_scene` | `Node` → `.dui` 文本 | [场景文件](../../api/scene.md) |
| `SceneError` | 带行号的解析错误 | [场景文件](../../api/scene.md) |

## 下一步

[第 5 步：真实字体渲染文本](05_text.md) —— 让文字长出真正的字形。
