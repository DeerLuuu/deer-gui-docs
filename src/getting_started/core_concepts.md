# 核心概念：一棵节点树

deer-gui 的一切都围绕**一棵 `Node` 树**运转。理解这一节，后面每一篇教程与 API 文档都会顺畅得多。

## 数据流

```text
  Builder（命令式，imgui 式手感）─┐
                                  ├─→ Node 树 ─→ layout() → 几何表 ─→ build_draw_list() → DrawList ─→ 后端
  parse_scene(.dui，.tscn 式）   ─┘               └─→ hit_test() → 输入路由
```

整条链的分工：

| 环节 | 谁 | 产出 |
|---|---|---|
| 描述界面 | [`Builder`](../api/builder.md) 或 [`parse_scene`](../api/scene.md) | [`Node` 树](../api/node.md) |
| 算几何 | [`layout()`](../api/layout.md)（**纯函数**） | `Geometry`：节点 id → `Rect` |
| 路由输入 | [`hit_test`](../api/layout.md) / [交互层 `hit`](../api/interaction.md) | 命中的节点 |
| 生成绘制命令 | [`build_draw_list`](../api/draw.md) | [`DrawList`](../api/draw.md) |
| 出像素 / 上屏 | [CPU 后端 `CpuRenderer`](../api/draw.md) 或 [Vulkan 窗口路径](../api/window.md) | RGBA8 / 交换链 |

## workspace 的 7 个 crate

整条链由一个 workspace 承载，自下而上分层：`deer-core`（L0，**原 `deer-layout` 的内容全部迁入**——节点树、布局代数、场景解析、命中测试、绘制命令、属性注册表、值解析，语言无关零平台依赖）、`deer-text`（L1 文本栈：字体解析、字形光栅化、图集、度量）、`deer-gpu`（L1：GPU HAL trait 与 CPU 参考后端）、`deer-window`（L1 显示服务 + L3 窗口宿主）、`deer-vk`（L2 Vulkan 后端）、`deer-gui`（L4 门面）。另有一个横切的 `deer-log`（零依赖日志门面）。依赖纪律见[架构总览](../advanced/architecture.md)。

## 两条构筑路径，一棵树

```rust,ignore
// 路径一：命令式 Builder
let mut app = Builder::new(Kind::Column, "app").padding(12.0).gap(8.0);
app.text("标题");
let tree = app.build();
```

```text
# 路径二：.dui 场景文件（结构完全等价）
[column name=app pad=12 gap=8]
  [text label=标题]
```

两条路径产出**结构相等**的树（`Node::structurally_eq`），由测试
`t1_two_authoring_paths_produce_the_same_tree` 钉住。保证相等的关键是
**确定性 id**：`IdGen` 按 kind 计数生成 `kind_N` 形式的 id，显式命名的节点会「占号」，
两条路径共用同一规则。

## 树是纯数据

`Node` 不含函数、不含回调 —— 这三个后果值得记住：

1. **事件靠 id 关联**。按钮被点之后发生什么，由你的代码查询 [交互层](../api/interaction.md) 的状态（`UiState`）决定，树里没有回调可注册；
2. **树可以随便序列化**。`.dui` 文本 ↔ `Node` 的往返是结构相等的（`parse_scene(encode_scene(t)) == t`）；
3. **布局是纯函数**。`layout()` 不改输入树，只回一张几何表；同输入必同输出（无时间、无随机、无环境探测）。

## 节点类型（Kind）

`Kind` 现有 **12 种变体**：

| Kind | 角色 | 可否有子节点 |
|---|---|---|
| `Column` | 竖排容器（子节点从上往下排） | ✅ |
| `Row` | 横排容器（子节点从左往右排） | ✅ |
| `Text` | 纯文本 | ❌ |
| `Button` | 按钮 | ❌ |
| `Field` | 输入框 | ❌ |
| `Segmented` | 分段选择（互斥单选，段是子按钮） | ✅ |
| `ChipGroup` | 标签组（多选开关，芯片是子节点） | ✅ |
| `TabBar` | 页签栏（单选页签） | ✅ |
| `NumberField` | 数值输入框（提交才解析） | ❌ |
| `ScrubNum` | 拖动调值（拖动改数） | ❌ |
| `Switch` | 开关（点击/`Enter`/`Space` 翻转） | ❌ |
| `ColorField` | 颜色输入框（`#RRGGBB` + 色块预览） | ❌ |

控件词汇来自 `deer-ui` 的验证原型；M6 控件族仍在扩展（`Icon`、`DropMenu`、`Dialog`、`Overlay`、`HoverTip` 未做，见 [`FEATURES.md`](https://github.com/DeerLuuu/deer-gui/blob/master/FEATURES.md)）。

## 布局引擎的八条不变式

`layout()` 的行为由八条不变式定义（每条都有测试守卫，详见[布局不变式](../advanced/invariants.md)）：

| # | 不变式 | 一句话 |
|---|---|---|
| I-1 | 纯函数 | 不改输入树，只回几何表 |
| I-2 | 确定性 | 同输入 ⇒ 逐位相同输出 |
| I-3 | 自底向上 | 先算子节点固有尺寸，父容器再分配 |
| I-4 | 像素取整 | 几何全部整数像素 |
| I-5 | 不假设拥有窗口 | 根盒子由宿主给，根不撑满 |
| I-6 | 不越界 | 结果夹在可用空间内 |
| I-7 | 分配尺寸 ≠ 可用空间 | 父分配的主轴尺寸必须被采信；百分比相对父**内容盒**解析 |
| I-8 | 主轴 = sum(子)，交叉轴 = max(子) | 容器固有尺寸按方向语义不同 |

看起来「反直觉」的行为通常是刻意的 —— 完整清单与背后的真缺陷见[已知边界与常见陷阱](../advanced/pitfalls.md)。

## 下一步

准备好了就进入 [分步教程 · 第 1 步：渲染第一张图](step_by_step/01_first_render.md)。
