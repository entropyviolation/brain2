# Spec → Code Mapping (Brain2)

This document maps every section of `Cognitive_Management_System_Spec.docx`
("Personal Cognitive Management System", historically titled COGS v2) to the
current **Brain2** codebase. The running product’s header and window title are
**BRAIN2** ([`lib/app-brand.ts`](../lib/app-brand.ts)).

The spec is the **checklist**, not the ceiling. Brain2 is intended as a
**revolutionary living second brain** — adaptable, alive, beautiful,
cutting-edge, infinite; a new type of software. **Item, used everywhere:**
capture once, then connect and use in as many rooms as the record can honestly
serve. **Analytics is the heart:** mass personal data and information-resource
collection, presentation, and analysis, and the engine for endless tools.
Features below are how the current body matches that document. The larger claim
(one Item graph, installable rooms, infinite adaptability) lives in the root
[`README.md`](../README.md) and [`MODULE_PLATFORM.md`](MODULE_PLATFORM.md).

Legend:
- ✅ **Implemented** — present and broadly matches the spec.
- 🟡 **Partial** — exists but diverges from or under-delivers the spec.
- ⛔ **Missing** — not implemented yet.
- 🕓 **Deferred** — explicitly out of scope for v1 per the spec.

> Direction chosen for this rebuild: **incremental evolution** of the existing
> localStorage/Zustand + Electron app toward the spec (not a from-scratch
> rewrite). **Storage model:** the local store stays **offline-first** (the
> working source of truth on every client); **MongoDB** (Atlas, replacing the
> spec's original SQLite recommendation) becomes a *cloud sync target* behind an
> opportunistic `SyncingDataSource` — for a flexible document model,
> semantic/fuzzy/advanced search, and aggregation-based routing as the dataset
> grows relational. This file is the running checklist for that work and the
> architectural plan (offline-first + opportunistic Atlas sync + shared
> `@brain2/core` + future mobile).

Screenshots and per-screen write-ups: [`docs/screenshots/`](screenshots/).

---

## §1 Overview & Design Philosophy
Design intent only; no code. Guiding principles to honor going forward:
capture-first, one underlying "item" concept **used in as many rooms as
possible**, progressive scheduling, local-first/sync-ready,
AI-ready-not-AI-dependent, everything reviewable. Product overlay (not in the
original spec wording, load-bearing here): the organism is a **living perfect
second brain**; **Analytics is the heart** of collection / presentation /
analysis, not a side report. A record is a **map** of a life, not the life:
it leaves characteristics out, carries a date, and keeps its order of
abstraction (observed, recorded, derived, inferred). Description comes before
inference. The next period starts from a handoff. Full parallels and the
ten-slice build: [`ScienceandSanityBrain2.md`](ScienceandSanityBrain2.md)
(Wave 13 in [`PLAN_OF_ACTION.md`](PLAN_OF_ACTION.md)).

## §2 System Architecture
- **Shape chosen by this repo:** Option B (Electron) + localStorage via Zustand
  `persist`, kept **offline-first**. Future direction:
  each client (web/desktop renderer + a future **mobile** app) keeps a complete
  local store; a `SyncingDataSource` opportunistically reconciles with **MongoDB
  Atlas** (cloud) in the background. Electron main reverts to a **thin shell**
  (optionally a connector/cache host), not the data host; its IPC + Mongo
  scaffolding is repurposed as one transport on the remote/sync side. A separate
  read-only **external data** layer (Open-Meteo weather, Photon places) feeds
  widgets, cached with a TTL and degrading offline. Shared logic lives in a future
  `@brain2/core` package. See `electron/`, `README.md`.
- Module list (§2.2) maps to top-level tabs in `app/page.tsx` and
  `components/<Module>/` folders:
  **Home** | **Lists** | **Docs** | **Scheduler** | **Operations** | **Modules** |
  **Analytics**, plus a global header cabinet (**BRAIN2** caption, today's friend
  with a Stardew Next-Action bubble on click, Friend / Review / System / optional
  **now** well (between System and Capture; idle → hidden; live Working sessions
  show name, elapsed, Stop, Pause↔Resume) / Capture groupboxes).

## §3 Data Storage & Sync — 🟡/⛔
- **Current:** a dozen-plus Zustand stores → localStorage:
  `task-store` (`cogs-task-storage`), `event-store` (`cogs-event-storage`),
  `habits-store` (`cogs-habits-store`), `goals-store` (`cogs-goals-store`),
  `points-store` (`points-store`), `time-tracking-store` (`cogs-timegrid-store`),
  `reviews-store` (`cogs-reviews-store`), `modules-store` (`cogs-modules-store`),
  `module-definitions` (`cogs-module-definitions`), `workflows-store`
  (`cogs-workflows-store`), `item-type-store` (`cogs-item-types-store`),
  `lists-ui-store` (`cogs-lists-ui`), `theme-store` (`cogs-theme-store`).
- **Also persisted outside stores:** append logs (`lib/append-log.ts`) — plan
  period keys (`lib/plan-text.ts`: `dayPlan-*`, `weekPlan-*`, `monthPlan-*`,
  hub-synced; optional `draft` on the envelope) and
  Tracking day notes (`lib/day-notes-persist.ts`); one-time import of legacy
  `weekly-habits-*` keys into `habits-store` (persist v3 also migrates climb
  config onto `IncrementalHabitData` and logs onto `TaskCompletion.value`).
- **Done:** one-click **JSON export/import** of all data — `lib/data/backup.ts`
  (`createFullBackup`/`downloadBackup`/`previewBackup`/`restoreBackup` over every persisted store,
  including home layout, weather place, sun history, and Names, plus plan text, attachments, docs,
  and `extras` for every other durable key — item history, friend pins, module notes, navigation,
  ingested-note ids, and unprefixed relics; split `brain2-*` / `cogs-*` copies and a bare plan draft
  are folded into the key restore reads; a hydrated store is included when disk is behind; leftover
  `friend-pic:` bytes and open-window gallery `data:image` URLs fold into attachments; doc export
  keeps the newer body; per-store merge/replace;
  per-category and per-module-definition exports too; new files use `app: "brain2"` and still accept
  legacy `app: "cogs"`; an older file with no `extras` field does not wipe live extras;
  `data/recovery-backups/` lists via GET `/api/recovery-backups` when present),
  surfaced in the header **Settings** dialog. Settings also has a **Live vs Demo**
  data profile (`brain2-data-profile`); Demo lives on `brain2-demo-*` keys and
  cannot restore onto Live. A nascent
  `DataSource`/repository seam (`lib/data/`) abstracts local/IPC/mongo sources.
- **Gap:** no cloud **MongoDB Atlas** sync target yet (`brain2` database —
  collections for items, plans, habits, reviews, etc.) or a numbered **schema
  migration** runner wired to the live stores. MongoDB was chosen over the spec's
  SQLite recommendation for:
  schemaless/flexible documents (unified `Item` + custom attributes), text indexes
  and Atlas Search for **fuzzy search**, vector indexes for future **semantic
  search**, aggregation pipelines for **advanced search and routing**, and native
  BSON/JSON interchange.
- **Revised direction (offline-first + opportunistic sync):** the local store is
  **not** being replaced — it stays the working source of truth on every client.
  Atlas becomes a background **sync target** behind a future `SyncingDataSource`
  (per-field last-write-wins to start; upgradeable to RxDB / PowerSync / Atlas
  Device Sync). The `DataSource`/repository seam (below) is what makes this — and a
  future mobile client — possible.
- **Multi-device sync is now planned, not deferred.** It is opportunistic and
  best-effort (never blocks offline use); a future **mobile** app (Expo / React
  Native) is an explicit target consumer.
- **Phone data uses a manual hub.** Settings → Mobile Sync and `/mobile` pull
  (`lib/mobile-sync.ts`) copy a snapshot. There is no always-on live-sync engine.

## §4 Inbox / Capture
- §4.2 Quick Add — ✅ `components/quick-add.tsx` + `lib/smart-parse.ts` +
  `lib/capture-target.ts`. Colon paths (`list: item`, `folder: list: item`,
  nested `folder: folder: list: item`), live destination chips, optional
  **Send to Inbox for clarification** (on by default; uncheck to file on the
  target list or All Items). `-mb` / `-monkey` files the line in **Monkey brain**.
  Shorthand help in-dialog
  (`components/capture-shorthand.tsx`).
- §4.3 Bulk Add — ✅ `components/enhanced-bulk-add.tsx`. Header lines ending in
  `:` (`list:` or `folder: list:`), same path + smart-parse on item lines,
  auto-creates folders/lists. Inbox checkbox off by default (files onto lists).
- Apple Notes ingest — ✅ This Mac: `components/notes-ingest.tsx` +
  `lib/apple-notes.ts` + `electron/apple-notes.js` / `apple-notes.jxa`. Electron
  IPC **or** localhost `/api/notes` (`scripts/notes-api.mjs`, loopback only) so
  Chrome at `http://localhost:3000` can list the same Notes.app library. Date-range
  listing, parse/skip with title+content preview, then bulk-add (`List:` syntax,
  or `Folder: List:` to create a new folder by name)
  or park the **full note** on Lists → **iPhone Notes Ingest** → **notes to ingest**.
  The dialog session survives close/reopen so a slow first listing can finish in
  the background. Already-ingested Apple Note ids are skipped.
  **On My iPhone notes that do not sync:** signed iOS Shortcut
  [`Dump iPhone Notes to Brain2.shortcut`](shortcuts/Dump%20iPhone%20Notes%20to%20Brain2.shortcut)
  (AirDrop; [`docs/shortcuts/dump-iphone-notes-to-brain2.md`](shortcuts/dump-iphone-notes-to-brain2.md);
  Find Notes “is in the last” + Pick a note / Shortcut Input; composite
  `id: Name|Folder|Modified` — not `properties.notes` / Identifier);
  `lib/ingest/apply-iphone-notes.ts` parks on Lists → **iPhone Notes Store** →
  **Parked**; header **Phone Notes** (`components/iphone-notes-store.tsx`) is the
  queue. Separate from Mac From Notes.
- **Message ingest (Telegram first)** — ✅ **BIM** (Brain2 Ingestion Messenger).
  Phone texts with short key phrases apply through the same capture / habit /
  tracking writes as the desktop UI, and **read back** lists, folders, inbox,
  habits, and status as plain text
  (`groc` / `read: grocery list`, `lists`, `folders`, `info` + `{prefix} info` /
  `{prefix} commands` / `all commands`; bare `g` → Inbox).
  A multi-line `Name:` dump files onto that list (grocery headers use the store
  list; identical open lines ask see / again / dismiss; `before 9/12:` is due that
  day). **`needed:`** / **`get:`** (colon required) add to list **needed** with notes **sent from text**.
  **`plan for rn:`** stamps plan log entries **from text**. Whole-message habit
  keywords (hemisync, read N pages, …) and Settings **discrete event triggers**
  (`log:` / `log-`, smoked weed, ate {item}, …) label tracker rows
  `generatedBy.kind === "text"`. **Activity spans:** `currently` / `stopped` /
  `switched to`. Dedupe on Telegram `update_id` / `message_id`. Analytics tabs
  **Text events** / **Text spans**. Grocery dumps **pin** in the Telegram chat
  so a store trip can read the last list with the laptop off. Live 24/7 replies:
  `npm run phone:hub` (hydrate persist, own Telegram, webhook optional).
  Shortcuts: `got milk`, `n …`, `day:`, custom first-word aliases (e.g. `store`
  → `groc`). **On My iPhone Notes:** AirDrop `Dump iPhone Notes to Brain2.shortcut`
  → `iphone-notes:` → iPhone Notes
  Store. **iPhone Screen Time / Calls / Texts:** typed Telegram verbs
  (`screen:`, `call:`, `text:`, `plan for rn:`, `do:`, `to do today:`, `gm`, `review`, `gps:`) or AirDrop
  [`Screen Time to Brain2.shortcut`](shortcuts/Screen%20Time%20to%20Brain2.shortcut),
  [`iPhone Call to Brain2.shortcut`](shortcuts/iPhone%20Call%20to%20Brain2.shortcut),
  [`iPhone Text to Brain2.shortcut`](shortcuts/iPhone%20Text%20to%20Brain2.shortcut),
  [`Location to Brain2.shortcut`](shortcuts/Location%20to%20Brain2.shortcut)
  (Ask-for-app ping, after-call Ask, Ask-for-text, Arrive/Leave location; no If actions — iOS rejects a
  hand-written one). Apple cannot export Screen Time, Phone recents, or the Messages
  database — those views are never a silent watcher. Channel-agnostic command core (`lib/ingest/`); Telegram adapter
  (Electron `safeStorage` token, or phone hub / `npm run ingest`). Pairing
  allowlist, not open DMs. Prefix-less text → Inbox Quick Add. **Media ingest**
  is built: journal photos → deskewed PDF + searchable Docs note (From phone);
  forwarded PDFs extract text on the desktop/hub path; receipt OCR checks off
  grocery and bumps Inventory/Pantry (asks when a name is new). Local Tesseract
  — no hosted vision API. See [`MESSAGE_INGEST.md`](MESSAGE_INGEST.md). Other
  messengers and Atlas-backed ingest are 🕓 later.
- §4.4 Clarification — 🟡 `components/inbox.tsx` (`TaskClarificationDialog`).
  Open ideas are listed **newest first** (`sortInboxNewestFirst`).
  Keyboard **Walk** starts at the caret when nothing is checked, and **Walk selected**
  steps the checks (Select all / **Select N** / **Select unsorted** / Deselect).
  `/` slices the pile to Dated or Bare. A navy bar is the caret; a filled well
  is the selection. Click the words; shift-click ranges.
  Clarifying, filing, or discarding awards **1 point**; emptying the revisit Inbox awards
  **50** (`lib/inbox-credit.ts`). The foot counts this sitting. The walk sheet stays
  mounted for the queue, and the pile behind it does not repaint until the walk
  ends. After a check: Apply list, due,
  merge (two or more), **File** (onto assigned lists, or All Items when none),
  **Monkey brain** / **To inbox**, **Bulk edit**, or **delete** after Are you sure?
  (one row’s trash asks the same way). **Apply and clarify** from the list popup
  files onto the chosen lists and leaves Inbox; **Apply** alone keeps them in the pile
  (`lib/inbox-batch.ts` + `lib/item-merge.ts`, `#243`). **Monkey brain** is a second Inbox partition
  for compulsive dumps (`-mb` / `-monkey` on Quick Add and Telegram); it does
  not count as the revisit pile. The partition name stays the resting ink color;
  the lamp and CRT count still change. A count of 10 or more uses a heavier phosphor.
  Still task-only (no type switching among task/note/event/log).
- §4.5 Inbox vs. review queue — ✅ Inbox exists, the Review header surfaces pending
  period reviews, and a separate **Needs Attention** queue ships on Home
  (`components/Home/NeedsAttention.tsx` over the pure selector in
  `lib/needs-attention.ts`): overdue / blocked / unclarified / stale plus
  neglected (goals / operations / list items) and zombie (pushed or
  long-resident), grouped by reason. Title click opens the detail popup; kill /
  split / clarify sit on neglected / zombie / unclarified rows.

## §5 Item Data Model — 🟡 (most important refactor target)
- Current model: `lib/types.ts` `Task` is the persisted document; **Item** is
  the ontology. Prefer `ItemRecord` (`type ItemRecord = Task`) on new
  signatures. Runtime array is still `tasks[]` in `cogs-task-storage` (persist
  **v12**). Store aliases: `addItem` / `updateItem` / `deleteItem` /
  `getItems` → `addTask` / `updateTask` / `deleteTask` / `tasks`. UI still
  calls `useTaskStore`. Separate interfaces for habits (`WeeklyTask`), events
  (`CalendarEvent`), time-grid intervals, reviews (`PeriodReview`), modules
  (`ModuleInstance`).
  `entropy` vs `cognitiveLoad` and `context` vs tags are **intentional keeps**
  (owner instruction), not a merge target — see
  [`CANONICAL_FIELDS.md`](CANONICAL_FIELDS.md). The old `category` /
  `categories` collision is gone: they are now `Task.stage` (lifecycle bucket)
  and `Task.lists` (list membership), two real axes under two honest names.
- **Gap vs §5.1–5.3:** a unified `Item` core exists (`id/type/title/tags/links/
  attributes` in `lib/types.ts`); the runtime record is still named `Task` /
  stored in `tasks[]` (aliases started). Persist **v12** fills a missing `type`
  (Next Actions or inbox → `"task"`, else `"item"`) and never overwrites an
  explicit type or deletes `description`. Rows that already carry `type` (including
  `"task"` stamped by the old v7 default) are left as-is. The one overlap left
  on the document is `title` vs `description`. `Item.title` is
  the field of record and every display read now goes through `itemTitle()` /
  `itemTitleOrUntitled()` in `lib/item-utils.ts`; `description` is kept as a
  mirror / parked-note body while persisted vaults and backups still carry it.
  Graph edges are `Item.links`; `Task.dependencies` / `parentTaskId` stay
  separate. Built-in types include
  `task`, `item`, `note`, `goal`, `habit`, `event` plus catalog Book / Furniture /
  Resource / Shopping / Flight and seeded Source/Belief.
- §5.4 Task fields — ✅ mostly present on `Task`.
- §5.5 Detail view — ✅ consolidated `components/ItemDetail/` (`ItemDetailPage` +
  `ItemDetailPopup`). Tabs and chrome follow `resolveDetailView` (item type +
  list `detailPanels` / `hiddenDetailPanels` + capabilities). Book shows a cover
  and featured page fields; non-task types do not inherit Scheduling by default.
  History tab is always on (`lib/item-activity.ts` append-only ledger). Adding a
  dependency that would loop is refused (`wouldCreateCycle` + Win95 confirm).
- §5.6 Recurrence — 🟡 `Task.repeatSettings` exists in types. Habit bridge:
  implied-action `incrementHabit` can add a numeric delta to a daily habit
  (e.g. Book pages read → “Read at least 10 pages per day”).
- **Operations as a configured item** — ✅ an Operation is a `Task` with
  `type: "operation"`: a little graphic tool for any project, its ideas, its
  data, and its progress. Shape lives in attributes rather than in code:
  `categories` (free-form, many per operation — grouped/filtered on the
  Operations home board), `panels` (which prebuilt panels the workspace
  shows, from `OPERATION_PANELS`, with `OPERATION_PRESETS` for a fast start;
  the default strip is Home / **To do** / Phases / **Parts** / Log, and the
  To do tab keeps the panel id `tasks`), and `trackingTagIds` (Tracking-library
  tags so **Working on this now** can auto-fill linked Goal / Yes-No habits).
  The home board hides completed and inactive operations (`done`, `paused`,
  `abandoned`, or `completed`) until **Show archived**. Settings can **delete**
  the operation after an Are you sure dialog. **Parts** are formulas
  (`partFormulas` / `partInstances`): a kind such as Issue → Article
  (drafted → written → formatted, then ordered / printed) or a plain Room.
  Each part has its own page. Stage and finish steps are tasks and join To do;
  ideas on a part are not tasks. Glance meters are chosen with **Metrics**.
  Same composition idea as `ItemTypeDefinition.detailPanels` /
  `List.detailPanels`, applied per *item*. Panel ids migrate
  `activities`→`locations` and `itinerary`→`timeline`. Live work sessions
  (`lib/operation-work-session.ts`) stamp To Do Done, `timeLogs`, and the
  Tracking minute grid from one clock. See `lib/operation-types.ts`,
  `lib/operation-parts.ts`, `components/Operations/README.md`.

## §6 Next Actions / Lists — ✅/🟡
- Renamed **Lists** tab; Win98 file-manager UI — ✅
  `components/Lists/enhanced-list-view.tsx` (orchestrator) + subfolders
  (`hooks/`, `views/`, `list-content/`, `dialogs/`, `toolbar/`) + `filemanager98.css`.
  Grid entry builder: `lib/lists-grid-entries.ts`; open-target reducer: `open-target.ts`.
- Folders, drag-and-drop, smart Home lists (Daily/Weekly/Monthly To-Do + Habits),
  four folder views (Icons/List/Details/Cards), five list display modes — ✅.
- Custom attributes per list (reorderable), CSV import, orb icons + gallery — ✅
  (`attribute-editor.tsx`, `lib/csv.ts`, `lib/orbs-manifest.ts`,
  `lib/lists-ui-store.ts`).
- Per-folder **All Items** uncategorized pool — ✅ `lib/folder-all-items.ts`.
  Right-panel list checkboxes filter which lists appear; **Select all** /
  **Deselect all** mass-toggle those plus Uncategorized (`AllViewCheckboxFilter`).
  Inspector **List Settings** on folder All Items edits view modes on
  `__all-items__{folderId}` (no Delete / Clear / In folders / Connected lists).
  Home / global All uses the same inspector on `__all-items__root` (folder
  inclusion checkboxes in that rail). See
  [`FOLDER_ALL_ITEMS.md`](../components/Lists/FOLDER_ALL_ITEMS.md).
- **Lists panel reused outside the Lists tab** — ✅ an Operation's **To do** panel
  mounts `list-content/ListContentPanel` over a real per-operation list
  (`lib/operation-lists.ts`, filed in an **Operations** folder). Phase steps and
  part stage/finish tasks are filed onto that list, so operation work is
  ordinary items and appears in Lists / All Items / search. Ideas on parts are
  not list items.
- Category shape — ✅ `TaskCategory`; **nested categories / sublists** — ✅
  `parentCategoryId` + `lib/list-tree.ts` (ancestor/descendant/move-cycle
  helpers), nesting rendered in `FolderTree.tsx`/`BreadcrumbNav.tsx`, per-category
  JSON export/import in `settings-dialog.tsx` (`lib/data/backup.ts`) (§6.2).
- **Connected lists** (membership, not nesting) — ✅ `List.linkedTargetListIds`
  + `Task.listMembershipExclusions` (`lib/list-links.ts`). List settings →
  **Connected lists** (`EditListDialog` / `ConnectedListsEditor`). Creating
  A→B copies existing + future source items onto B; a manual remove stays
  off (exclusion); unlink stops future auto-adds without mass-deleting.
  See [`components/Lists/LIST_LINKS.md`](../components/Lists/LIST_LINKS.md).
- **In folders** — ✅ a list may be filed in many folders (`Folder.listIds`,
  not `parentListId`). List Settings → **In folders** (`InFoldersEditor`) with
  searchable multiselect, chips, **Show nested** (inherited ancestors are
  distinct from direct filing). ~600px List Settings dialog. **Clear list**
  (Dangerous actions) removes membership on that list only; items stay in the
  universe. **Delete** the list itself also lives here, not on the inspector rail.
  See [`components/Lists/LIST_FOLDERS.md`](../components/Lists/LIST_FOLDERS.md).
- Completed view, settings, search — ✅. Search clears when the user chooses a
  Quick Access / folder-tree / Up location so they land on that folder, not the
  previous query (`chooseListsLocation`). **Missed Opportunities** is the
  too-late twin of Completed: both are real Next Actions lists
  (`na-smart-completed` / `na-smart-missed`, membership on `Task.lists`). Open
  them from the tree — the old Lists toolbar buttons are gone. Marking missed
  (`status: "missed"`) clears the row from To Do / Next Actions like complete
  does, without points or the completion popup
  (`markMissedOpportunity` in `lib/services/completion-service.ts`). Checklist
  default is one labeled **Completed** tick; extra checkbox variables are
  opt-in in List Settings → View mode settings → Checklist view mode settings.
  Details table columns are chosen in **Details view mode settings**
  (`List.detailsColumns`, independent of Spreadsheet `sheetConfig.columnIds`).
  Details has no complete/missed ticks (Checklist only); Select mode still
  overlays selection checkboxes. Name + Open stay as chrome.
  Ticking Completed opens the reflection dialog before the completion sticks.
  Default display is a reading row (status pip, not a complete checkbox).
  Per-list Default chrome is optional in View mode settings → Default view
  mode settings (`List.defaultView`; unset keeps the built-in look).
- New list rows default to generic `item` (or `list.itemTypeId`); Next Actions
  still creates Tasks. List settings overlay extra/hidden detail panels and
  implied-action rules (`logAction` / `incrementHabit`).
- Points on complete — ✅ `resolveCompletionPoints()` in `lib/item-utils.ts`
  (default 1, or numeric **Points** list attribute).
- §6.5 "to schedule" as a **tag** (not category) — 🟡 tags exist (`Item.tags`,
  `lib/links.ts`); a dedicated "to schedule" tag workflow is not built.

## §7 Scheduler & Calendar — ✅/🟡
- Period funnel Always→Year→Month→Week→Day — ✅
  `components/Scheduler/enhanced-scheduler.tsx`. Shared selection: drag of a
  selected task schedules the whole selection (`taskIdsForDragSchedule`);
  **Deselect all** clears checks only; **Delete** / **Mark complete** act on the
  selection (complete is quiet — no popup stack). Placing a task into a real
  period bucket awards **1 point** when the assignment changes
  (`lib/schedule-credit.ts`); Eventually / Later does not.
- Calendar Month/Week/Day views — ✅ `components/Home/Plan/*`. Month / week /
  day rails share `planned-tasks-sidebar.tsx` (period-planned todos +
  incomplete period habits + Lists **Next Actions** workable in that period,
  search/sort/**To Do / Habits / Next actions** toggles, period add). Day agenda
  drag from the rail **plans** at that time (`lib/plan-drag.ts` `text/plain`
  plus a live payload and pointer fallback onto `[data-plan-drop]`;
  `brain2-planned-actions` placements with notes — not events; habit
  drop does not complete). Click-drag empty minutes or toolbar **Add Plan**
  creates a planned action; click without drag still opens Add Event. Day hour
  rows are 152px. Month cells are
  compact numbered squares. Optional Plan-only dark chrome (`data-plan-dark`,
  persist `brain2-plan-dark`) is a latch — default remains gray Win95. Optional
  **Gem and trinket** mode (`brain2-plan-gem-mode`, `#plan-gem-mode`) is Month
  past-days only: completed daily habits use `resolveTaskGem`, completed list
  items use `iconFor` orbs; events stay chips; default off. Edit Event
  is a bounded Win95 window (title-bar ×, Cancel + Create/Update); dirty close
  uses the house unsaved-changes guard
  (`lib/unsaved-changes.ts` + `components/ui/unsaved-changes-guard.tsx`).
- §7.3 single source of truth — 🟡 scheduling fields shared via task-store;
  panels compute filtered lists independently (`lib/item-utils.ts` helpers).
- Persisted plan text — 🟡 **append log** via `lib/append-log.ts` +
  `lib/plan-text.ts` (`dayPlan-*` / `weekPlan-*` / `monthPlan-*` JSON logs,
  persist-hub writes; unsubmitted `draft` survives refresh; **Submit plan**
  stamps writing time; List / Bulk / Latest). Target is
  MongoDB-backed plan documents (`plans` collection keyed by period).
  Plan log + `planReflection` shown in Reviews — ✅.
- §7.5 Events with linked checklist — ✅ `lib/event-links.ts` derives each linked
  task's `mustBeDoneBefore` from the event date; attach/detach a prerequisite
  checklist in `Home/Plan/event-dialog.tsx`; `agenda-grid.tsx` renders the
  "must be done before <date>" badge + multi-day/all-day banner rows. **Paste
  Events** — ✅ `paste-events-dialog.tsx` + `lib/parse-event-text.ts` turns
  unstructured itinerary text into bulk-editable calendar events.
- §7.6 Auto-scheduling — 🕓 deferred (constraint fields retained on `Task`).
- §7.7 Carry-over logic — 🟡 partial: unfinished periods that have ended roll up
  one level on the funnel (`rollUpExpiredSchedules` on hydrate, local midnight,
  and when the window becomes visible): day → that week, week → that month,
  month → that year, year → fully unscheduled. Prior placements stay on
  `schedulePlacements` for gray past cells and analytics. Automatic roll-up does
  not increment push counters. Tomorrow's stored date becomes Today when that
  date arrives. An explicit push writes the next period and wins. Completed and
  missed stay put. Review and To Do still offer push-forward per task.

## §8 Home Dashboard — ✅/🟡
- Tabbed dashboard (Habits/Plan/To-Do/Goals/**Tracking**) + top bar — ✅
  `components/Home/home-dashboard.tsx`, `app/page.tsx`.
  Global header **today's friend** (`baby-animal-nest.tsx`) is the first
  gamify beat: click the **photograph** for that friend’s details. The **chat
  button** above Gallery asks for a Stardew-style bubble (unmet **daily
  habit**, **today's To Do**, open **Next Action**, affection, or a whim). Click
  the **bubble** for the mission sheet. The task row opens item detail **over
  the sheet**. **Accept** runs until the end of the day for friend points
  (`lib/friend-reward.ts`) and a small cheer; **Decline** asks to break the
  task down, then to do the first step, then for a reason — all logged in
  Details. **Escape**, the bubble close, or a click outside dismisses without
  declining. Request and shuffle live in **Gallery**; **Details** (also the
  photograph) is the friend instrument: lace portrait, bond tubes, voice dial,
  equalizer, tabs (Today, Personality, Keepsakes, Journal), mission card, and
  list-bias beads. The **worn friend persists across refresh**
  (`cogs-friend-worn` pin) and auto-changes only on **Monday**
  or when the user changes it. Returning friends may say **Hi again**. Cutouts
  persist in `cogs-friend-pic:<id>`. A **preapproved pack** (`animalsrcs/` →
  `public/friend-pack/`) seeds unnamed gallery cards you name yourself; shuffle
  picks among those cards. Gallery text fields use navy focus.
  Gallery **Remove** confirms; dismissed friends stay gone. Plan + remaining
  clock / trinkets: [`FRIEND_COMPANION.md`](FRIEND_COMPANION.md).
- **TOP strip** (large weekday + Review due + one Points tile + **Today's Progress** + screen pet + Days Until) — ✅
  shared by **all five** Home tabs. Equal-height tiles (caption + CRT + footer)
  flex up to 200px. Optional affirmation / weather / Next / Day lamp /
  Solar remainder / Tracking now / Night well / Harvest leftover / Inbox mill.
  **Latest award** shows the newest positive ledger row and why (task completion,
  high-completion bonus, habit grades higher than yesterday, weekly habit grades
  higher than last week).
  × asks Are you sure? before hide. The weekday plate is the clock's date.
  Centered CRT numerals, three Habits tints, shared `--hab-crt-green`.
  All time / today / week / month share one Points tile. **Widgets** sits in
  the corner of the large weekday plate. Click a tile for a silver handheld: dark wells, nixie digits, chunky keys.
  `home-overview.tsx` + `home-widgets-menu.tsx` + `home-widget-dialog.tsx` +
  `lib/home-widgets-store.ts`.
  See [`DESIGN_STYLE.md`](DESIGN_STYLE.md#depth--spacing).
- **Today's Progress** quickview (to-do + habit completion) — ✅
  `daily-progress-quickview.tsx` as a hidable tile on every Home tab (meters
  in the CRT, one footer line).
- Points stats — ✅ `components/Home/points-stats.tsx`. One hidable Points tile
  on every Home tab (all time, today, week, month). Cards and the instrument
  quad still list the four periods.
- §8.4 To-Do tiers + overdue — ✅ `components/Home/ToDo/todo-panel.tsx`.
  **Done** also includes Operation **Working on this now** sessions as
  `worked on {name}` (`lib/operation-work-session.ts`).
- §8.7 Review entry points — ✅ header Review button with a pending badge
  **plus** a Home overview **Review due** square
  (`components/Home/home-review-banner.tsx`) with Start review / Dismiss.

## §9 Habit Tracker — ✅/🟡
- Five habit types, week/day grid, daily/weekly/monthly frequency tabs,
  per-day/per-week % — ✅ `components/Home/Habits/*`, `lib/calculations.ts`,
  `lib/incremental-habits.ts`. Climb (`INCREMENTAL`) has two cadences: **weekly +**
  (goal-like target; rises Monday only after ≥4 hits last week) and **daily +**
  (log a running score; next day’s target = last log + increment, including drops).
  Completions persist as `TaskCompletion.value`. Meeting a habit goal also writes
  a `loggedAction` Done row (`lib/habit-done-log.ts`) for that day/week/month,
  carrying a derived **duration and clock window** rather than the old noon stamp.
  Daily tab **Week grade** is the mean of elapsed days' overall % after an
  optional daily curve (`gradeTolerance`: raw % that counts as 100; **0% stays 0**).
  Click the grade for a raw-vs-curved breakdown (scrollable; notes 50-pt habits,
  the user accomplishment bonus, 75% bonuses, and the grade-lift bonuses). Optional **50% floor** from
  prioritized habits (`lib/habit-priority.ts`; toggles in the grade / Good-day
  dialogs). **Perfect output** is a second, independent
  grade: mean of each habit's elapsed-paced row % (`outputGradeTolerance`, same
  curve formula, zeros not lifted). Grid week % still uses /7. Daily rows show 4+ day **week streaks**
  without changing climb bump rules. Per-habit week % and the daily-completion
  row are a quiet 10-pip milled channel by default (`percent-led-bar.tsx`) or a smaller
  numeric LED (`percent-led.tsx`; rail **Loading Bar**; tint `percentLedTint` in
  Habits Settings). Yes/No cells are recessed panel lamps (tint as on-color, not blast-white). Daily **Day View** shows today + week % only. Daily habits upsert **50 × completion
  ratio** plus a user **accomplishment bonus** when that day's raw score meets
  `accomplishmentThreshold` (default ≥80% → +50; Settings / Good days dialog), **+100 / +300**
  grade bonuses, and editable lift bonuses when grades beat yesterday or last week (`lib/habit-points.ts`). **Good day streak** and **Good days in the last month**
  (previous 30 days at/above the threshold) sit in the Daily Habits Tab Control Panel, not in a header strip
  (`lib/habit-accomplishment.ts`). Weekly and Monthly tabs use the same compact
  spreadsheet (7 weeks or 7 months), row % LEDs, period-completion footer, **Span grade**
  (mean of elapsed period columns) and **Perfect output**. Daily **New habit** is on
  the Habits Tab Control Panel on every tab. Optional Daily **heatmap** (sidebar Heatmap View rocker)
  with infinite scroll into the past, jewelry cells in the **same light metal well**
  as the checklist, a **Sort Habits** custom plate above grouped Heatmap View /
  **Day View** / **Hide Completed Today** (persisted) / **Loading Bar** / **Small LEDs** rockers, today as a **solid** mint fill, and noble-gas tubes for Week/Span
  grade and Perfect output (Willpower gems stay a crystal, plate pinned to the control panel
  foot). One inset gem/edit sits far left;
  the title wraps with streak/× under it; Delete is in habit settings.
  **Willpower gems:** completed daily-habit gems collect small around the plate
  all week (derived from completions); the row gem inverts while contributing;
  plate click stirs; grab/lift throws; photograph change is Settings-only.
  See
  [`components/Home/Habits/README.md`](../components/Home/Habits/README.md#daily-layout--chrome-intent).
- Shared store — ✅ `lib/habits-store.ts` persist **v20** (exemption wand: automatic pre-creation waivers, all-nighter `logExemptions`, plus explicit `habitExemptions`; sleep-clock and next-action list connections; sort direction; **v19** `contentRev` for titles/details/completions/overrides; hollow live maps overlay disk completions so grades keep paint; **`hideCompletedToday`** also hides exempt rows; calm Willpower physics defaults; control panel width pinned compact;
  persist **v16** `habitsControlPanelWidth` / physics lab; persist **v15** (`habitSmallLeds` default on;
  persist **v14** `gradeTubeColor` /
  `outputGradeTubeColor` discharge hues for Week/Span vs Perfect output tubes;
  persist **v13** random catalog
  `WeeklyTask.gem` stamp for habits that lacked one; user-picked gems kept;
  `habitDayView` +
  `percentLoadingBar` + `percentLedTint` +
  `habitSortMode` +
  `gradeTolerance` +
  `outputGradeTolerance` + `accomplishmentThreshold` / `accomplishmentBonus` +
  priority blend toggles + heatmap/sort prefs; Home +
  Lists Daily Habits read/write the same data; v3 split legacy multi-metric climbs).
  Per-habit `WeeklyTask.gem` is a persisted catalog path or upload (not a type/category default). The catalog is every tight-cropped file in `public/gems-removebackground/`.
- §9.4 completion records keyed by ISO/local date — ✅ (`WeeklyData` keyed by
  date string). **Gap:** not a DB record; habits are `WeeklyTask`, not a unified
  `Habit` item.
- §9.5 Streaks — ✅ `lib/streaks.ts` + Analytics **Streaks** tab
  (`components/Analytics/StreaksWidget.tsx`); climb days use the derived target.
- **Habit time estimates** — ✅ `WeeklyTask.timeEstimate` (Add/Edit Habit →
  *Time estimate*): minutes per unit of the goal (10 min per page) or a flat length
  per completion, with an `estimated` / `definite` precision flag. `lib/habit-time-estimate.ts`
  derives the duration from the best evidence — the habit's own minutes/hours value,
  painted Tracking minutes, then the rate — and `lib/completion-window.ts` places it
  in the day. Everything assumed is flagged for confirmation (see §13).
- **Auto-fill from Tracking** — ✅ GOAL/BOOLEAN habits (daily, weekly, or monthly)
  can link TimeGrid **tags** (Add/Edit Habit → *Auto-fill from Tracking*) so tagged
  minutes count toward the goal with no manual entry. Daily habits use that day’s
  minutes; weekly/monthly habits **sum** tagged minutes across the week or calendar
  month. `TaskCompletion` keeps `manualValue` and `trackedValue` apart, so
  repainting recomputes instead of accumulating and erasing time withdraws it;
  `value` stays the combined number every other calculation already reads.
  Climb/Text habits are excluded (`supportsTrackingLink`). An Operation can carry
  the same tags, so **Working on this now** paints minutes the habit already knows
  how to count. A tag pinned to a single block counts identically to a pen tag, and
  a logged sleep night feeds a Sleep-tagged habit with no sleep-specific code in
  the habit path. See §12.

## §10 Goals & Objectives — ✅/🟡
- **Objectives** — ✅ all-time aspirational directions (`Objective` entity, 26 seeded)
  that can be **prioritized per period** (day/week/month/year) with custom point
  multipliers (caps: 3/day-week-month, 5/year) and written period **reviews**.
  `Home/Goals/ObjectivesPanel.tsx` + `ObjectiveDetailDialog.tsx`.
- **Goals** — ✅ quantifiable metrics (`count|boolean|numerical`, period kinds incl.
  custom ranges) that each serve ≥1 objective. `Home/Goals/GoalsContainer.tsx`.
- **Contributions & multipliers** — ✅ tasks carry `contributesTo{Objective,Goal}Ids`;
  the global completion popup (`components/Completion/`) advances goals and awards a
  **stacking** objective multiplier (1.5× default, or a prioritized objective's custom
  value) via `lib/goals-store.ts` (`taskObjectiveMultiplier`). **Undo** on that popup
  reopens the task (`uncompleteTask`) and drops that day's base points; **Skip** keeps
  the completion without recording a contribution.
- **Direction in life** — ✅ `lib/objectives.ts` coverage (neglected goals, drift days)
  + `Home/Goals/DirectionReport.tsx`. Persisted in `lib/goals-store.ts` (persist v3).
- **Gap:** no **auto-progress** (a goal advancing itself from linked item/habit
  activity without the completion popup) and no **penalties** for a neglected
  goal. Progress today is written by explicit contributions; the Direction report
  only *reports* drift. This is the §10 line in the root README's gap list.

## §11 Modules — ✅ (spec §8 extension)
- User-composed dashboard **widgets** — ✅ `components/Modules/modules-panel.tsx`,
  `lib/modules-store.ts` (list-explorer, writing-prompt, random-task,
  list-summary, analytics-stat, rules).
- User-composed **workspaces** (full-screen mini-apps) — ✅ a workspace is a
  `ModuleInstance` with `kind: "workspace"` + bound `views[]`. Each view binds a
  source **list** to a presentation: editable **spreadsheet** (`SheetGrid`),
  **agenda**, **summary** (group-by + sum rollups), **randomizer** (pick-N +
  timer), **timer**, **checklist**, **gallery**, **stat**, **notes**,
  **decision-matrix**, **kanban**, **timeline**, **matcher** (link one list to
  another via `lib/book-match.ts`), **quiz**, **dashboard** (optional-inclusion
  rollup cards), plus Trip Itinerary **doc** (Docs editor), **itinerary-doc**
  (printable day blocks via `lib/itinerary-assemble.ts` / `lib/trip-itinerary.ts`),
  **trip-map** (Leaflet + Open-Meteo `lib/city-search.ts` / Photon `lib/places-search.ts`, cached in `lib/api-cache.ts`), **film-dna** (Film DNA
  Lab), **house-cleaning** (Tidy house-cleaning app), and **grad-search** (GradSearch
  program explorer — the standalone app, shadow-DOM mounted, full bundled catalog). Built/edited with `workspace/ModuleViewEditor.tsx`;
  the per-kind dispatch is `workspace/module-view-bodies.tsx`; itinerary-specific
  bodies live under `workspace/itinerary/`; Film DNA under `workspace/filmrecs/`;
  Tidy under `workspace/housecleaning/`; GradSearch under `workspace/gradsearch/`;
  rendered by
  `workspace/ModuleWorkspace.tsx` and **drag-reorderable**.
- **Templates** (`lib/module-templates.ts`) scaffold lists + attribute schemas +
  seed data + views + seeded workflows in one click: **Itinerary Creator** (Plan
  doc + printable Itinerary + Activities map + City Places + packing/pretrip
  checklists; print/export; on-Finalized workflow → **Sync to Plan**
  (`lib/module-plan-sync.ts`); older
  workspaces upgraded via `lib/itinerary-migrate.ts`), **Budget Tracker**
  (optional-inclusion rollup **dashboard**: liquid / net worth / expected spend /
  payments), **Book Tasting** (PDF→book **matcher** + **quiz** over `file`
  attributes with extracted text), **Film DNA Lab** (`film-dna` shelves /
  Watch ranking / Blend / Letterboxd import), and **House Cleaning App** (Tidy
  `house-cleaning` view), and **GradSearch** (`grad-search` explorer over the bundled
  catalog). This realizes the "custom-module platform" ambition on the unified Item model.
- **Build-from-scratch + definitions** — ✅ `ModuleBuilderDialog` offers build
  from scratch, saved **definitions**, or templates; `ModuleSettingsDialog` /
  `ModuleListsPanel` author a serializable `ModuleDefinition` stored in
  `lib/module-definitions.ts`; definitions instantiate into runnable workspaces and
  export/import via `lib/data/backup.ts`.
- **Workflow engine ("rules ACT")** — ✅ authored `WorkflowDefinition`s
  (`WorkflowBuilder`/`WorkflowStepEditor` → `lib/workflows-store.ts`) run on real
  item mutations via `lib/workflow-engine.ts`, wired through the
  `lib/workflow-hooks.ts` seam by `lib/services/item-mutation-service.ts`
  (`initWorkflowEngine` installed once on client mount in `app/page.tsx`, idempotent
  + SSR/static-export safe). Triggers (create/update/complete, attribute change,
  manual, schedule), conditions, and ordered actions.
- **Pop-out windows** — ✅ a workspace opens standalone at `/popout/?module=<id>`
  (`ModulePopoutView`, no app header/tabs); Electron uses a real `BrowserWindow` via
  `cogs:window:openModulePopout`, the browser falls back to `window.open`. Legacy
  `#popout/module/<id>` hashes still parse.
- **File / PDF attributes** — ✅ `file`/`multifile` (`FileValue`) attribute types
  (`components/Lists/attributes/**`) with PDF text extraction (`lib/file-extract.ts`
  + Electron `cogs:file:extractPdfText` / `pdf-parse`), plus catalog **Book** /
  **Flight** / Furniture / Resource / Shopping item types. Itinerary weather uses `lib/weather-client.ts`.
- **Module platform foundation (Phase 0)** — ✅ shared serializable contract in
  `lib/types.ts`: `ModuleDefinition`, `WorkflowDefinition`/`WorkflowTrigger`/
  `WorkflowAction`, and `FileValue` + `file`/`multifile` types; the dependency-free
  mutation seam in `lib/workflow-hooks.ts`.
- **Gap:** richer per-view filtering UI and a visual workflow graph are still thin.
- **Gap vs the north star** ([`MODULE_PLATFORM.md`](MODULE_PLATFORM.md)): there is
  no **module manifest**, no **bridge-grant** model, and no **install / port
  wizard** — so a module is *composed* in-app rather than *installed* from an
  arbitrary `.tsx` app. The LLM-assisted mapping step (rung 4) depends on the
  manifest landing first. Prerequisites are a single honest `Item` (§5,
  [`CANONICAL_FIELDS.md`](CANONICAL_FIELDS.md)) and one write path.
- **Violation of the Item model (partially bridged):** `module.config.houseCleaning`
  (`lib/house-cleaning.ts`) and `module.config.tripItinerary`
  (`lib/trip-itinerary.ts`) still store domain records *outside* the Item graph
  (Tidy/Trip remain the write source). **Module Lists import**
  (`lib/module-list-import.ts`) now **projects** those trees into nested lists
  and items (Tidy: Whole house → area sublists with priority, estimates, actuals,
  completed, `parentTaskId` subtasks; Trip: Itinerary → day lists). Lists, search,
  and Analytics can see the projection; two-way sync is still the north-star
  payoff. Field map: [`components/Lists/MODULE_LISTS.md`](../components/Lists/MODULE_LISTS.md).
  Tracked as debt, not as a pattern to copy.

## §12 Tracking / Activity Log — 🟡
- TimeGrid minute painter — ✅ `lib/time-entries.ts` (interval model) +
  `lib/time-tracking-store.ts` + `components/Home/Tracking/time-grid.tsx`; header
  **Tracking** button opens the same grid in a dialog (`cognitive-state.tsx`).
  Time is stored as minute-resolution intervals; **cell size** (1/5/10/15/30 min) is
  a rendering choice that never regroups stored time. Persist v4 migrates the old
  15-minute slot arrays. Cell size **1m / 5m / 10m / 15m / 30m** sits on the Time
  Grid chrome next to Day/Week/Infinite (not only in View settings); the live
  step is navy inset with a phosphor cap so the buttons show the current size.
- **Time Grid Fill** — ✅ `fill-range-control.tsx` + `empty-blocks.ts`. Defaults
  to the **longest empty (untracked) block** of the viewed day. Multiple gaps
  list **chronologically**; `<` `>` cycle them (longest is the default
  selection; arrows disabled at the ends). **Double-click** start or end for
  the clock picker. Sleep/tracked cells are not empty. Midnight wrap is one
  gap when both ends of the day are empty. View-settings **Day fill starts/ends**
  are the fallback when the day is fully untracked; a fully tracked day
  disables Fill. Week fill prefs are unchanged.
- **Now line + sunrise/sunset** — ✅ `trk-time-markers.tsx`. Red now line at the
  current minute on today; gray sunrise/sunset from Settings home location **for
  that calendar day**. Persisted per day in `lib/sun-times-store.ts`
  (`brain2-sun-times`, key `YYYY-MM-DD|lat|lng`); first write wins so historical
  rows are not overwritten with today's clock. Astronomy is `lib/sun-times.ts`.
  **Do not remove.** Day grid draws them **horizontally** across the plot (same
  clock as Plan agenda / Day Log); discrete events stay vertical ticks at the
  logged minute. Week/Infinite draw now/sun on that view's axis, looking up the
  row's date.
- **Day notes** — ✅ `tracking-day-notes.tsx` + `lib/day-notes-persist.ts`
  (`brain2-tracking-day-notes`). **Append log** (`lib/append-log.ts`): Submit
  note stamps the writing time; List / Bulk / Latest; past entries cannot be
  edited. Collapsed hides the log (legend + Expand only). Expand opens a tall
  composer and tall history (`notesWellExpanded`). Dedicated key, not rewritten into the huge timegrid blob per submit.
  Once this profile has the key, it wins over a hub map with more historical days.
  Both aliases are read and **unioned by entry id**; a write that failed on a full
  origin is reported in the well instead of showing a stamped entry that is only
  in memory.
- **Day / week spans** — ✅ `components/Home/Tracking/week-grid.tsx` behind a
  two-button switch on the grid, with the pen palette
  (`components/Home/Tracking/pen-palette.tsx`) shared between them so a selection
  survives the change. Optional **Infinite scroll** toggle next to Day/Week
  on the grid toolbar (not View settings) is one continuous looking: time
  left-to-right, day rows with week bands, hour labels sticky. Origin is frozen
  at mount; picking a day does not rebuild the list. Double-click a day tile
  to open that paged day; double-click a week band to open that paged week
  (`infinite-strip.tsx`, `infinite-window.ts`). Time Grid / Activity Log /
  Day Log share Habits' `.hab-view-changer` chrome.
  A week is seven columns at 15/30/60-minute cells, painting
  the same intervals into the same store and totalled by the same
  `lib/tracking-summary.ts`. A stroke stays in the column it began in; a typed
  range fills every ticked day at once (**Mon–Fri** in one press), which is what
  makes catching up on a routine practical; each column reports its own total and
  can be cleared on its own; a date heading drops back into the day view on that
  date. **Zoom-out (not implemented):** a later pass should show category-colored
  month/year blocks on the same interval store — do not build it until Infinite
  scroll stays still.
- **Activity Log** — ✅ `components/Home/Tracking/tracking-activity-log.tsx`
  lists every block of the day with its times, duration, variants, title and the
  tags it feeds, shows untracked gaps as one aligned row (time, Untracked · duration,
  white note, Fill, 22px `.trk-gap-add` **+**), **Log activity** once on this tab’s `.trk-period` (Time Grid / Day Log keep the grid-rail latch next to TIME/DIV / view modes; optional name, notes, optional **Date** on start/end, **right now** on a focused clock, and **discrete events** with one clock time that can
  start or end a state block), and **Done this day** (To Do items finished on this
  calendar day — listed as reconstruction hints, not auto-painted). Every row
  opens the block editor. A block may carry an optional **display name** (`TimeEntry.title`; empty
  falls back to the primary pen) and **secondary pens** (`secondaryPenIds`; older
  vaults omit this — primary only). Grid color stays the primary. Tags from every
  assigned pen feed habits / operations / goals. A block may be marked
  **assumed / reconstructed** (`TimeEntry.precision`);
  new strokes are certain.
- **Day Log** — ✅ `components/Home/Tracking/actual-day-view.tsx` with a local
  **Day \| Week** switch (default Day; not persisted). **Day** overlays the same
  painted intervals on the planned agenda (`AgendaGrid` log mode, `trackedBlocks`).
  **Week** (`daylog-week.tsx`) is a compact seven-column plan-vs-tracked board for
  the week of the selected date — not Time Grid `week-grid.tsx`; period nav steps
  by week; a column date heading opens that day. Ghosts are the Plan — click to
  **confirm** (paint + optional notes; tasks go through `completeTask` so
  dependents unlock). Solid pen-colored blocks are Tracking; a multi-hour stretch
  in day mode is one continuous slab (title once, still clickable in every hour).
  Amber blocks are task `timeLogs`. Paint strip follows the selected day. Date
  keys are local calendar days.
- **Day notes** — ✅ `components/Home/Tracking/tracking-day-notes.tsx`. Append
  log per local calendar day (`components/append-log.tsx`). **Submit note**
  stamps writing time; List / Bulk / Latest; leftover plaintext migrates as one
  "earlier" entry. Collapsed hides the log (Day notes legend + Expand only — no
  composer, history, or view keys). Expand opens a tall composer and tall history
  in `.append-log-history` (`notesWellExpanded` on `brain2-tracking-view-prefs`).
  Source of truth is `brain2-tracking-day-notes`
  (`lib/day-notes-persist.ts`), written on submit and shown under Time Grid,
  Activity Log, and Day Log. Mirrored into `cogs-timegrid-store.dayNotes`
  (persist v5). A hub pick of painted intervals cannot wipe the dedicated key;
  persist merge + vault-guard overlay copy that map back onto the timegrid blob.
  Reads union `brain2-` and `cogs-` (immutable, id'd entries), so a pair split by
  a quota-failed write heals instead of hiding the newest note; a failed write
  shows **this note is only in memory** in the well (`.trk-notes-unsaved`).
- **Consistent totals across views** — ✅ `lib/tracking-summary.ts` is the only
  place time is rolled up; Time Grid, Activity Log, Day Log and the Analytics
  Tracking tab all read it. Occupancy is a **union**. Pen totals respect
  `displayDepth`. `withPrecision` drops assumed blocks when Analytics **Include
  assumed** is off.
- Views (Activity / Location / Mood / **Company** / **Screen Time** / **iPhone
  Screen Time** / **iPhone Calls** / **iPhone Texts**) with configurable pens — ✅.
  Company is who you were with (Alone / Together / In conversation), not an
  Activity called hanging out. **Screen Time** (persist **v11**) is ActivityWatch
  meaning on its own scope (`id === "screentime"` or name "screen time"): category
  roots Work / Communication / Browsing / Media / System / Other, apps as child
  pens, AFK untracked (window ∩ not-afk). It does **not** switch `activeScopeId`
  on migrate, does not paint Activity/Location/Mood/Company, and does not embed
  aw-server. ActivityWatch only records from when its watchers run (no Apple
  Screen Time / pre-install import). A reachable sync with 0 blocks is success.
  Prefs: `brain2-screentime-prefs` (includes honest `lastSyncNote`). Sync: `lib/screentime/` +
  `window.desktop.fetchScreenTime` / loopback `/api/screentime`. Analytics Time
  tab **Screen Time**. Persist **v12** appends **iPhone Screen Time** (Telegram /
  AirDrop `Screen Time to Brain2.shortcut` Ask-for-app pings, estimated, no AW stamp), **iPhone Calls** (people
  pens, intervals; AirDrop `iPhone Call to Brain2.shortcut`), and **iPhone Texts** (people pens, instants; AirDrop `iPhone Text to Brain2.shortcut`) without
  switching `activeScopeId`. Phone is not Apple Screen Time / Recents / Messages
  export. New views are named inline in the palette
  (`window.prompt` does not work in Electron). Pens nest via `parentId`
  (`lib/pen-tree.ts`); **Show as** sets `displayDepth` (Exact by default). Nesting
  is retroactive. **Counts as** in pen settings is a searchable retro control with
  **Create new pen** and a collapsible color chain (this pen → parents; on a parent,
  pens that roll up to it). One parent only — **multiselect / parallel counts-as
  chains are planned, not implemented**. The palette **Sort** is Recent (default), A–Z, or Tree
  (`lib/pen-sort.ts`; persist **v7** stamps `lastUsedAt` from existing paint).
  Persist **v6** added Company, parents, and depth.
- **Pen variants (sub-categorization)** — ✅ overlapping labels *inside* one pen.
  Parents are for *is-a* rollup; variants are for several labels true at once.
  Analytics drills children first, then Split / Reach variants.
- **Block display name** — ✅ `TimeEntry.title` is an optional label for one
  block ("walk to the beach" on a block of *walking*). It changes what surfaces
  print, never what anything counts: rollups, tags, habits and Analytics all
  still read pens and tags. Blank falls back to the pen's name
  (`entryDisplayName`, `lib/time-entries.ts`), so the common case needs no typing.
- **Several pens on one block, one primary** — ✅ `TimeEntry.penId` is the
  **primary** (the color the grid draws) and `TimeEntry.secondaryPenIds` are
  extra pens over the same minutes — a red *youtube* block that is also gray
  *studying spanish*. Secondaries are **not cosmetic**: `effectiveTagIds`
  (`lib/tracked-time.ts`) unions the tags of every assigned pen
  (`assignedPenIds`), so the block reaches every habit, tag, operation and goal
  that *any* of its pens feeds, through the existing
  `tracked-time` → `habit-tracking` → `habit-tracking-sync` pipeline. No
  migration is needed: an older block simply has no `secondaryPenIds`, which
  means "primary only". UI: `components/Home/Tracking/secondary-pens-field.tsx`
  behind **add pen color** in the block editor (`block-pen-section.tsx` shows
  only pens already on the block until then).
- **Counts as — explained, searchable, and drawn** — ✅ three changes to pen
  nesting, all over the existing `parentId`:
  1. The copy now says what nesting actually does — painting still writes *this*
     pen; the grid and Analytics may roll it up to the parent — instead of
     implying that "Ocean Beach counts as San Diego" relabels the time.
  2. The native `<select>` is replaced by
     `components/Home/Tracking/pen-parent-picker.tsx`: a sunken Win95 field that
     filters as you type and offers **Create new pen…**, so a pen can be nested
     under a parent that does not exist yet.
  3. `components/Home/Tracking/pen-chain-visual.tsx` draws the chain in the
     pens' own colors — Home → Ocean Beach → San Diego — with the current pen
     marked and every node clickable through to that pen's settings. On a
     parent it also branches out every pen that counts as it. Collapsible.
  Reference: [`docs/COUNTS_AS.md`](./COUNTS_AS.md).
- **Default action format** — ✅ a pen can carry `actionFormats`, templates that
  turn a painted block into a **Done today** row: paint 1:00–1:15 of *Walking*
  and "Went for a walk" appears in To-Do Done. Templates take variables filled
  from the data (`{minutes}` `{hours}` `{duration}` `{location}` `{project}`
  `{start}` `{end}` `{name}`), and the **most specific template whose variables
  are all present wins** — so "went for an {x} minute walk at {location}" is
  used when the Location scope covers those minutes and "went for an {x} minute
  walk" when it does not. Two templates with the same placeholder count **tie
  on list order** (first listed wins); drag-to-reorder is not built yet.
  Create, retime, relocate, reproject or delete the
  block and the Done row follows; a title the user edited by hand is left
  alone. `lib/pen-action-format.ts` (pure) + `lib/pen-action-sync.ts` (store →
  `taskRepository` bridge, deterministic `pen-action-<id>` ids) +
  `components/Home/Tracking/pen-action-format-editor.tsx`. Separate from habit
  tag links: this names an action, tags feed a goal.
  Reference: [`docs/PEN_ACTION_FORMATS.md`](./PEN_ACTION_FORMATS.md).
- **Planned, not implemented — parallel counts-as.** A pen counts as exactly
  one parent (`parentId`). Multiselect, so a pen can roll up along two chains at
  once, is designed for but deliberately unbuilt; keep `parentId` a single nest
  so the model stays extensible. See [`docs/COUNTS_AS.md`](./COUNTS_AS.md#planned-parallel-counts-as-chains).
- **Planned, not implemented — hide / show / search / index.** Using block
  names, secondary pens and action formats to filter and index the Tracker and
  the Analytics Tracking tab is the stated next step. Nothing ships this pass.
- **Tags belong to time, not to pens** — ✅ `effectiveTagIds` (`lib/tracked-time.ts`)
  makes a block's tags the union of **every assigned pen's** standing tags (primary
  plus secondaries) and any pinned to that
  block alone (`TimeEntry.tagIds`, set from the block editor). Four hours of
  *San Diego Zoo* in the **Location** scope can count as *Exercise* without every
  zoo visit doing so, and the minutes reach habits and analytics exactly as a pen
  tag would. Analytics → Tracking → **By tag** → click a tag shows which pens, in
  which scopes, fed it. A block tag can be promoted to the pen ("always tag X as
  Y") from the same dialog.
- **Scopes attachable to each other** — ✅ `lib/entry-links.ts` + the **Also
  happening** section of the block editor (`components/Home/Tracking/companion-section.tsx`).
  Clicking a block shows what every other scope says about those exact minutes and
  fills in what they are missing in one click: *Ian's House* 1–5pm becomes *Social*
  too, with the party's guest list ticked off through the companion's variants
  without leaving the dialog. Attachments are one-offs by default and can be
  promoted to a standing `PenLink` on the pen, which then fires on each future
  stroke (`paintMinutes` → `applyPenLinks`). Suggestions come from the user's own
  history of co-painting two pens, not from heuristics. **An attachment only ever
  fills minutes the other scope left blank**, so a rule can never overwrite a
  statement. Deleting a scope, pen or variant prunes the links pointing at it.
- **Tagged time feeds the habit tracker** — ✅ a daily GOAL/BOOLEAN habit carries
  a `trackingLink` (tag ids, minutes/hours, add·max·replace, optional threshold);
  minutes carrying a linked tag — from any pen, in any scope, whether the tag came
  from the pen or from that one block — land on that day's completion.
  Minutes are unioned across scopes so a doubly-tagged minute counts once.
  `lib/tracked-time.ts` (rollups) → `lib/habit-tracking.ts` (pure link math) →
  `lib/habit-tracking-sync.ts` (store bridge) → `habits-store.applyTrackedValue`.
  Tracked and manual contributions live in separate fields on `TaskCompletion`,
  so the sync is idempotent and reversible. See §9.
- **Operations → Tracking** — ✅ **Working on this now** on an operation (also
  Home → Tracking and the header Tracking dialog) paints a minute-accurate
  Activity block for the live session and, on stop, writes `worked on {name}`
  into To Do Done plus `timeLogs` on the operation. The block stays editable.
  Operation Settings tags are the same library habits link. See
  `lib/operation-work-session.ts`. Home → Tracking also has **Working on right
  now** for a searched pen color (`lib/pen-color-session.ts`): the timer starts
  at the current second and paints a block of that color until stop. It does
  not write a Done row and does not replace the Operations clock.
- **Sleep / wake log** — ✅ `lib/sleep-log.ts` (pure model) + `lib/sleep-store.ts`
  (`cogs-sleep-store`) + `lib/sleep-sync.ts` (derivation). Tracking no longer
  shows a **Sleep this day** / Fell asleep / Woke up form; nights are painted on
  the Time Grid, edited in the block editor, or typed in Morning Review. Storage
  is still keyed by **the morning it ended**, with signed minutes from that
  midnight, so duration is a subtraction. Clocks typed on a calendar day belong
  to that day (`placeAsleepOnDay` / `placeAwakeOnDay`): 1 AM Thursday is
  Thursday's night, 10 PM Thursday is Friday's. Filling both ends derives painted
  Sleep blocks split at midnight (stamped `generatedBy`), a deterministic Done
  row, and — through the ordinary tag path — habit minutes. Each end is marked
  **estimated** or **certain**. Morning Review still uses the noon-pivot
  `parseBedtime` against the morning you woke into.
- **Nights read off the grid** — ✅ `lib/sleep-inference.ts`. Sleep painted
  directly on the grid — anything carrying the Sleep tag, in any scope, from a pen
  tag or a block tag — is reconstructed into a night: a run touching midnight on
  each side, or a long stretch in the small hours. `resolveNights` reconciles
  stated and painted **per end**, so a typed bedtime always wins and a missing one
  is borrowed and marked estimated. Blocks the log itself generated are excluded,
  so it cannot read its own output back as evidence.
- **A night corrected from the grid** — ✅ `reconcileNightFromGrid`
  (`lib/sleep-sync.ts`) + `nightFromGeneratedBlocks` (`lib/sleep-inference.ts`).
  Derived sleep blocks are ordinary blocks: retiming, splitting or deleting one
  reads the night back out of them and corrects the log, which re-writes the Done
  row, the habit minutes and the Sleep tab — so the tracker and Analytics cannot
  describe the same night differently, and a grid edit is no longer silently
  reverted. The ends taken are the outermost, since a one-interval night cannot
  hold a wakeful hour; confidence is untouched, because moving a block says
  nothing about how well a time is remembered; and a log whose nights were never
  paintable is never emptied by a grid that was always silent. A `deriving` latch
  keeps the two directions from chasing each other.
- **Sleep respected app-wide** — ✅ Morning Review's time fields are a view onto
  the same log rather than a second copy (its `wakeTime` was previously write-only),
  and open pre-filled from the grid when nothing was typed. `lib/completion-window.ts`
  takes half an hour before that night's bedtime — stated, painted, or the user's
  median over the last month (`typicalSleepWindow`) — in preference to the fixed
  day anchor, says which of those it used in the basis line, and never backdates a
  window into hours the user was asleep. Settings → **Default time of day** reports
  what is actually in force. The Tracking strip offers the same derivation as a
  one-click **Fill**, rather than applying it silently.
- **Sleep analytics** — ✅ `components/Analytics/SleepAnalytics.tsx` (Analytics →
  **Sleep**), reading logged and painted nights alike: average/median duration per
  night tracked, average bedtime and wake time, the standard deviation of each end
  as a regularity measure, the **earliest and latest** bedtime and wake time with
  their dates, debt against a nightly target, a night-by-night chart on a fixed
  6 PM → noon axis, and a later-half vs earlier-half trend that declines to compare
  fewer than two nights per half. **Against the sun** times sleep onset against
  that evening's sunset and wake against that morning's sunrise (minutes before/after,
  per night plus median), from persisted per-day sun — not today's clock on every
  night. Productivity / joy around the sun is left for a later cut. Blank nights,
  estimated nights and nights read
  off the grid are each reported rather than hidden, and sleep that is not a night
  — a nap, or time running past the night as logged (`straySleep`) — is counted
  under the chart instead of being averaged in or dropped. The tab follows edits
  made to sleep blocks on the grid, since those correct the log itself.
- **Gap vs §12.2/12.4:** `TimeEntry` still differs from the spec's `LogEntry`
  (no `nextPlanned`, no structured geo, no `source` field) and is not a unified
  `log` Item — though it now has the identity, span, detail fields, midnight-crossing
  `spanId` slices, and edit surface the spec assumes. Old `tracking-store.ts` /
  slider form removed.
- **Gap:** autolog pipelines that would paint assumed blocks from Done items,
  ingest, or other app evidence onto **Activity** are not implemented. Activity Log already *lists*
  Done-for-day as reconstruction hints; those minutes are not written to the grid.
  **Screen Time** (ActivityWatch, own scope) is the exception — estimated blocks
  stamped `generatedBy.kind === "screentime"`. Phone ingest paints **iPhone
  Screen Time / Calls / Texts** as estimated / instants without that stamp (Mac
  AW replace cannot delete them). Not Apple Screen Time, Recents, or Messages
  export. No Scolect import.

## §13 Reviews — 🟡
- Period reviews — 🟡 `components/Reviews/reviews.tsx` + `lib/reviews-store.ts`.
  Supports day/week/month/quarter/year with carry-over prompts, gratitude,
  reflection questions, saved plan text, and `planReflection`.
- **Morning review ritual** — ✅ `components/Reviews/MorningReview.tsx` +
  BIM `gm` (`lib/ingest/apply-morning-gm.ts`). `PeriodReview.morning`: all-nighter
  (lifts habits whose settings carry an all-nighter block — bedtime the evening
  before, wake and dream that morning),
  wake/dream (when slept), affirmations, to-dos added, 3–5 priorities, 1–3 habit
  priorities, day-plan flag, circumstance branches (must-do / must-not / events /
  excitement), best-day why, gratitude; `source` labels text-pipeline vs desktop.
  After priorities: go-through to-do six-slot walk (`lib/morning-todo-walk.ts` →
  task tier/duration/points + `dayRatings` + `resistanceReadings`) and plaintext
  day plan (Plan log; Telegram stamps **from text**). Surfaced from the Review
  header, Home → To Do / Habits morning priority bands, Analytics → Reviews +
  To-do pulse. Sleep clocks read/write `lib/sleep-store.ts` (all-nighter tracked
  there too for Analytics → Sleep). See §12.
- **Structured "why blocked/skipped" reasons** — ✅ `BlockedReason` +
  `PeriodReview.blockedReasons` captured in the carry-over step.
- **Assumed-time confirmation** — ✅ `components/Reviews/AssumedTimesSection.tsx`.
  Autogenerated time data is never presented as observed: each derived value carries
  a `FieldEstimate` (`Task.estimates`, `lib/estimated-values.ts`) naming the field,
  how it was produced, and its basis. The day/week/month review lists the period's
  unconfirmed ones for correction or bulk **Confirm all as-is**
  (`lib/services/completion-time-service.ts`); the same rows expose an **est.** chip
  in Home → To Do → Done. Confirmation is sticky, so the habit sync stops re-deriving
  over a settled value.
- **Task post-mortems (§13.7)** — ✅ `components/Reviews/PostMortemDialog.tsx` for
  any completed task (launched from the review carry-over step or Analytics →
  Reflection): satisfaction / resistance / focus / distraction, an optional
  actual-duration correction, and notes, persisted by `saveCompletionReview`.
  Operations have their own debrief (`addOperationReview` +
  `OperationPostMortemDialog`).
- **Gap:** no scheduled prompting beyond the header badge.

## §14 Points, Rewards & Regret — 🟡
- Points ledger — ✅ `lib/points-store.ts` (task/habit/goal completions,
  Inbox **+1 per handled idea** and **+50 when the Inbox hits 0** via
  `lib/inbox-credit.ts`, Scheduler **+1 per changed period placement** via
  `lib/schedule-credit.ts`,
  `upsertPoints` for revisable daily-habit scores, day/week/month totals + possible).
  Daily habits: 50 × that day’s completion ratio; user accomplishment bonus if that day’s raw column
  score meets `accomplishmentThreshold` (default ≥80% → +50); +100 if either Week grade or Perfect output is 75%+ that
  day, +300 if both; editable lift bonuses (default +25 each) when Week grade or Perfect output is higher than
  yesterday, and when a weekly-habit grade or output is higher than last week
  (`lib/habit-points.ts`, `lib/habit-accomplishment.ts`, Habits → Settings).
- List completion points — ✅ `resolveCompletionPoints()` (default 1 or **Points**
  attribute).
- Objective point sources + configurable multipliers — ✅ contributing to an
  objective applies a stacking multiplier (1.5× default, or a prioritized objective's
  user-set value) via `lib/goals-store.ts` + `components/Completion/`.
- **Gap:** other configurable multipliers (urgency/consistency); retroactive adjustment.
- §14.4 Regret accrual — ✅ `lib/regret-store.ts` (accrues the cost of not-done
  important/overdue items; day/week/month totals) + `Analytics/RegretView.tsx`.

## §15 Analytics — 🟡
**Heart of the product**, not a leftover tab: the vault of items, time, habits,
sleep, reviews, metrics, and operations is collected here, presented, analyzed,
and used to invent the next instrument. Chart → Lists (`open-in-lists.ts`) is
how a finding stays a living item, not a screenshot.
- Real charts — ✅ `components/Analytics/enhanced-analytics.tsx`: Lists **title
  bar + status bar**; interior is a **light instrument studio** (Karla, ink `#000`
  on Win95 face gray `#c0c0c0` nested wells, phosphor traces — not cream paper,
  not dark CRT). Five
  groups (Behavior / Time / Accuracy / Meta / Library).
  Views include **Observatory**, **Circadian**, **Places**, **Mood field**
  (cognitive-state trends), **Velocity**, **Cycle** (plus open-item survival),
  **Goals**, **Operations**, **Lists & areas** (size-by-items treemap + HHI),
  **Tags**, **Stages**, **Weight**, **Attributes**, **Diversity** (Shannon entropy
  + Gini + weekday/weekend), **Transitions** (Markov pen matrix + alluvial), **Spectrum**
  (autocorr / periodogram / sleep CV), plus Habits (horizon + weekday/weekend slope) /
  Tracking (**pie** + mosaic + block-length violin + hour×pen small multiples
  + enlarged drill that lists and edits blocks) / Sleep (weekday ridgelines) /
  Circadian (Cleveland cycle) / Cycle (age beeswarm) / Tags (UpSet) / Calibration.
  Settings still **edits** types. One remembered range (`analytics-range-store.ts`)
  — 7 / 14 / 30 / 90 **or** a custom inclusive from–to, labeled as the dates.
  Interpretive views show **n** and watermark when below `SAMPLE_FLOORS`. Empty
  charts keep the frame (`chart-frame.tsx`). Chart → Lists (`open-in-lists.ts`).
  Classical stats only (`lib/metrics.ts`, `signal-stats.ts`, `studio-plot-stats.ts`). Derived numbers use
  `~` / **est.** Every view has `ANALYTICS_TAB_HELP` plus tooltips.
- **Self-tracking metrics & analytics** — ✅ `lib/metrics-store.ts` + `lib/metrics.ts`
  (classical trend/slope, Pearson correlation, change-point, context-switch counts,
  Shannon entropy, Gini, HHI, autocorrelation, periodogram, CV, survival;
  no LLM). Logger: `components/Tracking/MetricLogger.tsx`. Views: `MetricsTrends`
  (small-multiples of all five, phosphor trace), `CorrelationExplorer` (pairwise matrix),
  `ContextSwitchHeatmap`, `RegretView` (§14.4), `OvercommitmentView`,
  `Observatory` (Pearson findings + Cross-section), `DiversityView`,
  `TransitionsView`, `SpectrumView`.
- **Sleep analysis** — ✅ **Sleep** view over `lib/sleep-log.ts` /
  `lib/sleep-inference.ts`. Nightly strip; `~` estimated, **est.** read off the grid.
  Against the sun: sleep vs that evening's sunset, wake vs that morning's sunrise
  (`lib/sleep-sun.ts` + persisted `lib/sun-times-store.ts`).
- **Gap vs spec:** predictive analytics (§15.3) 🕓 deferred. CSV export not shipped.
  Custom Metrics chart builder not shipped.

## §16 AI-Readiness — 🕓
No AI features required for v1, and no analytics depend on a model
(`lib/metrics.ts` is classical statistics on purpose). Keep timestamps,
structured types, free-text fields and a generic `links` mechanism so an AI layer
can be added later.

**The one planned use of a model is a build tool, not a feature:** the module
**install / port wizard** ([`MODULE_PLATFORM.md`](MODULE_PLATFORM.md) rung 4)
calls the cheapest adequate structured-output model *once, at install time*, to
propose a manifest and a state→Item mapping for a pasted `.tsx` app. Its output
is reviewable code and JSON. The wizard still works with no model reachable (you
fill the mapping in by hand), and installed modules never call out at runtime. A
model is never in a render path or a write path.

## §17 V1 Scope & Build Order
The spec's suggested build order remains a good sequence. Export/import (§3.2)
has already landed (`lib/data/backup.ts` + Settings). The live ordering for
agents is [`PLAN_OF_ACTION.md`](PLAN_OF_ACTION.md): screens and Analytics honesty
first, with §5 naming debt continued in Wave 10 (title is already the field of
record; parked-note `description` vs `body` remains). The module platform still
depends on that ontology, but UI style-breaks do not wait on it.

## Living application (beyond v2 spec) — 🕓
The spec describes a personal cognitive management system; the project's
ambition is a **new type of software** — a living, perfect second brain that
stays adaptable, alive, beautiful, and infinite. **Every item should be
connected and used in as many ways as possible.** **Analytics is the heart** of
that mass of personal data. See "What this is trying to be" in
[`../README.md`](../README.md). Tracked here so it stays connected to the code:
- **User-defined item types/subtypes as a primary workflow.** Seam + UI exist
  (`ItemTypeDefinition`, Settings → **Manage Item Types** and Analytics →
  Library → **Item Types**,
  `components/ItemTypes/`). New list items default to generic `item`, not Task.
  Catalog types are user-editable; Task remains the hardcoded work surface.
  Implied actions (`logAction`, `incrementHabit`) wire attribute deltas into
  Done / points / habits.
- **Dense relational network.** Richer composition of
  type ↔ category ↔ tag ↔ attribute ↔ link than today's mostly
  category-driven model. Primitives (`tags`, `links`, `attributes`) exist; the
  graph-style modeling/visualization does not.
- **Document-type items.** Notion / Google Docs–style rich-text editor as an item
  `body`/type. ✅ `Item.body` + built-in `note` type (`lib/note-types.ts` — Docs
  folder/font/status attrs), dependency-light markdown editor
  `components/Editor/RichTextEditor.tsx`, ItemDetail `"body"` panel
  `components/ItemDetail/BodyPanel.tsx`, and top-level **Docs** tab
  (`components/Docs/` — WYSIWYG HTML, Google Fonts, images, PDF ingest;
  helpers in `lib/doc-html.ts` / `doc-links.ts` / `pdf-to-html.ts`).
- **Spreadsheet-style grid displays.** Google Sheets–style editable grids over
  list/attribute data. ✅ `components/spreadsheet/SheetGrid.tsx` — inline cell
  editing, sticky header, frozen name column, numeric/currency column totals,
  add-row, add-column (pick on-this-list / vault attrs or create + assign-to-all),
  arrows/Tab/Enter/type-to-replace/Escape, header hide/insert without destroying
  attributes. Columns come from `lib/spreadsheet-catalog.ts` (built-ins + custom).
  Default visible extras are lean (list schema / `displayedAttributes` only;
  empty schema → Name-only) so All Items stays responsive; extras stay opt-in.
  Per-list layout on `List.sheetConfig`. Lists **Spreadsheet** display and Module
  **spreadsheet** view. See `components/Lists/SPREADSHEET.md`. Rollups
  (group-by + sum) power Module **summary** views via `lib/spreadsheet-utils.ts`.
  **Computed / formula attributes** — ✅ `lib/formula.ts` (safe expression
  evaluator: cell refs by attribute id, `+ - * / ( )`, `SUM/AVG/MIN/MAX`, no
  `eval`) drive the `"formula"` attribute type in grids + formula-aware rollups.
  Range selection, fill-drag, and per-cell `=A1` formulas also ship (`SheetGrid` v3).
  Lists **□ Fullscreen** is an in-app Win95 child window around the same grid
  (not OS fullscreen).
- **Self-tracking + analytics depth.** Track arbitrary user-defined metrics and
  analyze them (extends §12 Tracking and §15 Analytics).
- **Installable modules ("bring your own app").** ⛔ The end goal: any small
  `.tsx` app installs into Brain2 through a **port wizard** that maps its state
  onto Items, registers its views, and grants explicit **bridges** to Tracking /
  Habits / points / schedule / ingest — with a cheap, structured-output LLM doing
  the mapping once at install time and nothing depending on a model at runtime.
  This is what makes the second brain infinitely adaptable without forking its
  ontology: every module is a lens on the same graph, with its own feral skin.
  Contract, five laws, install ladder, manifest shape and migration order:
  [`MODULE_PLATFORM.md`](MODULE_PLATFORM.md).
- **Map and territory (general semantics as practice).** 🕓 The vault already
  keeps orders apart (est. chips, hatched assumed time, Counts-as at read time,
  plan ghosts beside solid tracking). Still to build, as Wave 13: one order on
  every derived value, extensional Analytics sentences, judgment copy that
  describes events, an optional is-of-identity check, description-then-inference
  reviews, a period handoff, a per-record differential, label ladders beyond
  pens, graded completion by default, and dated **formulation** items (the idea
  bank's Concept type, renamed). Sequence and done-when:
  [`ScienceandSanityBrain2.md`](ScienceandSanityBrain2.md) Part 3.

## §18 Resolved Contradictions
Reference notes; no code.

---

## Highest-leverage next steps (incremental path)

**Executable order for agents** (screens first, A’s mechanics kept, ontology
continued rather than restarted): [`PLAN_OF_ACTION.md`](PLAN_OF_ACTION.md).
UI-only ranking: [`UI_NEXT.md`](UI_NEXT.md).

Spec-facing remainder, still true, but **not** the next checkout:

1. **§5** `Item.title` is already the field of record (persist v11–v12). Remaining
   naming debt is parked-note text in `description` vs `body` — see
   [`CANONICAL_FIELDS.md`](CANONICAL_FIELDS.md). `stage` / `lists`,
   `entropy` / `cognitiveLoad`, and `context` vs tags stay. Then one write door
   as [`ARCHITECTURE_MODULARITY.md`](ARCHITECTURE_MODULARITY.md) states
   (`task-store` + `taskRepository`, not a third API through
   `item-mutation-service.ts`).
2. **§11** Module **manifest** + **bridge grants**, then the install / port
   wizard, then its LLM-assisted mapping step; finish two-way migration of the
   `module.config.houseCleaning` / `tripItinerary` shadow databases onto Items
   (one-way Module Lists projection already ships).
3. **§3** Wire opportunistic cloud sync to **MongoDB Atlas** via a
   `SyncingDataSource` (JSON backup/restore already ships; the local store stays
   the offline source of truth). Local selective restore and rolling
   `data/recovery-backups/` as a first-class source are in the plan before Atlas.
4. **§7.7** Automatic end-of-period carry-over — 🟡 partial: unfinished periods
   roll up one funnel level (`rollUpExpiredSchedules`); Reviews still offer
   per-task push-forward.
5. **§15** Predictive analytics still deferred. Category performance (**Lists &
   areas**) and cognitive-state (**Mood field**) now ship as Analytics studio
   views. Honesty (sample-size, shared range, chart → Lists) shipped in Wave 1;
   the studio interior is the current house exception (title + status stay Lists).
6. **§13** Scheduled review prompts. Generic task post-mortems already ship
   (`PostMortemDialog`).
7. **Map and territory** — Wave 13, after the est. mark is the house language
   for derived values. Not the next checkout ahead of screens and honesty.
   [`ScienceandSanityBrain2.md`](ScienceandSanityBrain2.md) Part 3.
