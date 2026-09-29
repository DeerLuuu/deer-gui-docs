# 交互层（UiState / handle / 命中测试）

**模块**：`deer_gui::interaction`

## 功能说明

**纯逻辑**的交互核心：命中测试（含裁剪与禁用）、悬停/按下/点击/焦点/文本输入状态机。不碰窗口、不碰 GPU —— 输入是值、输出是值，所以整条交互链能在无 winit / 无 Vulkan 的环境里被单测覆盖。

三个入口函数：

| 函数 | 签名 | 说明 |
|---|---|---|
| `handle` | `(state: &mut UiState, root: &Node, geo: &Geometry, clip: ClipSnapshot, ev: &InputEvent) -> Vec<UiEvent>` | **唯一入口**：喂事件、更新状态、产出「发生了什么」 |
| `hit` | `(root, geo, clip: ClipSnapshot, x, y) -> Option<&Node>` | 在 [`hit_test`](layout.md) 之上多查两道：**裁剪**与**禁用**；点在禁用子树或被裁掉处 ⇒ 没有命中，**不回退**到祖先 |
| `focusables` | `(root: &Node) -> Vec<String>` | 可聚焦节点（Button/Field 且不在禁用子树）的**树序**（`Tab` 循环用；只依赖树，不依赖几何） |

## `InputEvent`（输入事件）

| 变体 | 字段 |
|---|---|
| `PointerMoved` | `x, y: f32` |
| `PointerDown` / `PointerUp` | `button: PointerButton, x, y` |
| `Wheel` | `dx, dy: f32` |
| `KeyDown` / `KeyUp` | `key: Key, mods: Mods` |
| `TextInput` | `text: String` |
| `FocusChanged` | `focused: bool` |

配套：`PointerButton::{Left, Right, Middle}`；`Mods { shift, ctrl, alt, sup }`；
`Key::{Tab, Escape, Enter, Backspace, Left, Right, Up, Down, Char(char), Other}`（**物理键**，不含文本语义 —— 文本一律走 `TextInput`）。开 `window` feature 时这些类型直接 re-export 自 `deer-window`，否则用逐字相同的本地镜像 —— 两条路径签名与语义完全一致。

## `UiState`（状态的唯一真相）

| 字段 | 类型 | 说明 |
|---|---|---|
| `hover` | `Option<String>` | 指针压着的节点 |
| `focus` | `Option<String>` | 键盘焦点（`Tab` 改它，`Escape` 清它） |
| `pressed` | `Option<String>` | 被左键按下的节点 |
| `texts` | `BTreeMap<String, String>` | 输入框文本缓冲（不在表里 = 空串） |
| `scroll` | `ScrollState` | 滚动状态（偏移 + 上限，见下） |

`same_visual(&other)`：三个视觉字段（hover/focus/pressed）是否完全一样 ——
`PointerDown` 这类不发事件却改 `pressed` 的情况，靠它判定要不要重绘。

### `ScrollState`

| 方法 | 说明 |
|---|---|
| `set_metrics(&ScrollMetrics)` | **每帧必调**：灌入布局产出的上限，并把旧偏移夹回新上限（视口/内容变了也不残留越界偏移） |
| `offset_of(id) -> i32` / `max_of(id) -> i32` | 查询 |
| `scroll_to(id, v) -> Option<i32>` / `scroll_by(id, delta) -> Option<i32>` | 程序化滚动（夹取后返回新值；目标不是滚动容器 ⇒ `None`） |

## `UiEvent`（发生了什么）

| 变体 | 含义 |
|---|---|
| `HoverChanged(Option<String>)` | 悬停变了 |
| `FocusChanged(Option<String>)` | 焦点变了 |
| `Clicked(String)` | 点击完成（抬起处 == 按下处；`Enter` 键激活也算） |
| `TextChanged { id, value }` | 输入框内容变了（追加 / Backspace 删一个 Unicode 字符） |
| `Scrolled { id, offset }` | 滚动偏移变了（夹取后的整数值；到顶/到底再滚不发） |

