# 第 7 步：输入、点击与焦点

## 目标

把窗口层的输入事件接进**交互层**：命中测试（含裁剪与禁用）、悬停 / 按下 / 点击状态机、`Tab` 焦点循环、输入框文本，以及「有事件 = 需要重绘」的约定。

## 操作步骤

1. 每帧先算几何（要滚动就用 `layout_with_scroll`，见第 8 步），并从绘制列表派生裁剪快照 `ClipSnapshot::from_draw_list`。
2. 维护一个 `UiState`（交互状态的唯一真相），把每条 `InputEvent` 喂给 `interaction::handle`。
3. `handle` 返回一串 `UiEvent` —— **有事件 = 状态变了 = 需要重绘**；不发事件但改了 `pressed` 这类情况用 `UiState::same_visual` 兜底比对。
4. 事件用 **id** 关联：`UiEvent::Clicked(id)` 告诉你点的是谁，树里没有回调可注册。
5. 输入框文本在 `state.texts`（id → 内容）；不在表里的输入框视为空串。

## 完整示例

下面是「树 + 几何 + 交互」三件套接进窗口回调的最小骨架（完整可运行版见
`cargo run -p deer-gui --features window --example counter`）：

```rust,ignore
use deer_gui::gpu::build_draw_list;
use deer_gui::interaction::{self, ClipSnapshot, UiEvent, UiState};
use deer_gui::prelude::*;

struct Counter { tree: Node, state: UiState }

impl Counter {
    /// 一帧的闭环：几何 → 绘制列表 →（交给渲染器）；输入事件在别处喂进来
    fn draw_list(&self, w: u32, h: u32, theme: &Theme) -> DrawList {
        let geo = layout(&self.tree, Rect::new(0.0, 0.0, w as f32, h as f32),
                         TextStyle { font_size: theme.font_size, line_height: theme.line_height },
                         &ApproxMeasure);
        build_draw_list(&self.tree, &geo, theme.clone(), &ApproxMeasure)
    }

    /// 喂一条输入：返回是否需要重绘
    fn feed(&mut self, geo: &Geometry, clip: ClipSnapshot, ev: &InputEvent) -> bool {
        let events = interaction::handle(&mut self.state, &self.tree, geo, clip, ev);
        for ev in events {
            if let UiEvent::Clicked(id) = ev {
                println!("点击了 {id}");
            }
        }
        !events.is_empty()
    }
}
```

## `handle` 的事件 → 效果对照表

| 事件 | 效果 |
|---|---|
| `PointerMoved` | 同步 `hover`（变了才发 `HoverChanged`） |
| `PointerDown { Left }` | 同步 `hover`；命中的**可聚焦控件** ⇒ 聚焦它；记 `pressed` |
| `PointerUp { Left }` | 抬起处 == 按下处 ⇒ `Clicked`；无论如何清 `pressed` |
| `KeyDown { Tab }` | 树序循环焦点（`Shift` 反向）⇒ `FocusChanged` |
| `KeyDown { Escape }` | 清焦点 |
| `KeyDown { Enter }` | 焦点在启用的按钮上 ⇒ `Clicked`（键激活 = 点击） |
| `KeyDown { Backspace }` | 焦点是启用的输入框 ⇒ 删**一个 Unicode 字符** |
| `TextInput` | 焦点是启用的输入框 ⇒ 追加文本 |
| `FocusChanged { focused: false }` | 窗口失焦：清 `hover` / `pressed`（`focus` / `texts` 不动） |
| `Wheel { dy }` | `hover` 最近的可滚动祖先偏移 `-dy × 40px`（见第 8 步） |

只有**状态真的变了**才产出事件。右键 / 中键、方向键、按键重复、IME 预编辑本期不消费（详见[已知边界](../../advanced/pitfalls.md)）。

## 命中测试的语义

- 命中返回**最深**的节点（后序覆盖），区间是半开的 `[x, x+w)`；
- 交互层的 `hit` 在 `hit_test` 之上多查两道：**裁剪**与**禁用** —— 点在禁用子树或被裁掉的点上 ⇒ **没有命中**，**不回退**到祖先；
- 焦点序列 `focusables()` 只依赖树（Button / Field 且不在禁用子树里），所以零尺寸的按钮仍可被 `Tab` 聚焦，但屏幕上按不到 —— 刻意的：焦点序不引入第二套几何真相。

## 脚本化重放（调试利器）

输入事件全是值（没有句柄、没有闭包），所以可以写成文本脚本离屏重放 ——
脚本语法见[输入脚本语法](../../appendix/input_script.md)：

```sh
# counter 示例的确定性重放档（跑完自己退，退出码 0 = 断言全过）
cmd /c "set DEER_COUNTER_SCRIPT=@builtin&& cargo run -q -p deer-gui --features window --example counter"
```

## 本节用到的 API

| API | 作用 | 详细文档 |
|---|---|---|
| `handle` | 输入事件 → 状态机 + `UiEvent` | [交互层](../../api/interaction.md) |
| `UiState` | 交互状态唯一真相 | [交互层](../../api/interaction.md) |
| `ClipSnapshot::from_draw_list` | 从绘制列表派生裁剪 | [交互层](../../api/interaction.md) |
| `hit` | 命中测试（含裁剪 + 禁用） | [交互层](../../api/interaction.md) |
| `focusables` | `Tab` 焦点序列 | [交互层](../../api/interaction.md) |

## 下一步

[第 8 步：滚动与文本换行](08_scroll_wrap.md) —— 让长内容滚起来、让长文本折行。
