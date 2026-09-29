#!/usr/bin/env bash
# 一次构建三种语言版本（产物合并进同一个 book/ 目录，供 GitHub Pages 部署）：
#   简体中文（默认）→ book/         https://deerluuu.github.io/deer-gui-docs/
#   English         → book/en/     https://deerluuu.github.io/deer-gui-docs/en/
#   繁體中文         → book/zh-TW/  https://deerluuu.github.io/deer-gui-docs/zh-TW/
#
# 原理：三种语言共用一份 book.toml（搜索/折叠/主题等设置单一真相），
# 非默认语言用 mdBook 环境变量覆盖差异字段（MDBOOK_<节>__<键>，下划线映射连字符）。
# 新增语言时：建 src-<code>/（文件名与 src/ 完全一致）→ 在这里加一段构建 →
# 在 theme/lang-switcher.js 的 LANGS 里登记。
set -euo pipefail
cd "$(dirname "$0")"

MD="${MDBOOK:-mdbook}"

# 1) 简体中文（默认书，站点根）
"$MD" build -d book

# 2) English
MDBOOK_BOOK__SRC=src-en \
MDBOOK_BOOK__TITLE="deer-gui Documentation" \
MDBOOK_BOOK__DESCRIPTION="deer-gui — a Rust GUI runtime built from scratch: node trees, layout algebra, CPU/GPU rendering, and input handling. Tutorials and API reference." \
MDBOOK_BOOK__LANGUAGE=en \
MDBOOK_OUTPUT__HTML__SITE_URL=/deer-gui-docs/en/ \
  "$MD" build -d book/en

# 3) 繁體中文
MDBOOK_BOOK__SRC=src-zh-TW \
MDBOOK_BOOK__TITLE="deer-gui 正體中文文件" \
MDBOOK_BOOK__DESCRIPTION="deer-gui —— 從零實作的 Rust GUI 執行時：節點樹、版面配置代數、CPU/GPU 渲染、輸入互動的繁體中文教學與 API 參考" \
MDBOOK_BOOK__LANGUAGE=zh-TW \
MDBOOK_OUTPUT__HTML__SITE_URL=/deer-gui-docs/zh-TW/ \
  "$MD" build -d book/zh-TW

echo "build-all: OK — book/ (zh-CN) + book/en/ + book/zh-TW/"
