# 文档贡献指南

本站是 deer-gui 的中文文档（mdBook），工程根在仓库的 `docs/` 目录 —— 与既有的逐功能指南（`docs/features/`、`docs/TUTORIAL.md` 等）并存。规则、门禁与命令速查的完整版见 [`CONTRIBUTING.md`](https://github.com/DeerLuuu/deer-gui/blob/master/CONTRIBUTING.md)（英文），本页只讲**文档站点本身**的约定。

## 目录结构

```text
docs/
├── book.toml          # mdBook 配置（工程根在这里）
├── README.md          # 本站的使用与维护说明（本地预览、SUMMARY 规范）
├── book/              # 构建产物（gitignore，不入库）
└── src/
    ├── SUMMARY.md     # 目录 = 侧边栏（唯一入口）
    ├── introduction.md
    ├── getting_started/          # 安装、核心概念
    │   └── step_by_step/         # 分步教程（01–09）
    ├── api/                      # API 参考（按模块分篇）
    ├── advanced/                 # 架构、不变式、陷阱
    └── appendix/                 # 示例索引、脚本语法、贡献指南
```

## 新增一页文档的流程

1. 在 `docs/src/` 对应目录新建 `.md` 文件；
2. **在 `SUMMARY.md` 里登记**：没登记的文件不会被构建、不会被搜索索引收录；
   顺序与缩进就是侧边栏的顺序与层级；
3. `book.toml` 设了 `create-missing = false`：`SUMMARY.md` 里链接到不存在的文件会让
   `mdbook build` **直接红** —— 这是刻意设置，防 404 章节；
4. 本地确认：`mdbook serve docs`（自动重载）或 `mdbook build docs --open`。

## 行文规范

| 规范 | 说明 |
|---|---|
| **分步教程四段式** | 每节固定为 **目标 → 操作步骤 → 完整示例 → 下一步**，节与节之间用链接串起来 |
| **API 页四段式** | 每篇固定为 **功能说明 → 参数与返回值（表格）→ 使用示例 → 注意事项**，并附相关教程链接 |
| **代码必须真实** | 示例要与当前 API 一致 —— 仓库里有 `docs_consistency` 测试盯文档声明，改 API 必须同步改文档 |
| **能力声明以 FEATURES.md 为准** | 不确定某功能做了没有，先查它；别在文档里「预言」未实现的功能 |
| **中文行文，代码/标识符保持英文** | 命令、类型名、函数名不翻译 |

## 构建与部署

```sh
# 安装（一次性）
cargo install mdbook --locked

# 本地预览（http://localhost:3000，改动自动重载）
mdbook serve docs

# 构建产物到 docs/book/
mdbook build docs
```

推送到主分支时，GitHub Actions（`.github/workflows/deploy-docs.yml`）自动构建并部署到
GitHub Pages：`https://deerluuu.github.io/deer-gui/`。仓库改名 / 迁移时**必须同步改
`book.toml` 的 `site-url`**，否则 404 页与搜索资源的路径会错（详见 [docs/README.md](https://github.com/DeerLuuu/deer-gui/blob/master/docs/README.md)）。
