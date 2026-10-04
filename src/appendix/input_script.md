# 输入脚本语法

**模块**：`deer_gui::input_script`

输入脚本把一串输入事件写成文本，用于**确定性重放**：窗口示例（`counter`、`interactive_form`）与 testkit（`Harness::run_script`）共用同一份解析器 —— 脚本语法只有一处定义，不会出现「示例里能跑、测试里是另一套」的分叉。

环境变量：`DEER_INPUT_SCRIPT`（窗口示例从这里读默认脚本；示例可以定义自己的变量，如 `DEER_COUNTER_SCRIPT`，优先级更高）。

## 语法规则

- 语句用 `;`（或换行）分隔；**空语句被忽略**（`;;`、结尾多一个 `;` 都不算错）；
- `#` 到行尾是注释；
- 语法错（未知语句、未知键名、坐标不是数字…）⇒ `Err(String)`，**带语句序号与原文** ——
  刻意不「跳过看不懂的语句」：脚本是判据的一部分，静默跳过等于判据悄悄失效。

## 语句表

| 语法 | 含义 |
|---|---|
| `move:X,Y` | 指针移到 `(X, Y)`（f32；贴边、负数都允许） |
| `down:left` / `down:right` / `down:middle` | 指针按下（坐标 = **最近一次 `move`**；没 move 过就是 `(0,0)`） |
| `up:left`（同上三档） | 指针抬起（坐标口径同 `down`） |
| `key:Tab` | `KeyDown`。可写 `Escape` / `Enter` / `Backspace` / `Left` / `Right` / `Up` / `Down` / `PageUp` / `PageDown` / `Home` / `End` / `Other` / `Char(a)`。**键名后加 `*`（`key:Tab*`）= 系统按键重复**（`repeat: true`，T3.6）；不加 `*` = 普通按下（`repeat: false`） |
| `shift+key:Tab`（或 `key:shift+Tab`） | 带修饰键：`ctrl+` / `alt+` / `sup+` 同档，用 `+` 叠加；前缀写在动词一侧或键名一侧都行 |
| `text:hi` | 一段文本输入（原样，含空格与中文；是**追加**不是覆盖） |
| `focus:off` / `focus:on` | 窗口失焦 / 重新获得焦点（`FocusChanged`） |
| `wheel:0,3` | 滚轮事件（`dy` 驱动 `hover` 最近可滚动祖先的垂直滚动并播种惯性，见[第 8 步](../getting_started/step_by_step/08_scroll_wrap.md)；`dx` 水平本期忽略） |

## API

| 名称 | 签名 | 说明 |
|---|---|---|
| `parse_script` | `(src: &str) -> Result<Vec<InputEvent>, String>` | 脚本 → 事件序列 |
| `ENV_VAR` | `&str` = `"DEER_INPUT_SCRIPT"` | 环境变量名常量 |
| `DEFAULT_SCRIPT` | `"move:40,20;down:left;up:left;key:Tab;text:hi"` | 演示用默认脚本（每步都有可断言的效果） |

重放状态（脚本 → 终态）的纯逻辑入口也在本模块：把事件逐条喂给
[`interaction::handle`](../api/interaction.md) 即可 —— 窗口层与测试共用这一条链。

## 示例

```rust
use deer_gui::input_script::parse_script;
use deer_gui::interaction::{InputEvent, Key, PointerButton};

let evs = parse_script("move:10,20; down:left; up:left; key:Tab; text:hi").unwrap();
assert_eq!(evs.len(), 5);
assert_eq!(evs[0], InputEvent::PointerMoved { x: 10.0, y: 20.0 });
assert_eq!(
    evs[3],
    InputEvent::KeyDown { key: Key::Tab, mods: Default::default(), repeat: false }
);
assert_eq!(evs[4], InputEvent::TextInput { text: "hi".to_string() });
```

```sh
# counter 示例：内置脚本重放（有期望终态，跑完自己退；退出码 0 = 断言全过）
cmd /c "set DEER_COUNTER_SCRIPT=@builtin&& cargo run -q -p deer-gui --features window --example counter"
```

## 注意事项

- **`move:` 为什么必须显式写坐标**：`down`/`up` 的坐标来自「最近一次 `move`」——
  这正是窗口层的行为（winit 的 `MouseInput` 只给按键，坐标由 `CursorMoved` 记账）。
  脚本必须自足，「指针现在在哪」不能是脚本之外的隐式状态；
- **脚本建议走环境变量而不是命令行参数**（实测）：带空格/分号/`@` 的长参数在不同 shell 里
  会被吃掉内容，且解析器可能拿到的是另一段**合法**脚本 —— 静默地测了个寂寞；
- **`@id` 定位不是库级语法**：testkit 的 `Harness::run_script` 与部分示例扩展了
  `move @id`（坐标取该节点中心，由布局算出、不写死）；库级 `parse_script` 只认 `move:X,Y`；
- Windows `cmd` 下 `set X=1 && …` 的值带尾空格（`"1 "`）：示例的判定都先 `trim()` 再比，
  自己写的门槛判定也要这样（见[已知陷阱](../advanced/pitfalls.md)）。
