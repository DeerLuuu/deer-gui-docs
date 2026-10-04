# 命令式構築（Builder / L）

**模組**：`deer-core::builder`（原 `deer_layout::builder`，2026-10 分層重組；prelude 直接可用）

## 功能說明

imgui 式手感的命令式宣告 API：呼叫點即控制項、無樣板、可鏈式。內部維持一棵**保留式節點樹**——版面配置、命中測試、渲染都需要樹，「立即」的只是提交方式。與[場景檔](scene.md)共用同一套確定性 id 規則，兩條路徑產出結構相等的樹（核心不變式，見[第 2 步](../getting_started/step_by_step/02_builder.md)）。

## `Builder` 方法

| 方法 | 參數 | 回傳值 | 說明 |
|---|---|---|---|
| `Builder::new` | `(kind: Kind, id: impl Into<String>)` | `Builder` | 顯式命名的根；id 會被「佔號」，避免自動 id 撞名 |
| `Builder::auto` | `(kind: Kind)` | `Builder` | 根 id 由 `IdGen` 產生（與場景檔預設行為一致） |
| `.padding(v: f32)` | 鏈式 | `Builder` | **只對根節點**生效的內邊距 |
| `.gap(v: f32)` | 鏈式 | `Builder` | **只對根節點**生效的子節點間距 |
| `.size(w, h)` | `(Option<Size>, Option<Size>)` | `Builder` | **只對根節點**生效的顯式尺寸 |
| `.text(label)` | `impl Into<String>` | `String`（id） | 追加 `Text` 葉子 |
| `.button(label)` | 同上 | `String`（id） | 追加 `Button` 葉子 |
| `.field(label)` | 同上 | `String`（id） | 追加 `Field` 葉子 |
| `.text_opts(label, f)` / `.button_opts(label, f)` | `FnOnce(&mut Node)` | `String`（id） | 追加葉子並**就地改參數**（如 `n.layout.wrap = true`） |
| `.container(kind, id, body)` | `FnOnce(&mut Builder)` | `()` | 容器 + 閉包嵌套；斷言 `kind` 是容器（`Column`/`Row`/選擇類組） |
| `.container_auto(kind, body)` | 同上 | `()` | 容器 + 自動 id |
| `.container_opts(kind, id, layout: LayoutProps, body)` | 同上 | `()` | 容器 + 版面配置參數（嵌套容器設版面配置的正道） |
| `.build()` | — | `Node` | **複製**整棵樹；`Builder` 可繼續複用 |
| `.root_id()` | — | `&str` | 根的 id |

### M6 控制項族群（便捷構築）

以下方法均已從源碼核對（`crates/deer-core/src/builder.rs`）。**回傳的 id 是事件與 `UiState` 狀態表的鍵**；`*_opts` 版本可指定 id（**傳空字串 = 自動產生**）並就地改節點（`FnOnce(&mut Node)`）。

| 方法 | 參數 | 回傳值 | 說明 |
|---|---|---|---|
| `.segmented(labels)` / `.segmented_opts(id, layout, labels)` | `labels: &[&str]` | `Vec<String>`（段 id） | **分段選擇組**（`Kind::Segmented`）：互斥單選，每標籤一個 `button`；選中住在 `UiState::segments`（組 id → 段 id），沒塞 = 無選中段 |
| `.chip_group(labels)` / `.chip_group_opts(id, layout, labels)` | 同上 | `Vec<String>`（晶片 id） | **標籤組**（`Kind::ChipGroup`）：多選，每個晶片獨立開/關；開關表 `UiState::chips`，表裡沒有 = 關 |
| `.tab_bar(labels)` / `.tab_bar_opts(id, layout, labels)` | 同上 | `Vec<String>`（頁籤 id） | **頁籤欄**（`Kind::TabBar`）：單選頁籤，點擊發 `TabChanged { id, index }`（index 按直接子節點樹序，禁用頁也計入）；內容切換是 App 的事 |
| `.number_field(label)` / `.number_field_opts(id, label, f)` | `impl Into<String>` | `String`（id） | **數值輸入框**（`Kind::NumberField`）：草稿與 `Field` 同一套機械，提交時（失焦 / `Enter`）解析並發 `NumberChanged`；值域/步長住在 `UiState::num_opts` |
| `.scrub_num(label)` / `.scrub_num_opts(id, label, f)` | 同上 | `String`（id） | **拖動調值**（`Kind::ScrubNum`）：`label` 必須是 App 格式化的目前值，按住左右拖持續發 `NumberChanged` |
| `.switch(label)` / `.switch_opts(id, label, f)` | 同上 | `String`（id） | **開關**（`Kind::Switch`）：點擊 / `Enter` / `Space` 翻轉並發 `Toggled { id, on }`；開/關住在 `UiState::switches`（鍵 = 自己的 id），表裡沒有 = 關 |
| `.color_field(label)` / `.color_field_opts(id, label, f)` | 同上 | `String`（id） | **顏色輸入框**（`Kind::ColorField`）：文字輸入 `#RRGGBB` + 色塊預覽，提交成功發 `ColorChanged { rgb }` 並回寫正規化字串 |
| `.row_actions(labels)` / `.row_actions_opts(id, layout, labels)` | `labels: &[&str]` | `Vec<String>`（按鈕 id） | **行尾動作按鈕組**（組合層）：等價於「Row + 每標籤一個 button」，不擴 Kind；組 id 自動產生 |

