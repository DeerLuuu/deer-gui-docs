# 測試介面（testkit / Harness）

**模組**：`deer_gui::testing`（`testing` feature 或 `cfg(test)` 下編譯；生產建置零成本）

## 功能說明

把本專案的測試紀律變成 API：**建面 → 輸入注入 → 一幀 + 前置斷言 → 離屏像素 → 像素/狀態/繪製清單斷言 → CPU↔GPU 對照**。讓「寫一條 UI 測試」從抄 600 行樣板變成十幾行，並**預設帶上**前置斷言、門檻自證、越界為 0、CPU/GPU 對照容差與失敗時的重現命令。**不放寬任何閾值**。

每個斷言助手都有「反向自檢」：表驅動測試給每個助手餵故意錯誤的期望值，斷言它**確實回傳 `Err`**（錯誤裡帶可複製的重現命令）——「一條永遠不會紅的斷言」不是護欄。

## `Harness`（主句柄）

| 方法 | 說明 |
|---|---|
| `new(tree, width, height, theme)` | 建面；接受 `Node` 或 `Builder`（`IntoTree`）；自動載入系統字型出**真實字形** |
| `without_font(…)` | 無字型環境的變體（走 `ApproxMeasure` 近似度量） |
| `set_case(name)` / `set_repro(Repro)` | 命名用例、登記重現命令（斷言失敗時列印） |
| `require_ids(&[&str])` | **前置斷言**：這些 id 必須有幾何（防「腳本點到空處」） |
| `set_tree(tree)` / `tree()` | 取代/讀取樹 |
| `send(&InputEvent) -> Step` | 注入單事件（回傳是否改狀態 + 事件清單） |
| `tap(id) -> Step` | `move` 到節點中心 + 按下 + 抬起（座標由**版面配置**算出，不寫死） |
| `move_to(id)` / `center_of(id)` | 指標移動 / 查中心點 |
| `run_script(src) -> ScriptRun` | 跑[輸入腳本](../appendix/input_script.md)（支援 `move @id`，座標取節點中心；無幾何 ⇒ 硬錯） |
| `frame() -> Frame` | 算一幀（**內置前置斷言**）；`Frame` 提供幾何、繪製清單、`rect_of(id)`、`drawn_texts()` 等 |
| `shoot()` / `shoot_named(label) -> Shot` | 離屏 CPU 像素（真字形） |
| `shoot_png()` / `shoot_png_file(path)` | 直接出 PNG |
| `compare_cpu_gpu()` | 離屏 Vulkan vs CPU 對照（經 `GpuProbe` → `ParityReport`） |
| `state()` | 目前 `UiState` |

### 狀態斷言

`assert_hover(Option<&str>)`、`assert_focus`、`assert_pressed`、`assert_text(id, want)`、
`assert_texts(&[(&str, &str)])`、`assert_state(&UiState)`、`assert_focus_order(&[&str])`、
`assert_focus_order_excludes(&[&str])`。

### 像素斷言（`Shot`）

| 方法 | 說明 |
|---|---|
| `pixel(x, y) -> Option<[u8; 4]>` | 單像素（越界為 `None`，不是 panic） |
| `assert_bytes_eq(before)` | 兩幀逐位元組相等（「沒變化的區域一個位元組都不許變」） |
| `assert_state_change_only(before, primary_id)` | 差異只落在變化了的節點矩形內 |
| `assert_diff_only_inside(before, primary)` | 差異只在一個矩形內 |
| `assert_no_diff_outside(before, rects)` | 框外差異必須為 0 |
| `diff_split(before, rects)` | 差異分解（框內/框外像素數） |
| `write_png(path)` / `to_png()` | 落盤除錯 |

### 繪製清單斷言（`Frame` / `Harness`）

`assert_counts(frame, DrawCounts)`、`assert_drawn_text(frame, id, want)`、
`assert_drawn_text_contains`、`assert_text_size(frame, id, want)`、
`assert_command_count`、`assert_node_hint_count`、`assert_clip_nodes`、`assert_clip_known`。

### 門檻（環境變數開關）

| 函式 | 說明 |
|---|---|
| `gate(name) -> bool` | `name` 非零即開（**先 `trim()` 再比**：`cmd` 的 `set X=1 && …` 會把尾空格算進值裡） |
| `require_gate(name) -> bool` | 未開 ⇒ 列印「這不是通過，是被跳過」並回傳 false |
| `print_gate(name)` / `print_gates(&[&str])` | 自證列印（門檻的值要可見，不能只看結束代碼） |

## `ParityRule`（CPU↔GPU 對照規則，無「放寬」入口）

| 檔 | 上限 |
|---|---|
| `Opaque`（不透明內容） | `BYTE_EXACT` = 0 |
| `Translucent`（半透明內容） | `LSB_TOLERANCE` = 1 LSB |

`ParityRule::for_list(&DrawList)` / `for_theme(&Theme)` 自動選檔；`ParityReport::check()` 給出
最大通道差 / 不同像素數 / 最差點。

## 使用範例

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

完整可執行範例：`cargo run -q -p deer-gui --features testing --example testkit_demo`。
分步講解見[第 9 步](../getting_started/step_by_step/09_testing.md)。

## 注意事項

- testkit 只用本 workspace 的 crate 與 std，**不引入第三方相依**；
- 下游專案用它：在已有的 `deer-gui` 相依上加 `features = ["testing"]`（不必新增 crate）；
- `tap` / `run_script` 的 `@id` 定位靠版面配置：id 沒幾何是**硬錯**（`Err`），不是靜默點空 ——
  這正是它相對手寫座標的全部價值；
- 對照測試的閾值不可調：發現「需要放寬」時，先懷疑實作而不是規則
  （規則背後的實測依據見原始碼模組文件與 `FEATURES.md`）。
