# 窗口层（App / run / Waker）

**crate**：`deer-window`（`deer-gui` 开 `window` feature 后经 `deer_gui::window` 使用）

## 功能说明

「原生窗口 + 事件循环」层，也是本 workspace **唯一引入第三方依赖**（`winit 0.30`）的地方。它把窗口的原生句柄以 HAL 的不透明形式（`RawWindowHandle`）交给渲染层 —— 渲染后端不依赖 winit，所以换窗口实现不动渲染栈。

crate 按两层物理拆分（公开路径与拆分前**逐字相同**，`lib.rs` 只做模块声明 + `pub use` 枢纽）：

| 模块 | 层 | 内容 |
|---|---|---|
| `deer_window::display`（`display.rs`） | **L1 DisplayServer** | 平台映射：`WindowConfig` / `WindowInfo`、输入翻译（`InputEvent`/`Key`/`Mods`/`PointerButton` 与 `map_key`/`map_mouse_button`/`map_mods`/`map_wheel`/`printable_text`）、DPI 的 `scale_factor` 记账、**剪贴板**（AF-2）、句柄打包（`raw_handle_from_win32` 等）、`UNSUPPORTED_PLATFORM_MSG` |
| `deer_window::host`（`host.rs`） | **L3 host** | `App` trait + `run()`/`run_multi()`（事件循环与脏重绘）、`Waker`、`WindowId`、`WindowSpawner`（多窗口基建）、`RedrawPolicy`、`WakePlan`/`plan_wake`/`earliest`（测试用纯逻辑）、`WakeStats`/`FrameCounter`（账本）、`Flow` |

边界：**只有 Windows** 的句柄填法实现了；其它平台 `run()` 明确返回
`UNSUPPORTED_PLATFORM_MSG`，**不静默填 0**。窗口本身用 winit，其它平台「能开窗」，只是句柄交给 HAL 这一步未实现。

## `App` trait（你实现它，`run` 负责其余）

`App` 是**双钩子**结构：一套**单窗钩子**（多窗口出现前的原始签名），一套**按窗钩子**（多带一个 `WindowId`）。两者的关系是一条纪律：**按窗钩子的默认实现转发对应的单窗钩子（忽略 id）⇒ 单窗口用户零改动；一旦覆盖按窗钩子，对应的单窗钩子不再被调**（转发只发生在默认实现里 —— 两条路不能同时响）。

### 单窗钩子

| 方法 | 时机 | 默认实现 |
|---|---|---|
| `init(&mut self, &WindowInfo) -> Result<(), String>` | **每建一扇窗调一次**（按建窗顺序；创建渲染器/交换链） | 必须实现（即使覆盖了 `window_init` 也要给空实现） |
| `resized(w, h)` | 尺寸变化（物理像素；应重建交换链） | 什么都不做 |
| `redraw() -> Result<Flow, String>` | 每一帧 | 必须实现 |
| `input(&mut self, &WindowInfo, &InputEvent) -> Result<Flow, String>` | 每条输入事件 | 什么都不做，返回 `Flow::Continue` |
| `close_requested() -> Flow` | 关闭请求 | `Flow::Exit` |
| `wants_redraw() -> bool` | **每条输入之后**问一次（只对输入事件生效） | `false` |
| `redraw_policy() -> RedrawPolicy` | 启动时读一次 | `OnDemand` |
| `wake_handle(Waker)` | 主窗建好后调一次（**存下来**；整个 `run()` 只调一次） | 什么都不做 |
| `window_spawner(WindowSpawner)` | 与 `wake_handle` **同批**（多窗排队的建窗句柄） | 什么都不做 |
| `next_deadline() -> Option<Instant>` | 每轮事件循环收敛时问（拉式预约） | `None` |
| `on_wake_stats(&WakeStats)` | 收尾调一次（唤醒账本；只适合记账/断言） | 什么都不做 |

### 按窗钩子（T4.4-R1/R3，多窗口路由）

