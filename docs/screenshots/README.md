# COGS screenshots

Full-page PNG captures of every major app surface, each paired with a matching
`.txt` write-up (view path, source files, UI description).

**Re-capture:** with `npm run dev` (or `electron:dev`) running on port 3000:

```bash
npm run capture-screenshots
```

Set `COGS_FRESH=0` to keep your localStorage data instead of clearing it first.
Set `COGS_URL=http://localhost:3000` if the dev server uses a different port.

Implementation: `scripts/capture-screenshots.mjs` (Playwright) +
`scripts/screenshot-manifest.mjs` (metadata).

---

## Global chrome (every screen)

Rendered by `app/page.tsx`:

| Control | Component | Purpose |
|---------|-----------|---------|
| Review | `components/Reviews/reviews.tsx` | End-of-period review dropdown + dialog |
| Morning | `components/Reviews/MorningReview.tsx` | Start-of-day review dialog |
| Settings | `components/Settings/SettingsDialog.tsx` | Backup/restore, item types |
| Tracking | `components/cognitive-state.tsx` | Compact Time Grid dialog |
| Inbox | `components/inbox.tsx` | Unclarified captures |
| Metrics | `components/Tracking/MetricLogger.tsx` | Wellbeing datapoint logger |
| Bulk Add | `components/enhanced-bulk-add.tsx` | Multi-line capture |
| Quick Add | `components/quick-add.tsx` | Smart single-line capture |

**Top-level tabs (7):** Home · Lists · Scheduler · Operations · Modules · Graph · Analytics

**Shortcuts:** Cmd/Ctrl+K → global search · quick-capture hotkey → Quick Add

---

## Screenshot index

### Home dashboard (`components/Home/`)

| File | View |
|------|------|
| `01-home-daily-habits.png` | Habits → Daily week grid |
| `01-home-habits-weekly.png` | Habits → Weekly cards |
| `01-home-habits-monthly.png` | Habits → Monthly cards |
| `02-home-plan.png` | Plan → Month View |
| `02-home-plan-week.png` | Plan → Week View |
| `02-home-plan-day.png` | Plan → Day View |
| `03-home-todo.png` | To Do → Day |
| `03-home-todo-week.png` | To Do → Week |
| `03-home-todo-month.png` | To Do → Month |
| `04-home-goals.png` | Goals → objectives & direction report |
| `08-home-tracking.png` | Tracking → Time Grid |
| `08-home-tracking-daylog.png` | Tracking → Day Log |

Also visible on Home shots: `NeedsAttention`, review banner, points stats, today's progress.

### Lists (`components/Lists/`)

| File | View |
|------|------|
| `05-lists.png` | Home folder → Icons |
| `05-lists-list.png` | Home folder → List |
| `05-lists-details.png` | Home folder → Details |
| `05-lists-cards.png` | Home folder → Cards |
| `05-lists-content-default.png` | Example List → Default display |
| `05-lists-content-checklist.png` | Example List → Checklist |
| `05-lists-content-kanban.png` | Example List → Kanban |
| `05-lists-content-spreadsheet.png` | Example List → Spreadsheet |

### Scheduler (`components/Scheduler/`)

| File | View |
|------|------|
| `06-scheduler.png` | Funnel → Always |
| `06-scheduler-day.png` | Funnel → Day |
| `06-scheduler-gantt.png` | Gantt timeline |
| `06-scheduler-dependencies.png` | Dependency graph |

### Operations (`components/Operations/`)

| File | View |
|------|------|
| `10-operations.png` | Operations list |
| `10-operations-workspace.png` | Operation workspace (demo operation) |

### Modules (`components/Modules/`)

| File | View |
|------|------|
| `09-modules.png` | Modules dashboard |
| `09-modules-workspace.png` | Itinerary Creator workspace |

### Graph

| File | View |
|------|------|
| `11-graph.png` | Knowledge graph tab |

### Analytics (`components/Analytics/`)

| File | View |
|------|------|
| `07-analytics.png` | Habits heatmap |
| `07-analytics-points.png` | Points charts |
| `07-analytics-tracking.png` | Time distribution |
| `07-analytics-plan-vs-reality.png` | Plan vs Reality |
| `07-analytics-calibration.png` | Duration calibration |
| `07-analytics-streaks.png` | Streaks |
| `07-analytics-reflection.png` | Reflection / post-mortem |
| `07-analytics-reviews.png` | Saved reviews archive |
| `07-analytics-metrics.png` | Self-tracking metrics trends |
| `07-analytics-correlation.png` | Metric correlation explorer |
| `07-analytics-context-switch.png` | Context-switch heatmap |
| `07-analytics-regret.png` | Regret ledger |
| `07-analytics-item-types.png` | Item Types panel |

