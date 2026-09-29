# 绘制与主题（DrawList / Theme / Color）

**crate**：`deer-gpu`（经 `deer_gui` / prelude 使用）

## 功能说明

这一层把「树 + 几何」翻成**绘制命令列表**，再由后端（CPU 软件光栅化或 Vulkan）画成像素。核心设计原则：**命令是「结果」不是「控件」**——控件（Button/Field…）在渲染器里被翻译成矩形/文字/图标，后端只负责画矩形与字形；新增控件类型不需要动任何后端。

`Theme` 是控件配色与字号的集中定义；`Color` 是 sRGB 八位 + f32 alpha 的简单颜色。

## `DrawCmd`（绘制命令）

| 变体 | 字段 | 说明 |
|---|---|---|
| `FillRect` | `rect: RectI, color: Color` | 填充矩形 |
| `StrokeRect` | `rect, color, width: i32` | 描边矩形 |
| `FillRoundRect` | `rect, radius: i32, color` | 圆角填充（圆角化由后端做） |
| `Text` | `rect, text: String, color, size: f32, align: u8`（0=左 1=中 2=右） | 一段文字（字形从图集取样；`size` 为像素字号） |
| `PushClip` | `rect: RectI` | 推裁剪区（与当前裁剪**求交**） |
| `PopClip` | — | 出裁剪栈（空栈弹出 ⇒ 退回全画布） |
| `NodeHint` | `rect, node_id_len, node_id_fp` | 节点提示：**不产生像素**，后端安静忽略；[裁剪快照](interaction.md)靠它把裁剪绑回节点（长度 + FNV 指纹双重校验） |

### `DrawList`

一帧的命令列表，结构不变式：**裁剪栈必须平衡**（`clip_balanced()`）。

| 方法 | 说明 |
|---|---|
| `push(cmd)` | 追加（内部维护裁剪平衡） |
| `len()` / `is_empty()` | |
| `clip_balanced() -> bool` | 裁剪栈平衡检查（后端可据此省运行时检查） |
| `counts() -> DrawCounts` | 各命令数量统计（测试与诊断用） |

### 生成与消费

| 入口 | 签名要点 | 说明 |
|---|---|---|
| `build_draw_list` | `(tree: &Node, geo: &Geometry, theme: Theme, m: &impl Measure) -> DrawList` | 树 + 几何 → 命令列表（唯一产出点） |
| `CpuRenderer`（`deer_gpu::null`） | `new()` / `with_text(engine: TextEngine)`；`render(Extent { width, height }, &list, clear: Color) -> GpuResult<Framebuffer>` | CPU 参考后端（软件光栅化）；`Framebuffer { width, height, pixels: Vec<u8> }` |

## `Theme`

| 字段 | 类型 | 默认值 |
|---|---|---|
| `text` | `Color` | `#e6e8ef` |
| `text_dim` | `Color` | `#8b93a7` |
| `surface` | `Color` | `rgba(20, 22, 32, 0.55)` |
| `border` | `Color` | `#2a2f3f` |
| `accent` | `Color` | `#4c8dff` |
| `on_accent` | `Color` | `#ffffff` |
| `font_size` | `f32` | `13.0` |
| `line_height` | `f32` | `18.0` |

交互状态色由 `Color::lighten(t)`（hover 提亮）/ `Color::darken(t)`（pressed 加深）派生。

## `Color` / `RectI` / `Extent`

| 类型 | 字段 / 方法 |
|---|---|
| `Color { r, g, b: u8, a: f32 }` | `rgb(r,g,b)`（a=1.0）、`rgba(r,g,b,a)`、`TRANSPARENT`、`WHITE`、`packed() -> u32`（`0xRRGGBBAA`）、`lighten(t)` / `darken(t)`（**alpha 不变**，保证 CPU/GPU 不透明语料逐字节对照成立） |
| `RectI { x, y, w, h: i32 }` | `new`、`right()`、`bottom()`、`contains(px, py)`（半开区间） |
| `Extent { width, height: u32 }` | 渲染目标尺寸 |

## 使用示例

```rust
use deer_gui::prelude::*;

// 拆开用：自己控制「几何 → 命令 → 像素」三步
let tree = /* … */;
let geo = layout(&tree, Rect::new(0.0, 0.0, 320.0, 200.0), TextStyle::default(), &ApproxMeasure);
let list = build_draw_list(&tree, &geo, Theme::default(), &ApproxMeasure);
assert!(list.clip_balanced());
println!("命令数：{}", list.counts().fill_rect);

let fb = CpuRenderer::new().render(Extent { width: 320, height: 200 }, &list, Theme::default().surface)?;
let (w, h, rgba) = (fb.width, fb.height, fb.pixels);
```

## 注意事项

- **颜色附件约定**：必须是 `R8G8B8A8_UNORM`，**不能**用 `_SRGB` —— CPU 基准不做 gamma 转换；
  sRGB 附件的混合发生在线性空间，实测与 CPU 字节空间混合差约 44 字节。窗口交换链同理（线性优先）；
- `lighten` / `darken` 刻意不动 alpha —— 让 CPU/GPU 的逐字节对照在不透明语料上仍然成立；
- `NodeHint` 不含 id 本身（只有长度 + 指纹）：后端可忽略，但 `ClipSnapshot::from_draw_list`
  依赖它与树 + 几何**共走**绑定 —— 自己构造绘制列表时保持「每个有几何的节点一条提示」；
- 自定义主题时保持 `font_size` / `line_height` 与布局 `TextStyle` 一致（字号铁律，见[第 5 步](../getting_started/step_by_step/05_text.md)）。

相关教程：[第 1 步](../getting_started/step_by_step/01_first_render.md)、[第 7 步](../getting_started/step_by_step/07_interaction.md)。
