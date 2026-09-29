# 文件貢獻指南

本站是 deer-gui 的中文文件（mdBook），工程根在儲存庫的 `docs/` 目錄 —— 與既有的逐功能指南（`docs/features/`、`docs/TUTORIAL.md` 等）並存。規則、門禁與命令速查的完整版見 [`CONTRIBUTING.md`](https://github.com/DeerLuuu/deer-gui/blob/master/CONTRIBUTING.md)（英文），本頁只講**文件站點本身**的約定。

## 目錄結構

```text
docs/
├── book.toml          # mdBook 設定（工程根在這裡）
├── README.md          # 本站的使用與維護說明（本地預覽、SUMMARY 規範）
├── book/              # 建置產物（gitignore，不入庫）
└── src/
    ├── SUMMARY.md     # 目錄 = 側邊欄（唯一入口）
    ├── introduction.md
    ├── getting_started/          # 安裝、核心概念
    │   └── step_by_step/         # 分步教學（01–09）
    ├── api/                      # API 參考（按模組分篇）
    ├── advanced/                 # 架構、不變式、陷阱
    └── appendix/                 # 範例索引、腳本語法、貢獻指南
```

## 新增一頁文件的流程

1. 在 `docs/src/` 對應目錄新建 `.md` 檔案；
2. **在 `SUMMARY.md` 裡登記**：沒登記的檔案不會被建置、不會被搜尋索引收錄；
   順序與縮排就是側邊欄的順序與層級；
3. `book.toml` 設了 `create-missing = false`：`SUMMARY.md` 裡連結到不存在的檔案會讓
   `mdbook build` **直接紅** —— 這是刻意設定，防 404 章節；
4. 本地確認：`mdbook serve docs`（自動重載）或 `mdbook build docs --open`。

## 行文規範

| 規範 | 說明 |
|---|---|
| **分步教學四段式** | 每節固定為 **目標 → 操作步驟 → 完整範例 → 下一步**，節與節之間用連結串起來 |
| **API 頁四段式** | 每篇固定為 **功能說明 → 參數與回傳值（表格）→ 使用範例 → 注意事項**，並附相關教學連結 |
| **程式碼必須真實** | 範例要與目前 API 一致 —— 儲存庫裡有 `docs_consistency` 測試盯文件宣告，改 API 必須同步改文件 |
| **能力宣告以 FEATURES.md 為準** | 不確定某功能做了沒有，先查它；別在文件裡「預言」未實作的功能 |
| **中文行文，程式碼/識別字保持英文** | 命令、型別名、函式名不翻譯 |

## 建置與部署

```sh
# 安裝（一次性）
cargo install mdbook --locked

# 本地預覽（http://localhost:3000，改動自動重載）
mdbook serve docs

# 建置產物到 docs/book/
mdbook build docs
```

推送到主分支時，GitHub Actions（`.github/workflows/deploy-docs.yml`）自動建置並部署到
GitHub Pages：`https://deerluuu.github.io/deer-gui/`。儲存庫改名 / 遷移時**必須同步改
`book.toml` 的 `site-url`**，否則 404 頁與搜尋資源的路徑會錯（詳見 [docs/README.md](https://github.com/DeerLuuu/deer-gui/blob/master/docs/README.md)）。
