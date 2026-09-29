# 安裝與環境需求

## 目標

裝好工具鏈，把 deer-gui 作為路徑相依引入你的專案，並確認能編譯。

## 環境需求

| 要求 | 說明 |
|---|---|
| **Rust 1.85 或更高** | workspace 使用 edition 2024，舊工具鏈編譯不過 |
| **Windows** | 只有需要**真視窗**時才必須（視窗層目前只有 Windows）；版面配置、CPU 光柵化、離屏出 PNG、Vulkan 離屏路徑在其它平台也能跑 |
| **不需要 Vulkan SDK** | `deer-vk` 自己宣告 Vulkan 符號，執行時用 `LoadLibraryW` + `GetProcAddress` 載入 `vulkan-1.dll`，只連結 `kernel32` |

## 操作步驟

### 1. 拿到倉庫

```sh
git clone https://github.com/DeerLuuu/deer-gui.git
cd deer-gui
```

這些 crate 尚未發布到 crates.io，直接用 workspace 或按路徑相依。

### 2. 在自己的專案裡引入

```toml
[dependencies]
deer-gui = { path = "path/to/deer-gui/crates/deer-gui" }
```

> **重要**：只有需要真視窗時才加 `--features window`。不開這個 feature 就不會引入
> `winit`，`deer-gui` 也就**沒有任何第三方相依**。離屏算繪（出 PNG / RGBA）不需要視窗。

```toml
# 需要視窗 / 互動時：
[dependencies]
deer-gui = { path = "path/to/deer-gui/crates/deer-gui", features = ["window"] }

# 想用測試介面（testkit）時再加：
# features = ["window", "testing"]
```

### 3. 確認一切正常

在倉庫裡跑一遍自檢：

```sh
# 跑全部斷言（數量隨里程碑增長，以執行輸出為準）
cargo test --workspace

# 離屏算繪一張圖（CI 友善）→ render_out/render_to_png.png
cargo run -p deer-gui --example render_to_png
```

`render_to_png` 跑通並寫出 PNG，就表示工具鏈沒問題。

## 下一步

- 讀 [核心概念：一棵節點樹](core_concepts.md)，建立整體模型；
- 然後進入 [分步教學 · 第 1 步](step_by_step/01_first_render.md)，算繪第一張圖。

相關 API：[門面 crate（deer_gui）](../api/deer_gui.md)、[視窗層](../api/window.md)。
