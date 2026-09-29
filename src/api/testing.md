# 测试接口（testkit / Harness）

**模块**：`deer_gui::testing`（`testing` feature 或 `cfg(test)` 下编译；生产构建零成本）

## 功能说明

把本项目的测试纪律变成 API：**建面 → 输入注入 → 一帧 + 前置断言 → 离屏像素 → 像素/状态/绘制列表断言 → CPU↔GPU 对照**。让「写一条 UI 测试」从抄 600 行样板变成十几行，并**默认带上**前置断言、门槛自证、越界为 0、CPU/GPU 对照容差与失败时的复现命令。**不放宽任何阈值**。

每个断言助手都有「反向自检」：表驱动测试给每个助手喂故意错误的期望值，断言它**确实返回 `Err`**（错误里带可复制的复现命令）——「一条永远不会红的断言」不是护栏。

## `Harness`（主句柄）

| 方法 | 说明 |
|---|---|
| `new(tree, width, height, theme)` | 建面；接受 `Node` 或 `Builder`（`IntoTree`）；自动加载系统字体出**真实字形** |
| `without_font(…)` | 无字体环境的变体（走 `ApproxMeasure` 近似度量） |
| `set_case(name)` / `set_repro(Repro)` | 命名用例、登记复现命令（断言失败时打印） |
| `require_ids(&[&str])` | **前置断言**：这些 id 必须有几何（防「脚本点到空处」） |
| `set_tree(tree)` / `tree()` | 替换/读取树 |
| `send(&InputEvent) -> Step` | 注入单事件（返回是否改状态 + 事件列表） |
| `tap(id) -> Step` | `move` 到节点中心 + 按下 + 抬起（坐标由**布局**算出，不写死） |
| `move_to(id)` / `center_of(id)` | 指针移动 / 查中心点 |
| `run_script(src) -> ScriptRun` | 跑[输入脚本](../appendix/input_script.md)（支持 `move @id`，坐标取节点中心；无几何 ⇒ 硬错） |
| `frame() -> Frame` | 算一帧（**内置前置断言**）；`Frame` 提供几何、绘制列表、`rect_of(id)`、`drawn_texts()` 等 |
| `shoot()` / `shoot_named(label) -> Shot` | 离屏 CPU 像素（真字形） |
| `shoot_png()` / `shoot_png_file(path)` | 直接出 PNG |
| `compare_cpu_gpu()` | 离屏 Vulkan vs CPU 对照（经 `GpuProbe` → `ParityReport`） |
| `state()` | 当前 `UiState` |

### 状态断言

`assert_hover(Option<&str>)`、`assert_focus`、`assert_pressed`、`assert_text(id, want)`、
`assert_texts(&[(&str, &str)])`、`assert_state(&UiState)`、`assert_focus_order(&[&str])`、
`assert_focus_order_excludes(&[&str])`。

### 像素断言（`Shot`）

| 方法 | 说明 |
|---|---|
| `pixel(x, y) -> Option<[u8; 4]>` | 单像素（越界为 `None`，不是 panic） |
| `assert_bytes_eq(before)` | 两帧逐字节相等（「没变化的区域一个字节都不许变」） |
| `assert_state_change_only(before, primary_id)` | 差异只落在变化了的节点矩形内 |
| `assert_diff_only_inside(before, primary)` | 差异只在一个矩形内 |
| `assert_no_diff_outside(before, rects)` | 框外差异必须为 0 |
| `diff_split(before, rects)` | 差异分解（框内/框外像素数） |
| `write_png(path)` / `to_png()` | 落盘调试 |

### 绘制列表断言（`Frame` / `Harness`）

`assert_counts(frame, DrawCounts)`、`assert_drawn_text(frame, id, want)`、
`assert_drawn_text_contains`、`assert_text_size(frame, id, want)`、
`assert_command_count`、`assert_node_hint_count`、`assert_clip_nodes`、`assert_clip_known`。

### 门槛（环境变量开关）

| 函数 | 说明 |
|---|---|
| `gate(name) -> bool` | `name` 非零即开（**先 `trim()` 再比**：`cmd` 的 `set X=1 && …` 会把尾空格算进值里） |
| `require_gate(name) -> bool` | 未开 ⇒ 打印「这不是通过，是被跳过」并返回 false |
| `print_gate(name)` / `print_gates(&[&str])` | 自证打印（门槛的值要可见，不能只看退出码） |

## `ParityRule`（CPU↔GPU 对照规则，无「放宽」入口）

| 档 | 上限 |
|---|---|
| `Opaque`（不透明内容） | `BYTE_EXACT` = 0 |
| `Translucent`（半透明内容） | `LSB_TOLERANCE` = 1 LSB |

`ParityRule::for_list(&DrawList)` / `for_theme(&Theme)` 自动选档；`ParityReport::check()` 给出
最大通道差 / 不同像素数 / 最差点。

## 使用示例

```rust
use deer_gui::prelude::*;
use deer_gui::testing::{Harness, Repro};

let mut h = Harness::without_font(
    Builder::new(Kind::Column, "app").gap(4.0), 320, 200, Theme::default(),
);
h.set_case("plus_click");
h.set_repro(Repro::test("deer-gui", "testing", "my_test", "plus_click", &[]));

let before = h.shoot_named("点击前")?;
let step = h.tap("button_1")?;
assert!(step.changed, "点按钮必须改状态");
let after = h.shoot_named("点击后")?;
after.assert_state_change_only(&before, "button_1")?;
h.assert_hover(Some("button_1"))?;
```

完整可运行示例：`cargo run -q -p deer-gui --features testing --example testkit_demo`。
分步讲解见[第 9 步](../getting_started/step_by_step/09_testing.md)。

## 注意事项

- testkit 只用本 workspace 的 crate 与 std，**不引入第三方依赖**；
- 下游项目用它：在已有的 `deer-gui` 依赖上加 `features = ["testing"]`（不必新增 crate）；
- `tap` / `run_script` 的 `@id` 定位靠布局：id 没几何是**硬错**（`Err`），不是静默点空 ——
  这正是它相对手写坐标的全部价值；
- 对照测试的阈值不可调：发现「需要放宽」时，先怀疑实现而不是规则
  （规则背后的实测依据见源码模块文档与 `FEATURES.md`）。
