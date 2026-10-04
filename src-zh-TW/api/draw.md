# 繪製與主題（DrawList / Theme / Color）

**crate**：`DrawCmd` / `DrawList` / `Color` / `RectI` / `TextureId` / `GpuError` / `GpuResult` 現屬 `deer-core`（原 `deer-gpu`，2026-10 分層重組；prelude 名字不變）；`Theme` / `Extent` 仍在 `deer-gpu`。頁面內容經 `deer_gui` / prelude 使用。

## 功能說明

這一層把「樹 + 幾何」翻成**繪製命令清單**，再由後端（CPU 軟體光柵化或 Vulkan）畫成像素。核心設計原則：**命令是「結果」不是「控制項」**——控制項（Button/Field…）在渲染器裡被翻譯成矩形/文字/圖示，後端只負責畫矩形與字形；新增控制項型別不需要動任何後端。

`Theme` 是控制項配色與字號的集中定義；`Color` 是 sRGB 八位 + f32 alpha 的簡單顏色。

## `DrawCmd`（繪製命令）

| 變體 | 欄位 | 說明 |
|---|---|---|
| `FillRect` | `rect: RectI, color: Color` | 填充矩形 |
| `StrokeRect` | `rect, color, width: i32` | 描邊矩形 |
| `FillRoundRect` | `rect, radius: i32, color` | 圓角填充（圓角化由後端做） |
| `Text` | `rect, text: String, color, size: f32, align: u8`（0=左 1=中 2=右） | 一段文字（字形從圖集取樣；`size` 為像素字號） |
| `PushClip` | `rect: RectI` | 推裁剪區（與目前裁剪**求交**） |
| `PopClip` | — | 出裁剪堆疊（空堆疊彈出 ⇒ 退回全畫布） |
| `NodeHint` | `rect, node_id_len, node_id_fp` | 節點提示：**不產生像素**，後端安靜忽略；[裁剪快照](interaction.md)靠它把裁剪綁回節點（長度 + FNV 指紋雙重校驗） |

### `DrawList`

一幀的命令清單，結構不變式：**裁剪堆疊必須平衡**（`clip_balanced()`）。

| 方法 | 說明 |
|---|---|
| `push(cmd)` | 追加（內部維護裁剪平衡） |
| `len()` / `is_empty()` | |
| `clip_balanced() -> bool` | 裁剪堆疊平衡檢查（後端可據此省執行時檢查） |
| `counts() -> DrawCounts` | 各命令數量統計（測試與診斷用） |

### 產生與消費

| 入口 | 簽名要點 | 說明 |
|---|---|---|
| `build_draw_list` | `(tree: &Node, geo: &Geometry, theme: Theme, m: &impl Measure) -> DrawList` | 樹 + 幾何 → 命令清單（唯一產出點） |
| `CpuRenderer`（`deer_gpu::null`） | `new()` / `with_text(engine: TextEngine)`；`render(Extent { width, height }, &list, clear: Color) -> GpuResult<Framebuffer>` | CPU 參考後端（軟體光柵化）；`Framebuffer { width, height, pixels: Vec<u8> }` |

### 影像解碼（deer-gpu 新增，AF-1）

`deer-gpu` 新增 `image` 模組：零相依 **BMP 解碼**（檔案位元組 → RGBA8 像素 → 直餵紋理）。根導出 `decode_bmp` / `upload_bmp_to_texture` / `BmpImage` / `BmpError`；支援 24/32 位 `BI_RGB` 與 32 位 `BI_BITFIELDS`，不支援的格式（16 位、調色盤、RLE 等）明確報 `Unsupported`，不靜默給空圖。可執行範例：`cargo run -p deer-gui --example bmp_decode`。

## `Theme`

| 欄位 | 型別 | 預設值 |
|---|---|---|
| `text` | `Color` | `#e6e8ef` |
| `text_dim` | `Color` | `#8b93a7` |
| `surface` | `Color` | `rgba(20, 22, 32, 0.55)` |
| `border` | `Color` | `#2a2f3f` |
| `accent` | `Color` | `#4c8dff` |
| `on_accent` | `Color` | `#ffffff` |
| `font_size` | `f32` | `13.0` |
| `line_height` | `f32` | `18.0` |

互動狀態色由 `Color::lighten(t)`（hover 提亮）/ `Color::darken(t)`（pressed 加深）衍生。

## `Color` / `RectI` / `Extent`

| 型別 | 欄位 / 方法 |
|---|---|
| `Color { r, g, b: u8, a: f32 }` | `rgb(r,g,b)`（a=1.0）、`rgba(r,g,b,a)`、`TRANSPARENT`、`WHITE`、`packed() -> u32`（`0xRRGGBBAA`）、`lighten(t)` / `darken(t)`（**alpha 不變**，保證 CPU/GPU 不透明語料逐位元組對照成立） |
| `RectI { x, y, w, h: i32 }` | `new`、`right()`、`bottom()`、`contains(px, py)`（半開區間） |
| `Extent { width, height: u32 }` | 渲染目標尺寸 |

## 使用範例

```rust
use deer_gui::prelude::*;

// 拆開用：自己控制「幾何 → 命令 → 像素」三步
let tree = /* … */;
let geo = layout(&tree, Rect::new(0.0, 0.0, 320.0, 200.0), TextStyle::default(), &ApproxMeasure);
let list = build_draw_list(&tree, &geo, Theme::default(), &ApproxMeasure);
assert!(list.clip_balanced());
println!("命令数：{}", list.counts().fill_rect);

let fb = CpuRenderer::new().render(Extent { width: 320, height: 200 }, &list, Theme::default().surface)?;
let (w, h, rgba) = (fb.width, fb.height, fb.pixels);
```

## 注意事項

- **顏色附件約定**：必須是 `R8G8B8A8_UNORM`，**不能**用 `_SRGB` —— CPU 基準不做 gamma 轉換；
  sRGB 附件的混合發生在線性空間，實測與 CPU 位元組空間混合差約 44 位元組。視窗交換鏈同理（線性優先）；
- `lighten` / `darken` 刻意不動 alpha —— 讓 CPU/GPU 的逐位元組對照在不透明語料上仍然成立；
- `NodeHint` 不含 id 本身（只有長度 + 指紋）：後端可忽略，但 `ClipSnapshot::from_draw_list`
  依賴它與樹 + 幾何**共走**綁定 —— 自己建構繪製清單時保持「每個有幾何的節點一條提示」；
- 自訂主題時保持 `font_size` / `line_height` 與版面配置 `TextStyle` 一致（字號鐵律，見[第 5 步](../getting_started/step_by_step/05_text.md)）。

相關教學：[第 1 步](../getting_started/step_by_step/01_first_render.md)、[第 7 步](../getting_started/step_by_step/07_interaction.md)。
