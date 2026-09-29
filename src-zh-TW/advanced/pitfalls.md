# 已知邊界與常見陷阱

看起來「反直覺」的行為通常是**刻意的**。本頁彙總使用中最常撞到的邊界；完整清單（每個約束背後的真缺陷與防護測試）見 [`CONTRIBUTING.md`](https://github.com/DeerLuuu/deer-gui/blob/master/CONTRIBUTING.md) 的 Design constraints and known traps 一節（英文）。

## 渲染

| 陷阱 | 真相 | 出路 |
|---|---|---|
| `render_tree_to_png` 畫出的字是等寬方塊 | 舊入口**不載入字型**（既定行為，不是 bug） | 用 `render_tree_to_png_with_font` / `…_with_engine`（[第 5 步](../getting_started/step_by_step/05_text.md)） |
| 字號三處不一致 ⇒ 文字位置漂 | 版面配置度量、`DrawCmd::Text.size`、引擎字號必須同一個值 | 用便捷入口；自拼路徑時把 `theme.font_size` 釘成同一值 |
| 顏色附件用 `_SRGB` ⇒ 混合結果差 ~44 位元組 | CPU 基準不做 gamma 轉換；sRGB 附件線上性空間混合 | 顏色附件一律 `R8G8B8A8_UNORM`（視窗交換鏈同理，線性優先） |
| Vulkan「動態 viewport 畫不出像素」的舊說法 | 已被本機三組對照**推翻**（不設定才會崩）；但這是本機實測，不代表全裝置 | 離屏路徑仍用靜態 viewport/scissor（實作事實） |

## 版面配置

| 陷阱 | 真相 | 出路 |
|---|---|---|
| 根節點沒佔滿視窗 | I-5：根盒子是上限不是命令，根不撐滿 | 給根顯式尺寸，或調整宿主給的盒子 |
| `50%` 比「父分配的一半」大/小 | I-7：百分比相對父**內容盒**解析 | 別用「父分配尺寸」當心算基準 |
| 捲動容器裡 `grow` 沒效果 | 捲動容器主軸不夾取、無剩餘空間 ⇒ `grow` 失效 | 捲動內容本來就不該被壓縮（[第 8 步](../getting_started/step_by_step/08_scroll_wrap.md)） |
| 換行不生效 | 換行寬度 = 節點自己的**像素**寬度；沒宣告（或只有百分比）⇒ 換不了行 | `L::new().wrap(true).w(200.0)`，或場景 `w=200 wrap` |
| 英文單詞斷行奇怪 / 中文逐字斷行 | `wrap_greedy` 按空格/定位鍵切詞；無空格的中文是「一個單詞」⇒ 超寬按字元硬切 | 確定行為，符合預期；英文按詞斷行需要源文本有空格 |

## 互動

| 陷阱 | 真相 | 出路 |
|---|---|---|
| 點了沒反應 | 點在停用子樹或被裁剪掉的區域 ⇒ **沒有命中**，不回退祖先 | 檢查 `disabled` 與父級裁剪；這是刻意的（不引入第二套路由規則） |
| `Tab` 能聚焦一個看不見的按鈕 | `focusables` 只依賴樹：零尺寸節點仍在焦點序列裡 | 刻意設計（焦點序不引入第二套幾何真相） |
| 滑鼠滾輪滾不動 | `ScrollMetrics` 沒灌進 `ScrollState` ⇒ 上限全 0（fail-closed） | 每幀 `layout_with_scroll` 後呼叫 `state.scroll.set_metrics(&metrics)` |
| 視窗「不動了」不重繪 | 預設 `OnDemand`：輸入沒改狀態就不畫（省電） | 確實改了狀態就回傳 `wants_redraw() == true`；動畫宣告 `Continuous` 或用 `Waker` |
| IME 打不了中文預編輯 | 預編輯未建模（只抑制重複上屏），`Commit` 的文字能收 | 等 M6+；見 [`docs/features/input.md`](https://github.com/DeerLuuu/deer-gui/blob/master/docs/features/input.md) |

## 環境變數與門檻

| 變數 | 作用 |
|---|---|
| `DEER_WINDOW_REDRAW=continuous` | 無條件強制連續重繪（關掉省電模式） |
| `DEER_VK_WINDOW_TESTS=1` | 開啟視窗對照測試的門禁（不設 = 明確列印「被跳過」） |
| `DEER_INPUT_SCRIPT` | 視窗範例的預設輸入腳本（見[輸入腳本語法](../appendix/input_script.md)） |

門檻判定**先 `trim()` 再比**：`cmd /c "set X=1 && …"` 會把尾空格算進變數值（實測 `"1 "`），
嚴格判等會把「已啟用」判成「未啟用」⇒ 靜默跳過卻報 pass。自己寫門檻判定時同樣要 trim。

## 平台

| 邊界 | 說明 |
|---|---|
| 視窗層只有 Windows | 其它平台 `run()` 明確報「平台不支援」，不靜默填 0 |
| 版面配置 / CPU 光柵化 / PNG / Vulkan 離屏 | 任何平台可用（CI 友好） |
| Vulkan 後端 | 不需要 SDK；需要驅動提供 Vulkan 1.4 |

## 判斷「是不是 bug」的流程

1. 先查 [`FEATURES.md`](https://github.com/DeerLuuu/deer-gui/blob/master/FEATURES.md)：這個功能到底做了沒有；
2. 再查 [`CONTRIBUTING.md`](https://github.com/DeerLuuu/deer-gui/blob/master/CONTRIBUTING.md) 的設計約束：這是不是刻意的；
3. 都沒有 ⇒ 按 [`CONTRIBUTING.md`](https://github.com/DeerLuuu/deer-gui/blob/master/CONTRIBUTING.md) 的流程提 issue（帶上可重現命令）。
