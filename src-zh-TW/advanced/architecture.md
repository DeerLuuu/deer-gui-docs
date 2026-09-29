# 架構總覽

## 分層

```text
crates/
├── deer-layout/   語言無關核心：Node 樹、版面配置代數、命中測試、.dui 場景解析
│                  ── 零平台相依，可在沒有 GPU 的 CI 裡完整斷言
├── deer-gpu/      GPU HAL：Backend/Device/Swapchain/Frame trait、DrawList、CPU 參考後端
│                  ── 加一個後端 = 實作一個 trait
├── deer-vk/       Vulkan 後端：自己宣告 extern 符號 + 執行時動態載入；surface/交換鏈/呈現
│                  ── 不需要 Vulkan SDK（只連結 kernel32，vulkan-1.dll 執行時載入）
└── deer-window/   視窗層：原生視窗 + 事件迴圈（winit）
                   ── 唯一引入第三方相依的地方；只把不透明的 RawWindowHandle 交給渲染層，
                      換視窗實作不動渲染層
```

`deer-gui` 是**門面**：re-export 一切、提供互動層與 testkit、給出離屏渲染便捷入口
（見 [API 總覽](../api/index.md)）。

## 資料流（一幀的閉環）

```text
  Builder（命令式）─┐
                    ├─→ Node 樹 ─→ layout() → 幾何表 ─→ build_draw_list() → DrawList ─→ 後端
  parse_scene(.dui)─┘               └─→ hit_test() → 輸入路由
```

要點：

- **兩條構築路徑，一棵樹**：`Node::structurally_eq` 是核心不變式，由測試
  `t1_two_authoring_paths_produce_the_same_tree` 釘住；
- **版面配置是純函式**：不改樹、確定性、像素取整（見[版面配置不變式](invariants.md)）；
- **命令是「結果」不是「控制項」**：`DrawList` 裡只有矩形/文字/裁剪，後端不需要認識控制項；
- **輸入是值**：`InputEvent` → `handle` → `UiEvent`，整條互動鏈可在無視窗環境單測。

## 相依紀律

| Crate | 第三方相依 |
|---|---|
| `deer-layout` | 無 |
| `deer-gpu` | 無 |
| `deer-vk` | 無（Vulkan 符號手寫宣告 + `LoadLibraryW` 執行時載入，不需要 SDK） |
| `deer-gui`（不開 `window`） | 無 |
| `deer-window` / `deer-gui --features window` | `winit 0.30` |

`winit` 是唯一登記在案的例外（[`ROADMAP.md`](https://github.com/DeerLuuu/deer-gui/blob/master/ROADMAP.md) Q-1）。**新增相依必須先在那裡登記並說明理由。**

## 里程碑現狀

里程碑 M1–M7 與驗收判據見 [`ROADMAP.md`](https://github.com/DeerLuuu/deer-gui/blob/master/ROADMAP.md)；
「哪些功能、做到哪一步、哪些還沒做」以 [`FEATURES.md`](https://github.com/DeerLuuu/deer-gui/blob/master/FEATURES.md) 為唯一真相 —— 本文件站假設某功能可用之前，也以它為準。

## 深入閱讀

- [版面配置不變式（I-1 ～ I-8）](invariants.md)：版面配置引擎的行為契約；
- [已知邊界與常見陷阱](pitfalls.md)：刻意設計與踩過的坑；
- [`agent.md`](https://github.com/DeerLuuu/deer-gui/blob/master/agent.md)（儲存庫紀律與踩坑記錄）；
- [`CONTRIBUTING.md`](https://github.com/DeerLuuu/deer-gui/blob/master/CONTRIBUTING.md)（英文：規則、門禁、命令速查、設計約束）。
