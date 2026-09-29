# 輸入腳本語法

**模組**：`deer_gui::input_script`

輸入腳本把一串輸入事件寫成文字，用於**確定性重放**：視窗範例（`counter`、`interactive_form`）與 testkit（`Harness::run_script`）共用同一份解析器 —— 腳本語法只有一處定義，不會出現「範例裡能跑、測試裡是另一套」的分叉。

環境變數：`DEER_INPUT_SCRIPT`（視窗範例從這裡讀預設腳本；範例可以定義自己的變數，如 `DEER_COUNTER_SCRIPT`，優先級更高）。

## 語法規則

- 語句用 `;`（或換行）分隔；**空語句被忽略**（`;;`、結尾多一個 `;` 都不算錯）；
- `#` 到行尾是註解；
- 語法錯（未知語句、未知鍵名、座標不是數字…）⇒ `Err(String)`，**帶語句序號與原文** ——
  刻意不「跳過看不懂的語句」：腳本是判據的一部分，靜默跳過等於判據悄悄失效。

## 語句表

| 語法 | 含義 |
|---|---|
| `move:X,Y` | 指標移到 `(X, Y)`（f32；貼邊、負數都允許） |
| `down:left` / `down:right` / `down:middle` | 指標按下（座標 = **最近一次 `move`**；沒 move 過就是 `(0,0)`） |
| `up:left`（同上三檔） | 指標抬起（座標口徑同 `down`） |
| `key:Tab` | `KeyDown`。可寫 `Escape` / `Enter` / `Backspace` / `Left` / `Right` / `Up` / `Down` / `Other` / `Char(a)` |
| `shift+key:Tab`（或 `key:shift+Tab`） | 帶修飾鍵：`ctrl+` / `alt+` / `sup+` 同檔，用 `+` 疊加；前綴寫在動詞一側或鍵名一側都行 |
| `text:hi` | 一段文字輸入（原樣，含空格與中文；是**追加**不是覆蓋） |
| `focus:off` / `focus:on` | 視窗失焦 / 重新取得焦點（`FocusChanged`） |
| `wheel:0,3` | 滾輪事件（狀態機本期不消費，可用來驗證「不消費的事件不改狀態」） |

## API

| 名稱 | 簽名 | 說明 |
|---|---|---|
| `parse_script` | `(src: &str) -> Result<Vec<InputEvent>, String>` | 腳本 → 事件序列 |
| `ENV_VAR` | `&str` = `"DEER_INPUT_SCRIPT"` | 環境變數名常數 |
| `DEFAULT_SCRIPT` | `"move:40,20;down:left;up:left;key:Tab;text:hi"` | 展示用預設腳本（每步都有可斷言的效果） |

重放狀態（腳本 → 終態）的純邏輯入口也在本模組：把事件逐條餵給
[`interaction::handle`](../api/interaction.md) 即可 —— 視窗層與測試共用這一條鏈。

## 範例

```rust
use deer_gui::input_script::parse_script;
use deer_gui::interaction::{InputEvent, Key, PointerButton};

let evs = parse_script("move:10,20; down:left; up:left; key:Tab; text:hi").unwrap();
assert_eq!(evs.len(), 5);
assert_eq!(evs[0], InputEvent::PointerMoved { x: 10.0, y: 20.0 });
assert_eq!(evs[3], InputEvent::KeyDown { key: Key::Tab, mods: Default::default() });
assert_eq!(evs[4], InputEvent::TextInput { text: "hi".to_string() });
```

```sh
# counter 範例：內置腳本重放（有期望終態，跑完自己退；結束代碼 0 = 斷言全過）
cmd /c "set DEER_COUNTER_SCRIPT=@builtin&& cargo run -q -p deer-gui --features window --example counter"
```

## 注意事項

- **`move:` 為什麼必須顯式寫座標**：`down`/`up` 的座標來自「最近一次 `move`」——
  這正是視窗層的行為（winit 的 `MouseInput` 只給按鍵，座標由 `CursorMoved` 記帳）。
  腳本必須自足，「指標現在在哪」不能是腳本之外的隱式狀態；
- **腳本建議走環境變數而不是命令列參數**（實測）：帶空格/分號/`@` 的長參數在不同 shell 裡
  會被吃掉內容，且解析器可能拿到的是另一段**合法**腳本 —— 靜默地測了個寂寞；
- **`@id` 定位不是庫級語法**：testkit 的 `Harness::run_script` 與部分範例擴展了
  `move @id`（座標取該節點中心，由版面配置算出、不寫死）；庫級 `parse_script` 只認 `move:X,Y`；
- Windows `cmd` 下 `set X=1 && …` 的值帶尾空格（`"1 "`）：範例的判定都先 `trim()` 再比，
  自己寫的門檻判定也要這樣（見[已知陷阱](../advanced/pitfalls.md)）。
