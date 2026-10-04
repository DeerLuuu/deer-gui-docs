# 第 7 步：输入、点击与焦点

## 目标

把窗口层的输入事件接进**交互层**：命中测试（含裁剪与禁用）、悬停 / 按下 / 点击状态机、`Tab` 焦点循环、输入框文本，以及「有事件 = 需要重绘」的约定。

## 操作步骤

1. 每帧先算几何（要滚动就用 `layout_with_scroll`，见第 8 步），并从绘制列表派生裁剪快照 `ClipSnapshot::from_draw_list`。
2. 维护一个 `UiState`（交互状态的唯一真相），把每条 `InputEvent` 喂给 `interaction::handle`。
3. `handle` 返回一串 `UiEvent` —— **有事件 = 状态变了 = 需要重绘**；不发事件但改了 `pressed` 这类情况用 `UiState::same_visual` 兜底比对。
4. 事件用 **id** 关联：`UiEvent::Clicked(id)` 告诉你点的是谁，树里没有回调可注册。
5. 输入框文本在 `state.texts`（id → 内容），光标在 `state.carets`（id → **字符位**，不在表里 = 末尾）；不在 `texts` 表里的输入框视为空串。

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
| `PointerMoved` | 同步 `hover`（变了才发 `HoverChanged`）；**捕获中 ⇒ 路由给捕获者**：hover 钉在捕获节点上（T3.7 指针捕获，拖出不换人） |
| `PointerDown { Left }` | 同步 `hover`；命中的**可聚焦控件** ⇒ 聚焦它；记 `pressed` = **捕获**（按下即捕获，D7） |
| `PointerUp { Left }` | **按捕获者结算 `Clicked`**（抬起在哪都算 —— 拖出节点/整棵树再抬起仍是它的点击）；释放捕获；落点是选择类组的直接子节点 ⇒ 追加 `SelectionChanged` / `ChipToggled` / `TabChanged`；落点是 `Switch` ⇒ 追加 `Toggled` |
| `PointerDown { Right }` | **按下即发 `PointerRight`**（T3.3 纯透传：不参与焦点 / `pressed` / `Clicked`；禁用子树不发） |
| `KeyDown { Tab }` | 树序循环焦点（`Shift` 反向）⇒ `FocusChanged`；焦点从值输入框离开 ⇒ 失焦提交 |
| `KeyDown { Escape }` | 清焦点 |
| `KeyDown { Enter }` | 焦点在启用的按钮 ⇒ `Clicked`（键激活 = 点击）；焦点在启用的开关 ⇒ `Clicked` + 翻转；焦点在值输入框 ⇒ **提交**（解析 → 值事件 → 规范化回写） |
| `KeyDown { Char(' ') }`（= winit 的 Space） | 焦点在启用的开关 ⇒ 与 `Enter` 同一条翻转路径；其余不消费 |
| `KeyDown { Backspace }` | 焦点是启用的输入框 ⇒ 删**光标前**一个 Unicode 字符（光标退一位） |
| `TextInput` | 焦点是启用的输入框 ⇒ **插在光标处**（没动过光标时它在末尾） |
| `KeyDown { Left / Right }` | 焦点是启用的输入框 ⇒ 移动光标，**不发事件** |
| `KeyDown { Up / Down }` | 焦点**不是**输入框时：**几何邻近移动焦点**（T3.1，严格方向；无焦点不定义，到边停） |
| `KeyDown { PageUp / PageDown / Home / End }` | **按键滚动**（焦点不是输入框时）：焦点容器优先、退 `hover`；翻页 = 视口高，`Home`/`End` 到边 |
| `KeyDown { repeat: true }` | 与 `false` 同语义（T3.6：能区分；要不要忽略重复由调用方决定） |
| `ImePreedit` | 预编辑只进聚焦输入框的 `state.preedit` 缓冲（**不进 `texts`**，无双写）；空文本 = 取消；提交走 `TextInput` |
| `FocusChanged { focused: false }` | 窗口失焦：清 `hover` / `pressed` / 拖动锚点（`focus` / `texts` 不动） |
| `Wheel { dy }` | `hover` 最近的可滚动祖先偏移 `-dy × 40px` 并**播种惯性**（见第 8 步） |

只有**状态真的变了**才产出事件。不消费的输入：`KeyUp`、中键、非空格的 `Key::Char`/`Key::Other`、`ScaleFactorChanged`（DPI 只透传，坐标/尺寸不换算）——
匹配是穷尽的，将来加事件变体会编译报错，不会静默忽略（详见[已知边界](../../advanced/pitfalls.md)）。

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