**有事件 = 状态变了 = 需要重绘**（窗口层的 dirty 约定）。
滚轮步长 `WHEEL_STEP_PX = 40`（≈两行文本；`dy < 0` ⇒ 内容上移 ⇒ 偏移增大）。

## `ClipSnapshot`（裁剪快照）

每个节点的**有效裁剪**（嵌套 `PushClip` 已求交）：

| 方法 | 说明 |
|---|---|
| `from_draw_list(&DrawList, &Node, &Geometry)` | 从绘制列表派生（把第 k 条 `NodeHint` 绑到前序遍历第 k 个有几何的节点，长度 + 指纹双重校验，错位即断言失败） |
| `unclipped()` | 全不裁剪 |
| `with_node_clip(id, Option<RectI>)` | 手工登记（测试用） |
| `allows(id, x, y) -> bool` | 点是否没被裁掉；**未知 id 放行**（fail-open，测试里要先断言 `is_known`） |
| `is_known(id)` / `clip_of(id)` | 查询 |

## `handle` 的事件 → 效果对照

| 事件 | 效果 |
|---|---|
| `PointerMoved` | 同步 `hover`（变了才发 `HoverChanged`） |
| `PointerDown { Left }` | 同步 `hover`；命中的可聚焦控件 ⇒ 聚焦；记 `pressed` |
| `PointerUp { Left }` | 抬起处 == 按下处 ⇒ `Clicked`；无论如何清 `pressed` |
| `KeyDown { Tab }` | 树序循环焦点（`Shift` 反向）；只有一个可聚焦时停在原地 |
| `KeyDown { Escape }` | 清焦点 |
| `KeyDown { Enter }` | 焦点在**启用**的按钮 ⇒ `Clicked` |
| `KeyDown { Backspace }` | 焦点是**启用**的输入框 ⇒ 删一个 Unicode 字符 |
| `TextInput` | 焦点是**启用**的输入框 ⇒ 追加 |
| `FocusChanged { false }` | 窗口失焦：清 `hover`/`pressed`（`focus`/`texts` 不动） |
| `Wheel { dy }` | `hover` 最近的可滚动祖先（含自身）偏移 `-dy × 40`，夹取，变了才发 `Scrolled` |
| 其余（右/中键、方向键、`KeyUp`、按键重复…） | 本期不消费（匹配是**穷尽**的：新增事件变体会编译报错，不会静默忽略） |

## 使用示例

完整闭环见[第 7 步](../getting_started/step_by_step/07_interaction.md)；无窗口也能跑：

```sh
cargo test -p deer-gui --lib interaction   # 整条交互链的单测不依赖 winit/Vulkan
```

```rust
use deer_gui::interaction::{self, ClipSnapshot, InputEvent, UiState};

let mut state = UiState::default();
let events = interaction::handle(
    &mut state, &tree, &geo,
    ClipSnapshot::unclipped(),
    &InputEvent::PointerMoved { x: 60.0, y: 30.0 },
);
assert!(matches!(events.first(), Some(_)) == (state.hover.is_some()));
```

## 注意事项

- 事件坐标是**物理像素**、窗口左上角原点（与 `WindowInfo::extent` 同一套口径，无 DPI 换算）；
- 命中**不回退**到祖先：点在禁用子树或被裁掉的点上就是「没点中」—— 回退需要第二套路由规则，
  与「`hit_test` 是输入路由唯一依据」冲突（代价与讨论见源码模块文档「已知边界」）；
- `ClipSnapshot` 的 `allows` 对未知 id 放行（fail-open）：**测试里必须先断言 `is_known(id)`**，
  否则「被裁掉不命中」可能只是快照里没这个 id；
- 窗口层与测试脚本共用同一个 `handle`（脚本重放走同一入口），所以「脚本跑得通」与
  「人手点得动」不可能漂。
