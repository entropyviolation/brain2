# `components/` — All React UI

Every React component in Brain2 lives here. Top-level files are cross-cutting dialogs and shared widgets; each subfolder is one **module** surfaced from the main tab bar in `app/page.tsx`.

Brain2 is meant to be a **living, perfect second brain** — adaptable, alive,
beautiful, a new type of software. These folders are rooms on **one item
graph**, not a suite of separate products: an item captured once should be
connected and used in as many of them as it can honestly serve. **Analytics**
is the heart — collection, presentation, and analysis of that mass, and the
engine for the next tool. A record is a map: dated, incomplete, and kept at
its own order. Description stays distinct from inference. Look and feel: **Lists** (`Lists/`) is the
gold-standard combination of Win95 furniture and surreal orb/velvet contents.
New UI should preserve both halves — [`docs/DESIGN_STYLE.md`](../docs/DESIGN_STYLE.md).
The build that extends the map is [`docs/ScienceandSanityBrain2.md`](../docs/ScienceandSanityBrain2.md).

## Top-level tabs (from `app/page.tsx`)

| Tab | Folder | Purpose |
|-----|--------|---------|
| Home | `Home/` | Dashboard: habits (incl. weekly/daily climb cadences), plan, to-do, goals, tracking |
| Lists | `Lists/` | Milled Explorer frame + velvet Icons cabinet (orbs, auto-organize) |
| Docs | `Docs/` | WYSIWYG document workspace over `note` items (fonts, images, PDF ingest) |
| Scheduler | `Scheduler/` | Win95 window around the period funnel (Always → Year → Month → Week → Day). Always is two columns of drop cards, including Eventually / Later. Today/Tomorrow are real dates. + Gantt / Dependencies documents |
| Operations | `Operations/` | Graphic tool for a project (work, ideas, data, progress) — milled fascia command center; category board hides completed/inactive until Show archived; Parts formulas; To do includes phase and part tasks; **Working on this now** logs into Home To Do / Tracking / habits |
| Modules | `Modules/` | User-built mini-app **workspaces** (Itinerary / House Cleaning / Budget / Book Tasting / Film DNA / GradSearch templates + custom views) and dashboard widgets. Catalog chrome: `.mod95` in `modules-chrome.css`. End goal: **install** any small `.tsx` app as a lens on the same Item graph — [`docs/MODULE_PLATFORM.md`](../docs/MODULE_PLATFORM.md) |
| Analytics | `Analytics/` | **Heart of the app:** mass personal data → presentation, analysis, new tools. Light instrument studio over tasks, habits, tracking, sleep, goals, operations, item library (title+status stay Lists; Karla on `#c0c0c0` gray; custom range; pies, horizon, ridgeline, violin, alluvial, UpSet) |

App tabs (`data-ui-name="App tabs"` in `app/page.tsx`, painted in `app/win95.css`) are a milled fascia: one brushed bay, seven equal keys filling it, the active tab a black-mirror CRT with a round power lamp. The same language is the Home date plate and overview tiles — [`docs/DESIGN_STYLE.md`](../docs/DESIGN_STYLE.md#milled-fascia).

The global header (all tabs **and** item detail) is a **pinned mill title bar** (`AppHeader.tsx`, `shell-chrome.css`, sticky top, z-index 40 — below Names plates at 310 and Radix dialogs at 50): full window width, navy **BRAIN2** caption with a Tek POWER lamp, **today's friend** jewel (`baby-animal-nest.tsx` — 64px photograph in a chrome + black-mirror well inside the Friend key-well, Gallery; naming only inside Gallery; preapproved pack cards start unnamed and are the only picture source besides your uploads; worn friend persists until **Monday** or a manual shuffle/pick; pictures in `cogs-friend-pic:*`; click the photograph for that friend’s instrument (portrait, bond, voice keys, equalizer, journal — `components/friend-details/`); the chat button above Gallery asks for a Stardew-style suggestion (habits / today's To Do / Next Actions / affection / whim); click the bubble for the mission sheet (the task opens item detail on top; Accept until the end of the day; Decline asks for smaller tasks, then a first step, then a reason); Esc / × / outside closes the bubble; Gallery **Details** is the same page), then Review / System / optional **now** well (`header-now-box.tsx` — between System and Capture; idle → hidden; live Operations or pen-color Working sessions show name, tabular elapsed, Stop, Pause↔Resume) / Capture as milled silver key-wells of chunky press keys (Y2K handheld / TENO — stacked silver rings, specular top lip, phosphor counts; quoted Win95 bevels underneath, not a flat dialog strip) — **Morning / Review** (`Reviews/` — dialogs on `.hpp95` milled fascia), **Settings** (`Settings/SettingsDialog.tsx` — `.set95`; **data profile** Live vs Demo, window gray, **desktop PCB**, home location, default time of day, backup/restore, Manage Item Types, Second Brain setup, **Message ingest**, **Baby animal friend** gallery), **Tracking** (`cognitive-state.tsx` → TimeGrid; dialog **shell** `.hpp95-shell-only`), **Names** (`UiNames/` — first `data-ui-mode`; caption stays **Names**, latches sunken while on; Help / Inspect would sit beside it later), **Inbox** (`.inbox-dialog`), **Ingest** (`ingest-log-dialog.tsx`), **Metrics**, **Bulk Add**, **From Notes** (`notes-ingest.tsx` — Apple Notes ingest on the Mac desktop app), **Phone Notes** (`iphone-notes-store.tsx` — Telegram Shortcut dumps), and **Quick Add** (default framed key, docked at the right of Capture) — capture/review/metrics popups share `header-popup-chrome.css` (`.hpp95`). Review / Inbox counts are phosphor wells with tooltips. A global **Cmd/Ctrl-K** search palette (`Search/`) and the global **completion popup** (`Completion/`, fires on every task completion) plus **Names overlay** (`UiNames/UiNamesHost`, also in `app/layout.tsx`) are mounted app-wide. **Cmd/Ctrl-Z** undoes the last Home/Tracking action (paint, sleep, habit, complete, Day Log) via `hooks/useUndoHotkey.ts`; Tracking also listens in capture (`Home/Tracking/tracking-undo.ts`) so a focused timegrid still undoes the last stroke.

