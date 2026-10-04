# 交互层（UiState / handle / 命中测试）

**模块**：`deer_gui::interaction`

## 功能说明

**纯逻辑**的交互核心：命中测试（含裁剪与禁用）、悬停/按下（指针捕获）/点击/焦点/文本与 IME/控件值状态机。不碰窗口、不碰 GPU —— 输入是值、输出是值，所以整条交互链能在无 winit / 无 Vulkan 的环境里被单测覆盖。

三个入口函数：

| 函数 | 签名 | 说明 |
|---|---|---|
| `handle` | `(state: &mut UiState, root: &Node, geo: &Geometry, clip: ClipSnapshot, ev: &InputEvent) -> Vec<UiEvent>` | **唯一入口**：喂事件、更新状态、产出「发生了什么」 |
| `hit` | `(root, geo, clip: ClipSnapshot, x, y) -> Option<&Node>` | 在 [`hit_test`](layout.md) 之上多查两道：**裁剪**与**禁用**；点在禁用子树或被裁掉处 ⇒ 没有命中，**不回退**到祖先 |
| `focusables` | `(root: &Node) -> Vec<String>` | 可聚焦节点（Button/三个值输入框/Switch 且不在禁用子树）的**树序**（`Tab` 循环用；只依赖树，不依赖几何） |

## `InputEvent`（输入事件）

| 变体 | 字段 |
|---|---|
| `PointerMoved` | `x, y: f32` |
| `PointerDown` / `PointerUp` | `button: PointerButton, x, y` |
| `Wheel` | `dx, dy: f32` |
| `KeyDown` / `KeyUp` | `key: Key, mods: Mods`（`KeyDown` 多一个 `repeat: bool` —— **系统按键重复**，长按不松时 OS 补发的 KeyDown；交互层默认不区分、照常消费，建模的意义是「能区分」，要不要忽略重复由调用方决定） |
| `TextInput` | `text: String` |
| `ImePreedit` | `text: String`（**IME 预编辑**：中文/日文输入法正在拼、还没上屏的那一段；空 `text` = 预编辑被取消） |
| `FocusChanged` | `focused: bool`（窗口焦点，**不是**控件焦点） |
| `ScaleFactorChanged` | `scale_factor: f64`（**DPI 缩放系数变了**，只透传：OS 报多少带多少，交互层不换算任何坐标） |

配套：`PointerButton::{Left, Right, Middle}`；`Mods { shift, ctrl, alt, sup }`；
`Key::{Tab, Escape, Enter, Backspace, Left, Right, Up, Down, PageUp, PageDown, Home, End, Char(char), Other}`（**物理键**，不含文本语义 —— 文本一律走 `TextInput`；`PageUp`/`PageDown`/`Home`/`End` 是滚动键）。开 `window` feature 时这些类型直接 re-export 自 `deer-window`，否则用逐字相同的本地镜像 —— 两条路径签名与语义完全一致。

## `UiState`（状态的唯一真相）

