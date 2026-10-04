# 第 6 步：打开窗口

## 目标

用窗口层（`deer-window`，基于 `winit`）打开一个真窗口，实现 `App` trait 的生命周期回调，并理解**事件驱动重绘**：默认省电模式（`OnDemand`）下，没有变化的帧一帧都不画。

> **前置**：需要 `features = ["window"]`，且当前只有 **Windows** 支持把原生句柄交给渲染层
> （其它平台 `run()` 会明确返回「平台不支持」，不静默填 0）。

## 操作步骤

1. 写一个实现 `deer_gui::window::App` 的结构体；
2. 至少实现 `init`（建窗后调一次，创建渲染资源）与 `redraw`（画一帧）；
3. 用 `run(WindowConfig::new("标题", 800, 600), app)` 启动 —— **必须在主线程调用**；
4. 需要「输入改了状态才重绘」就在 `input` 里记账，并在 `wants_redraw` 里如实回答。

## 完整示例

```rust
use deer_gui::window::{App, Flow, InputEvent, Key, RedrawPolicy, WindowConfig, WindowInfo, run};

struct MyApp {
    /// 「刚才那条输入改了状态吗」的记账（wants_redraw 读它）
    dirty: bool,
}

impl App for MyApp {
    fn init(&mut self, info: &WindowInfo) -> Result<(), String> {
        println!(
            "窗口 {}x{}，HWND=0x{:X}",
            info.extent.width, info.extent.height, info.raw.handle
        );
        Ok(()) // 真实实现在这里创建 Vulkan 设备 / 交换链
    }

    fn redraw(&mut self) -> Result<Flow, String> {
        self.dirty = false; // 这一帧画完了，脏标记清掉
        Ok(Flow::Continue)
    }

    fn input(&mut self, _info: &WindowInfo, ev: &InputEvent) -> Result<Flow, String> {
        match ev {
            InputEvent::KeyDown { key: Key::Escape, .. } => return Ok(Flow::Exit),
            InputEvent::PointerDown { x, y, .. } => {
                println!("按下 ({x}, {y})");
                self.dirty = true; // 状态真的变了
            }
            _ => {}
        }
        Ok(Flow::Continue)
    }

    fn wants_redraw(&self) -> bool {
        self.dirty // 为真才会请求重绘；系统事件（Resized 等）不看它，一律重画
    }

    fn redraw_policy(&self) -> RedrawPolicy {
        RedrawPolicy::OnDemand // 默认值；动画类 App 才返回 Continuous
    }
}

fn main() -> Result<(), String> {
    run(WindowConfig::new("hello", 800, 600), MyApp { dirty: false })
}
```

```sh
cargo run --features window
```

## App 生命周期速查

| 回调 | 时机 | 默认实现 |
|---|---|---|
| `init(&WindowInfo)` | 窗口建好后**调一次** | 必须自己实现 |
| `resized(w, h)` | 尺寸变化（物理像素），应重建交换链 | 什么都不做 |
| `redraw()` | 每一帧 | 必须自己实现 |
| `input(&WindowInfo, &InputEvent)` | 每条输入事件 | 什么都不做 |
| `close_requested()` | 点了关闭按钮 | 允许关闭（`Flow::Exit`） |
| `wants_redraw()` | 每条输入之后问一次 | `false` |
| `redraw_policy()` | 启动时读一次 | `OnDemand` |
| `wake_handle(Waker)` | 建窗后调一次（省电模式的唤醒句柄） | 什么都不做 |
| `next_deadline()` | 每轮事件循环收敛时问一次 | `None`（睡死） |
| `on_wake_stats(&WakeStats)` | 收尾调一次（观测账本） | 什么都不做 |

## 重绘的六条置位规则（省电模式的关键）

| 触发 | 是否请求重绘 |
|---|---|
| 输入事件 | **只有 `wants_redraw()` 为真**才请求 |
| 系统事件（`Resized` / `Focused` / 窗口重新暴露 / 引导帧） | **一律**请求（不看 `wants_redraw`） |
| `RedrawRequested` 到达 | 才调 `redraw()` |
| `RedrawPolicy::Continuous` | 每画完一帧续下一帧 |
| `Waker::wake()`（提示） | 问 `wants_redraw()`，答真才画 |
| `wake_after(d)` / `next_deadline` 到点 | **一律**画一帧（App 自己下的单） |

运行时可用环境变量强制关掉省电模式：`DEER_WINDOW_REDRAW=continuous`。
启动与结束时窗口层会打印自证行（「重绘策略」「重绘账本」「唤醒账本」）——
验收时 grep 那几行，别只看退出码。

## 多窗口已落地

上面是单窗口流程。多窗口（T4.4）也已可用：`WindowSpawner::spawn_window` 动态建新窗、
`WindowId` 按窗路由生命周期（`window_init` / `window_redraw` / `window_input` / `window_resized` /
`window_close_requested` / `window_destroyed` 按窗钩子，默认转发旧的单窗方法 ⇒ 单窗口 App 零改动）。
参考示例：

```sh
DEER_VK_WINDOW_TESTS=1 cargo run -p deer-gui --features window --example dual_window
```

细节见[窗口层](../../api/window.md)。

## 「树怎么上屏？」

本节只搭了 App 骨架。把界面树画进窗口的完整样板（Vulkan 窗口路径
`WindowedRenderer`）见仓库内两个可运行示例：

```sh
cargo run -p deer-gui --features window --example hello_window   # 8 步：树 → 窗口
cargo run -p deer-gui --features window --example counter        # 最小可交互界面
```

两者的配套说明见仓库 `docs/GETTING-STARTED-UI-STEPS.md` 与 `docs/GETTING-STARTED-UI.md`。

## 本节用到的 API

| API | 作用 | 详细文档 |
|---|---|---|
| `App` trait | 窗口应用的生命周期 | [窗口层](../../api/window.md) |
| `run(config, app)` | 建窗 + 跑事件循环 | [窗口层](../../api/window.md) |
| `WindowConfig` | 标题与逻辑尺寸 | [窗口层](../../api/window.md) |
| `Waker` | 省电模式下的定时 / 提示唤醒 | [窗口层](../../api/window.md) |

## 下一步

窗口有了，接下来让它**响应你**：[第 7 步：输入、点击与焦点](07_interaction.md)。
