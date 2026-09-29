# 已知边界与常见陷阱

看起来「反直觉」的行为通常是**刻意的**。本页汇总使用中最常撞到的边界；完整清单（每个约束背后的真缺陷与守护测试）见 [`CONTRIBUTING.md`](https://github.com/DeerLuuu/deer-gui/blob/master/CONTRIBUTING.md) 的 Design constraints and known traps 一节（英文）。

## 渲染

| 陷阱 | 真相 | 出路 |
|---|---|---|
| `render_tree_to_png` 画出的字是等宽方块 | 老入口**不加载字体**（既定行为，不是 bug） | 用 `render_tree_to_png_with_font` / `…_with_engine`（[第 5 步](../getting_started/step_by_step/05_text.md)） |
| 字号三处不一致 ⇒ 文字位置漂 | 布局度量、`DrawCmd::Text.size`、引擎字号必须同一个值 | 用便捷入口；自拼路径时把 `theme.font_size` 钉成同一值 |
| 颜色附件用 `_SRGB` ⇒ 混合结果差 ~44 字节 | CPU 基准不做 gamma 转换；sRGB 附件在线性空间混合 | 颜色附件一律 `R8G8B8A8_UNORM`（窗口交换链同理，线性优先） |
| Vulkan「动态 viewport 画不出像素」的旧说法 | 已被本机三组对照**推翻**（不设置才崩）；但这是本机实测，不代表全设备 | 离屏路径仍用静态 viewport/scissor（实现事实） |

## 布局

| 陷阱 | 真相 | 出路 |
|---|---|---|
| 根节点没占满窗口 | I-5：根盒子是上限不是命令，根不撑满 | 给根显式尺寸，或调整宿主给的盒子 |
| `50%` 比「父分配的一半」大/小 | I-7：百分比相对父**内容盒**解析 | 别用「父分配尺寸」当心算基准 |
| 滚动容器里 `grow` 没效果 | 滚动容器主轴不夹取、无剩余空间 ⇒ `grow` 失效 | 滚动内容本来就不该被压缩（[第 8 步](../getting_started/step_by_step/08_scroll_wrap.md)） |
| 换行不生效 | 换行宽度 = 节点自己的**像素**宽度；没声明（或只有百分比）⇒ 换不了行 | `L::new().wrap(true).w(200.0)`，或场景 `w=200 wrap` |
| 英文单词断行奇怪 / 中文逐字断行 | `wrap_greedy` 按空格/制表切词；无空格的中文是「一个单词」⇒ 超宽按字符硬切 | 确定行为，符合预期；英文按词断行需要源文本有空格 |

## 交互

| 陷阱 | 真相 | 出路 |
|---|---|---|
| 点了没反应 | 点在禁用子树或被裁剪掉的区域 ⇒ **没有命中**，不回退祖先 | 检查 `disabled` 与父级裁剪；这是刻意的（不引入第二套路由规则） |
| `Tab` 能聚焦一个看不见的按钮 | `focusables` 只依赖树：零尺寸节点仍在焦点序列里 | 刻意设计（焦点序不引入第二套几何真相） |
| 滚轮滚不动 | `ScrollMetrics` 没灌进 `ScrollState` ⇒ 上限全 0（fail-closed） | 每帧 `layout_with_scroll` 后调 `state.scroll.set_metrics(&metrics)` |
| 窗口「不动了」不重绘 | 默认 `OnDemand`：输入没改状态就不画（省电） | 确实改了状态就返回 `wants_redraw() == true`；动画声明 `Continuous` 或用 `Waker` |
| IME 打不了中文预编辑 | 预编辑未建模（只抑制重复上屏），`Commit` 的文本能收 | 等 M6+；见 [`docs/features/input.md`](https://github.com/DeerLuuu/deer-gui/blob/master/docs/features/input.md) |

## 环境变量与门槛

| 变量 | 作用 |
|---|---|
| `DEER_WINDOW_REDRAW=continuous` | 无条件强制连续重绘（关掉省电模式） |
| `DEER_VK_WINDOW_TESTS=1` | 打开窗口对照测试的门禁（不设 = 明确打印「被跳过」） |
| `DEER_INPUT_SCRIPT` | 窗口示例的默认输入脚本（见[输入脚本语法](../appendix/input_script.md)） |

门槛判定**先 `trim()` 再比**：`cmd /c "set X=1 && …"` 会把尾空格算进变量值（实测 `"1 "`），
严格判等会把「已启用」判成「未启用」⇒ 静默跳过却报 pass。自己写门槛判定时同样要 trim。

## 平台

| 边界 | 说明 |
|---|---|
| 窗口层只有 Windows | 其它平台 `run()` 明确报「平台不支持」，不静默填 0 |
| 布局 / CPU 光栅化 / PNG / Vulkan 离屏 | 任何平台可用（CI 友好） |
| Vulkan 后端 | 不需要 SDK；需要驱动提供 Vulkan 1.4 |

## 判断「是不是 bug」的流程

1. 先查 [`FEATURES.md`](https://github.com/DeerLuuu/deer-gui/blob/master/FEATURES.md)：这个功能到底做了没有；
2. 再查 [`CONTRIBUTING.md`](https://github.com/DeerLuuu/deer-gui/blob/master/CONTRIBUTING.md) 的设计约束：这是不是刻意的；
3. 都没有 ⇒ 按 [`CONTRIBUTING.md`](https://github.com/DeerLuuu/deer-gui/blob/master/CONTRIBUTING.md) 的流程提 issue（带上可复现命令）。
