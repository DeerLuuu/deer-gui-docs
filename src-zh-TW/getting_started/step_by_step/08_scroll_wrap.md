# 第 8 步：捲動與文字換行

## 目標

給長內容加**滾輪垂直捲動**，讓長文字**按寬度換行**。兩者都是 opt-in 的顯式宣告：`scroll`（只對 `Column` 有意義）與 `wrap`（只對 `Text` 有意義）。

## 操作步驟

### 垂直捲動

1. 給容器宣告捲動：`L::new().scroll(true).to_props()`，或場景檔裡寫裸屬性 `scroll`。
   「可捲動容器」的唯一判據是 `Node::is_scroll_container()`（`Column` + `scroll`）——
   版面配置、算繪、互動三處共用，`Row` 上設了會被**忽略**（本期只做垂直捲動）。
2. 捲動偏移住在 `UiState.scroll`（`ScrollState`）裡：**偏移是版面配置的輸入，上限是版面配置的輸出**。
3. 每幀：`layout_with_scroll(root, box, style, &measure, &state.scroll.offsets)` 拿
   `(geometry, metrics)`，然後**立刻** `state.scroll.set_metrics(&metrics)` 灌回去 ——
   它會把舊偏移夾進新上限（視口/內容變了也不殘留越界偏移）。
4. 滾輪不用你寫：`handle` 裡 `Wheel { dy }` 會找 `hover` 最近的可捲動祖先，
   按 `dy × 40px`（`WHEEL_STEP_PX`）捲，夾在 `[0, max_scroll]`，變了才發 `Scrolled` 事件。

### 文字換行

1. 給 `Text` 節點宣告換行：`L::new().wrap(true).w(200.0).to_props()` —— **換行寬度 =
   節點自己的像素寬度**。沒宣告像素寬度 ⇒ 節點寬 = 文字寬 ⇒ 換不了行（這是被測試釘住的邊界）。
2. 場景檔寫法：`[text label=長文字 w=200 wrap]`。
3. 高度自動算對：固有高 = **實際行數 × 行高** —— 行數只有一處定義（`Measure::wrap`），
   版面配置預留與算繪繪製永遠不會「預留 2 行、畫出 3 行」。

## 完整範例

```rust
use deer_gui::prelude::*;

fn main() {
    // 一個 160 高的可捲動 Column，裡面塞 6 段文字；第二段宣告了按 200px 寬換行
    let mut list = Node::new(Kind::Column, "list")
        .with_layout(L::new().w(240.0).h(160.0).pad(8.0).gap(4.0).scroll(true).to_props());
    for i in 1..=6 {
        let mut t = Node::new(Kind::Text, "").with_label(format!("第 {i} 段文字"));
        if i == 2 {
            t.layout.wrap = true;
            t.layout.width = Some(Size::Px(200.0)); // 換行寬度 = 自己的像素寬度
        }
        list.children.push(t);
    }

    // 偏移是版面配置的輸入；沒登記的 id ⇒ 偏移 0（永遠給出確定結果）
    let offsets = ScrollOffsets::new();
    let (geo, metrics) = layout_with_scroll(
        &list, Rect::new(0.0, 0.0, 260.0, 180.0), TextStyle::default(), &ApproxMeasure, &offsets,
    );
    println!("list 的捲動上限 = {}px", metrics.max_of("list"));

    // 想直接跳到某處：ScrollOffsets::new().with("list", 40)，再算一次版面配置即可
}
```

```sh
cargo run
```

可執行的互動版（滾輪真的能捲）：

```sh
cargo run -p deer-gui --example scroll
```

## 語義要點

| 規則 | 說明 |
|---|---|
| `max_scroll = max(0, 內容主軸尺寸 + 間隙 + 內邊距 − 視口)` | 版面配置的輸出，整數像素 |
| 偏移夾取 | 捲到邊界不越界；越界偏移被**靜默丟棄**，不滲進幾何 |
| 容器自身矩形不動 | 捲動只改**內部內容**的相對位置（整體位移 `-offset`） |
| 捲動容器的子節點 | 主軸顯式尺寸**不被視口夾取**（否則「內容高於視口」前提不成立）；`grow` 失效（沒有剩餘空間可分） |
| 灌漏了 metrics | 上限全為 0 ⇒ 滾輪什麼都不做（fail-closed，不會捲進「沒有上限的虛空」） |
| 換行演算法 `wrap_greedy` | 按**空格 / 定位字元**切詞貪心塞行；單詞超寬按字元硬切；`max_width <= 0` 不換行 |

> **中文文字提示**：切詞只認空格 / 定位字元。一段沒有空格的中文是一個「單詞」，
> 超出寬度時走**按字元硬切**——結果確定、逐字折行，符合預期；但如果你在英文單詞中間
> 期待「按詞斷行」，記得原始文本裡要有空格。

## 捲軸與慣性捲動（已落地）

- **可視捲軸**：`scrollbar_geom(viewport, offset, max_scroll)` 給出軌道 + 滑塊幾何
  （寬度 `SCROLLBAR_W`、貼邊內縮 `SCROLLBAR_INSET`、最小滑塊高 `SCROLLBAR_MIN_THUMB`；
  內容裝得下 ⇒ 回傳 `None` 不畫）。互動層接線後：**拖滑塊改偏移**，**點軌道空白跳到指標處**並可續拖。
- **慣性捲動**：滾輪捲動時自動播種慣性（捲多遠滑多遠），但**不會自己捲** ——
  需要呼叫方顯式驅動：`redraw` 裡調 `advance_inertia(&mut state)` 推進一步，
  `next_deadline` 用 `inertia_deadline(state)` 排下一次喚醒。真實視窗的完整接線見範例
  `scroll_inertia_window`。

細節見[版面配置引擎](../../api/layout.md)與[互動層](../../api/interaction.md)。

```sh
cargo run -p deer-gui --example scroll_bar            # 可視捲軸（離屏自檢）
cargo run -p deer-gui --features window --example scroll_inertia_window   # 慣性捲動（真視窗）
```

## 本節用到的 API

| API | 作用 | 詳細文件 |
|---|---|---|
| `layout_with_scroll` | 版面配置 + 捲動（回傳幾何與上限） | [版面配置引擎](../../api/layout.md) |
| `ScrollOffsets` / `ScrollMetrics` | 偏移（輸入）/ 上限（輸出） | [版面配置引擎](../../api/layout.md) |
| `ScrollState::set_metrics` | 每幀灌回上限並夾取舊偏移 | [互動層](../../api/interaction.md) |
| `Node::is_scroll_container` / `wraps_text` | 判據的唯一出處 | [節點資料模型](../../api/node.md) |
| `wrap_greedy` | 換行演算法（唯一實作） | [版面配置引擎](../../api/layout.md) |

## 下一步

[第 9 步：用 testkit 寫介面測試](09_testing.md) —— 把以上一切變成十幾行的可斷言測試。