## Subfolders

| Folder | Module |
|--------|--------|
| `Home/` | Home dashboard and its Habits / Plan (bounded Win95 event dialog + week/month/day rails with To Do / Habits / Next actions, Lists orbs + habit gems, double-click detail + day-agenda planned placements that fill the split column + optional gem-and-trinket month mode) / ToDo (title jewel also at photograph size on the desktop under the window) / Goals (Objectives + Goals; same desktop jewel) / Tracking sub-views |
| `Completion/` | Global task-completion popup — fires on every **done** (not missed-opportunity) to capture objective/goal contributions + multipliers; **Undo** reopens the task |
| `Lists/` | Lists file manager (formerly "Next Actions") — orchestrator + `hooks/`, `views/`, `dialogs/` (Completed / Missed Opportunities are real Next Actions lists, not toolbar dialogs), `list-content/` (checklist ticks + too-late), `navigation/`, `toolbar/`, `attributes/`, `lib/` subfolders |
| `Docs/` | Docs tab — `DocsPanel` + `DocumentEditor` over `note` items |
| `Scheduler/` | Period funnel in `.sch95` window chrome + `DependencyGraph` / `GanttView` (critical path) |
| `Operations/` | Operations home board (milled fascia: CRT title, engraved category nameplates, metal keys) and per-operation workspaces (equal-fill panel keys, CRT heatmap). Panels are chosen per operation in Settings; To do embeds the Lists content panel and includes phase and part tasks; Parts are formulas with their own pages. **Working on this now** connects the workspace to Home To Do Done, Tracking, and tagged habits. |
| `Modules/` | Module platform — full-screen workspaces (`workspace/`, incl. itinerary, filmrecs, housecleaning, gradsearch views) + dashboard widgets. Heading toward **installable** modules: paste a small `.tsx` app, a wizard ports its state onto Items and grants it explicit bridges into Tracking / Habits / points / schedule / ingest ([`docs/MODULE_PLATFORM.md`](../docs/MODULE_PLATFORM.md)) |
| `Analytics/` | Heart studio: pies, treemaps, phosphor traces, observatory, circadian, diversity, transitions, spectrum, lists sized by count, tags, stages, weight, and **Item Types** |
| `ItemDetail/` | Consolidated item/task detail — full-screen page (`ItemDetailPage`) + popup (`ItemDetailPopup`), both `data-ui-name="Item detail"`. Tabs and chrome come from `resolveDetailView` (item type + list overlays + capabilities), not Task defaults. Completable items offer **Complete** and **Missed opportunity**. Always includes a History tab (`item-activity.ts`). Dependency add refuses cycles. |
| `ItemTypes/` | Create/edit item types (Settings → Manage Item Types; also Analytics → Item Types). System types locked; catalog types persist. |
| `Editor/` | Rich-text/markdown body editor (`RichTextEditor`) + `markdown.ts` serialization, `editor.css` |
| `UiNames/` | Thin overlay kernel. **Names** is the first `data-ui-mode` (outline + hover nameplate; plate portals to `document.body` at z-index 310 so it reads **on dialogs/popups**, not under the dim overlay). Help / Inspect would reuse the store, host, and `data-ui-*` attrs pointing at living READMEs — not a second blurb table. Not Lists `fm-inspector`. |
| `Focus/` | `JustStartMode` (`data-ui-name="Just Start"`) — ADHD anti-paralysis overlay (one smallest step + 2-minute timer) |
| `Search/` | `GlobalSearch` (`data-ui-name="Search"`) Cmd/Ctrl-K command palette + `useGlobalSearchHotkey` |
| `Settings/` | `SettingsDialog` header entry — window gray (`ChromeFaceField`), **desktop PCB** (`PcbBackdropField`), home location, default time of day (`DayAnchorField`), `BackupRestore` (full app JSON backup/restore), **Message ingest** (Telegram pairing, grocery pin, receipt/journal/PDF scans, always-on hub), item types, Second Brain setup, and manual mobile hub pull |
| `Mobile/` | Sideloadable Home + Lists shell (`/mobile`); manual hub pull from Settings |
| `Reviews/` | End-of-period review ritual (header dropdown, `data-ui-name="Period review"`) + `MorningReview` (`data-ui-name="Morning review"`), `PostMortemDialog`, and `AssumedTimesSection` — dialogs on milled fascia (`.hpp95`) |
| `Tracking/` | `MetricLogger` (`data-ui-name="Metrics"`) — quick self-tracking metric capture; header dialog shell `.hpp95` |
| `Icons/` | Shared icon system — `Icon`, `OrbPicker`, `icon-registry`, barrel `index.ts` |
| `spreadsheet/` | Reusable Google-Sheets-style editable grid (`SheetGrid` + `AddColumnDialog`) used by Lists + Module spreadsheet views |
| `ui/` | shadcn/ui primitives used across modules |

