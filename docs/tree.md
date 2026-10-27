# BRAIN2 room map

A short map of the repository. The plain snapshot is [`tree.txt`](tree.txt),
written by `npm run tree` when someone asks to update the tree. Per-file
lists live in the folder `README.md` next to the code. File-header comments
stay in the source. This map does not copy them.

> Where to start: root [`README.md`](../README.md) → [`SPEC_MAPPING.md`](SPEC_MAPPING.md)
> → the nearest folder `README.md`. Where it is going:
> [`MODULE_PLATFORM.md`](MODULE_PLATFORM.md) (installable modules on one Item
> graph). Look and feel: [`DESIGN_STYLE.md`](DESIGN_STYLE.md)
> (Lists is the gold standard); moodboard: [`DESIGN_REFS.md`](DESIGN_REFS.md).

The tab picture (Home, Lists, Docs, Scheduler, Operations, Modules, Data)
is the application map in the root [`README.md`](../README.md).

---

## app/

Next.js App Router entry. One static client page, global CSS, the retro shell.
Trip maps, weather, and places call public APIs from the browser. No App
Router API routes are required for the static Electron export.

→ [`app/README.md`](../app/README.md)

## components/

All React UI. Top-level files are cross-cutting widgets (pin bar, Quick Add,
Inbox, friend). Subfolders are rooms. Most have a co-located `*.test.tsx`.
Inbox parts sit in `components/inbox/` beside `components/inbox.tsx`, which stays the import: `inbox-view.tsx`, `time.ts`, `caret.ts`, `capture-chips.tsx`, `walk-origin.tsx`, `assigned-list-plates.tsx`, `clarify-dialog.tsx`, `trigger.tsx`, `chrome.tsx`, `undo-banner.tsx`, `rows.tsx`, `foot.tsx`, `apply-list-dialog.tsx`, `deadline-dialog.tsx`, `select-n-dialog.tsx`, `delete-confirm-dialog.tsx`, `bulk-edit-host.tsx`, `use-inbox-rows-scroll.ts`, `use-inbox-chords.ts`.

→ [`components/README.md`](../components/README.md)

### Home

Default tab. Date plate, the Visual dashboard, then Habits, Plan, To Do,
Goals, and Tracking. The dashboard is the same on every sub-tab.

Habits is the favorite interior. The habit form body is `components/Home/Habits/habit-form/`; `TaskForm` is still `daily-task-form.tsx`. The desktop console is `components/Home/Habits/tracker/habits-desktop-page.tsx`; `habit-tracker.tsx` is the phone switch. Plan, To Do, Goals, and Tracking steal its
language and do not clone `.hab95`. Goals are all-time Objectives plus
quantifiable goals and the Direction report. Tracking here is the time grid.
The wellbeing logger is `components/Tracking/` (`MetricLogger`), opened from
Now → Current moment, and it is not this desk. The header Now popup is
`components/header-tracking/`. To Do's door is `components/Home/ToDo/todo-panel.tsx`; the desktop fascia is `components/Home/ToDo/desk/todo-desk-panel.tsx`. The phone door stays `components/Home/ToDo/todo-phone-page.tsx`; its modules are `components/Home/ToDo/phone/`. To Do's Session popup door is `components/Home/ToDo/SessionPlanner.tsx`; the views live in `components/Home/ToDo/session-planner/`.

→ [`components/Home/README.md`](../components/Home/README.md)

### Lists