| 字段 | 类型 | 说明 |
|---|---|---|
| `preedit` | `Option<Preedit>` | **IME 预编辑缓冲**（还没上屏的那一段，挂在当时聚焦的输入框上；`Preedit { id, text }`）。默认 `None` ⇒ 既有行为不变。与 `texts` 的分工是硬的：预编辑只进这里、不进 `texts`；提交走 `TextInput` 进 `texts` 并同时清缓冲（无双写） |
| `hover` | `Option<String>` | 指针压着的节点（含容器；捕获期间钉在捕获者身上，见下） |
| `focus` | `Option<String>` | 键盘焦点（`Tab`/`Shift+Tab`/方向键改它，`Escape` 清它） |
| `pressed` | `Option<String>` | **左键捕获的节点**（指针捕获，按下即默认捕获）—— 语义见下文「指针捕获（T3.7）」小节，不再是「按下时记住」 |
| `texts` | `BTreeMap<String, String>` | 输入框文本缓冲（不在表里 = 空串）。普通 `Field` 与值输入框（`NumberField`/`ColorField`）的**编辑期草稿**同住这里 |
| `carets` | `BTreeMap<String, usize>` | 输入框光标（id → 位置，单位是**字符位**不是字节位；不在表里 = 末尾，纯增量字段） |
| `scroll` | `ScrollState` | 滚动状态（偏移 + 上限 + 滚动条拖动 + 惯性，见下） |
| `segments` | `BTreeMap<String, String>` | **分段选择的当前选中**（组 id → 选中段的节点 id；表里没有 = 该组还没有选中段）。App 塞初值，`handle` 点击结算时更新并发 `SelectionChanged` |
| `chips` | `BTreeMap<String, bool>` | **标签组的开/关**（芯片**自己**的 id → 是否开；表里没有 = 关）。每次点击芯片都翻转它并发 `ChipToggled` |
| `tabs` | `BTreeMap<String, String>` | **页签栏的活动页**（组 id → 活动页的节点 id，存 id 不存下标：标签重名、树增删页不错位；发 `TabChanged` 时才换算成树序下标） |
| `num_opts` | `BTreeMap<String, NumOpts>` | **数值类控件的值域/步长**（控件 id → `NumOpts { min: Option<f64>, max: Option<f64>, step: f64 }`；表里没有 = 无值域、步长 1.0）。**应用数据**：App 想约束就自己塞，控件只读不写 |
| `switches` | `BTreeMap<String, bool>` | **开关的开/关**（开关**自身** id → 是否开；表里没有 = 关）。与 `chips` 同形但独立一张表（Switch 不是组的孩子） |
| `scrub` | `Option<ScrubAnchor>` | **拖动调值（`ScrubNum`）的瞬态锚点**。按下落在 `ScrubNum` 上才建立（`start_x` = 按下 x，`base` = 按下时 `parse_num(label)` 的基准值）；**抬起/窗口失焦即清** —— 它不是值，值的真相在 App 的数据里，经 label 回到树上 |

控件值的读写纪律（`segments`/`chips`/`tabs`/`switches`/`num_opts` 同一条）：**按 id 键控、住在树外** ⇒ 整树重建不丢；**读** = 直接查表（表里没有就是默认值）；**写初值** = App 自己塞（如 `state.segments.insert("mode".into(), week_id)`、`state.num_opts.insert("age".into(), NumOpts { min: Some(0.0), max: Some(150.0), step: 1.0 })`）；**值的真相在 App 的数据里** —— `handle` 只负责在点击/激活结算时更新表并发事件，App 拿着事件改自己的数据、重建树。

`same_visual(&other)`：三个视觉字段（hover/focus/pressed）是否完全一样 ——
`PointerDown` 这类不发事件却改 `pressed` 的情况，靠它判定要不要重绘。

### `ScrollState`

| 方法 | 说明 |
|---|---|
| `set_metrics(&ScrollMetrics)` | **每帧必调**：灌入布局产出的上限，并把旧偏移夹回新上限（视口/内容变了也不残留越界偏移） |
| `offset_of(id) -> i32` / `max_of(id) -> i32` | 查询 |
| `scroll_to(id, v) -> Option<i32>` / `scroll_by(id, delta) -> Option<i32>` | 程序化滚动（夹取后**真的变了**才返回新值；目标不是滚动容器 ⇒ `None`） |
| `inertia_active() -> bool` | **正在惯性滚动吗** —— 窗口层据此决定「还要不要再排一次唤醒」；停了之后它必须为 `false`（唤醒账本无空转的判据面） |
| `stop_inertia()` | 让惯性**停下**（开始拖动滚动条/失焦时调用）—— 幂等 |
| `inertia_step() -> Option<(String, i32)>` | **推进一步惯性**：偏移 += 速度，速度按整数衰减；返回 `Some((id, 新偏移))` = 这步真的动了；`None` = 已停下（到边界/速度太小），调用方据此不再排下一次唤醒 |

`ScrollState` 里还有两块**瞬态**状态：`drag: Option<ScrollDrag>`（正在拖动的滚动条，`ScrollDrag { id, grab_dy }`）与 `inertia: Option<ScrollInertia>`（正在惯性滚动，`ScrollInertia { id, velocity }`）—— 默认都是 `None`，不拖不滑时行为不变。滚动条几何（滑块/轨道、`scrollbar_geom()`/`scrollbar_offset_for_pointer()`）在 [`deer_core::layout`](layout.md)，本层只消费它。

## `UiEvent`（发生了什么）

