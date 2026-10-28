# Claude Code notes for Brain2

This file loads on every Claude Code session. While it exists, Claude Code does not load `AGENTS.md`. Do not `@import` `AGENTS.md`, a README, or a doc from here. An import is copied into every session.

Room folders and `lib/` each have a `README.md`. Read that before mapping the code yourself.

After a code change, update that folder's README once: current behavior, and why it left a plan if it did. Fix its file list when files were added, renamed, or removed. Edit `docs/SPEC_MAPPING.md` or `docs/DESIGN_STYLE.md` only when that claim changed. Edit a parent README only when an overview sentence is now false. Leave `docs/tree.md`, `docs/tree.txt`, screenshots, and unrelated docs alone unless asked.

When you map a module in depth, write the findings back. Label unbuilt intent **Planned**. Date a section you change with `_Last mapped: YYYY-MM-DD_`. Short plain sentences. Paths in backticks.

AMAP means do as much as possible, in parallel. Extend what already works: the smallest true shape, one named idea, a seam the next person can grow.

Design language is `docs/DESIGN_STYLE.md`. Redesign plans are `docs/*_REDESIGN.md`. A slant in `docs/mockups/slants/` applies only when asked by name.

The iOS / mobile app follows `docs/MOBILE_STYLE.md` and does not follow the desktop style.

Open a file in `.cursor/rules/` when the task matches it. Those notes stay out of this file: doc sync, verify-without-rewriting, design style while styling, the three task editors, and long files under `components/Modules`.