## Top-level files

| File | Purpose |
|------|---------|
| `append-log.tsx` | Shared **append log** composer: write, Submit (stamps now), List / Bulk / Latest, copy. Plan and Tracking day notes mount this. Optional `viewsWellClassName` (Tracking wraps List / Bulk / Latest in `.hab-view-changer`). Optional `rootStamp` / `logStamp` / `bulkStamp` (`data-ui-name` + help + docs) — Plan’s Month/Week/Day Plan uses these; Tracking omits them. Compact size stays a short strip. Frozen entries live in `.append-log-history` so the log scrolls apart from the composer. |
| `AppHeader.test.tsx` | Pin + brand + toolbar groups + door names + Review/Inbox tooltips + Names latch (`aria-pressed`, tooltip **Stop naming**) |
| `header-now-box.tsx` / `header-now-box.test.tsx` | Optional **now** groupbox between System and Capture — live Working session clocks (Stop / Pause↔Resume); absent when idle |
| `shell-chrome.css` | Full-width sticky mill fascia for `.b2-shell`: caption mill, Friend / Review / System / optional now / Capture as milled silver key-wells (imported from `app/layout.tsx` too) |
| `header-popup-chrome.css` | Shared milled fascia for pin-bar dialogs (`.hpp95`): CRT caption + power lamp, brushed bay, engraved nameplates, raised metal / CRT primary keys, recessed fields. Imported from `app/layout.tsx`. |
| `quick-add.tsx` | Single-line capture (`data-ui-name="Quick Add"`): colon paths (`list: item`, `folder: list: item`), live chips, optional Inbox vs file-to-list. `-mb` / `-monkey` sends the line to Monkey brain. Header trigger is `.b2-shell-go`. Dialog shell `.hpp95`. |
| `enhanced-bulk-add.tsx` | Multi-line capture (`data-ui-name="Bulk Add"`); header lines `list:` / `folder: list:`; `before 9/12:` stamps due that day; same path + inbox checkbox. Inbox **Bulk edit** reuses it with the selection prefilled. Dialog shell `.hpp95`. |
| `capture-shorthand.tsx` | Shared Inbox checkbox + in-dialog shorthand help for Quick Add and Bulk Add |
| `notes-ingest.tsx` | From Notes (`data-ui-name="From Notes"`) — date range, title+body preview, parse/skip; close/reopen keeps the session (listing continues); bulk-add (`ListName:` then items, or `Folder: List:` to create a folder) or park full text on **notes to ingest**. Dialog shell `.hpp95`. |
| `iphone-notes-store.tsx` | Phone Notes (`data-ui-name="Phone Notes"`) — queue of On My iPhone notes dumped via Telegram Shortcut onto **iPhone Notes Store** / **Parked**; bulk-add (same header syntax), keep parked, skip, Open in Lists. Dialog shell `.hpp95`. |
| `ingest-log-dialog.tsx` | Header **Ingest** (`data-ui-name="Ingest"`) — log of phone-message ingest (applied / clarify / ignored). Pairing lives in Settings. Dialog shell `.hpp95`. |
| `inbox.tsx` / `inbox.css` | Inbox dialog (`data-ui-name="Inbox"`; nested clarify is `"Clarify idea"`): **milled fascia** (brushed silver bay, engraved uppercase nameplates, raised metal keys, CRT count wells `#7dffc4`, round power lamp on the active partition). Partition names stay the resting ink color; the lamp and the count still light. **Inbox** (revisit) and **Monkey brain** (dump) as equal bay keys. Open ideas in the current pile, **newest first**, one hairline row in a sunken well (~12 visible). A navy bar is the caret; a filled well plus a check is the selection. Click the words to select; shift-click ranges. Pencil and trash sit on the caret row only. At rest: Select all, **Select N** (random, or all if the number is larger), **Select unsorted** (name only), a Dated/Bare slice (`/`), and **Walk** from the caret. After a check: Apply list, Due, **File**, Monkey brain / To inbox, Bulk edit, Delete. Merge at two or more. Keys that cannot press are absent. One-row trash asks the same Are you sure? as Delete. Sticky day plates; the clock is the row’s time; a trailing parenthetical is a quieter second line. The foot counts this sitting. Walk keeps one sheet up for the whole queue (the pile behind it does not repaint until the walk ends). Clarify leads with recent lists. |
| `cognitive-state.tsx` | Header **Tracking** button; opens `WorkingNowStrip` + `TimeGrid` in a dialog (name kept for wiring compatibility). Dialog frame `.hpp95-shell-only` (caption + bay; grid interior untouched). |
| `baby-animal-nest.tsx` | **Today's friend** (`data-ui-name="Today's friend"`, docs `docs/FRIEND_COMPANION.md`) in the pin-bar brand well — photograph, chat button, Gallery. Click the photograph for details. Chat asks for a mission (a short CRT power-on on the well; `prefers-reduced-motion` skips it). Click the bubble for the mission sheet. Esc / × / outside closes the bubble without declining. An accepted finish opens a cheer |
| `baby-animal-nest.css` | Friend nest, chat mark, Stardew bubble, mission sheet, and cheer styles; CRT power-on keyframes scoped to `.baby-nest-crt.is-powering`. The instrument’s paint is `friend-details/friend-details.css` |
| `friend-details.tsx` | Friend instrument entry. The page is `friend-details/`: lace portrait, bond tubes, tabs, equalizer, mission card, cameo keepsakes, playlist journal |
| `friend-mission-sheet.tsx` | Mission from {name}. Task row opens item detail over the sheet. Accept until local midnight. Decline: smaller tasks, then first step, then a reason |
| `baby-animal-gallery.tsx` | Friend gallery (shuffle among cards, pack naming, upload); no web picture search; **Details** opens the same instrument as the photograph; **Remove** confirms delete; names stick to `photo.id`; dismissed pack cards stay gone |

