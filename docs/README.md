# `docs/` — Project documentation

| File / folder | Purpose |
|---------------|---------|
| `SPEC_MAPPING.md` | Section-by-section mapping of `Cognitive_Management_System_Spec.docx` (COGS v2) to the codebase: what is implemented (✅), partial (🟡), missing (⛔), or deferred (🕓), plus the prioritized incremental-build checklist. **Storage target:** MongoDB (replacing the spec's SQLite recommendation) for flexible documents, semantic/fuzzy/advanced search, and aggregation-based routing. Start here when planning feature work. |
| `screenshots/` | Full-page PNG captures of each major app view plus matching `.txt` write-ups (UI elements, source files, data state). Re-capture with `node scripts/capture-screenshots.mjs` while `npm run dev` is running. |

### Screenshot index

| File | View |
|------|------|
| `01-home-daily-habits.png` | Home → Habits → Daily |
| `02-home-plan.png` | Home → Plan → Month View |
| `03-home-todo.png` | Home → To Do → Day |
| `04-home-goals.png` | Home → Goals → This Month |
| `05-lists.png` | Lists → Home → Icons view |
| `06-scheduler.png` | Scheduler → Always |
| `07-analytics.png` | Analytics → Habits |
| `08-home-tracking.png` | Home → Tracking → Time Grid |
| `09-modules.png` | Modules |

See also the root `README.md` for the project overview and repository map, and the
per-folder `README.md` files for file-by-file documentation.
