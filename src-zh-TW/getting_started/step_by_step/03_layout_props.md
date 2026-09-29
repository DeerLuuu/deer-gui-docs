# 第 3 步：版面配置參數與對齊

## 目標

會用 `L`（`LayoutProps` 的便捷建構器）表達尺寸（像素 / 百分比）、間距、主軸 / 交叉軸對齊與 `grow`，並理解「顯式尺寸 > 父分配 > 固有尺寸」的優先順序。

## 操作步驟

1. 容器的版面配置參數用 `L::new().…` 鏈式建構，最後 `.to_props()` 交給 `container_opts`：
   - `w(px)` / `h(px)`：顯式尺寸；百分比用 `Size::Pct(50.0)`（相對**父內容盒**解析）；
   - `pad(px)`：四邊內邊距；`gap(px)`：子節點間距；
   - `main(Align)`：主軸對齊（`Row` 的水平方向 / `Column` 的垂直方向）；
   - `cross(Align)`：交叉軸對齊；`Align::Stretch` 會吃滿交叉軸；
   - `grow(w)`：剩餘主軸空間的分配權重。
2. 記住固有尺寸的語義（I-8）：容器主軸 = **sum(子)**，交叉軸 = **max(子)**。
3. `layout()` 是純函式：餵樹 + 根盒子，拿回幾何表 —— 不滿意就改參數再算，樹永遠不會被改。

## 完整範例

```rust
use deer_gui::prelude::*;

fn main() {
    // 頂欄：固定高 40，水平置中，子節點間距 8
    let tree = Node::new(Kind::Column, "app")
        .with_layout(L::new().w(280.0).h(160.0).pad(8.0).gap(8.0).to_props())
        .push(
            Node::new(Kind::Row, "topbar")
                .with_layout(
                    L::new().h(40.0).gap(8.0).main(Align::Center).cross(Align::Center).to_props(),
                )
                .push(Node::new(Kind::Button, "").with_label("左"))
                .push(Node::new(Kind::Button, "").with_label("右")),
        )
        // grow = 1：吃掉剩餘的垂直空間
        .push(
            Node::new(Kind::Text, "content")
                .with_layout(L::new().grow(1.0).to_props())
                .with_label("正文區域"),
        )
        // 底部按鈕：交叉軸拉伸（吃滿寬度）
        .push(
            Node::new(Kind::Button, "wide")
                .with_layout(L::new().cross(Align::Stretch).to_props())
                .with_label("佔滿一整行"),
        );

    let geo = layout(
        &tree,
        Rect::new(0.0, 0.0, 300.0, 200.0), // 根盒子由宿主給（I-5：根不撐滿，以上面的顯式尺寸為準）
        TextStyle::default(),
        &ApproxMeasure,
    );
    for (id, r) in &geo {
        println!("{id}: {r:?}");
    }
}
```

```sh
cargo run
```

## 優先順序與邊界

| 情況 | 結果 |
|---|---|
| 顯式像素尺寸存在 | **採信**它（但被夾在可用空間內，I-6） |
| 只有百分比 | 相對**父內容盒**解析（不是「父分配尺寸」，I-7 的靜默錯誤來源） |
| 都沒有 | 用固有尺寸（Button ≥ 28×22，Field ≥ 60×22，見 `metrics` 常數） |
| `main_axis: Stretch` | 主軸剩餘空間被**均分**吃掉 |
| `cross_axis: Stretch` | 交叉軸直接吃滿 |

> **百分比陷阱**：`50%` 解析基準是父的**內容盒**（內邊距以內的區域）。把它理解成
> 「父分配給我的空間的一半」是一個真實發生過的靜默錯誤 —— 版面配置仍有值，只是值錯了。

## 本節用到的 API

| API | 作用 | 詳細文件 |
|---|---|---|
| `L` | `LayoutProps` 便捷建構器 | [命令式構築](../../api/builder.md) |
| `Size::Px` / `Size::Pct` | 像素 / 百分比尺寸 | [節點資料模型](../../api/node.md) |
| `Align` | 主軸 / 交叉軸對齊 | [節點資料模型](../../api/node.md) |
| `layout()` | 樹 → 幾何表（純函式） | [版面配置引擎](../../api/layout.md) |
| `measure_tree` | 只看固有尺寸 | [版面配置引擎](../../api/layout.md) |

## 下一步

同一棵樹能不能不寫 Rust、直接寫成文字？[第 4 步：用 .dui 場景檔描述介面](04_scene_file.md)。
