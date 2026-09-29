# Documentation Contribution Guide

This site is deer-gui's documentation in Chinese (mdBook), with its project root in the repo's `docs/` directory — coexisting alongside the existing per-feature guides (`docs/features/`, `docs/TUTORIAL.md`, etc.). For the full rules, gates, and command cheat sheet see [`CONTRIBUTING.md`](https://github.com/DeerLuuu/deer-gui/blob/master/CONTRIBUTING.md) (English); this page covers only the conventions of **the documentation site itself**.

## Directory structure

```text
docs/
├── book.toml          # mdBook configuration (the project root is here)
├── README.md          # Usage and maintenance notes for this site (local preview, SUMMARY conventions)
├── book/              # Build output (gitignored, not committed)
└── src/
    ├── SUMMARY.md     # The table of contents = the sidebar (the single entry point)
    ├── introduction.md
    ├── getting_started/          # Installation, core concepts
    │   └── step_by_step/         # Step-by-step tutorial (01–09)
    ├── api/                      # API reference (one page per module)
    ├── advanced/                 # Architecture, invariants, pitfalls
    └── appendix/                 # Examples index, script syntax, contribution guide
```

## Process for adding a new page

1. Create the new `.md` file in the appropriate directory under `docs/src/`;
2. **Register it in `SUMMARY.md`**: files not registered are not built and never enter the search index;
   the order and indentation there are the sidebar's order and hierarchy;
3. `book.toml` sets `create-missing = false`: a `SUMMARY.md` link to a nonexistent file makes
   `mdbook build` **go red outright** — a deliberate setting to prevent 404 chapters;
4. Verify locally: `mdbook serve docs` (auto reload) or `mdbook build docs --open`.

## Writing conventions

| Convention | Notes |
|---|---|
| **Four-part step-by-step tutorials** | Every section is fixed: **Goal → Steps → Complete example → Next step**, with sections chained together by links |
| **Four-part API pages** | Every page is fixed: **What it does → Parameters & return values (tables) → Example → Notes**, plus links to related tutorials |
| **Code must be real** | Examples must match the current API — the repo has a `docs_consistency` test watching the documented claims; any API change must update the docs in step |
| **Feature claims defer to FEATURES.md** | Unsure whether a feature is done? Check it first; don't "prophesy" unimplemented features in the docs |
| **Chinese prose, code/identifiers stay in English** | Commands, type names, and function names are not translated |

## Build & deployment

```sh
# Install (once)
cargo install mdbook --locked

# Local preview (http://localhost:3000, changes reload automatically)
mdbook serve docs

# Build output into docs/book/
mdbook build docs
```

On pushes to the main branch, GitHub Actions (`.github/workflows/deploy-docs.yml`) builds and deploys automatically to
GitHub Pages: `https://deerluuu.github.io/deer-gui/`. If the repo is renamed / moved, **`site-url` in
`book.toml` must be updated in sync**, otherwise the 404 page and the search assets' paths will be wrong (details in [docs/README.md](https://github.com/DeerLuuu/deer-gui/blob/master/docs/README.md)).
