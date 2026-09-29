# deer-gui-docs

[deer-gui](https://github.com/DeerLuuu/deer-gui)（从零实现的 Rust GUI 运行时）的**中文文档站点**：基于 mdBook 的分步教程 + API 参考，部署在 GitHub Pages：

> **https://deerluuu.github.io/deer-gui-docs/**

## 本地预览

需要 [mdBook](https://rust-lang.github.io/mdBook/)（≥ 0.4.40）：

```sh
mdbook build   # 构建到 book/
mdbook serve   # 启动本地预览：http://localhost:3000
```

> Windows 快速安装：从 [mdbook Releases](https://github.com/rust-lang/mdBook/releases) 下载对应平台的 zip（注意资产名是 `.zip` 不是 `.tar.gz`），解压取 `mdbook.exe` 放进 PATH 即可。

## 目录结构

```
book.toml        # mdBook 配置（site-url 必须与仓库名一致）
src/SUMMARY.md   # 目录 = 左侧侧边栏（Godot 文档风格，多级可折叠）
src/*.md         # 各章节内容
```

## 新增文档的规范

1. 在 `src/` 下新建 `.md` 文件；
2. **必须**把它登记进 `src/SUMMARY.md`，否则不会出现在侧边栏与搜索里；
3. `book.toml` 里 `create-missing = false`：SUMMARY.md 链到不存在的文件会构建失败（CI 直接红），所以登记前先确认文件已创建。

## 部署

推送 `main` 分支即自动触发 [.github/workflows/deploy-docs.yml](.github/workflows/deploy-docs.yml)：固定 mdbook 0.4.40 构建 → 补 `.nojekyll` → `upload-pages-artifact` + `deploy-pages` 部署到 Pages（首次运行会自动把 Pages 来源设为 GitHub Actions）。

⚠️ **仓库改名时**必须同步改 `book.toml` 的 `site-url`（`/deer-gui-docs/`），否则 404 页与资源路径会失效。

## 内容约定

- **分步教程**（`src/getting_started/step_by_step/`）：每节固定「目标 → 操作步骤 → 完整示例 → 下一步」四段式，节末附「本节用到的 API」表格并互链。
- **API 参考**（`src/api/`）：按模块分类，每篇统一「功能说明 → 参数与返回值表格 → 使用示例 → 注意事项」。
- 所有 API 签名以 [deer-gui](https://github.com/DeerLuuu/deer-gui) 源码为准；功能是否已实现以主仓库的 [`FEATURES.md`](https://github.com/DeerLuuu/deer-gui/blob/master/FEATURES.md) 为唯一真相。