### Global dialogs & detail

| File | View |
|------|------|
| `20-dialog-reviews.png` | Day review dialog |
| `20-dialog-morning-review.png` | Morning review dialog |
| `20-dialog-settings.png` | Settings |
| `20-dialog-inbox.png` | Inbox |
| `20-dialog-bulk-add.png` | Bulk Add |
| `20-dialog-quick-add.png` | Quick Add |
| `20-dialog-global-search.png` | Cmd/Ctrl+K search |
| `20-dialog-time-tracking.png` | Header Tracking dialog |
| `20-dialog-metrics.png` | Metrics logger |
| `21-item-detail-popup.png` | Item detail popup |

---

## Coverage checklist

| App area | Screenshot(s) | Status |
|----------|---------------|--------|
| App shell + 7 top tabs | Visible in all full-page shots | ✅ |
| Global header actions | `20-dialog-*.png` | ✅ |
| Global search (Cmd+K) | `20-dialog-global-search.png` | ✅ |
| Home → Habits (Daily/Weekly/Monthly) | `01-home-*.png` | ✅ |
| Home → Plan (Month/Week/Day) | `02-home-plan*.png` | ✅ |
| Home → To Do (Day/Week/Month) | `03-home-todo*.png` | ✅ |
| Home → Goals | `04-home-goals.png` | ✅ |
| Home → Tracking (Grid/Day Log) | `08-home-tracking*.png` | ✅ |
| Home → Needs Attention banner | Visible in Home shots | ✅ |
| Lists folder views (Icons/List/Details/Cards) | `05-lists*.png` (first four) | ✅ |
| Lists content displays (Default/Checklist/Kanban/Spreadsheet) | `05-lists-content-*.png` | ✅ |
| Lists: habits/objectives smart entries | Opened via Home + sidebar (same components) | ✅ |
| Scheduler funnel (Always/Day) | `06-scheduler.png`, `06-scheduler-day.png` | ✅ |
| Scheduler Gantt + Dependencies | `06-scheduler-gantt.png`, `06-scheduler-dependencies.png` | ✅ |
| Operations list + workspace | `10-operations*.png` | ✅ |
| Modules dashboard + workspace | `09-modules*.png` | ✅ |
| Knowledge Graph tab | `11-graph.png` | ✅ |
| Analytics (all 13 tabs) | `07-analytics*.png` | ✅ |
| Item detail popup | `21-item-detail-popup.png` | ✅ |
| End-of-period reviews | `20-dialog-reviews.png` | ✅ |
| Morning review | `20-dialog-morning-review.png` | ✅ |

### Not separately screenshotted (see notes)

| Area | Why / how to reach |
|------|-------------------|
| Full-screen item detail (`ItemDetailPage`) | Same editor as popup; opened via Operations `onOpenItem` or legacy full-screen route |
| Completion dialog (`CompletionDialog`) | Appears automatically on task completion (`CompletionPopupHost` in layout) |
| Just Start focus mode | Launch from To Do row action (`components/Focus/JustStartMode.tsx`) |
| List/folder dialogs (New List, Settings, CSV import, Completed, Orb picker) | Open from Lists toolbar — same chrome as `05-lists.png` |
| Module builder chooser | Momentary step before `09-modules-workspace.png` |
| Module/widget config dialogs | Open from Modules dashboard |
| Sheet pop-out (`#popout/sheet/…`) | Separate Electron/window route |
| Module pop-out (`#popout/module/…`) | Separate Electron/window route |
| Affirmations sub-dialog | Inside Morning review |
| Operation post-mortem dialog | Button in operation workspace header |
| Item Types editor (full) | Settings → Manage Item Types (compact version in Analytics tab) |

---

## Naming convention

`NN-area-feature.png` — numeric prefix groups related views; `.txt` sidecar
matches the PNG basename. Legacy names (`01-home-daily-habits`, `02-home-plan`,
`03-home-todo`, `05-lists`, `06-scheduler`, `07-analytics`, `08-home-tracking`,
`09-modules`) are preserved for existing doc links.
