# 第 9 步：用 testkit 写界面测试

## 目标

把「建面 → 输入注入 → 一帧 → 像素/状态断言 → CPU↔GPU 对照」这条链写进测试 ——
不用抄 600 行样板，十几行就够，而且**默认带上**前置断言、越界为 0、失败时打印可复现命令。

> **前置**：testkit 在 `testing` feature 后面（生产构建里零成本）：
> 自己的项目里写 `features = ["testing"]`；本仓库的测试目标自动包含它。

## 操作步骤

1. `Harness::new(tree, w, h, theme)` 建面（自动加载系统字体出**真实字形**；
   没字体环境用 `Harness::without_font`，走 `ApproxMeasure` 近似度量）。参数直接收
   `Node` 或 `Builder`。
2. 用 `tap(id)` / `send(&InputEvent)` / `run_script(src)` 注入输入 —— 每一步返回
   `Step`（改没改状态、发了哪些事件）。
3. `shoot()` / `shoot_named("…")` 拿离屏 CPU 像素（`Shot`），做像素断言。
4. 状态断言用 `assert_hover` / `assert_focus` / `assert_pressed` / `assert_text` 等
   现成助手 —— 每一个都有「反向自检」测试：喂错值必须能红。
5. 用 `set_repro` 登记复现命令；断言失败时错误信息会带上它。

## 完整示例

```rust
use deer_gui::prelude::*;
use deer_gui::testing::{Harness, Repro};

fn main() -> Result<(), String> {
    // ① 建面：一个按钮（测试目标），带前置断言与复现命令
    let mut h = Harness::without_font(
        Builder::new(Kind::Column, "app").gap(4.0),
        320, 200, Theme::default(),
    );
    h.set_case("button_click");
    h.set_repro(Repro::test("my-app", "testing", "my_test", "button_click", &[]));

    // ② 点击前拍一张
    let before = h.shoot_named("点击前")?;

    // ③ 注入输入：tap = move 到节点中心 + 按下 + 抬起（坐标由布局算出，不写死）
    let step = h.tap("button_1")?;
    assert!(step.changed, "点按钮必须改状态");

    // ④ 点击后拍一张，断言差异只落在变化的节点矩形内（框外必须为 0）
    let after = h.shoot_named("点击后")?;
    after.assert_state_change_only(&before, "button_1")?;

    // ⑤ 状态断言：hover 停在按钮上
    h.assert_hover(Some("button_1"))?;
    Ok(())
}
```

```sh
# 本仓库里跑等价示例（testing feature 的可运行演示）：
cargo run -q -p deer-gui --features testing --example testkit_demo
```

## 能力面速查

| 能力 | 入口 |
|---|---|
| 建面 | `Harness::new` / `without_font`（收 `Node` 或 `Builder`） |
| 输入注入 | `send`（单事件）/ `tap(id)` / `run_script`（脚本，支持 `move @id`） |
| 一帧 | `frame()`（**内置前置断言**）→ `Frame`（几何、绘制列表、绘制出的文本） |
| 离屏像素 | `shoot` / `shoot_named` / `shoot_png` / `GpuProbe`（离屏 Vulkan） |
| 像素断言 | `Shot::pixel`、`assert_bytes_eq`、`assert_state_change_only`、`assert_diff_only_inside`、`assert_no_diff_outside` |
| 状态断言 | `assert_hover` / `assert_focus` / `assert_pressed` / `assert_text` / `assert_state` / `assert_focus_order` |
| 绘制列表断言 | `assert_counts` / `assert_drawn_text` / `assert_text_size` / `assert_clip_nodes` |
| CPU↔GPU 对照 | `compare_cpu_gpu` → `ParityReport`（最大通道差 / 不同像素数） |
| 门槛与自证 | `gate()` / `require_gate()` / `print_gate()`（环境变量开关，先 `trim()` 再比） |

## 判据纪律（testkit 不放宽任何阈值）

- CPU↔GPU 对照只有两档规则：不透明内容**逐字节相等**（容差 0），半透明内容最多 1 LSB ——
  没有「放宽」入口；
- 每个断言助手的失败信息都带**可复制的复现命令**与关键数字；
- 「一条永远不会红的断言」不是护栏 —— 每个助手都被一条表驱动测试喂过错误期望值。

## 本节用到的 API

| API | 作用 | 详细文档 |
|---|---|---|
| `Harness` | 测试主句柄 | [测试接口](../../api/testing.md) |
| `tap` / `send` / `run_script` | 输入注入 | [测试接口](../../api/testing.md) |
| `Shot` | 离屏像素与像素断言 | [测试接口](../../api/testing.md) |
| `Repro` | 可复现命令 | [测试接口](../../api/testing.md) |

## 下一步

教程到此完整走完一遍。接下来：

- 需要查 API？去 [API 参考](../../api/index.md)；
- 想理解「为什么」？读[架构总览](../../advanced/architecture.md)与[已知陷阱](../../advanced/pitfalls.md)；
- 想跑更多例子？看[示例索引](../../appendix/examples.md)。