## From Notes (Apple Notes ingest)

Header **From Notes** (`notes-ingest.tsx`). Reads **Notes.app on this Mac** (iCloud-synced iPhone notes and On My Mac). Electron uses `window.desktop.fetchAppleNotes`; Chrome at `http://localhost:3000` uses the same reader through `/api/notes` (loopback only). A phone browser cannot list Notes. The first run may prompt macOS Automation permission for Notes.

Flow:

1. Pick a **date range** (dialog opens immediately; listing shows a spinner). Closing the dialog does **not** cancel listing — **From Notes** / **Resume Notes** / **Listing…** on the header brings the same session back. **Continue in background** is the same dismiss. **Done** or closing the finished empty screen starts a fresh period next time.
2. **Parse / skip** each note. The card shows the **title plus a content preview** (snippet fetched per card, not the whole library).
3. For each parsed note: freely edit **bulk-add** syntax (`ListName:` then items), or **Save for later ingestion**.
4. Parked notes go in an auto-created Lists folder **iPhone Notes Ingest**, list **notes to ingest**, with the **full note body** (not title-only). Bulk-add writes real items onto the named lists.

Header syntax is the same rule as Quick/Bulk Add (`parsePathHeader`), so a second colon names a **new folder**: `Trip ideas: Packing:` files the items on a new **Packing** list inside a new **Trip ideas** folder. Both notes dialogs resolve destinations through `ensureCaptureTarget`, the same door Quick Add uses, so nothing is created twice.
5. Apple Note ids that were already bulk-added or parked are **skipped** on later runs (`appleNoteId` on items + `cogs-apple-notes-ingested-ids`).

