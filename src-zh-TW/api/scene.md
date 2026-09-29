# 場景檔（parse_scene / encode_scene）

**模組**：`deer_layout::scene`

## 功能說明

`.dui` 場景檔是 deer-gui 的宣告式描述格式（思路類似 Godot 的 `.tscn`）：縮排 + 段頭的行式語法，與[命令式 Builder](builder.md) 產出**結構相等**的樹。

為什麼是「縮排 + 段頭」而不是 JSON/TOML：與 `.tscn` 同族手感；**零相依**（本儲存庫硬不變量）；行式解析能給出**行號**，錯誤訊息可用。**安全性**：純解析，不執行任何東西（場景檔可能來自資料）。

## 函式

| 函式 | 簽名 | 說明 |
|---|---|---|
| `parse_scene` | `(src: &str, source: &str) -> Result<Node, SceneError>` | 文字 → 樹；`source` 是出錯時顯示的來源名（通常是檔名） |
| `encode_scene` | `(root: &Node) -> String` | 樹 → 文字；`parse_scene(encode_scene(t))` 與 `t` 結構相等（往返不變式有測試） |

### `SceneError`

| 欄位 | 型別 | 說明 |
|---|---|---|
| `message` | `String` | 錯誤描述（含期望寫法） |
| `line` | `usize` | 行號（從 1 起） |
| `source` | `String` | 來源名 |

`Display` 輸出形如 `ui.dui:5: 缩进必须是 2 的倍数，实际 3`。

## 語法

```text
# 井號到行尾是註解（引號裡的 # 不算；空行忽略）
[column name=app pad=12 gap=8]
  [text label=标题]
  [row gap=8]
    [button label=确定]
    [button label=取消 disabled]
```

規則：

- 每行一個節點：`[型別 屬性=值 …]`；型別必須是 `column` / `row` / `text` / `button` / `field`；
- **縮排必須是 2 的倍數**，縮排層級即父子關係；
- 只能有一個根節點；葉子節點下不能再掛子節點；
- 屬性值含空格 / 引號 / `#` / `=` 時用雙引號：`label="确 定"`。

### 屬性表

| 屬性 | 值的形式 | 對應欄位 |
|---|---|---|
| `name` | 字串（可省略 → 自動 `kind_N`） | `Node.id` |
| `w` / `h` | 數字或百分比（`280` / `50%`） | `layout.width` / `layout.height` |
| `pad` / `gap` | 數字 | `layout.padding` / `layout.gap` |
| `main` / `cross` | `start` / `center` / `end` / `stretch` | `main_axis` / `cross_axis` |
| `grow` | 數字 | `layout.grow` |
| `scroll` / `wrap` | **裸屬性**（寫了就為真；**帶值報錯**） | `layout.scroll` / `layout.wrap` |
| `label` | 字串 | `props.label` |
| `disabled` | **裸屬性**（帶值報錯） | `props.disabled` |

## 使用範例

```rust
use deer_gui::prelude::*;

let src = r#"
[column name=app pad=12 gap=8]  # 行內註解也行
  [text label=标题]
  [row gap=8]
    [button label=确定]
"#;

let tree = parse_scene(src, "inline")?;
let back = encode_scene(&tree);
assert!(parse_scene(&back, "roundtrip")?.structurally_eq(&tree));
```

## 注意事項

- **開關屬性帶值就報錯**：`scroll=1` 不是「當真」，是 `Err` ——「寫錯了但不生效」屬於最難查的
  bug，解析器寧可大聲失敗（`disabled` 也走這條：它以前默默把任何值當假）；
- **未知屬性報錯**：可用屬性就是上面那張表；未知**型別**也報錯；
- 顯式 `name` 會被 `IdGen` 佔號，自動 id 不會撞上它 —— 與 Builder 同一條規則；
- 數字屬性必須可解析為 `f32`，否則報錯（帶行號與原文）；
- 與 Builder 的等價性有測試釘住（`t1_two_authoring_paths_produce_the_same_tree`），
  改語法前先讀 `CONTRIBUTING.md` 的設計約束。

相關教學：[第 4 步](../getting_started/step_by_step/04_scene_file.md)。