Win98 file manager for folders, lists, and items, through `task-store`. New
rows default to generic `item`. Velvet and orbs are the cabinet. The milled
Explorer frame is `filemanager98.css`. This is the UI gold standard.
Sub-rooms include `hooks/` (`useListsShelf.ts`, `useListsShelfMaintenance.ts`, `useOpenListItems.ts`, `useListsClipboard.ts`, `useListsCreate.ts`, `useListsDuplicate.ts`, `useFolderContextMenu.ts`, `useListsCsvImport.ts`, `useListsSelectionActions.ts`, `useListsIconChrome.ts`), `navigation/`, `views/`, `list-content/`,
`dialogs/`, `attributes/`, `lib/` (`lists-shelf-sync.ts`, `open-list-chrome.ts`), and `board/` (`list-inner-caption.tsx`, `lists-title-bar.tsx`, `lists-address-bar.tsx`, `lists-status-bar.tsx`, `lists-select-strip.tsx`, `lists-inspector.tsx`, `lists-main-pane.tsx`, `lists-dialog-host.tsx`).

→ [`components/Lists/README.md`](../components/Lists/README.md)

### Docs

WYSIWYG documents over `note` items. Folder sidebar, auto-save, fonts,
images, PDF ingest. Helpers live in `lib/` (`doc-html.ts`, `doc-links.ts`,
`google-fonts.ts`, `image-resize.ts`, `pdf-to-html.ts`).

→ [`components/Docs/README.md`](../components/Docs/README.md)

### Scheduler

Always → Year → Month → Week → Day, plus dependency and gantt.

→ [`components/Scheduler/README.md`](../components/Scheduler/README.md)

### Operations

A graphic tool for any project — work, ideas, data, and progress. Nothing is
assumed to be trip-shaped. Archived ops stay hidden until Show archived.
The workspace tabs are the panels that operation turned on.

→ [`components/Operations/README.md`](../components/Operations/README.md)

### Modules

Widget dashboard plus a workspace mini-app: bind lists, compose views,
author workflows, pop out a window. Installable modules are the direction
([`MODULE_PLATFORM.md`](MODULE_PLATFORM.md)). Files here are allowed to stay
long. Why: [`components/Modules/README.md`](../components/Modules/README.md).

### Data

Heart of the app. The vault is presented, analyzed, and turned into the next
instrument. Chart → Lists keeps a finding as a living item. Title bar and
status bar stay Lists furniture. The interior is a light studio with range
chips and the groups Behavior, Time, Accuracy, Meta, and Library.

→ [`components/Analytics/README.md`](../components/Analytics/README.md)

### Rituals

Header Rituals control. Morning and night, and week through year. The end
walk can push unfinished items, record assumed times, and glance at the day
in pen colors.

→ [`components/Reviews/README.md`](../components/Reviews/README.md)

### Item detail

The full page and the popup both show one record (tags, links, schedule,
body, history). Private sections of the popup live in `popup/`. The public
import is still `@/components/ItemDetail/ItemDetailPopup`. Private sections of
the page live in `page/`. The public import is still
`@/components/ItemDetail/ItemDetailPage`. They stay separate
editors from the To Do card. Why:
[`components/Home/ToDo/README.md`](../components/Home/ToDo/README.md).

→ [`components/ItemDetail/README.md`](../components/ItemDetail/README.md)

### Other rooms

| Room | What it is |
|------|------------|
| `Completion/` | One completion popup for every task completion, mounted from `app/layout.tsx`. Undo reopens the task. Skip keeps the win. Save records the contribution. |
| `Settings/` | Gear menu. Theme, chrome warmth, city, backup, phone, accounts. |
| `Focus/` | Just Start. |
| `People/` | People I Know biography and pipelines. |
| `ItemTypes/` | The type catalog editor. Data still has the Library view. |
| `UiNames/` | Names overlay. First `data-ui-mode`. Nameplates point at living READMEs. |
| `Mobile/` | Phone shell. Same vault, its own pages. |
| `spreadsheet/` | Sheet engine used by Lists and modules. |
| `ui/` | Shared shadcn-style primitives and house keys. |
| `header-tracking/` | The Now popup. Reuses the time grid. Does not replace the Tracking desk. |
| `Tracking/` | Wellbeing `MetricLogger`. Not the time grid. |

Each of those folders has its own `README.md` when the room is more than one file.

## lib/

