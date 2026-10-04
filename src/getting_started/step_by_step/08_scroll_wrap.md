# 第 8 步：滚动与文本换行

## 目标

给长内容加**滚轮垂直滚动**，让长文本**按宽度换行**。两者都是 opt-in 的显式声明：`scroll`（只对 `Column` 有意义）与 `wrap`（只对 `Text` 有意义）。

## 操作步骤

### 垂直滚动

1. 给容器声明滚动：`L::new().scroll(true).to_props()`，或场景文件里写裸属性 `scroll`。
   「可滚动容器」的唯一判据是 `Node::is_scroll_container()`（`Column` + `scroll`）——
   布局、渲染、交互三处共用，`Row` 上设了会被**忽略**（本期只做垂直滚动）。
2. 滚动偏移住在 `UiState.scroll`（`ScrollState`）里：**偏移是布局的输入，上限是布局的输出**。
3. 每帧：`layout_with_scroll(root, box, style, &measure, &state.scroll.offsets)` 拿
   `(geometry, metrics)`，然后**立刻** `state.scroll.set_metrics(&metrics)` 灌回去 ——
   它会把旧偏移夹进新上限（视口/内容变了也不残留越界偏移）。
4. 滚轮不用你写：`handle` 里 `Wheel { dy }` 会找 `hover` 最近的可滚动祖先，
   按 `dy × 40px`（`WHEEL_STEP_PX`）滚，夹在 `[0, max_scroll]`，变了才发 `Scrolled` 事件。

### 文本换行

1. 给 `Text` 节点声明换行：`L::new().wrap(true).w(200.0).to_props()` —— **换行宽度 =
   节点自己的像素宽度**。没声明像素宽度 ⇒ 节点宽 = 文本宽 ⇒ 换不了行（这是被测试钉住的边界）。
2. 场景文件写法：`[text label=长文本 w=200 wrap]`。
3. 高度自动算对：固有高 = **实际行数 × 行高** —— 行数只有一处定义（`Measure::wrap`），
   布局预留与渲染绘制永远不会「预留 2 行、画出 3 行」。

## 完整示例

```rust
use deer_gui::prelude::*;

fn main() {
    // 一个 160 高的可滚动 Column，里面塞 6 段文本；第二段声明了按 200px 宽换行
    let mut list = Node::new(Kind::Column, "list")
        .with_layout(L::new().w(240.0).h(160.0).pad(8.0).gap(4.0).scroll(true).to_props());
    for i in 1..=6 {
        let mut t = Node::new(Kind::Text, "").with_label(format!("第 {i} 段文本"));
        if i == 2 {
            t.layout.wrap = true;
            t.layout.width = Some(Size::Px(200.0)); // 换行宽度 = 自己的像素宽度
        }
        list.children.push(t);
    }

    // 偏移是布局的输入；没登记的 id ⇒ 偏移 0（永远给出确定结果）
    let offsets = ScrollOffsets::new();
    let (geo, metrics) = layout_with_scroll(
        &list, Rect::new(0.0, 0.0, 260.0, 180.0), TextStyle::default(), &ApproxMeasure, &offsets,
    );
    println!("list 的滚动上限 = {}px", metrics.max_of("list"));

    // 想直接跳到某处：ScrollOffsets::new().with("list", 40)，再算一次布局即可
}
```

```sh
cargo run
```

可运行的交互版（滚轮真的能滚）：

```sh
cargo run -p deer-gui --example scroll
```

## 语义要点

| 规则 | 说明 |
|---|---|
| `max_scroll = max(0, 内容主轴尺寸 + 间隙 + 内边距 − 视口)` | 布局的输出，整数像素 |
| 偏移夹取 | 滚到边界不越界；越界偏移被**静默丢弃**，不渗进几何 |
| 容器自身矩形不动 | 滚动只改**内部内容**的相对位置（整体位移 `-offset`） |
| 滚动容器的子节点 | 主轴显式尺寸**不被视口夹取**（否则「内容高于视口」前提不成立）；`grow` 失效（没有剩余空间可分） |
| 灌漏了 metrics | 上限全为 0 ⇒ 滚轮什么都不做（fail-closed，不会滚进「没有上限的虚空」） |
| 换行算法 `wrap_greedy` | 按**空格 / 制表**切词贪心塞行；单词超宽按字符硬切；`max_width <= 0` 不换行 |

> **中文文本提示**：切词只认空格 / 制表。一段没有空格的中文是一个「单词」，
> 超出宽度时走**按字符硬切**——结果确定、逐字折行，符合预期；但如果你在英文单词中间
> 期待「按词断行」，记得源文本里要有空格。

## 滚动条与惯性滚动（已落地）

- **可视滚动条**：`scrollbar_geom(viewport, offset, max_scroll)` 给出轨道 + 滑块几何
  （宽度 `SCROLLBAR_W`、贴边内缩 `SCROLLBAR_INSET`、最小滑块高 `SCROLLBAR_MIN_THUMB`；
  内容装得下 ⇒ 返回 `None` 不画）。交互层接线后：**拖滑块改偏移**，**点轨道空白跳到指针处**并可续拖。
- **惯性滚动**：滚轮滚动时自动播种惯性（滚多远滑多远），但**不会自己滚** ——
  需要调用方显式驱动：`redraw` 里调 `advance_inertia(&mut state)` 推进一步，
  `next_deadline` 用 `inertia_deadline(state)` 排下一次唤醒。真实窗口的完整接线见示例
  `scroll_inertia_window`。

细节见[布局引擎](../../api/layout.md)与[交互层](../../api/interaction.md)。

```sh
cargo run -p deer-gui --example scroll_bar            # 可视滚动条（离屏自检）
cargo run -p deer-gui --features window --example scroll_inertia_window   # 惯性滚动（真窗口）
```

## 本节用到的 API

| API | 作用 | 详细文档 |
|---|---|---|
| `layout_with_scroll` | 布局 + 滚动（返回几何与上限） | [布局引擎](../../api/layout.md) |
| `ScrollOffsets` / `ScrollMetrics` | 偏移（输入）/ 上限（输出） | [布局引擎](../../api/layout.md) |
| `ScrollState::set_metrics` | 每帧灌回上限并夹取旧偏移 | [交互层](../../api/interaction.md) |
| `Node::is_scroll_container` / `wraps_text` | 判据的唯一出处 | [节点数据模型](../../api/node.md) |
| `wrap_greedy` | 换行算法（唯一实现） | [布局引擎](../../api/layout.md) |

## 下一步

[第 9 步：用 testkit 写界面测试](09_testing.md) —— 把以上一切变成十几行的可断言测试。
