# 第 3 步：布局参数与对齐

## 目标

会用 `L`（`LayoutProps` 的便捷构造器）表达尺寸（像素 / 百分比）、间距、主轴 / 交叉轴对齐与 `grow`，并理解「显式尺寸 > 父分配 > 固有尺寸」的优先级。

## 操作步骤

1. 容器的布局参数用 `L::new().…` 链式构造，最后 `.to_props()` 交给 `container_opts`：
   - `w(px)` / `h(px)`：显式尺寸；百分比用 `Size::Pct(50.0)`（相对**父内容盒**解析）；
   - `pad(px)`：四边内边距；`gap(px)`：子节点间距；
   - `main(Align)`：主轴对齐（`Row` 的水平方向 / `Column` 的垂直方向）；
   - `cross(Align)`：交叉轴对齐；`Align::Stretch` 会吃满交叉轴；
   - `grow(w)`：剩余主轴空间的分配权重。
2. 记住固有尺寸的语义（I-8）：容器主轴 = **sum(子)**，交叉轴 = **max(子)**。
3. `layout()` 是纯函数：喂树 + 根盒子，拿回几何表 —— 不满意就改参数再算，树永远不会被改。

## 完整示例

```rust
use deer_gui::prelude::*;

fn main() {
    // 顶栏：固定高 40，水平居中，子节点间距 8
    let tree = Node::new(Kind::Column, "app")
        .with_layout(L::new().w(280.0).h(160.0).pad(8.0).gap(8.0).to_props())
        .push(
            Node::new(Kind::Row, "topbar")
                .with_layout(
                    L::new().h(40.0).gap(8.0).main(Align::Center).cross(Align::Center).to_props(),
                )
                .push(Node::new(Kind::Button, "").with_label("左"))
                .push(Node::new(Kind::Button, "").with_label("右")),
        )
        // grow = 1：吃掉剩余的垂直空间
        .push(
            Node::new(Kind::Text, "content")
                .with_layout(L::new().grow(1.0).to_props())
                .with_label("正文区域"),
        )
        // 底部按钮：交叉轴拉伸（吃满宽度）
        .push(
            Node::new(Kind::Button, "wide")
                .with_layout(L::new().cross(Align::Stretch).to_props())
                .with_label("占满一整行"),
        );

    let geo = layout(
        &tree,
        Rect::new(0.0, 0.0, 300.0, 200.0), // 根盒子由宿主给（I-5：根不撑满，以上面的显式尺寸为准）
        TextStyle::default(),
        &ApproxMeasure,
    );
    for (id, r) in &geo {
        println!("{id}: {r:?}");
    }
}
```

```sh
cargo run
```

## 优先级与边界

| 情况 | 结果 |
|---|---|
| 显式像素尺寸存在 | **采信**它（但被夹在可用空间内，I-6） |
| 只有百分比 | 相对**父内容盒**解析（不是「父分配尺寸」，I-7 的静默错误来源） |
| 都没有 | 用固有尺寸（Button ≥ 28×22，Field ≥ 60×22，见 `metrics` 常量） |
| `main_axis: Stretch` | 主轴剩余空间被**均分**吃掉 |
| `cross_axis: Stretch` | 交叉轴直接吃满 |

> **百分比陷阱**：`50%` 解析基准是父的**内容盒**（内边距以内的区域）。把它理解成
> 「父分配给我的空间的一半」是一个真实发生过的静默错误 —— 布局仍有值，只是值错了。

## 本节用到的 API

| API | 作用 | 详细文档 |
|---|---|---|
| `L` | `LayoutProps` 便捷构造器 | [命令式构筑](../../api/builder.md) |
| `Size::Px` / `Size::Pct` | 像素 / 百分比尺寸 | [节点数据模型](../../api/node.md) |
| `Align` | 主轴 / 交叉轴对齐 | [节点数据模型](../../api/node.md) |
| `layout()` | 树 → 几何表（纯函数） | [布局引擎](../../api/layout.md) |
| `measure_tree` | 只看固有尺寸 | [布局引擎](../../api/layout.md) |

## 下一步

同一棵树能不能不写 Rust、直接写成文本？[第 4 步：用 .dui 场景文件描述界面](04_scene_file.md)。