| 方法 | 时机 | 默认实现 |
|---|---|---|
| `window_init(id, &WindowInfo)` | 与 `init` 同时机（每窗一次），带 id —— 多窗 App 在这里创建渲染器，把 `id.raw()` 直传渲染层窗口表 | 转发 `init`（忽略 id） |
| `window_input(id, &WindowInfo, &InputEvent)` | 这条输入属于哪个窗，连同**该窗自己的** `WindowInfo` 一起交付；只收这一个窗的事件 | 转发 `input`（忽略 id） |
| `window_resized(id, w, h)` | 哪扇窗变了尺寸必须可区分 | 转发 `resized` |
| `window_redraw(id)` | 该窗的 `RedrawRequested` ⇒ 多窗口下一次只画这一扇 | 转发 `redraw` |
| `window_close_requested(id) -> Flow` | 用户点了**那一扇**窗的 X。返回 `Flow::Exit` = **允许关闭这一扇窗**（不是结束事件循环 —— 只剩这一扇时关它才会退出）；返回 `Flow::Continue` = **否决**（哪扇都不关） | 转发 `close_requested` |
| `window_destroyed(id)` | 一扇窗已从活窗表移除后调一次（**至多一次**）；App 在这里释放该窗的渲染资源 | **纯新增钩子**（没有旧方法可转发），什么都不做 |

所有回调都在**主线程**调用。任何回调返回 `Err` ⇒ `run()` 打印原因并返回 `Err`（绝不吞掉）；`Flow::Exit` 请求结束事件循环。

## 多窗口（T4.4-R1）

| 入口 | 说明 |
|---|---|
| `WindowId(u64)` | 本层的窗口编号；`raw()` 直传渲染层窗口表（两层同源编号，映射是恒等式 —— 禁止靠「0/1 恰好错位对上」的隐式约定） |
| `WindowSpawner::spawn_window(config: WindowConfig)` | **排队**建一扇新窗，在事件循环的安全点（持 `ActiveEventLoop` 的 `user_event` 臂）真正建。句柄经 `App::window_spawner` 交付（与 `Waker` 同一根通道），存下后任何回调里都能排 |
| `run(config, app)` | 主窗仍由 `run()` 首建 |
| `run_multi(configs: &[WindowConfig], app)` | **多配置启动**：每一项各建一扇窗（第一项 = 主窗），与 `run()` 同一条代码路径 |
| 关闭语义 | `CloseRequested` **只关该窗**（可被 `window_close_requested` 否决）；**全部窗口关闭** ⇒ 事件循环退出 |

多窗渲染侧（按窗的交换链/资源表，`WindowedRenderer::new_with_primary_id`/`add_window`）属 [deer-vk]（T4.4-R2），本页不展开。唤醒是 App 级的：`Waker` 多窗共享，唤醒会让**所有活窗**一起重画。

## 剪贴板（AF-2）

`display` 模块的 `Clipboard`（自写 Win32 `CF_UNICODETEXT`，**纯文本一种格式，不引第三方**）：

| 方法 | 说明 |
|---|---|
| `Clipboard::new(hwnd: usize) -> Result<Clipboard, String>` | 公共构造器（不是经 `App` 交接 —— 剪贴板是 OS 全局资源，与窗口/事件循环无生命周期耦合；非 Windows 上明确 `Err(CLIPBOARD_UNSUPPORTED_MSG)`，不静默）。构造本身**不碰**剪贴板 |
| `set_text(&self, text: &str) -> Result<(), String>` | 写入。**必须用真实窗口句柄**（`hwnd = 0` 是 NULL 属主，Win32 规定此时 `SetClipboardData` 会失败 —— `set_text` 会在动手前明确拒绝）；含 NUL 的文本明确拒绝 |
| `get_text(&self) -> Result<String, String>` | 读出（不需要属主，`0` 可用）；剪贴板为空或非文本格式 ⇒ 明确 `Err`，**不静默给空串**；内容不是合法 UTF-16 ⇒ 同样明确 `Err`，不做 lossy 替换 |

即用即走是惯例：`App::input` 的签名里就带着 `info: &WindowInfo`，现场 `Clipboard::new(info.raw.handle)` 即可，不必为存句柄加状态。每次调用内部原子完成「开（重试）→ 干活 → 关」，不跨调用持有（不卡全系统的复制粘贴）；**可在任意线程调用**。

## DPI（AF-3，只透传）

`scale_factor` 初值 = 建窗时 winit 的 `window.scale_factor()`（与 extent 同一来源），住在 `WindowInfo::scale_factor`；之后 OS 报变化 ⇒ 派发 `InputEvent::ScaleFactorChanged { scale_factor: f64 }`（OS 报多少带多少，派发前已把 `WindowInfo::scale_factor` 记账到新值）。本层**不换算任何坐标**：事件坐标与尺寸仍是物理像素，布局是像素级纯函数；窗口物理尺寸也**不**因 DPI 变化而改（所以不会跟着一条 `Resized`）。要按 DPI 缩放是上层自己的事。