Data model, Zustand stores (`localStorage`), and pure helpers. Not React UI.
Live keys are `brain2-*`. `cogs-*` is the historical alias. Persist keys and
versions are only in the lib README.

→ [`lib/README.md`](../lib/README.md)

## electron/

Desktop shell. Dev loads `localhost:3000`. Prod serves `out/` as `app://`.
The main window stays on that origin. http(s) leaves through the system
browser. `userData` stays the `cogs` folder so a rename cannot orphan the vault.

→ [`electron/README.md`](../electron/README.md)

## hooks/

App-wide React hooks, mounted mostly from `app/page.tsx`. Hooks that belong
to one room live next to that room (`components/Lists/hooks/`).

→ [`hooks/README.md`](../hooks/README.md)

## scripts/

Dev server, phone hub, ingest, shortcuts, screenshot capture, and the doc
sync. `update-tree.sh` writes [`tree.txt`](tree.txt) (`npm run tree`).
`docs-check.mjs` checks README file lists (`npm run docs:check`).
`screenshot-targets.mjs` names the gallery ids a diff touched
(`npm run screenshot-targets`). Capture itself is
`capture-screenshots.mjs`.

## docs/

North stars, checklists, and screen truth. The index is
[`docs/README.md`](README.md). `tree.md` is this room map. `tree.txt` is the
generated source snapshot. `screenshots/` is the gallery, refreshed on
demand, not on every code change.

## public/

Shipped pictures, omitted from `tree.txt` so the snapshot stays a source
tree. Fonts (`fonts/w95fa.woff`). Lists orbs (`orbs-removebackground/`) and
folder cut-outs (`folders-removebackground/`). Friend pack
(`friend-pack/`). Habit gems (`gems-removebackground/`). Lists velvet
(`newvelv.jpg`). Desktop plates (`pcb/`). Moon-chart maps (`planets/`).
Tracking pen-well photographs (`pen-tray/`). Manifests live in `lib/`.

## designrefs/

Moodboard stills. Not shipped assets, except plates and pen-tray photos
copied into `public/`. Catalog: [`DESIGN_REFS.md`](DESIGN_REFS.md). Omitted
from `tree.txt`.

## extensions/chrome-history/

Unpacked Chrome extension. At 12:05am local it exports the day that just
ended and posts it to this machine. Install notes:
[`extensions/chrome-history/README.md`](../extensions/chrome-history/README.md).

## Tests and config

`e2e/` is Playwright. `tests/` holds shared Vitest helpers. Co-located
`*.test.ts(x)` files sit next to the code. `npm test` and `npm run test:e2e`.

`next.config.mjs` ignores hub writes, `.cursor/`, `out/`, and `dist/` in dev
watch so those cannot Fast Refresh the skin. The filesystem webpack cache
stays as Next set it. Other root config: `package.json`, `tsconfig.json`,
`tailwind.config.ts`, `vitest.config.ts`, `playwright.config.ts`.

## cosmeticsandperfume/

Personal notes, not app code.
[README](../cosmeticsandperfume/README.md).

## Spec gaps (highest impact)

The checklist is [`SPEC_MAPPING.md`](SPEC_MAPPING.md). These are the rows
that still shape the work:

| Area | Status | Next step |
|------|--------|-----------|
| Storage | local store | The manual phone hub is the sync that exists. Atlas is speculation. JSON export already ships. |
| Item model | split types | De-dup fields into one `Item`. |
| Goals | Objectives shipped | Auto-progress and penalties remain. |
| Data | studio views | Spec category and cognitive-state rooms. |
| Carry-over | via Rituals | Automatic period carry-over. |
| Regret | ledger | Auto-accrual tuning. |

## When the tree moves

`npm run tree` rewrites `tree.txt` only. Run it on a doc sync, not during
ordinary coding. Edit this file when a top-level folder or a named room
appeared or disappeared. The rule is `.cursor/rules/doc-sync.mdc`.