| 变体 | 含义 |
|---|---|
| `HoverChanged(Option<String>)` | 悬停变了 |
| `FocusChanged(Option<String>)` | 控件焦点变了 |
| `Clicked(String)` | 点击完成（**按捕获者结算**，抬起在哪都算；`Enter`/`Space` 键盘激活也算） |
| `TextChanged { id, value }` | 输入框内容变了（在光标处插入 / Backspace 删光标前一个 Unicode 字符） |
| `Scrolled { id, offset }` | 滚动偏移变了（夹取后的整数值；到顶/到底再滚不发；滚轮、滚动条拖动、按键滚动、惯性推进共用这一个事件） |
| `PointerRight { id }` | **右键**按在某个节点上（纯透传，上下文菜单属控件层）：**按下即发**；不参与焦点/`pressed`；禁用子树/被裁剪的点拿不到 id ⇒ 不发 |
| `SelectionChanged { id, selected }` | **分段选择**（`Segmented`）：点了组的一个段且**选中真的换了**（`id` = 组节点 id，`selected` = 新选中段的节点 id）。点已选中的段没有变化 ⇒ 只发 `Clicked` 不发这条（**变了才发**）；禁用段点不到 ⇒ 什么都不发 |
| `ChipToggled { id, chip, on }` | **标签开关**（`ChipGroup`）：点了组的一个芯片（`id` = 组 id，`chip` = 芯片节点 id，`on` = 翻转后的新值）。翻转语义：**每次点击必翻转发一次**（与单选的「变了才发」刻意不同 —— 点击本身就是动作） |
| `TabChanged { id, index }` | **页签切换**（`TabBar`）：点了页签且活动页**真的换了**（`index` = 新活动页在组直接子节点里的树序下标，**禁用页也一起数**）。内容切换是 App 的事：TabBar 只报告。点当前活动页 ⇒ 只发 `Clicked` |
| `NumberChanged { id, value: f64 }` | **数值变了**：`NumberField` 提交成功（失焦/`Enter`）或 `ScrubNum` 拖动中值真的变了（`value` 是**夹取之后**的新值）。提交失败（不可解析）不发、拖动中值没变不发（**变了才发**）；成功后草稿规范化回写，但那**不发** `TextChanged` |
| `Toggled { id, on: bool }` | **开关翻转**（`Switch` 被点击/`Enter`/`Space` 激活；`on` = 翻转后的新值）。翻转语义：**每次激活必翻转发一次** |
| `ColorChanged { id, rgb: [u8; 3] }` | **颜色提交成功**（`ColorField` 按 `#RRGGBB` 解析成功，失焦/`Enter`）：`rgb` = 解析出的三通道。解析失败**不发**（色块退回 `border` 色 = 标记）；成功后草稿回写规范化串 `#rrggbb`（同样不发 `TextChanged`） |

