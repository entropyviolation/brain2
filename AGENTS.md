# Agent notes for Brain2

For coding agents other than Claude Code. Cursor, Codex, and the rest read this file. Claude Code reads `CLAUDE.md` and skips this one. Keep them separate. Do not paste this file into `CLAUDE.md`, and do not `@import` it from there.

## Keep the room docs current

Every room folder has a `README.md`, and `lib/README.md` covers `lib/`. Read those before mapping code yourself.

When you change code, follow `.cursor/rules/update-docs-after-each-step.mdc`: once, at the end of the task, the colocated README (and a spec, style, or overview sentence only when that claim is now false). The tree, the gallery, and a repo-wide sync are `.cursor/rules/doc-sync.mdc`, and only when asked.

When you map a module in depth (by reading it or through a subagent), write back anything future agents would otherwise have to re-derive:

- Add findings that are missing from that folder's README, or that disagree with it. Fix the README where the code wins. Where the doc describes intent the code has not reached yet, label it **Planned**.
- Put `_Last mapped: YYYY-MM-DD_` at the top of each section you add or change.
- If changes are planned for the module, say so in its README and link the plan doc (for example `docs/TODO_REDESIGN.md`).
- Keep the house voice: short, plain sentences, file paths in backticks, and approximate line numbers (`~123`) only where they save a search.

Design language is in `docs/DESIGN_STYLE.md`. Redesign plans live in `docs/*_REDESIGN.md`.

The iOS / mobile app follows `docs/MOBILE_STYLE.md` and does not follow the desktop style.

Style slants (Hipgnosis, retrofuturism) live in `docs/mockups/slants/`. Use one only when asked for it by name. A slant never changes the house style.

## Rules that are not pasted here

Cursor already loads `.cursor/rules/`. Other agents should open the matching file when the task needs it, rather than carrying every rule in this note:

- `amap.mdc` — AMAP means do as much as possible, in parallel.
- `maximize-beauty-perfection-genius.mdc` — extend what works; the smallest true shape.
- `update-docs-after-each-step.mdc` — the end-of-task doc pass.
- `doc-sync.mdc` — tree, gallery, and push prep, only when asked.
- `verify-change.mdc` — run the touched tests; do not rewrite the feature to make a test pass.
- `design-style.mdc` — while styling.
- `three-task-editors.mdc` — do not merge the three task editors.
- `modules-files-stay-long.mdc` — files under `components/Modules` stay long.