注意：三個選擇類組（Segmented/ChipGroup/TabBar）**是容器**（孩子就是選項），版面配置與 `Row` 同一套橫排數學；便捷構造產出的樹與手寫 `container_opts` + `button` **結構相等**（有測試釘住）。

## `L` —— `LayoutProps` 便捷建構器

`L::new().…` 鏈式設定，最後 `.to_props()` 產出 `LayoutProps`：

| 方法 | 對應欄位 | 備註 |
|---|---|---|
| `.w(px)` / `.h(px)` | `width` / `height` = `Some(Size::Px(px))` | 百分比用 `Size::Pct(p)` 手工塞 |
| `.pad(px)` / `.gap(px)` | `padding` / `gap` | |
| `.main(Align)` / `.cross(Align)` | `main_axis` / `cross_axis` | |
| `.grow(w)` | `grow` | 剩餘主軸空間的分配權重 |
| `.scroll(bool)` | `scroll` | 垂直捲動容器，**只對 `Column` 有意義**（`Row` 上被忽略） |
| `.wrap(bool)` | `wrap` | 文字按寬度換行，**只對 `Text` 有意義** |
| `.pos(x, y)` | `position` = `Pos::Offset` | 流外定位（L1）：相對父內容盒原點的像素偏移，可為負；設了即脫離流內版面配置 |
| `.anchors(l, t, r, b, ox, oy)` | `position` = `Pos::Anchors` | 流外錨點（L4）：四邊錨點比例（`None` = 該邊無錨）+ 像素修正；一軸兩側都有錨 ⇒ 尺寸由錨點對導出，**resize 時錨定邊跟隨** |
| `.cross_self(a)` | `cross_self` | 每子節點交叉軸對齊（L2）：覆蓋父容器的 `cross`，只對這一個流內子節點生效 |
| `.min_w(px)` / `.max_w(px)` / `.min_h(px)` / `.max_h(px)` | `min_w` / `max_w` / `min_h` / `max_h` | 最小/最大尺寸（L3，像素版）；百分比用 `Size::Pct` 直設欄位；`min > max` ⇒ min 贏 |

另有自由函式 `props(label: Option<&str>, disabled: bool) -> NodeProps`。

## 屬性註冊表（registry）

`deer-core::registry`（重組後新增，E1）：按 [`Kind`](node.md) 枚舉「可編輯屬性」的**純資料表**。

- `PropSpec` —— 一條屬性登記：`name`（與結構體欄位名逐字一致）、`ty: PropType`（編輯器該用什麼控制項改它）、`domain`（取值域，給人看 + 輸入校驗）、`default`（字面量預設值）、`kinds`（對哪些 `Kind` 有意義，非空）；
- `PropType` —— 取值類型：`F32` / `Bool` / `Size` / `Align` / `Pos` / `Text` / `Opaque`（`Opaque` = 未知屬性的原樣保留，編輯器**不該直接編輯**它）；
- `SPECS: &[PropSpec]` —— 全部登記項，宣告順序 = 編輯器顯示順序。

**給誰用**：同一張表服務四個消費者——Inspector 面板、「改一個屬性」的 undo 粒度、`.dui` 2.0 的語法面、拖拽寫回的映射規則。它是純資料（`&'static [PropSpec]`，沒有 trait object / `Any` / 程序宏），與「樹是純資料」同一立場；防漂移靠編譯期窮盡解構——給 `LayoutProps`/`NodeProps` 加欄位而忘了登記，registry 模組直接編譯失敗。

## 使用範例

```rust
use deer_gui::prelude::*;

let mut app = Builder::new(Kind::Column, "app").padding(12.0).gap(8.0);
let ok_id = app.text("准备好了吗？");                    // 記下 id 給事件用
app.button_opts("取消", |b| { b.props.disabled = true; }); // 就地改參數
app.container_opts(Kind::Row, "bar", L::new().gap(8.0).to_props(), |r| {
    r.button("确定");
});
let tree = app.build();
```

## 注意事項

- **`new().padding()` 等鏈式方法只作用於根節點**；給嵌套容器設參數必須用
  `container_opts` + `L` —— 這是最常見的混淆點；
- **id 隨結構漂移**：自動 id 形如 `text_1`、`button_1`，按 kind 計數。節點要被按 id 定位
  （事件、腳本 `move @id`）時給它顯式 id；
- `_opts` / `container_with` 內部的順序是「先設 layout/props，最後 `with_id`」——
  整體賦值會覆蓋 id。直接用 `Node` 鏈式建構時也要遵守這個順序（踩過一次的坑）；
- `build()` 回傳的是複製，改 `Builder` 不會影響已 `build()` 出去的樹；
- 事件不進樹（樹是純資料）：點擊後發生什麼由[互動層](interaction.md)按 id 回報。