**有事件 = 状态变了 = 需要重绘**（窗口层的 dirty 约定）。
滚轮步长 `WHEEL_STEP_PX = 40`（≈两行文本；`dy < 0` ⇒ 内容上移 ⇒ 偏移增大）。
注意 `UiEvent` 只保 `PartialEq` 不保 `Eq`（`NumberChanged` 携带 `f64`）—— 带浮点的类型只用 `PartialEq`。

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
| `PointerMoved` | 同步 `hover`（变了才发 `HoverChanged`）；**捕获中（`pressed` 在手）⇒ 路由给捕获者**（见下节）；**滚动条拖动中** ⇒ 把指针 y 反解成偏移（变了才发 `Scrolled`）；**`ScrubNum` 拖动锚点在手且捕获者仍是它** ⇒ 反解成值 `base + Δx × step`（夹值域，变了才发 `NumberChanged`） |
| `PointerDown { Left }` | 同步 `hover`；命中的**可聚焦控件** ⇒ 聚焦（变了才发 `FocusChanged`）；记 `pressed` = **捕获**；按在**滚动条竖带**上 ⇒ 开始拖动/点轨道跳转（不进点击语义，惯性立刻停）；按在 `ScrubNum` 上 ⇒ 建立拖动锚点（label 解析失败 = 不进入） |
| `PointerUp { Left }` | 同步 `hover`（捕获随抬起释放，hover 回到物理位置）；**按捕获者结算 `Clicked`**（抬起在哪都算 —— 拖出节点、拖出整棵树再抬起照样是它的点击）并释放捕获、清拖动锚点；落点是选择类组的直接子节点 ⇒ 追加选择结算（`SelectionChanged`/`ChipToggled`/`TabChanged`）；落点本身是 `Switch` ⇒ 追加开关结算（`Toggled`）；滚动条拖动在此结束（不发点击） |
| `PointerDown { Right }` | **按下即发** `PointerRight`（纯透传；不置 `pressed`、不改焦点；禁用子树/被裁剪的点不发） |
| `PointerDown/Up { Middle }`（及右键抬起） | 只同步 `hover`，无额外语义 |
| `KeyDown { Tab }` | 树序循环焦点（`Shift` 反向）；只有一个可聚焦时停在原地；**焦点从值输入框离开 ⇒ 失焦提交**（见下） |
| `KeyDown { Escape }` | 清焦点；焦点从值输入框离开 ⇒ 失焦提交 |
| `KeyDown { Enter }` | 焦点在**启用**的按钮 ⇒ `Clicked` + 选择结算；焦点在**启用的开关** ⇒ `Clicked` + 翻转（与指针同路）；焦点在**值输入框**（`NumberField`/`ColorField`）⇒ **提交**（解析 → 值事件 → 规范化回写）；普通 `Field` 不受 `Enter` 影响 |
| `KeyDown { Char(' ') }`（winit 的 Space） | 焦点在**启用的开关** ⇒ 与 `Enter` 同一条激活路径；焦点在值输入框上不消费（空格是草稿正文）；其余不消费 |
| `KeyDown { Backspace }` | 焦点是**启用**的输入框 ⇒ 删**光标前**那一个 Unicode 字符（取字符边界，不切半个汉字；删完光标退一位） |
| `TextInput` | 焦点是**启用**的输入框 ⇒ **插在光标处**，插完光标前进；**同时清预编辑缓冲**（那段文字从此由 `texts` 负责，不清就是双写） |
| `KeyDown { Left / Right }` | 焦点是**启用**的输入框 ⇒ 移动光标（两端夹在 `[0, 字符数]`；**不发事件** —— `TextChanged` 的语义是「值变了」，光标移动没改值） |
| `KeyDown { Up / Down }` | **几何邻近焦点移动**（焦点**不是**输入框时）：把焦点移到「严格在按键方向上、几何上最近」的可聚焦控件（主判据垂直距离、平手看水平、再平手树序；无焦点 ⇒ 不定义；到边停；同行不算方向）⇒ `FocusChanged` |
| `KeyDown { PageUp / PageDown / Home / End }` | **按键滚动**（焦点不是输入框时）：目标容器与滚轮同一来源（焦点所在容器优先，无焦点退 `hover`）；翻页步长 = 容器视口高；`Home`/`End` 到顶/到底；变了才发 `Scrolled` |
| `KeyDown { repeat: true }` | 与 `false` **同语义**（照常消费；要不要忽略重复由调用方过滤） |
| `ImePreedit { text }` | 预编辑挂到**当前聚焦的输入框**上（`UiState::preedit`）；没有聚焦输入框 ⇒ 忽略；**空串 = 输入法取消** ⇒ 清缓冲 |
| `FocusChanged { false }` | 窗口失焦：清 `hover`/`pressed`（捕获）/`scrub`（拖动锚点）（`focus`/`texts` 不动）—— 抬起事件可能永远不来，捕获必须跟着丢 |
| `Wheel { dy }` | `hover` 最近的可滚动祖先（含自身）偏移 `-dy × 40`，夹取，变了才发 `Scrolled`；**同时播种惯性**（速度 = 这一步的位移，见下节） |
| `ScaleFactorChanged` | **不消费**（透传红线：DPI 系数由窗口层转给 App，坐标/尺寸不换算，`UiState` 不动） |
| 其余（`KeyUp`、非空格的 `Key::Char`/`Other`、`focused: true`） | 不消费（匹配是**穷尽**的：新增事件变体会编译报错，不会静默忽略） |

**失焦提交**（所有事件共用的收尾钩子）：处理前焦点在某个值输入框、处理后焦点换了人（`Tab`/`Escape`/点到别处）⇒ 替它提交一次（解析 → 发值事件 → 规范化回写）。窗口失焦**不动 UI 焦点** ⇒ 不触发。

## 指针捕获（T3.7）

`pressed` 的语义是**指针捕获**（按下即默认捕获）：

