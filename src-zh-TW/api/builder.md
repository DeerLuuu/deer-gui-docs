# 命令式構築（Builder / L）

**模組**：`deer_layout::builder`（prelude 直接可用）

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
| `.container(kind, id, body)` | `FnOnce(&mut Builder)` | `()` | 容器 + 閉包嵌套；斷言 `kind` 是 `Column`/`Row` |
| `.container_auto(kind, body)` | 同上 | `()` | 容器 + 自動 id |
| `.container_opts(kind, id, layout: LayoutProps, body)` | 同上 | `()` | 容器 + 版面配置參數（嵌套容器設版面配置的正道） |
| `.build()` | — | `Node` | **複製**整棵樹；`Builder` 可繼續複用 |
| `.root_id()` | — | `&str` | 根的 id |

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

另有自由函式 `props(label: Option<&str>, disabled: bool) -> NodeProps`。

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
