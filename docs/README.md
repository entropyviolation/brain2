# `docs/` — Project documentation

| File / folder | Purpose |
|---------------|---------|
| `SPEC_MAPPING.md` | Section-by-section mapping of `Cognitive_Management_System_Spec.docx` (COGS v2) to the codebase: what is implemented (✅), partial (🟡), missing (⛔), or deferred (🕓), plus the prioritized incremental-build checklist. **Storage target:** MongoDB (replacing the spec's SQLite recommendation) for flexible documents, semantic/fuzzy/advanced search, and aggregation-based routing. Start here when planning feature work. |
| `BRAIN2_FEATURE_IDEAS.md` | Large idea bank of potential buildouts distilled from the `Brain2Ideas` brain-dump and other source docs, cross-referenced against what COGS is today and mapped onto the data model. A menu to pull from — nothing here is a commitment. |
| `CANONICAL_FIELDS.md` | Read-only analysis snapshot of the COGS data model: which fields are canonical, legacy/duplicate, or derived. Reference for a future, careful field-cleanup pass (no code was changed to produce it). |
| `brain2_features_roadmap.md` | Execution roadmap + coordination contract for **Wave 1** of Brain2 → COGS features (Gantt/CPM, plan-vs-reality, calibration, post-mortem, molecular/just-start, decision matrix, priority formula, streaks, knowledge graph, source/belief types, global search, JSON backup, needs-attention). Marked complete. |
| `brain2_features_roadmap_wave2.md` | Execution roadmap + coordination contract for **Wave 2** of Brain2 → COGS features (non-overlapping with Wave 1): owner/file map, upfront types, integration checklist. |
| `tree.md` | Annotated, clickable index of the whole repository (pairs with `tree.txt`). |
| `tree.txt` | Plain `tree` command output (regenerate with `npm run tree`). |
| `screenshots/` | Full-page PNG captures of every major app view plus matching `.txt` write-ups (52 views). Re-capture with `npm run capture-screenshots` while `npm run dev` is running. See [`screenshots/README.md`](screenshots/README.md). |

### Screenshot index

See [`screenshots/README.md`](screenshots/README.md) for the full index (52 PNG +
52 `.txt` sidecars). Quick map:

| Prefix | Area |
|--------|------|
| `01-*` | Home → Habits |
| `02-*` | Home → Plan |
| `03-*` | Home → To Do |
| `04-*` | Home → Goals |
| `05-*` | Lists (folder + content displays) |
| `06-*` | Scheduler |
| `07-*` | Analytics (13 tabs) |
| `08-*` | Home → Tracking |
| `09-*` | Modules |
| `10-*` | Operations |
| `11-*` | Knowledge Graph |
| `20-*` | Global header dialogs |
| `21-*` | Item detail popup |

See also the root `README.md` for the project overview and repository map, and the
per-folder `README.md` files for file-by-file documentation.