- **按下**命中节点 ⇒ 记下它 = **捕获**（无论它是不是可聚焦控件 —— 容器、文本同样可以被捕获；按下落在空白/禁用/被裁剪处 ⇒ 没有命中者 ⇒ 无捕获）；
- **拖拽期间**（捕获在手）`PointerMoved` **路由给捕获者**：hover 钉在它身上，指针拖出节点、拖出整棵树都不换人（按钮的 hover/pressed 视觉因此保持，也不会对着路过的东西刷 `HoverChanged`）；
- **抬起**（无论在哪）**按捕获者结算** `Clicked`，并**释放捕获** —— 改前是「抬起处 == 按下处才成点击」（拖出即丢），现在是「按住的这个节点拿到这次点击」；
- **窗口失焦**清空捕获 —— 抬起事件可能永远不来，否则窗口切回来一点就凭空成点击。

两条不变：**未捕获**时照旧命中测试（这条路径不变）；**滚动条拖动**是自己的捕获（`scroll.drag`，从不置 `pressed`），它的 hover 行为原样保留。`ScrubNum` 的拖动调值锚点与捕获互锁：锚点只在「捕获者仍是它」时生效。

## 滚动惯性（T3.2b）

滚轮滚动一步之后**播种惯性**（速度 = 这一步的位移，「滚多远」与「滑多远」成比例），松手之后继续滑一段并自己衰减停下：

- 衰减是**整数**的：每步 `v = v × INERTIA_DECAY_NUM / INERTIA_DECAY_DEN`（85/100）。整数是刻意的 —— 让「滚一次之后停几步、停在哪」**逐位可复现**（浮点会因平台/优化而漂）；
- 速度绝对值小于 `INERTIA_MIN_V`（2）就停；撞到边界（夹取后没动）也**立刻停** —— 不夹的话惯性会一直「撞墙」空转（画面没动却每 16ms 醒一次）；
- `INERTIA_TICK_MS = 16` 是推进一步的时间，窗口层按它排下一次唤醒。

窗口层的驱动方式（纯逻辑与窗口层的唯一接缝）：

| 入口 | 说明 |
|---|---|
| `advance_inertia(state: &mut UiState) -> Vec<UiEvent>` | **推进一步惯性**并翻译成事件（每步至多一条 `Scrolled`）。窗口层 `redraw` 每 `INERTIA_TICK_MS` 调一次；**返回空 = 惯性已停，不必再排下一次唤醒** |
| `inertia_deadline(state: &UiState) -> Option<Instant>` | 惯性还在滚 ⇒ 下一次推进的 deadline（`now + INERTIA_TICK_MS`）；停了 ⇒ `None`。给 `App::next_deadline`（拉式）当实现；推式（`Waker::wake_after`）用同一个常量。两条纪律：**只在 `inertia_active()` 时给 `Some`**（停了还给 ⇒ 空转）；返回的是**固定时刻**（不会「永远差一点」追不到点） |

其它打断手段：开始拖动滚动条时 `handle` 自动 `stop_inertia()`（两种位移会打架）；窗口失焦同清。

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

- 事件坐标是**物理像素**、窗口左上角原点（与 `WindowInfo::extent` 同一套口径，无 DPI 换算 —— `ScaleFactorChanged` 只透传，交互层不消费）；
- 命中**不回退**到祖先：点在禁用子树或被裁掉的点上就是「没点中」—— 回退需要第二套路由规则，
  与「`hit_test` 是输入路由唯一依据」冲突（代价与讨论见源码模块文档「已知边界」）；
- `ClipSnapshot` 的 `allows` 对未知 id 放行（fail-open）：**测试里必须先断言 `is_known(id)`**，
  否则「被裁掉不命中」可能只是快照里没这个 id；
- 窗口层与测试脚本共用同一个 `handle`（脚本重放走同一入口），所以「脚本跑得通」与
  「人手点得动」不可能漂；
- 光标单位是**字符位**：`苹果x` 是 3 字符 / 7 字节，按字节表达会把多字节字符从中间切开；
- 目前**没有任何东西渲染光标**，所以左右移动光标不发事件；真开始画光标时，按
  `ScrollState` 的先例补 `UiEvent::CaretChanged` 并把 `carets` 加进 `same_visual`（登记在案的延迟决策）；
- 控件值（`segments`/`chips`/`tabs`/`switches`）的**持久视觉**由绘制侧读同一份状态表（`to_interact_state()` 统一搬运），渲染与交互不会各认一张表。
