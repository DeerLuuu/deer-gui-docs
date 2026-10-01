# 簡介

**deer-gui** 是一個從零實作的 Rust GUI 執行時 —— 不依賴 web、不依賴 DOM，也不依賴 `wgpu` / `ash` / `vulkano`。

它的核心是**一棵節點樹**：你用兩種方式中的任意一種描述介面，由本倉庫自研的版面配置引擎算出幾何，再交給可插拔的算繪後端（CPU 軟體光柵化或 Vulkan）。

- **命令式 API**（[`Builder`]，imgui 式手感）；
- **場景檔**（`.dui`，思路類似 Godot 的 `.tscn`）。

兩條路徑產出**結構相等**的同一棵樹 —— 這是整個執行時的核心不變式。

> **注意**：專案仍在活躍開發中。「有哪些功能、做到哪一步、哪些還沒做」以倉庫根目錄的
> [`FEATURES.md`](https://github.com/DeerLuuu/deer-gui/blob/master/FEATURES.md) 為唯一真相。
> 假設某個功能可用之前，請先讀它。

## 本文件適合誰

- 想用 deer-gui 寫介面的人：從[安裝](getting_started/installation.md)開始，跟著[分步教學](getting_started/step_by_step/index.md)走；
- 想查某個 API 的人：直接翻 [API 參考](api/index.md)，每篇都有參數表與範例；
- 想理解「為什麼它這樣做」的人：看[架構總覽](advanced/architecture.md)與[已知陷阱](advanced/pitfalls.md)。

## 這個執行時的能力地圖

| 能力 | 狀態 |
|---|---|
| 構築節點樹（命令式 / `.dui` 場景檔） | ✅ |
| 版面配置計算（幾何表）、命中測試 | ✅ |
| 樹 + 幾何 → 繪製清單 → **像素**（CPU 後端） | ✅ |
| 把像素寫成 PNG 檔案 | ✅ |
| **真實字型字形**（零相依 TTF 解析 + 光柵化 + 圖集 + 真實度量） | ✅ |
| 算繪到視窗 / 螢幕上（Vulkan，形狀 + 文字） | ✅ 需開 `window` feature |
| 輸入與焦點（懸停 / 點擊 / `Tab` 焦點 / 文字輸入 / 輸入框游標 / 腳本重放 / 事件驅動重繪） | ✅ |
| 滾輪驅動的垂直捲動、文字按寬度換行 | ✅ |
| 停靠面板 / 多視窗、右鍵 / 中鍵、跨控制項的方向鍵導覽、IME 預編輯 | ⬜ 未實作 |

平台支援：版面配置 / CPU 光柵化 / 出 PNG / Vulkan 離屏在任何平台都可用；**視窗層目前只有 Windows**（Linux / macOS 會明確回傳「平台不支援」錯誤，絕不靜默）。

## 相依

除視窗層外，整個 workspace **沒有第三方相依**：

| Crate | 第三方相依 |
|---|---|
| `deer-layout`（節點樹、版面配置、場景解析） | 無 |
| `deer-gpu`（GPU HAL + CPU 參考後端） | 無 |
| `deer-vk`（Vulkan 後端，執行時動態載入） | 無 |
| `deer-gui`（門面，不開 `window`） | 無 |
| `deer-window`、`deer-gui --features window` | `winit 0.30` |

`winit` 是唯一登記在案的例外（記錄在 [`ROADMAP.md`](https://github.com/DeerLuuu/deer-gui/blob/master/ROADMAP.md) 的 Q-1）。

## 授權條款

MIT —— 全文見倉庫根目錄的 [LICENSE](https://github.com/DeerLuuu/deer-gui/blob/master/LICENSE)。

[`Builder`]: api/builder.md
