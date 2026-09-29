# 第 4 步：用 .dui 場景檔描述介面

## 目標

學會 `.dui` 場景檔語法（思路類似 Godot 的 `.tscn`），用文字描述一棵與命令式 API **結構相等**的樹，並理解解析的嚴格性：寫錯的屬性會報錯，而不是靜默無效。

## 操作步驟

1. 寫一個 `ui.dui` 檔案：每行一個節點 `[類型 屬性=值 …]`，**縮排必須是 2 的倍數**，縮排層級就是父子關係。
2. 用 `parse_scene(text, "ui.dui")` 解析成 `Node` —— 回傳 `Result`，錯誤帶**行號**。
3. 場景檔來自資料時也一樣安全：解析是純文字處理，**不執行任何東西**。

## 完整範例

`ui.dui`：

```text
# 井號到行尾是註解（引號裡的 # 不算）
[column name=app pad=12 gap=8]
  [text label=標題]
  [row name=bar gap=8]
    [button label=確定]
    [button label=取消 disabled]
```

`main.rs`：

```rust
use deer_gui::prelude::*;
use deer_gui::render_tree_to_png;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let src = std::fs::read_to_string("ui.dui")?;
    let tree = parse_scene(&src, "ui.dui")?; // Err 裡帶行號與來源檔名

    // 與命令式路徑完全等價的寫法（兩棵樹結構相等）：
    //   let mut app = Builder::new(Kind::Column, "app").padding(12.0).gap(8.0);
    //   app.text("標題");
    //   app.container_opts(Kind::Row, "bar", L::new().gap(8.0).to_props(), |r| {
    //       r.button("確定");
    //       r.button_opts("取消", |b| { b.props.disabled = true; });
    //   });

    std::fs::write("scene.png", render_tree_to_png(&tree, 320, 200, Theme::default())?)?;
    Ok(())
}
```

```sh
cargo run
```

## 屬性速查

| 屬性 | 接受的值 | 對應 `LayoutProps` / `NodeProps` |
|---|---|---|
| `name` | 字串（可省略 → 自動產生 `kind_N`） | `Node.id` |
| `w` / `h` | 數字或百分比（`280` / `50%`） | `width` / `height` |
| `pad` / `gap` | 數字 | `padding` / `gap` |
| `main` / `cross` | `start` / `center` / `end` / `stretch` | `main_axis` / `cross_axis` |
| `grow` | 數字 | `grow` |
| `scroll` | **裸屬性**（不接受值） | `scroll`（見第 8 步） |
| `wrap` | **裸屬性** | `wrap`（見第 8 步） |
| `label` | 字串（含空格用引號：`label="確 定"`） | `props.label` |
| `disabled` | **裸屬性** | `props.disabled` |

## 嚴格性的三條規則

1. **開關屬性帶值就報錯**：`scroll=1` 不是「當真」，是 `Err` ——「寫錯了但不生效」屬於最難查的 bug，解析器寧可大聲失敗。
2. **未知屬性報錯**：可用屬性清單就是上面這張表，多一個字母都不行。
3. **只能有一個根節點**；葉子節點（`text` / `button` / `field`）下面不能再掛子節點。

需要把樹序列化回文字（做編輯器、做快照測試）？`encode_scene(&tree)` ——
且 `parse_scene(encode_scene(t))` 與 `t` 結構相等（往返不變式有測試釘著）。

## 本節用到的 API

| API | 作用 | 詳細文件 |
|---|---|---|
| `parse_scene` | `.dui` 文字 → `Node` | [場景檔](../../api/scene.md) |
| `encode_scene` | `Node` → `.dui` 文字 | [場景檔](../../api/scene.md) |
| `SceneError` | 帶行號的解析錯誤 | [場景檔](../../api/scene.md) |

## 下一步

[第 5 步：真實字型算繪文字](05_text.md) —— 讓文字長出真正的字形。
