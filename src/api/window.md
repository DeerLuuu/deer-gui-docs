# 窗口层（App / run / Waker）

**crate**：`deer-window`（`deer-gui` 开 `window` feature 后经 `deer_gui::window` 使用）

## 功能说明

「原生窗口 + 事件循环」层，也是本 workspace **唯一引入第三方依赖**（`winit 0.30`）的地方。它把窗口的原生句柄以 HAL 的不透明形式（`RawWindowHandle`）交给渲染层 —— 渲染后端不依赖 winit，所以换窗口实现不动渲染栈。

边界：**只有 Windows** 的句柄填法实现了；其它平台 `run()` 明确返回
`UNSUPPORTED_PLATFORM_MSG`，**不静默填 0**。窗口本身用 winit，其它平台「能开窗」，只是句柄交给 HAL 这一步未实现。

## `App` trait（你实现它，`run` 负责其余）

| 方法 | 时机 | 默认实现 |
|---|---|---|
| `init(&mut self, &WindowInfo) -> Result<(), String>` | 窗口建好后**调一次**（创建渲染器/交换链） | 必须实现 |
| `resized(w, h)` | 尺寸变化（物理像素；应重建交换链） | 什么都不做 |
| `redraw() -> Result<Flow, String>` | 每一帧 | 必须实现 |
| `input(&mut self, &WindowInfo, &InputEvent) -> Result<Flow, String>` | 每条输入事件 | 什么都不做 |
| `close_requested() -> Flow` | 关闭请求 | `Flow::Exit` |
| `wants_redraw() -> bool` | **每条输入之后**问一次 | `false` |
| `redraw_policy() -> RedrawPolicy` | 启动时读一次 | `OnDemand` |
| `wake_handle(Waker)` | 建窗后调一次（**存下来**） | 什么都不做 |
| `next_deadline() -> Option<Instant>` | 每轮事件循环收敛时问（拉式预约） | `None` |
| `on_wake_stats(&WakeStats)` | 收尾调一次（唤醒账本；只适合记账/断言） | 什么都不做 |

所有回调都在**主线程**调用。任何回调返回 `Err` ⇒ `run()` 打印原因并返回 `Err`（绝不吞掉）；`Flow::Exit` 请求结束事件循环。

## 其余类型

| 类型 | 要点 |
|---|---|
| `WindowConfig` | `new(title, width, height)`（**逻辑**尺寸，建窗时换算）；默认 800×600 无标题；`display_title()` 会加 `deer-gui — ` 前缀 |
| `WindowInfo` | `{ raw: RawWindowHandle, extent: Extent }`（当前物理尺寸；`Resized` 后同步） |
| `Flow` | `Continue` / `Exit` |
| `RedrawPolicy` | `OnDemand`（默认，省电）/ `Continuous`（每帧续下一帧）；可被环境变量 `DEER_WINDOW_REDRAW=continuous` 运行时强制覆盖 |
| `Waker` | `wake()`（提示：问 `wants_redraw`，答真才画）/ `wake_after(Duration)`（预约：到点**一律**画一帧）；可 `Clone`、`Send` |
| `InputEvent` / `Key` / `Mods` / `PointerButton` | 输入模型（与 [交互层](interaction.md) 同一份定义） |
| `WakeStats` / `FrameCounter` | 账本（frames / requests / skipped / iters …） |

## 置位规则（重绘的六条）

| 触发 | 是否请求重绘 |
|---|---|
| 输入事件 | **只有 `wants_redraw()` 为真** |
| 系统事件（`Resized` / `Focused` / 窗口重新暴露 / 引导帧） | **一律** |
| `RedrawRequested` 到达 | 才调 `redraw()` |
| `RedrawPolicy::Continuous` | 每画完一帧续下一帧 |
| `Waker::wake()` | 问 `wants_redraw`，答真才画 |
| `wake_after` / `next_deadline` 到点 | **一律**（App 自己下的单） |

事件循环默认睡在 `ControlFlow::Wait` 上 —— **没有 App 声明的 deadline 就一个纳秒的超时都不设**（省电承诺）。启动时打印自证行（策略解析结果），收尾打印「重绘账本」与「唤醒账本」。

## 使用示例

最小可运行 `App` 见[第 6 步](../getting_started/step_by_step/06_window.md)；
「树 → 窗口」的完整样板：

```sh
cargo run -p deer-gui --features window --example hello_window    # 树 → 窗口 8 步
cargo run -p deer-gui --features window --example counter         # 最小可交互界面
cargo run -p deer-gui --features window --example window_parity   # 上屏 vs CPU 逐像素对照
```

```rust,ignore
// 省电模式下的定时动画：用 Waker 排下一次，而不是退化成 Continuous
fn wake_handle(&mut self, waker: Waker) { self.waker = Some(waker); }
fn redraw(&mut self) -> Result<Flow, String> {
    if let Some(w) = &self.waker {
        w.wake_after(std::time::Duration::from_millis(16)); // 60fps 排下一帧
    }
    Ok(Flow::Continue)
}
```

## 注意事项

- **`run()` 必须在主线程调用**（winit 的要求）；
- `next_deadline()` 必须给出**固定的时刻**并自己往前推：每次都返回 `Instant::now() + 50ms`
  会让它**永远不到点**（每 50ms 醒一次却一帧不画，空转）。定时推进用 `Waker::wake_after`；
- 已过期的 deadline 视为「立刻到点」⇒ 画一帧；不清理就等于自己要求连续重绘；
- 输入事件的坐标是**物理像素**（本层不做 DPI 换算）；字符与物理键是**两条事件**
  （文本走 `TextInput`，`Enter`/`Tab`/`Backspace`/`Esc` 只有 `KeyDown`）；
- IME：预编辑不建模（只用来抑制重复上屏）；触摸/拖放/设备事件未接线；
- 别只看退出码：窗口层的账本是打印出来的行，验收要 grep。
