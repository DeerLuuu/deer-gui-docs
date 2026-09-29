# 第 2 步：用 Builder 搭介面樹

## 目標

掌握 `Builder` 的三種掛載方式（葉子、帶參數葉子、容器嵌套），理解它回傳的 **id** 有什麼用，以及 id 是如何保證確定性的。

## 操作步驟

1. `Builder::new(kind, id)` 建立根節點；`.padding()` / `.gap()` / `.size()` 鏈式設定**根節點**的版面配置參數。
2. 用 `app.text("…")` / `app.button("…")` / `app.field("…")` 追加葉子控制項 —— 回傳值就是該節點的 **id**（留著給事件用）。
3. 需要就地改參數時用 `_opts` 變體：`app.text_opts("…", |n| n.layout.wrap = true)`。
4. 用 `container` / `container_opts` + 閉包嵌套容器；閉包裡 `push` 的節點都掛在容器下。
5. `app.build()` 把樹**複製**出來交給版面配置 / 算繪 —— `Builder` 本身還在，可以繼續改。

## 完整範例

```rust
use deer_gui::prelude::*;
use deer_gui::render_tree_to_png;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut app = Builder::new(Kind::Column, "app").padding(12.0).gap(8.0);

    // 葉子控制項：回傳 id（事件關聯用，不進樹 —— 樹是純資料）
    let ok_id = app.text("準備好了嗎？");

    // 帶參數的葉子：就地改 Node（這裡是停用一顆按鈕）
    let cancel_id = app.button_opts("取消", |b| {
        b.props.disabled = true;
    });

    // 容器 + 閉包式嵌套：閉包裡的呼叫都掛到這個 Row 下
    app.container(Kind::Row, "actions", |r| {
        r.button("確定");
        r.button("再想想");
    });

    let tree = app.build();
    std::fs::write("builder.png", render_tree_to_png(&tree, 320, 180, Theme::default())?)?;

    println!("確定按鈕 id = {ok_id}，取消按鈕 id = {cancel_id}");
    println!("根節點 id = {}", app.root_id());
    Ok(())
}
```

```sh
cargo run
```

## 關鍵規則（踩過的坑，別繞回來）

- **id 是確定性的**：不命名時由 `IdGen` 按 kind 計數產生 `text_1` / `button_1` 這樣的 id；
  顯式命名的節點會「佔號」，自動 id 永遠不會撞上它。兩條構築路徑（Builder / 場景檔）
  共用同一規則 —— 否則兩棵樹就不結構相等了。
- **id 會隨樹的結構漂移**：自動 id 依賴「第幾個出現的同 kind 節點」。某個節點的內容每幀都變、
  你要按 id 定位它（比如腳本 `move @count`）—— 那就給它**顯式 id**（用 `Node` 鏈式建構或
  `container_opts` 的 id 參數）。
- **`Builder::new().padding()` 只作用於根節點**。給嵌套容器設版面配置參數要用
  `container_opts(kind, id, L::new().pad(8.0).to_props(), |…| …)`。
- **先設參數、最後定 id** 是庫內部的事，但如果你直接用 `Node::with_props` 鏈式建構，
  順序寫反會把 id 整塊覆蓋掉（原始碼註解裡記的踩坑）。

需要更強的版面配置控制（尺寸、對齊、grow）？那是下一步的內容。

## 本節用到的 API

| API | 作用 | 詳細文件 |
|---|---|---|
| `Builder::text` / `button` / `field` | 追加葉子，回傳 id | [命令式構築](../../api/builder.md) |
| `Builder::text_opts` / `button_opts` | 葉子 + 就地改參數 | [命令式構築](../../api/builder.md) |
| `Builder::container` / `container_opts` | 容器 + 閉包嵌套 | [命令式構築](../../api/builder.md) |
| `Builder::build` | 複製出 `Node` 樹 | [節點資料模型](../../api/node.md) |
| `IdGen` | 確定性 id 產生規則 | [節點資料模型](../../api/node.md) |

## 下一步

[第 3 步：版面配置參數與對齊](03_layout_props.md) —— 讓子節點真正排成你想要的樣子。
