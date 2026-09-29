# deer-gui-docs

[deer-gui](https://github.com/DeerLuuu/deer-gui)（从零实现的 Rust GUI 运行时）的**多语言文档站点**：基于 mdBook 的分步教程 + API 参考，部署在 GitHub Pages：

> **https://deerluuu.github.io/deer-gui-docs/**
>
> 简体中文（站点根）· [English](https://deerluuu.github.io/deer-gui-docs/en/) · [繁體中文](https://deerluuu.github.io/deer-gui-docs/zh-TW/) —— 每页顶栏有语言切换器。

## 多语言架构

mdBook 没有原生多语言构建，本仓库采用「每语言一份源码 + 环境变量覆盖差异 + 三次构建合并」的方案：

```
book.toml          # 共享配置（搜索/折叠/主题等，单一真相；默认语言 = 简体中文）
src/               # 简体中文源码 → 构建到 book/（站点根）
src-en/            # English 源码 → book/en/
src-zh-TW/         # 繁體中文源码 → book/zh-TW/
build-all.sh       # 一次构建三种语言（env 覆盖 title/description/language/site-url）
theme/lang-switcher.js   # 每页顶栏的语言切换器（additional-js 注入）
```

- **文件名三语完全一致**：语言间靠同路径互跳（切换器按当前页路径换前缀），新增页面必须三语同步创建，缺一个 `create-missing = false` 都会让构建红。
- **差异字段只写进 build-all.sh 的环境变量**（`MDBOOK_BOOK__TITLE` 等），共享设置永远改 `book.toml` 一处。
- **新增语言**：建 `src-<code>/` → `build-all.sh` 加一段构建 → `theme/lang-switcher.js` 的 `LANGS` 登记一个选项。

## 本地预览

需要 [mdBook](https://rust-lang.github.io/mdBook/)（≥ 0.4.40）：

```sh
mdbook build          # 只构建简体版到 book/
mdbook serve          # 简体版实时预览：http://localhost:3000

bash build-all.sh     # 三语全量构建（需要 bash；Windows 用 Git Bash）
# 用任意静态服务器 serve 合并后的 book/ 目录，语言切换器才能跨语言跳转：
python -m http.server 8000 --directory book   # http://localhost:8000/
```

> Windows 快速安装：从 [mdbook Releases](https://github.com/rust-lang/mdBook/releases) 下载对应平台的 zip（注意资产名是 `.zip` 不是 `.tar.gz`），解压取 `mdbook.exe` 放进 PATH 即可。

## 新增文档的规范

1. 在 `src/` 下新建 `.md` 文件，并**同步创建** `src-en/`、`src-zh-TW/` 的对应译文（文件名一致）；
2. **必须**把它登记进三个语言的 `SUMMARY.md`（`src/SUMMARY.md`、`src-en/SUMMARY.md`、`src-zh-TW/SUMMARY.md`），否则不会出现在该语言的侧边栏与搜索里；
3. `book.toml` 里 `create-missing = false`：SUMMARY.md 链到不存在的文件会构建失败（CI 直接红），所以登记前先确认三语文件都已创建。

## 翻译约定

- **只翻 prose 与代码注释**：Rust 标识符、crate 名、命令、配置键、文件路径、GitHub 链接一律原样保留；
- **相对链接不改**：`../api/index.md` 这类链接在每种语言书内同构，直接沿用；
- 繁體版使用台灣慣用技術詞彙（檔案/資料夾/預設/支援/執行/建置…），不是逐字簡繁轉換。

## 部署

推送 `main` 分支即自动触发 [.github/workflows/deploy-docs.yml](.github/workflows/deploy-docs.yml)：`build-all.sh` 三语构建 → 校验三份 index.html → 补 `.nojekyll` → `upload-pages-artifact` + `deploy-pages` 部署到 Pages。

⚠️ **仓库改名时**必须同步改 `book.toml` 的 `site-url`（`/deer-gui-docs/`）**和** `build-all.sh` 里两个子语言的 `MDBOOK_OUTPUT__HTML__SITE_URL`（`/deer-gui-docs/en/`、`/deer-gui-docs/zh-TW/`），否则 404 页与资源路径会失效；`theme/lang-switcher.js` 里的 `deer-gui-docs` 前缀判断也要同步。

## 内容约定

- **分步教程**（`src/getting_started/step_by_step/`）：每节固定「目标 → 操作步骤 → 完整示例 → 下一步」四段式，节末附「本节用到的 API」表格并互链。
- **API 参考**（`src/api/`）：按模块分类，每篇统一「功能说明 → 参数与返回值表格 → 使用示例 → 注意事项」。
- 所有 API 签名以 [deer-gui](https://github.com/DeerLuuu/deer-gui) 源码为准；功能是否已实现以主仓库的 [`FEATURES.md`](https://github.com/DeerLuuu/deer-gui/blob/master/FEATURES.md) 为唯一真相。
