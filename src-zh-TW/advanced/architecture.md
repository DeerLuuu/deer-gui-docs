# 架構總覽

## 分層

workspace 共 **7 個 crate**，自下而上 L0–L4：

```text
crates/
├── deer-core/     L0 語言無關純核心：節點樹（node）、Builder、版面配置代數（layout）、
│                  .dui 場景解析（scene）、屬性註冊表（registry）、值解析（values）、
│                  繪製命令（draw）、錯誤（error）
│                  ── 零平台相依，可在沒有 GPU 的 CI 裡完整斷言（原 deer-layout 已併入）
├── deer-text/     L1 文字堆疊：字型解析、字形光柵化、圖集、度量 + 零相依 PNG 編碼器
│                  ── 文字能力只有一處實作，CPU/GPU 後端共用
├── deer-gpu/      L1：GPU HAL trait（Backend/Device/Frame/Renderer）、DrawList、
│                  CPU 參考後端、互動算繪輔助、BMP 解碼（image.rs）
│                  ── 加一個後端 = 實作一個 trait
├── deer-window/   L1 顯示服務（display.rs）：winit 事件迴圈、InputEvent 映射、DPI、剪貼簿
│                  L3 宿主（host.rs）：App/run/Waker/RedrawPolicy、多視窗（WindowId/WindowSpawner）
│                  ── 唯一引入第三方相依（winit）的地方；只把不透明的 RawWindowHandle 交給渲染層，
│                     換視窗實作不動渲染層
├── deer-vk/       L2 Vulkan 後端：自己宣告 extern 符號 + 執行時動態載入；surface/交換鏈/呈現
│                  ── 不需要 Vulkan SDK（只連結 kernel32，vulkan-1.dll 執行時載入）
└── deer-gui/      L4 門面：re-export 一切、testkit、輸入腳本（input_script）、離屏算繪便捷入口
                   ── 見 [API 總覽](../api/index.md)
```

兩點補充：

- **互動層（`deer_gui::interaction`）的歸屬是 L2 framework**：命中/狀態機/`UiEvent` 這套是框架邏輯，不屬 `deer-core` —— 它住在 `deer-gui` 裡，但是純邏輯（不碰視窗、不碰 GPU），可在無視窗環境單測；
- **`deer-log` 是橫切的日誌門面**：零相依自研（約 200 行，不引 `log`/`tracing`），分級 + 按 target 過濾 + 寫 stderr，預設完全靜默，全 workspace 共用。

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
| `deer-core` | 無 |
| `deer-text` | 無 |
| `deer-gpu` | 無 |
| `deer-window` | `winit 0.30` |
| `deer-vk` | 無（Vulkan 符號手寫宣告 + `LoadLibraryW` 執行時載入，不需要 SDK） |
| `deer-log` | 無（刻意零相依，不引 `log`/`tracing`） |
| `deer-gui` | 無（`deer-window` 為可選相依；開 `window` feature 時經它引入 `winit`） |

`winit` 是唯一登記在案的例外（[`ROADMAP.md`](https://github.com/DeerLuuu/deer-gui/blob/master/ROADMAP.md) Q-1）。**新增相依必須先在那裡登記並說明理由。**

## 里程碑現狀

里程碑 M1–M7 與驗收判據見 [`ROADMAP.md`](https://github.com/DeerLuuu/deer-gui/blob/master/ROADMAP.md)；
「哪些功能、做到哪一步、哪些還沒做」以 [`FEATURES.md`](https://github.com/DeerLuuu/deer-gui/blob/master/FEATURES.md) 為唯一真相 —— 本文件站假設某功能可用之前，也以它為準。

## 深入閱讀

- [版面配置不變式（I-1 ～ I-8）](invariants.md)：版面配置引擎的行為契約；
- [已知邊界與常見陷阱](pitfalls.md)：刻意設計與踩過的坑；
- [`agent.md`](https://github.com/DeerLuuu/deer-gui/blob/master/agent.md)（儲存庫紀律與踩坑記錄）；
- [`CONTRIBUTING.md`](https://github.com/DeerLuuu/deer-gui/blob/master/CONTRIBUTING.md)（英文：規則、門禁、命令速查、設計約束）。