Helpers: `lib/apple-notes.ts`. Native reader: `electron/apple-notes.js` + `electron/apple-notes.jxa` (modes `preview` / `snippet` / `bodies`). Local `npm run dev` also serves `/api/notes` (`scripts/notes-api.mjs`, loopback).

## Phone Notes (iPhone Notes Store)

Header **Phone Notes** (`iphone-notes-store.tsx`). On My iPhone notes that never sync to this Mac: AirDrop the signed [`Dump iPhone Notes to Brain2.shortcut`](../docs/shortcuts/Dump%20iPhone%20Notes%20to%20Brain2.shortcut); it dumps `iphone-notes:` to the Telegram bot; Brain2 parks full bodies on Lists → **iPhone Notes Store** → **Parked** (`ensureIphoneNotesStoreDestination`). Queue: bulk-add (same header syntax as From Notes), keep parked, skip, or **Open in Lists**. Text the bot something that names no list and it parks here too, rather than replying with a picker of near-misses. Install: [`docs/shortcuts/dump-iphone-notes-to-brain2.md`](../docs/shortcuts/dump-iphone-notes-to-brain2.md). Distinct from Mac From Notes parking (**iPhone Notes Ingest** / **notes to ingest**).

## Message ingest (Telegram)

Header **Ingest** (`ingest-log-dialog.tsx`) plus Settings → **Message ingest**. Phone texts with `groc`, `got milk`, `needed:`, `get:`, `plan for rn:`, activity spans, discrete events / `log:`, whole-message habit keywords, `n …`, `qa:`, `habit:`, `at:`, `read: grocery list`, `lists`, `info`, `iphone-notes:` (On My iPhone Shortcut dump), and the rest of the phrase list in [`docs/MESSAGE_INGEST.md`](../docs/MESSAGE_INGEST.md) apply through `lib/ingest/` (writes reuse desktop paths; grocery dumps pin in Telegram; bare `g` → Inbox). `npm run phone:hub` is the always-on executor. Pairing required. Text-pipeline analytics: **Text events** / **Text spans**. Photos / PDFs / receipt OCR: [`docs/MESSAGE_INGEST.md`](../docs/MESSAGE_INGEST.md).

## Data stores (see `lib/`)

Components read/write Zustand stores (localStorage-backed) — the offline-first
source of truth. A future opportunistic `SyncingDataSource` reconciles with
**MongoDB Atlas** in the background (not a replacement for the local store) and a
shared `@brain2/core` package will hold this data layer for web/desktop/mobile (see
`docs/SPEC_MAPPING.md` §3). Append logs
(`lib/append-log.ts`) are the shared composer for Plan period keys
(`plan-text.ts`) and Tracking day notes (`day-notes-persist.ts`):

| Store | Used by |
|-------|---------|
| `task-store` | Lists, Scheduler, Plan, ToDo, Inbox, Modules, From Notes ingest |
| `habits-store` | Home Habits, Lists Daily Habits, Analytics |
| `goals-store` | Home Goals |
| `event-store` | Plan panel, Actual Day View |
| `points-store` | Points stats, completions across app |
| `time-tracking-store` | TimeGrid, Analytics Tracking tab |
| `reviews-store` | Reviews header, Analytics Reviews tab |
| `modules-store` | Modules panel |
| `item-type-store` | Item type registry (system Task/Item/Note/Operation re-seeded; catalog Book/Furniture/… persist) |
| `lists-ui-store` | Lists UI prefs (folder view, icon positions, orb gallery) |

A growing pure-logic layer in `lib/` (e.g. `search`, `links`,
`graph-layout`, `calibration`, `streaks`, `plan-vs-reality`, `critical-path`,
`priority`, `needs-attention`, `decision-matrix`) and a `lib/data/` data layer
(`DataSource` sources + Mongo collections/schemas + JSON `backup`) and
`lib/services/` (completion / review / scheduling / item-mutation + implied actions) back these components.

## Notes

- Item detail lives under `components/ItemDetail/` (`ItemDetailPage` + `ItemDetailPopup`). Tabs follow the item type; generic list items are not Tasks.
- Lists module hooks live in `components/Lists/hooks/` (not top-level `hooks/`).
- Deleted/removed from tree: `NextActions/`, top-level `Tracking/` (the current `Tracking/` is the new `MetricLogger`), `theme-provider.tsx`, `daily-review.tsx`, many unused `ui/` primitives.
- See each subfolder's `README.md` for file-level detail.
