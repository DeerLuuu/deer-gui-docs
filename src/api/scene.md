# 场景文件（parse_scene / encode_scene）

**模块**：`deer_layout::scene`

## 功能说明

`.dui` 场景文件是 deer-gui 的声明式描述格式（思路类似 Godot 的 `.tscn`）：缩进 + 段头的行式语法，与[命令式 Builder](builder.md) 产出**结构相等**的树。

为什么是「缩进 + 段头」而不是 JSON/TOML：与 `.tscn` 同族手感；**零依赖**（本仓库硬不变量）；行式解析能给出**行号**，错误信息可用。**安全性**：纯解析，不执行任何东西（场景文件可能来自数据）。

## 函数

| 函数 | 签名 | 说明 |
|---|---|---|
| `parse_scene` | `(src: &str, source: &str) -> Result<Node, SceneError>` | 文本 → 树；`source` 是出错时显示的来源名（通常是文件名） |
| `encode_scene` | `(root: &Node) -> String` | 树 → 文本；`parse_scene(encode_scene(t))` 与 `t` 结构相等（往返不变式有测试） |

### `SceneError`

| 字段 | 类型 | 说明 |
|---|---|---|
| `message` | `String` | 错误描述（含期望写法） |
| `line` | `usize` | 行号（从 1 起） |
| `source` | `String` | 来源名 |

`Display` 输出形如 `ui.dui:5: 缩进必须是 2 的倍数，实际 3`。

## 语法

```text
# 井号到行尾是注释（引号里的 # 不算；空行忽略）
[column name=app pad=12 gap=8]
  [text label=标题]
  [row gap=8]
    [button label=确定]
    [button label=取消 disabled]
```

规则：

- 每行一个节点：`[类型 属性=值 …]`；类型必须是 `column` / `row` / `text` / `button` / `field`；
- **缩进必须是 2 的倍数**，缩进层级即父子关系；
- 只能有一个根节点；叶子节点下不能再挂子节点；
- 属性值含空格 / 引号 / `#` / `=` 时用双引号：`label="确 定"`。

### 属性表

| 属性 | 值的形式 | 对应字段 |
|---|---|---|
| `name` | 字符串（可省略 → 自动 `kind_N`） | `Node.id` |
| `w` / `h` | 数字或百分比（`280` / `50%`） | `layout.width` / `layout.height` |
| `pad` / `gap` | 数字 | `layout.padding` / `layout.gap` |
| `main` / `cross` | `start` / `center` / `end` / `stretch` | `main_axis` / `cross_axis` |
| `grow` | 数字 | `layout.grow` |
| `scroll` / `wrap` | **裸属性**（写了就为真；**带值报错**） | `layout.scroll` / `layout.wrap` |
| `label` | 字符串 | `props.label` |
| `disabled` | **裸属性**（带值报错） | `props.disabled` |

## 使用示例

```rust
use deer_gui::prelude::*;

let src = r#"
[column name=app pad=12 gap=8]  # 行内注释也行
  [text label=标题]
  [row gap=8]
    [button label=确定]
"#;

let tree = parse_scene(src, "inline")?;
let back = encode_scene(&tree);
assert!(parse_scene(&back, "roundtrip")?.structurally_eq(&tree));
```

## 注意事项

- **开关属性带值就报错**：`scroll=1` 不是「当真」，是 `Err` ——「写错了但不生效」属于最难查的
  bug，解析器宁可大声失败（`disabled` 也走这条：它以前默默把任何值当假）；
- **未知属性报错**：可用属性就是上面那张表；未知**类型**也报错；
- 显式 `name` 会被 `IdGen` 占号，自动 id 不会撞上它 —— 与 Builder 同一条规则；
- 数字属性必须可解析为 `f32`，否则报错（带行号与原文）；
- 与 Builder 的等价性有测试钉住（`t1_two_authoring_paths_produce_the_same_tree`），
  改语法前先读 `CONTRIBUTING.md` 的设计约束。

相关教程：[第 4 步](../getting_started/step_by_step/04_scene_file.md)。