## 其余类型

| 类型 | 要点 |
|---|---|
| `WindowConfig` | `new(title, width, height)`（**逻辑**尺寸，建窗时换算）；默认 800×600 无标题；`display_title()` 会加 `deer-gui — ` 前缀 |
| `WindowInfo` | `{ raw: RawWindowHandle, extent: Extent, scale_factor: f64 }`（当前物理尺寸 + DPI 系数；`Resized`/`ScaleFactorChanged` 后同步） |
| `Flow` | `Continue` / `Exit` |
| `RedrawPolicy` | `OnDemand`（默认，省电）/ `Continuous`（每帧续下一帧）；可被环境变量 `DEER_WINDOW_REDRAW=continuous` 运行时强制覆盖（`REDRAW_ENV` 常量；取值先 `trim()` 再比、大小写不敏感） |
| `Waker` | `wake()`（提示：问 `wants_redraw`，答真才画）/ `wake_after(Duration)`（预约：到点**一律**画一帧）；可 `Clone`、`Send` |
| `InputEvent` / `Key` / `Mods` / `PointerButton` | 输入模型（与 [交互层](interaction.md) 同一份定义；`Key` 含 `PageUp`/`PageDown`/`Home`/`End`，`KeyDown` 带 `repeat: bool`） |
| `WakePlan` / `plan_wake` / `earliest` | 事件循环「睡死 / 睡到点 / 到点了」的**纯逻辑**真值表（测试用） |
| `WakeStats` / `FrameCounter` | 账本（frames / requests / skipped / iters …） |

## 置位规则（重绘的六条）

| 触发 | 是否请求重绘 |
|---|---|
| 输入事件 | **只有 `wants_redraw()` 为真** |
| 系统事件（`Resized` / `Focused` / 窗口重新暴露 / 引导帧） | **一律** |
| `RedrawRequested` 到达 | 才调 `redraw()`（多窗下经 `window_redraw`，只画那一扇） |
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

多窗口的最小骨架：

```rust,ignore
struct TwoWindows { spawner: Option<WindowSpawner>, spawned: bool }

impl App for TwoWindows {
    fn init(&mut self, _info: &WindowInfo) -> Result<(), String> { Ok(()) }
    // 主窗建好后拿到建窗句柄（与 wake_handle 同批），排一扇新窗。
    fn window_spawner(&mut self, spawner: WindowSpawner) { self.spawner = Some(spawner); }
    fn redraw(&mut self) -> Result<Flow, String> {
        if !self.spawned {
            self.spawned = true;
            if let Some(sp) = &self.spawner {
                sp.spawn_window(WindowConfig::new("第二扇", 320, 200)); // 只排队，安全点才真建
            }
        }
        Ok(Flow::Continue)
    }
    // 多窗口 App 覆盖这里（覆盖后 input 不再被调）：按 id 分发每窗状态。
    fn window_input(&mut self, id: WindowId, _info: &WindowInfo, _ev: &InputEvent)
        -> Result<Flow, String> { Ok(Flow::Continue) }
}
```

## 注意事项

- **`run()` 必须在主线程调用**（winit 的要求）；
- `next_deadline()` 必须给出**固定的时刻**并自己往前推：每次都返回 `Instant::now() + 50ms`
  会让它**永远不到点**（每 50ms 醒一次却一帧不画，空转）。定时推进用 `Waker::wake_after`
  （惯性滚动有现成的拉式实现可参考：`interaction::inertia_deadline`）；
- 已过期的 deadline 视为「立刻到点」⇒ 画一帧；不清理就等于自己要求连续重绘；
- 输入事件的坐标是**物理像素**（本层不做 DPI 换算）；字符与物理键是**两条事件**
  （文本走 `TextInput`，`Enter`/`Tab`/`Backspace`/`Esc` 只有 `KeyDown`）；
- IME：**预编辑已接线**（`Ime::Preedit` ⇒ `InputEvent::ImePreedit` 派发，提交仍走 `TextInput`）；按键重复已建模（winit 的 `event.repeat` 进 `KeyDown.repeat`）；
  触摸/拖放/设备事件未接线；
- 覆盖按窗钩子后对应的单窗钩子不再被调 —— 别在两边都写逻辑；
- 别只看退出码：窗口层的账本是打印出来的行，验收要 grep。
