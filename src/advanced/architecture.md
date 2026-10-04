# 架构总览

## 分层

workspace 共 **7 个 crate**，自下而上 L0–L4：

```text
crates/
├── deer-core/     L0 语言无关纯核心：节点树（node）、Builder、布局代数（layout）、
│                  .dui 场景解析（scene）、属性注册表（registry）、值解析（values）、
│                  绘制命令（draw）、错误（error）
│                  ── 零平台依赖，可在没有 GPU 的 CI 里完整断言（原 deer-layout 已并入）
├── deer-text/     L1 文本栈：字体解析、字形光栅化、图集、度量 + 零依赖 PNG 编码器
│                  ── 文本能力只有一处实现，CPU/GPU 后端共用
├── deer-gpu/      L1：GPU HAL trait（Backend/Device/Frame/Renderer）、DrawList、
│                  CPU 参考后端、交互渲染辅助、BMP 解码（image.rs）
│                  ── 加一个后端 = 实现一个 trait
├── deer-window/   L1 显示服务（display.rs）：winit 事件循环、InputEvent 映射、DPI、剪贴板
│                  L3 宿主（host.rs）：App/run/Waker/RedrawPolicy、多窗口（WindowId/WindowSpawner）
│                  ── 唯一引入第三方依赖（winit）的地方；只把不透明的 RawWindowHandle 交给渲染层，
│                     换窗口实现不动渲染层
├── deer-vk/       L2 Vulkan 后端：自己声明 extern 符号 + 运行时动态加载；surface/交换链/呈现
│                  ── 不需要 Vulkan SDK（只链接 kernel32，vulkan-1.dll 运行时加载）
└── deer-gui/      L4 门面：re-export 一切、testkit、输入脚本（input_script）、离屏渲染便捷入口
                   ── 见 [API 总览](../api/index.md)
```

两点补充：

- **交互层（`deer_gui::interaction`）的归属是 L2 framework**：命中/状态机/`UiEvent` 这套是框架逻辑，不属 `deer-core` —— 它住在 `deer-gui` 里，但是纯逻辑（不碰窗口、不碰 GPU），可在无窗口环境单测；
- **`deer-log` 是横切的日志门面**：零依赖自研（约 200 行，不引 `log`/`tracing`），分级 + 按 target 过滤 + 写 stderr，默认完全静默，全 workspace 共用。

## 数据流（一帧的闭环）

```text
  Builder（命令式）─┐
                    ├─→ Node 树 ─→ layout() → 几何表 ─→ build_draw_list() → DrawList ─→ 后端
  parse_scene(.dui)─┘               └─→ hit_test() → 输入路由
```

要点：

- **两条构筑路径，一棵树**：`Node::structurally_eq` 是核心不变式，由测试
  `t1_two_authoring_paths_produce_the_same_tree` 钉住；
- **布局是纯函数**：不改树、确定性、像素取整（见[布局不变式](invariants.md)）；
- **命令是「结果」不是「控件」**：`DrawList` 里只有矩形/文字/裁剪，后端不需要认识控件；
- **输入是值**：`InputEvent` → `handle` → `UiEvent`，整条交互链可在无窗口环境单测。

## 依赖纪律

| Crate | 第三方依赖 |
|---|---|
| `deer-core` | 无 |
| `deer-text` | 无 |
| `deer-gpu` | 无 |
| `deer-window` | `winit 0.30` |
| `deer-vk` | 无（Vulkan 符号手写声明 + `LoadLibraryW` 运行时加载，不需要 SDK） |
| `deer-log` | 无（刻意零依赖，不引 `log`/`tracing`） |
| `deer-gui` | 无（`deer-window` 为可选依赖；开 `window` feature 时经它引入 `winit`） |

`winit` 是唯一登记在案的例外（[`ROADMAP.md`](https://github.com/DeerLuuu/deer-gui/blob/master/ROADMAP.md) Q-1）。**新增依赖必须先在那里登记并说明理由。**

## 里程碑现状

里程碑 M1–M7 与验收判据见 [`ROADMAP.md`](https://github.com/DeerLuuu/deer-gui/blob/master/ROADMAP.md)；
「哪些功能、做到哪一步、哪些还没做」以 [`FEATURES.md`](https://github.com/DeerLuuu/deer-gui/blob/master/FEATURES.md) 为唯一真相 —— 本文档站假设某功能可用之前，也以它为准。

## 深入阅读

- [布局不变式（I-1 ～ I-8）](invariants.md)：布局引擎的行为契约；
- [已知边界与常见陷阱](pitfalls.md)：刻意设计与踩过的坑；
- [`agent.md`](https://github.com/DeerLuuu/deer-gui/blob/master/agent.md)（仓库纪律与踩坑记录）；
- [`CONTRIBUTING.md`](https://github.com/DeerLuuu/deer-gui/blob/master/CONTRIBUTING.md)（英文：规则、门禁、命令速查、设计约束）。
