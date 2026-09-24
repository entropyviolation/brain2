# BRAIN2

**Brain2** is meant to be a **new type of software**: a **living, perfect second
brain** — adaptable, alive, beautiful, cutting-edge, and **infinite**. Not a
to-do list with extra tabs. Not a dashboard of orphans. Not a note dump that
never leaves its folder. A single organism that can become whatever tool the
moment demands, without becoming a different product.

Two laws hold the house together:

1. **An item is captured once, then connected and used in as many ways as
   possible.** Lists, Scheduler, Tracking, Habits, Docs, Modules, Reviews, and
   search are rooms on the same graph — not separate products that happen to
   share a name. Isolation is a bug.
2. **Analytics is the heart.** The rest of the house writes the vault. Analytics
   is mass personal data and information-resource collection, presentation, and
   analysis — and the place that turns that mass into endless tools. Capture
   without analysis is a filing cabinet.

A record is a **map**, not the life it describes. The miss between an order
and what came back is the **next input**. What lines up without a cause is
shown as **meaning**, and never sold as a reason. How those three ideas
perfect the house — and the laws that keep them from eating each other — is
[`docs/MAP_LOOP_MEANING.md`](docs/MAP_LOOP_MEANING.md). The work orders stay
the work orders: map
[`docs/ScienceandSanityBrain2.md`](docs/ScienceandSanityBrain2.md), meaning
[`docs/JungBrain2.md`](docs/JungBrain2.md) (essay
[`docs/jungideas.md`](docs/jungideas.md)), loop
[`docs/cyberneticsbrain2.md`](docs/cyberneticsbrain2.md). Not built yet.

It captures the full range of a person's working thoughts (reminders, to-dos,
ideas, plans, activity/feeling logs, and reflections) and organizes them into a
small number of interconnected structures — an **Inbox**, **Lists** (categories
and folders), a **Scheduler/Calendar**, **Goals**, **Habits**, **Time
Tracking**, **Modules**, **Reviews**, and **Analytics**. Those structures are
the skeleton. The point is that the skeleton **grows**.

The name is one word. **BRAIN2** is the all-caps mark in the header (beside today’s friend — click the photograph for their details; the chat button asks for a mission; click the bubble to accept or decline; Esc / × / outside closes the bubble), the window title, and the tab title. **Brain2** is the name in sentences. Zustand persist keys, IPC channel prefixes, CSS classes such as `.cogs-color-swatch`, and CLI env vars (`COGS_STRICT_PORT`, `COGS_TELEGRAM_BOT_TOKEN`, `COGS_FRESH`, …) still use a historical `cogs` prefix so existing local data and scripts keep working. New backups write `app: "brain2"` and still restore files that say `app: "cogs"`. The single source is [`lib/app-brand.ts`](lib/app-brand.ts).

## What this is trying to be

What exists in this repository today is an **early, working version** of that
ambition — already usable, already dense, already not finished. The destination
is a **revolutionary personal knowledgebase and time-management instrument**:
one deeply flexible **item** primitive composing into a mathematically rich,
densely interconnected network of **types, subtypes, categories, tags,
attributes, and lists**. Those structures form a living model of your ideas,
tasks, plans, goals, next actions, habits, and routines — and they track **how
your plans actually matched reality**.

Treat Brain2 as software that is **alive**: it fills in records, compares
intention to outcome, grows new rooms, and still looks like one vintage machine
that is also a painting — phosphor and silver and pixel as motif, luminous
contents, and room for a motion the 90s could not render — on a teal desktop
by default (Settings → **Desktop**; optional PCB photographs).
The chrome stays furniture. The insides stay personal.
The graph has no ceiling.

The aim is for Brain2 to do all of this at once:

- **A living perfect second brain.** Define your own item types ("Book",
  "Friend", "Project", "Idea") with custom attributes, link them together, and
  let categories, tags, and subtypes weave a dense network that mirrors how you
  actually think. The same item should schedule, paint time, feed a habit, sit
  in a module, appear in review, and chart — as many honest uses as it can
  bear.
- **Analytics as the heart.** Track yourself on any number of metrics, then
  collect, present, and analyze that mass of personal data so the next tool can
  be invented from it. Other tabs live in the graph; Analytics is where the
  graph becomes instrument.
- **A planning and reflection engine.** Built-in **daily / weekly / monthly /
  quarterly / yearly reflections** assist planning, and the system continuously
  compares intentions against outcomes (plan-vs-reality).
- **A custom-module platform.** Users can compose extremely powerful, complex
  custom modules on top of the same data — turning Brain2 into whatever tool the
  moment demands.
- **A place to externalize everything.** Pour every idea and consideration into
  lists — reading lists, watch lists, vacation plans, decision matrices — then
  visualize, sort, and reason over them.

**The end goal — install any app into your brain.** The final form of the
Modules platform is an **install** flow: you write, paste, or generate a small
`.tsx` app — a chore tracker, a plant log, a climbing pyramid, a wine cellar —
and a **wizard ports it in**. It maps that app's state onto **Items**, turns its
screens into views, and asks which **bridges** it may use (create items, paint
Tracking minutes, increment habits, award points, write dates, claim a
text-message phrase). A cheap, structured-output **LLM does the tedious mapping
once, at install time**, and produces reviewable artifacts — a manifest and a
diff — after which the module runs offline forever with no model involved.

The point is that a newly installed module is not a guest. It is a room in the
house: its records show up in Lists and Cmd/Ctrl-K search, its dated things reach
the Scheduler, its effort reaches Habits and Tracking, its completions award
points, its numbers chart in Analytics, and a text from a phone can create one.
**Infinite adaptability, one nervous system.** That is the new type of thing:
not an app store bolted on, not a plugin that lives in a sandbox — a brain that
can grow organs forever and still be one body. The laws that keep that possible —
Item is the only noun, config is layout not domain, one write door, skins stay
feral, deterministic after install — plus the rung-by-rung plan and the two
current exceptions to them, live in
[`docs/MODULE_PLATFORM.md`](docs/MODULE_PLATFORM.md).

**Module platform (built):** the **Modules** tab is now a full place to compose
your own tools. Beyond single-card widgets, you can build full-screen
**workspaces** — mini-apps assembled from your own lists and a layout of bound
**views** (an editable spreadsheet, agenda, rollup summaries, a gamified
randomizer, a focus timer, checklists, a gallery, notes, plus specialized
**timeline**, **matcher**, **quiz**, **dashboard**, **decision-matrix**, Trip
Itinerary **doc** / **itinerary-doc** / **trip-map**, **film-dna**, **house-cleaning**, and **grad-search** kinds).
You can author per-module **workflows** ("Zapier for your data": a trigger →
conditions → actions that run on real item mutations) and **pop a workspace
out** into its own window. One-click **templates** scaffold the lists, attribute
schemas, seed data, views, and workflows for an **Itinerary Creator**, a
**House Cleaning App** (Tidy), a **Budget Tracker**, a **Book Tasting** shelf, a
**Film DNA Lab**. **GradSearch** is the graduate-program explorer with the full catalog
inside the module. List-backed templates sit on the same `Item` / `ItemType` / attribute foundation,
so their data also flows through Lists, Scheduler, and Analytics. Reusable module
**definitions** (blueprints) can be saved, re-instantiated, and exported/imported.

**Google Sheets–style grids (built):** list/attribute data can be edited in a
spreadsheet display (`components/spreadsheet/SheetGrid.tsx`) — inline cells,
A1 column-letter headers + a row-number gutter, click-to-sort, free-text filter,
**drag + shift-click range selection** (with a Sum/Avg/Min/Max/Count summary
bar), **row & column resize**, freeze, a **fill handle** that copies down with
relative references, currency-aware totals, add-row/add-column, and **Delete** to
clear a range — available both as a Lists display mode and as a Module view.
Lists **Spreadsheet** can open the same live grid in an in-app Win95 maximized
child window (□ Fullscreen; Esc / restore / close). Formulas come in two flavors: read-only column-level **formula** columns, and
**per-cell `=A1` formulas** (`=B2+C2`) typed into any cell. A1 evaluation +
fill-drag ref-shifting live in `lib/sheet-a1.ts` / `lib/sheet-eval.ts`; the
expression engine and cross-item formulas (`LOOKUP`/`COUNTIF`/`ROLLUP`/`IF`) in
`lib/formula.ts`.

**File & PDF attributes (built):** `file`/`multifile` attributes (`FileValue`)
attach documents to items; PDFs are text-extracted (`lib/file-extract.ts`, via an
Electron `pdf-parse` IPC handler with a graceful browser fallback) so they power
the Book Tasting matcher/quiz. Catalog **Book** (cover, pages read, implied-action
rules) and **Flight** item types also ship, plus Furniture / Resource / Shopping
starters. Itinerary weather uses Open-Meteo (`lib/weather-client.ts`).

**Second-brain & knowledge features (built):** a top-level **Docs** tab
(`components/Docs/`) — Notion/Google Docs–style WYSIWYG over `note` items (HTML
body, folders, Google Fonts, images, PDF ingest); a **global Cmd/Ctrl-K search**
palette (`components/Search/`) over all items; a consolidated **item detail**
surface (`components/ItemDetail/`) with tags, typed links, related items, a
**History** tab (append-only `lib/item-activity.ts`), dependency-cycle refuse,
and a rich-text/markdown body (`components/Editor/`); **Set up Second Brain**
(Source/Belief item types) and full **JSON backup/restore** from the header
**Settings** dialog (`components/Settings/`); and self-tracking via a quick
**metric logger** (`components/Tracking/`).

**Planning & analytics depth (built):** the **Scheduler** adds dependency and
**Gantt/critical-path** views. **Analytics** is the heart of that depth — not a
report tab: **calibration** (estimate vs. actual), **streaks**,
**plan-vs-reality**, **regret**, correlation, context-switch heatmaps, a
**Cross-section** density over the shared range, an **Overcommit** early-warning
(sentence + n on day-pushes + logged minutes), and an **Item Types** library
(Settings still edits types). **Reviews** add a morning review and per-task
**post-mortems**; and a **Focus / Just-Start** mode (`components/Focus/`) breaks
paralysis with one smallest step + a short timer. These are backed by pure logic
in `lib/` and a nascent data layer (`lib/data/` with Mongo collections/sources +
JSON backup) and domain `lib/services/`.

**Phone capture (built):** text **BIM** (Brain2 Ingestion Messenger — you can call
him BIM for short) at the Telegram bot with short phrases
(`groc`, `got milk`, `needed:`, `get:`, `plan for rn:`, `currently …`, whole-message habit
keywords, discrete events + `log:`, `n stuck in aisle 4`, `qa: pick up milk`, `habit: exercise 30`,
`at: gym`, `do:`, `to do today:`, `gm`, `review`, `gps:`,
`screen: Instagram 30m`, `call: Jane 12m`, `text: Jane on my way`, `iphone-notes:` from the iOS Shortcut).
Send `info` for basics, `{prefix} info` / `{prefix} commands` for one family, or
`all commands` for every keyword. They land through the same writes as the desktop. Pairing stays put across a refresh. Grocery dumps
**pin** in the chat so you can read the list at the store with the laptop off.
A message that is a list name, then one item per line (`Grocery list:` / `before elijah gets home:`), files onto that list — grocery names use the store list, identical open items ask see / again / dismiss, and `before 9/12:` makes the following lines due that day.
Snap a **receipt** (OCR → check off grocery + bump pantry), a **journal page**
(deskewed PDF + searchable Docs note), or **forward a PDF**. Live 24/7 replies:
`npm run phone:hub` on a machine that stays on. Pairing lives
in Settings → Message ingest. On My iPhone Notes: AirDrop
[`Dump iPhone Notes to Brain2.shortcut`](docs/shortcuts/Dump%20iPhone%20Notes%20to%20Brain2.shortcut)
([install](docs/shortcuts/dump-iphone-notes-to-brain2.md)). Text the bot something
that names no list and it parks there too, to sort in **Phone Notes** rather than
answering with a picker of near-misses. iPhone Screen Time / Calls / Texts: AirDrop [`Screen Time to Brain2.shortcut`](docs/shortcuts/Screen%20Time%20to%20Brain2.shortcut), [`iPhone Call to Brain2.shortcut`](docs/shortcuts/iPhone%20Call%20to%20Brain2.shortcut), [`iPhone Text to Brain2.shortcut`](docs/shortcuts/iPhone%20Text%20to%20Brain2.shortcut) ([install](docs/shortcuts/screen-time-to-brain2.md), [install](docs/shortcuts/iphone-calls-and-texts-to-brain2.md)). See [`docs/MESSAGE_INGEST.md`](docs/MESSAGE_INGEST.md).

**Eventual expansion** (not yet built): deeper computed-attribute editing UX on
top of the in-grid **formula** columns and cross-item rollups that already exist.
Document items / Docs are built (see above). Other messengers wait on Atlas sync.
A **hosted webhook** for Telegram is built on the always-on phone hub
(`COGS_TELEGRAM_WEBHOOK`). Telegram **media ingest** (journal photos stored as
PDF, forwarded PDFs, receipt OCR into inventory / grocery list) is built — see
[`docs/MESSAGE_INGEST.md`](docs/MESSAGE_INGEST.md). Also not yet built: the **module install / port
wizard** and its LLM-assisted mapping step (rungs 2–4 in
[`docs/MODULE_PLATFORM.md`](docs/MODULE_PLATFORM.md)), and the migration of
Tidy's and Trip Itinerary's self-contained `module.config.*` state onto ordinary
Items as the *write* path (a one-way **Module Lists** projection already ports
Tidy chores and Trip days into nested lists — [`components/Lists/MODULE_LISTS.md`](components/Lists/MODULE_LISTS.md)).

The sections below describe **what actually runs today** — the living foundation
those ambitions are being built on. The vision above is not marketing copy; it
is the design constraint. The rest of this document is ground truth for the
current body.

## What this repository is today

This repository implements **Brain2 v1**, evolved toward the **"Brain2 v2"
specification** (`Cognitive_Management_System_Spec.docx`). See
[`docs/SPEC_MAPPING.md`](docs/SPEC_MAPPING.md) for a section-by-section mapping of
the spec to the code, including what is implemented, partial, or deferred.

The groundwork for the bigger vision is already visible in the data model: a
unified **`Item`** type with user-definable **types** (`ItemTypeDefinition`),
free-form **tags**, typed **links** between items, and flexible per-item/per-list
**attributes** (`lib/types.ts`). New list items default to generic **`item`**;
**Task** remains the hardcoded work surface. Catalog types (Book, Furniture,
Resource, Shopping, Flight) own their detail views, and implied actions on
types/lists can log Done activity and increment habits.

Records also fill themselves in: completing a habit derives how long it took and
where in the day it sat. That data is **labeled, never asserted** — each derived
value carries a `FieldEstimate` (`Task.estimates`, `lib/estimated-values.ts`) naming
the field and the reasoning behind it, shown as an **est.** chip in To Do → Done and
queued for confirmation in the period review. A display-only **usually ~N** glance
(median of observed `timeLogs` / unflagged `actualDuration` on the same title or
named type) sits on Working Now, Done rows, and the completion dialog — it never
rewrites `estimatedDuration`. Autogeneration stays aggressive
because correcting it is cheap and nothing pretends to be observed.

> **Documentation convention:** nearly every source file begins with a `/** ... */`
> header explaining its purpose and the spec section(s) it implements, and every
> major folder has a `README.md`. Start with this file, then `docs/SPEC_MAPPING.md`,
> then the folder README nearest the code you're reading. For look and feel,
> [`docs/DESIGN_STYLE.md`](docs/DESIGN_STYLE.md) — Lists is the gold standard.
> Next work (screens first, mechanics kept): [`docs/PLAN_OF_ACTION.md`](docs/PLAN_OF_ACTION.md).
> How map, loop, and meaning join: [`docs/MAP_LOOP_MEANING.md`](docs/MAP_LOOP_MEANING.md).
> Map, orders of abstraction, and the ten-slice build: [`docs/ScienceandSanityBrain2.md`](docs/ScienceandSanityBrain2.md).
> Meaning beside the average (not built): [`docs/JungBrain2.md`](docs/JungBrain2.md).
> The miss as the next input (not built): [`docs/cyberneticsbrain2.md`](docs/cyberneticsbrain2.md) Part 3.
> For reusable components and how to thin the UI without flattening skins,
> [`docs/ARCHITECTURE_MODULARITY.md`](docs/ARCHITECTURE_MODULARITY.md).

---

## Tech stack

- **Next.js 15** (App Router) + **React 19**, exported as a fully static site
  (`output: "export"` → `out/`).
- **TypeScript**, **Tailwind CSS**, **shadcn/ui** (Radix-based primitives in
  `components/ui/`), **lucide-react** icons, **recharts** for Analytics.
- **Windows 95 skin** — global retro chrome via `app/win95.css` (`body.win95-app`),
  loaded from `app/layout.tsx` together with module skins so Next Fast Refresh
  cannot drop them. Lists adds its own Win98 file-manager layer
  (`components/Lists/filemanager98.css`). That pairing (honest beveled furniture
  + photographed orbs on velvet) is the UI gold standard — see
  [`docs/DESIGN_STYLE.md`](docs/DESIGN_STYLE.md).
- **Zustand** stores with `persist` middleware for state, backed by the browser's
  **localStorage**. This local store stays the offline-first source of truth;
  **MongoDB Atlas** becomes a future *cloud sync target* (not a replacement) behind
  an opportunistic `SyncingDataSource` — see `docs/SPEC_MAPPING.md` §3.
- **Electron** desktop shell (`electron/`) that serves the static export via a
  custom `app://` protocol. The same build also runs as a plain web app.

## Architecture at a glance

```
Next.js (static export, all client-side)
        │  COMPLETE local store via Zustand + localStorage (offline source of truth)
        │  (+ plan text keys, legacy habit import)
        ▼
out/ (HTML/CSS/JS + public assets)
        │  loaded by
        ▼
Electron main process (electron/main.js)  →  desktop window (thin shell)
        ┊  future: opportunistic background sync, best-effort
        ▼
MongoDB Atlas (cloud) — sync target behind SyncingDataSource/RemoteDataSource
```

Most features run entirely in the renderer and read/write localStorage through
the Zustand stores in `lib/` (plus a few direct localStorage helpers for plan
text). Trip Itinerary maps and weather call Open-Meteo / Photon from the client
(`lib/city-search.ts`, `lib/weather-client.ts`, `lib/places-search.ts`, cached by
`lib/api-cache.ts`) so they work
with static `output: "export"` — there is no required API layer. The app is
**offline-first**: the local store remains the working source of truth. A future
opportunistic `SyncingDataSource` reconciles with **MongoDB Atlas** in the
background when online so multiple devices (including a future mobile app)
converge — without ever blocking offline use. See
[`docs/SPEC_MAPPING.md`](docs/SPEC_MAPPING.md) §3.

### Application map

```
app/page.tsx
├── Pinned mill title bar (full width): BRAIN2 caption + friend jewel (click → suggestion bubble) | Review | Settings | Tracking | Names | now (live Working sessions only) | Inbox | Ingest | Metrics | Bulk Add | From Notes | Phone Notes | Quick Add   (+ Cmd/Ctrl-K search, Cmd/Ctrl-Z undo)
└── Tabs
    ├── Home ────── Habits | Plan | To Do | Goals | Tracking
    ├── Lists ───── Win98 file manager (folders, lists, items, orb gallery, spreadsheet)
    ├── Docs ────── WYSIWYG notes (folders, fonts, images, PDF ingest)
    ├── Scheduler ─ Always → Year → Month → Week → Day funnel (+ dependency / gantt)
    ├── Operations ─ Graphic tool for a project (work, ideas, data, progress); category board hides archived; Parts + To do (Win95 command center)
    ├── Modules ─── User-built mini-apps (workspaces) + dashboard widgets
    └── Analytics ─ heart of the house: vault → presentation, analysis, new tools
```

Selecting a task from **Lists** (or Modules, Inbox, or global search) opens the
full-screen detail view (`components/ItemDetail/ItemDetailPage.tsx`).

Home **Tracking** is a Win95 window (navy title, photographed orb) with a
photographed well of pen beads (**Draw** tool, default). Beads show one row
until **Expand** (right of Tree) unwraps them — the key then reads **Conceal**; **New pen** reveals the hidden creator; selected name and detail sit on
steel plates so tray photos cannot wash the type out. **Erase** and **Scissors**
are radios on the far-right tools rail — they hide the pen tray (a spacer keeps
the keys docked right) and never grow a banner. A stable **tool-detail** well
beside the keys keeps how-to copy for Draw, Erase, and Scissors. **Sort** defaults to **Recent** so the pens you actually paint
float to the top (A–Z and Tree are there when you need them). It logs the day to
the **minute**. Paint the grid with colored pens (cells render at 1, 5, 10, 15 or 30
minutes over minute-accurate data), and each painted block is a real event: it can
be reopened from the grid, the **Activity Log**, or the **Day Log**, retimed,
renamed, split, or deleted. **Cmd/Ctrl-Z** reverses the last
paint, erase, edit, split, move, or fill; typing in a field keeps the
browser's own undo. A **day / week** switch changes the
span without changing the data: the week shows seven columns side by side, where
an unlogged day is obvious at a glance and a routine can be filled in one press —
type 9:00–17:00, tick Mon–Fri, done. Click any date heading to drop back into
that single day. **Infinite scroll** sits next to Day/Week on the
grid toolbar (not View settings): one continuous strip, time left to right,
day rows with week bands, origin stays put when you pick a day. Double-click a
day tile to open that paged day; double-click a week band to open that paged
week. **1m / 5m / 10m / 15m / 30m** cell size sits on the grid chrome next to
Day/Week; the live step is a navy inset key with a phosphor lamp bar. A **red now line** and **gray sunrise/sunset** mark the day plot as
horizontal lines across the hours, like Plan agenda and Day Log (do not
remove). Week and Infinite label sunrise/sunset from **that row's date** (persisted
per day), not today's clock on every row. Discrete events stay small vertical ticks at the minute they were
logged. **Time Grid / Activity Log / Day Log** use the same inset metal
`.hab-view-changer` keys as Habits Daily / Weekly / Monthly. **Day Log** has a local **Day \| Week** agenda switch (default Day, not persisted): Day overlays those same painted blocks on the planned agenda as **one continuous slab** per stretch; Week is a compact seven-column plan-vs-tracked board for that week (not the Time Grid paint week; click a date heading to open that day). Ghosts are the plan; solid color is tracked time; click Sleep to edit. A plaintext **notes**
field sits under all three Tracking views for the calendar day — white, not cream; jots like
"went to the zoo from 4–5" stay with the date while you figure out where they
belong, and they survive reload (`cogs-tracking-day-notes` / `brain2-tracking-day-notes`, not the timegrid
hub blob) — both of those keys are read and unioned, and if a full origin keeps a
submitted jot out of storage the well says so instead of pretending it saved. **Tracked** and **% of the day** are occupancy: overlapping
blocks (derived Sleep sitting on Work that was already there) count once, so a
day cannot read as more than 24 hours. Independent **views** (Activity, Location,
Mood, **Company**, **Screen Time**) each have their own pens. Company is who you were with — Alone,
Together, In conversation — not an Activity called hanging out. **Screen Time** reads a running
[ActivityWatch](https://github.com/ActivityWatch/activitywatch) server (loopback `127.0.0.1:5600`);
Brain2 is the meaning layer, not a window watcher. AFK stays untracked. ActivityWatch only records
from when its watchers run — it cannot import Apple Screen Time or anything from before install.
A successful sync with 0 blocks means AW had nothing usable yet, not a broken pipe. Settings → Screen Time
connects and syncs; Analytics → Time → Screen Time reports active vs untracked. Pens can **nest**
(trash under Cleaning, a park under Out under Mexico); **Show as** picks how coarse
the grid and Analytics read. **Counts as** is a searchable retro picker with
**Create new pen** and a color chain (one parent; parallel chains planned). A block
is **certain** unless marked assumed (hatched in the pen color; sleep **est.** is steel, not yellow);
Analytics can hide assumed time. A painted block can carry a **display name**
(defaults to the pen) and **secondary pens** whose tags still feed habits. A pen
can carry a **default action format** so a Walking block logs "Went for a walk"
into To-Do Done. A pen can also carry overlapping
**variants**, so Analytics shows the share of a category first and then breaks
that share down.

Tracking and **Habits** are connected by **tags**, which belong to *time* rather
than to pens. Tagging a pen is the shorthand for "always" — tag a "Do dishes" pen
*Cleaning* and every minute of it lands on the cleaning habit — but a single
block can carry extra tags of its own, so four hours of *San Diego Zoo* in the
Location scope can count as exercise without the next zoo visit assuming the
same. Habits count any minute carrying a linked tag, from any pen in any scope —
a daily habit for that day, a weekly or monthly habit as the sum across the period.

Opening a block also shows **what else was happening**: the other scopes' view of
those exact minutes, and one click to fill in what they are missing. Paint *Ian's
House* from 1 to 5 and attach *Social* to it, ticking off who was at the BBQ
without leaving the dialog. Attachments are one-offs by default and can be
promoted to a standing rule on the pen; either way they only fill minutes the
other scope left blank, so nothing you already logged is overwritten.

**Sleep** is typed on the calendar day you are looking at, not "last night": 1 AM
Thursday and 10 PM Thursday both belong to Thursday. Either end is enough;
**Add stretch** logs a second pair (the 10 PM bedtime pairs with Friday's 5 AM
wake). Mark each as estimated or certain; filling both paints the stretch on the
Sleep pen (split at midnight), logs it in To-Do Done, counts toward sleep habits,
and analyzes it in Analytics → **Sleep**. It reads the other direction too: sleep
painted straight onto the grid is reconciled back into the log, and **editing a
derived sleep block corrects the night**. A tracking fill of 11 PM–2 AM continues
onto the next morning as one block. Those times are the app's source of truth for
your waking hours — the Morning Review still writes "last night" into the same
store, and assumed completion times stay inside the hours you were actually up.
See [`components/Home/Tracking/README.md`](components/Home/Tracking/README.md).

## Future direction

Brain2 is **offline-first and stays that way**. Highlights:

- **Offline-first, always.** Every client (web/desktop renderer and a future
  **mobile** app) keeps a **complete local store** that is the working source of
  truth offline (today: Zustand + `persist`). The app never requires the network.
- **Opportunistic cloud sync.** A future `SyncingDataSource` wraps the local store
  and, when online, reconciles with **MongoDB Atlas** in the background so devices
  converge. Conflict resolution starts as per-field last-write-wins (upgradeable to
  a sync engine: RxDB / PowerSync / Atlas Device Sync). Sync is best-effort and
  never blocks offline use.
- **Shared `@brain2/core` package.** A future monorepo extraction holding the data
  model (`lib/types.ts`), Zod schemas, the `DataSource` interface, domain services,
  and pure logic (search, needs-attention, links, scheduling) — shared
  by web, desktop, and mobile.
- **Future mobile app** (Expo / React Native) consuming `@brain2/core` + a local
  cache + the same syncing remote data source. Today, phones use a **manual
  hub pull** (`lib/mobile-sync.ts`, Settings → Mobile Sync, `/mobile`).
- **External data** (read-only, starting with **weather** via Open-Meteo) feeds
  itinerary widgets: fetched when online, cached locally with a TTL, degrading
  gracefully offline. Deliberately **not** on the user-data sync path.
- **Phone message ingest** (Telegram first: [t.me/brain2_phone_bot](https://t.me/brain2_phone_bot))
  long-polls the Bot API from Electron or runs headless via `npm run phone:hub`
  (hydrate persist, optional webhook). Grocery dumps pin in the chat for
  laptop-off reads. Writes reuse capture/habit/tracking paths; `groc` / `read:` /
  `lists` / `info` dump data back as plain text (bare `g` is Inbox only; `-mb` / `-monkey` dumps a capture in Monkey brain). Text-pipeline
  tracker rows show in Analytics **Text events** / **Text spans**. Token is gitignored `.env.local`
  or Electron `safeStorage`. See [`docs/MESSAGE_INGEST.md`](docs/MESSAGE_INGEST.md).
- **Electron main becomes a thin shell** (optionally a connector/cache host), not
  the source of truth. The existing IPC + Mongo scaffolding is repurposed as the
  **remote/sync** side rather than a desktop-local datastore.

## Getting started

```bash
npm install --legacy-peer-deps   # react-day-picker peer-dep needs this flag
npm run dev                      # web dev server at http://localhost:3000
npm run electron:dev             # Next dev server + Electron window
npm run build                    # static export to out/
npm run electron:build           # package desktop installers into dist/
npm test                         # vitest unit + integration tests
npm run ingest                   # optional Telegram queue poller (prefer npm run phone:hub)
npm run phone:hub                # always-on Telegram executor (gitignored .env.local / COGS_TELEGRAM_BOT_TOKEN)
npm run shortcut:iphone-notes    # write + sign Dump iPhone Notes to Brain2.shortcut
npm run shortcut:iphone-phone    # write + sign Screen Time / Call / Text / Location .shortcut files
npm run shortcut:iphone-location # alias of shortcut:iphone-phone (includes Location to Brain2)
npm run test:e2e                 # Playwright (Lists flows; starts dev server)
```

`electron:dev` runs the dev server directly (not through a nested `npm run dev`)
so Ctrl-C kills it instead of orphaning a listener on port 3000. It also sets
`COGS_STRICT_PORT=1`: the server stays on `http://localhost:3000` (Electron never
follows a fallback port). If a leftover **Node** process is still listening after
a crash (heap OOM / SIGABRT), the next `electron:dev` SIGTERMs that listener and
binds 3000 itself. A non-Node occupant still errors — then
`kill $(lsof -t -nP -iTCP:3000 -sTCP:LISTEN)`. Both `dev` and `electron:dev`
raise the Node heap to 8 GB (`--max-old-space-size=8192`); webpack’s compiler
cache is on disk in dev so a long Fast Refresh session is less likely to abort. The desktop vault is **pinned** to
`~/Library/Application Support/cogs` even though package.json `name` is
`brain2` — fully quit Electron (not just reload) after that pin lands so it
picks up the live lists/habits instead of an empty `brain2` profile.

## Repository map

| Path | What lives here | README |
|------|-----------------|--------|
| `app/` | Next.js App Router entry: layout, single page, global + Win95 CSS | [`app/README.md`](app/README.md) |
| `components/` | All React UI — modules, dialogs, shared widgets | [`components/README.md`](components/README.md) |
| `components/Home/` | Home dashboard (Habits, Plan, ToDo, Goals, Tracking) | [`components/Home/README.md`](components/Home/README.md) |
| `components/Completion/` | Global task-completion popup (objective/goal contributions + multipliers; Undo reopens the task) | [`components/Completion/README.md`](components/Completion/README.md) |
| `components/Lists/` | Lists file manager — orchestrator, hooks, views, dialogs (`components/Lists/README.md`) | [`components/Lists/README.md`](components/Lists/README.md) |
| `components/Docs/` | Top-level Docs tab — WYSIWYG notes over `note` items | [`components/Docs/README.md`](components/Docs/README.md) |
| `components/Scheduler/` | Period scheduling funnel + dependency/gantt views | [`components/Scheduler/README.md`](components/Scheduler/README.md) |
| `components/Operations/` | Operations — a graphic tool for any project: category board (completed/inactive hidden until Show archived), per-operation panels, Parts formulas, Lists-backed To do, delete from Settings (Win95 command-center chrome) | [`components/Operations/README.md`](components/Operations/README.md) |
| `components/Modules/` | Composable dashboard modules + workspaces | [`components/Modules/README.md`](components/Modules/README.md) |
| `components/Analytics/` | Heart of the app: collection, presentation, analysis, next tools | [`components/Analytics/README.md`](components/Analytics/README.md) |
| `components/ItemDetail/` | Consolidated item/task detail (page + popup; type-owned tabs + History; cycle refuse) | [`components/ItemDetail/README.md`](components/ItemDetail/README.md) |
| `components/ItemTypes/` | Manage item types (Settings + Analytics) | [`components/ItemTypes/README.md`](components/ItemTypes/README.md) |
| `components/Editor/` | Rich-text/markdown body editor | [`components/Editor/README.md`](components/Editor/README.md) |
| `components/Search/` | Global Cmd/Ctrl-K search palette | [`components/Search/README.md`](components/Search/README.md) |
| `components/Settings/` | Data profile (Live/Demo), window gray, desktop PCB, backup/restore, Message ingest (Telegram), item types, Second Brain setup, manual mobile hub | [`components/Settings/README.md`](components/Settings/README.md) |
| `components/Focus/` | Just-Start anti-paralysis mode | [`components/Focus/README.md`](components/Focus/README.md) |
| `components/Mobile/` | Sideload Home + Lists shell; manual hub pull | [`components/Mobile/README.md`](components/Mobile/README.md) |
| `components/Icons/` | Shared icon system + orb picker | [`components/Icons/README.md`](components/Icons/README.md) |
| `components/Tracking/` | Quick self-tracking metric logger | — |
| `components/Reviews/` | End-of-period review ritual (header) + post-mortems | [`components/Reviews/README.md`](components/Reviews/README.md) |
| `components/spreadsheet/` | Reusable Google-Sheets-style editable grid | [`components/spreadsheet/README.md`](components/spreadsheet/README.md) |
| `components/ui/` | shadcn/ui primitives (Button, Dialog, Tabs, …) | [`components/ui/README.md`](components/ui/README.md) |
| `lib/` | Data model types, Zustand stores, pure helpers | [`lib/README.md`](lib/README.md) |
| `lib/data/` | Nascent data layer: `DataSource` sources, Mongo collections/schemas, JSON backup | [`lib/data/mongo/README.md`](lib/data/mongo/README.md) |
| `lib/services/` | Domain services (completion, review, scheduling, item-mutation / implied actions) | — |
| `electron/` | Desktop shell: main process + preload | [`electron/README.md`](electron/README.md) |
| `docs/` | Spec mapping, **plan of action**, the map-loop-meaning join, map-and-territory philosophy, meaning-layer plan, steersman plan, module-platform north star, design style, design refs, modularity assessment, screen write-ups | [`docs/README.md`](docs/README.md) · [`docs/PLAN_OF_ACTION.md`](docs/PLAN_OF_ACTION.md) · [`docs/MAP_LOOP_MEANING.md`](docs/MAP_LOOP_MEANING.md) · [`docs/ScienceandSanityBrain2.md`](docs/ScienceandSanityBrain2.md) · [`docs/JungBrain2.md`](docs/JungBrain2.md) · [`docs/cyberneticsbrain2.md`](docs/cyberneticsbrain2.md) · [`docs/DESIGN_REFS.md`](docs/DESIGN_REFS.md) |
| `docs/screenshots/` | PNG captures + per-screen `.txt` write-ups (56 views) | [`docs/screenshots/README.md`](docs/screenshots/README.md) |
| `public/` | Static assets: orb PNGs (`orbs-removebackground/`), fonts, icons, link connectors | — |
| `hooks/` | Shared React hooks (`useUndoHotkey`, `useQuickCaptureHotkey`, `useVocalConfidence`); module hooks live in subfolders (e.g. `components/Lists/hooks/`) | [`hooks/README.md`](hooks/README.md) |
| `out/` | Built static export (generated by `npm run build`; git-ignored) | — |

### Home subfolders

| Path | README |
|------|--------|
| `components/Home/Habits/` | [`README.md`](components/Home/Habits/README.md) |
| `components/Home/Plan/` | [`README.md`](components/Home/Plan/README.md) |
| `components/Home/ToDo/` | [`README.md`](components/Home/ToDo/README.md) |
| `components/Home/Goals/` | [`README.md`](components/Home/Goals/README.md) |
| `components/Home/Tracking/` | [`README.md`](components/Home/Tracking/README.md) |

## Data layer (summary)

A dozen-plus Zustand stores in `lib/` persist to **localStorage** — the complete,
offline-first source of truth (including the newer `module-definitions`,
`workflows-store`, and `item-type-store`). Persist **keys** are **`brain2-*`**.
Historical **`cogs-*`** keys are a lossless alias so a rename does not empty the
vault (`lib/storage-keys.ts`). The future **MongoDB Atlas**
`brain2` database is a
*cloud sync target* (reached via a `RemoteDataSource`/`SyncingDataSource`, not the
durable store) — flexible documents, text/vector search indexes, and aggregation
pipelines for advanced search and routing. See [`docs/SPEC_MAPPING.md`](docs/SPEC_MAPPING.md) §3.
Key store examples:

| Store | Key | Used for |
|-------|-----|----------|
| `task-store` | `brain2-task-storage` | Item records (`tasks[]`), lists, folders (persist v12) |
| `habits-store` | `brain2-habits-store` | Habit definitions + weekly completion data |
| `time-tracking-store` | `brain2-timegrid-store` | Tracking views (Activity / Location / Mood / Company / Screen Time), pens (with parents, last-used, Recent/A–Z/Tree sort), minute intervals, block tags/variants/precision, mirrored per-day append-log notes. Persist v11. |
| `day-notes-persist` | `brain2-tracking-day-notes` | Tracking bottom scratch pad (the jot that survives refresh) |
| `screentime/prefs` | `brain2-screentime-prefs` | ActivityWatch URL, lookback, min duration, window-titles opt-in (off), last sync + honest empty-success note |
| `sleep-store` | `brain2-sleep-store` | Nightly sleep log (day-local asleep/wake + precision), keyed by the morning |
| `reviews-store` | `brain2-reviews-store` | Period reviews |
| `lists-ui-store` | `brain2-lists-ui` | Lists UI prefs, orb gallery |

Plan free-text uses interim `plan-text.ts` helpers (`dayPlan-*`, `weekPlan-*`,
`monthPlan-*` keys) as an append-only log of stamped entries (`9/20 9pm - …`)
plus an unsubmitted `draft` on the same key so typing survives refresh;
target is MongoDB `plans` collection. Optional Plan-only dark chrome latches
`brain2-plan-dark` (`1`/`0`); default stays gray Win95. Full file-by-file
detail: [`lib/README.md`](lib/README.md).

## Status vs. the v2 spec (summary)

**Implemented in some form:** Inbox (Walk selected + rename/discard + recent lists + +1/+50 points + Select all / Deselect all + multi-select list / deadline / merge / mark clarified / Monkey brain / bulk edit / delete) / Quick Add / Bulk Add (colon paths `list: item` /
`folder: list: item`, optional skip clarification) / **From Notes** (this Mac: Apple Notes via Electron or localhost hub; close the dialog while listing — reopen to return) / **Phone Notes** (AirDrop `Dump iPhone Notes to Brain2.shortcut` → Telegram `iphone-notes:` → iPhone Notes Store) — both notes dialogs bulk-add with the same `Folder: List:` headers, so a second colon creates a new folder by name; **Lists** board with
Win98-style folders, custom attributes, orb icons, CSV import, and per-folder All
Items; Scheduler period funnel (Always→Year→Month→Week→Day); Home dashboard
(Habits / Plan / To Do / Goals / Tracking, including the Habits **exemption wand** that waives a period without marking it done, all-nighter blocks on each habit, and connections that check bedtime, wake, and a done to-do from the log); five habit types (boolean, goal, text,
climb with **weekly +** / **daily +** cadences) with shared `habits-store`, **Week grade**
and **Perfect output** as glass noble-gas tubes, optional habit heatmap and priority sort, daily points (50 × completion, user accomplishment bonus default +50 at ≥80% raw day, +100/+300
grade bonuses); minute-resolution time tracking (header + Home Tracking tab) in a
**day or week** span, the week filling a typed range across any set of ticked
days in one press, occupancy totals that cannot exceed 100% of a day even when
derived Sleep sits on already-painted Work, with
**tags on time** — standing pen tags plus tags pinned to a single block — that
auto-fill linked daily habits across scopes, per-pen **nesting**, **Recent** sort,
and **variants**,
**Working on right now** for a searched pen color (or a Create row when the typed name is new in that view; timer from this second, a block of that color beside Operations **Working on this now**, under the Tracking view switcher in `.trk-now-module`),
an **Activity Log** where every block is editable (plus **Log activity** on the Time Grid rail with TIME/DIV / view modes, and on Activity Log / Day Log’s plan-style `.trk-period` date bar — optional name, notes, optional **Date** on start/end, **right now** on a focused clock, and discrete events — untracked-gap row as a grid with a 22px `.trk-gap-add` **+**, Done-for-day), a **Day Log** with local **Day \| Week** (default Day) that overlays painted time on the plan as **one continuous slab** per stretch in day mode and a seven-column plan-vs-tracked week board otherwise (click a ghost to confirm it, completing tasks so dependents unlock; click Sleep to edit; week date heading returns to that day), per-day **tracking notes** (metal well collapsed to legend + Expand; Expand opens a tall composer and tall history; white field, cream lace in the bevel only; persist overlay so reload keeps them), **scissors** (split at a minute; same-pen adjacent merge unless cut), clickable **Sleep** (fell asleep / woke up; steel **est.** / certain; dialog opens immediately), optional infinite day/week from the grid toolbar (virtualized, origin-stable) and pen-image mosaic, hide pens per view, selected-pen settings vs view settings, cross-scope
**attachment** (one click to say the same hours were also *Social*, as a one-off
or as a standing rule on the pen), and an Analytics Tracking tab with percentage
views, category depth, an include-assumed switch, plus variant and tag drill-downs; a two-field
**sleep log** that derives painted Sleep blocks, a Done row and habit minutes from
a bedtime and a wake time (each marked estimated or certain), reads nights back
off the grid when they were painted instead of typed **or when a derived block is
retimed there**, and feeds an Analytics
**Sleep** tab for duration, timing, regularity, extremes, trend and naps counted
apart from nights;
**habit time estimates** (minutes per unit of a
goal, or a flat length) so completing a habit writes a Done row with a real clock
window and duration instead of a bare date, with every autogenerated value flagged
**est.** and confirmable in the review; period **Reviews**
with plan text, reflection, and an **Assumed times** step (plus morning review and
per-task post-mortems);
**Modules** platform (user-buildable full-screen **workspaces** with bound
spreadsheet/agenda/summary/randomizer/timer/checklist/gallery/notes/decision-matrix/
timeline/matcher/quiz/dashboard/doc/itinerary-doc/trip-map/film-dna/house-cleaning/grad-search views,
authored **workflows** that run on item mutations, **pop-out** windows, reusable
**definitions**, plus templates for Itinerary / House Cleaning / Budget / Book Tasting
/ Film DNA Lab / GradSearch, and dashboard widgets); **Docs** tab (WYSIWYG over `note`
items); **Operations** tab (a little graphic tool for any project — its work, ideas,
data, and progress: many free-form **categories** per operation grouped on the
home board, completed and inactive operations hidden until **Show archived**,
per-operation **panel settings** chosen from prebuilt panels — To do / Phases /
Parts / Timeline / Locations / Plan / Resources / Log / Queue rail — presets,
a **Parts** tab of formulas and part pages, a To do panel that is a real Lists
panel over a per-operation list and also shows phase and part tasks, delete
from Settings after **Are you sure?**, and **Working on this now** which logs
the session into Home To Do Done, Tracking minutes, and tagged daily habits); **spreadsheet** display (v3: range select, fill
handle, per-cell `=A1` + formula columns, row/column resize) for lists;
**file/PDF** attributes and catalog **Book** / **Flight** / Furniture / Resource /
Shopping item types; all-time
**Objectives** (prioritizable per period with
custom point multipliers) + quantifiable **Goals** that serve them, with a
global **completion popup** that captures objective/goal contributions on every
task completion (**Undo** reopens the item as still to-do; **Skip** keeps the
win without a contribution); **Missed opportunity** (too late) clears the same
open To Do / Next Actions row onto an automatic **Missed Opportunities** list
under Next Actions instead of Completed, with no points and no popup; points on task/habit/goal completion (with stacking objective
multipliers); Scheduler **dependency / Gantt** views; **global
Cmd/Ctrl-K search**; consolidated **ItemDetail** with tags/links/rich-text body;
**Second Brain** item types + **JSON backup/restore** (header Settings);
Plan **Paste Events**; Plan Day rail **To Do / Habits / Next actions** (Lists orbs on to-dos and next actions, habit gems on habits; double-click opens detail) drag onto the agenda to plan (notes + time, persist `brain2-planned-actions`, not events and not habit completion); Day agenda fills the column beside a long rail; optional Plan **Dark** / **light mode** chrome; optional Plan **Gem and trinket** / **no gem no trinket** month mode (past days);
and Analytics charts
plus Brain2 views (calibration, streaks, plan-vs-reality, regret).

**Not yet matching the spec** (tracked in `docs/SPEC_MAPPING.md`): a durable
**MongoDB** storage layer (flexible documents, text/vector search indexes) wired
behind the nascent `lib/data/` sources + schema migrations (§3), unified Item data
model with de-duplicated fields (§5), auto-progress / penalties on the
Goals→Objectives model (§10),
complete Reviews cadence set (§13), the full set of spec Analytics views (§15), and
fully automatic carry-over logic (§7.7).

**Toward the living application** (beyond the current spec — see "What this is
trying to be" above): denser **type ↔ category ↔ tag ↔ attribute ↔ link** modeling
and visualization. User-defined item types already own detail views (generic
`item` default; Task is the special work surface; catalog types persist edits;
implied actions wire attribute deltas into Done / points / habits). The
**custom-module platform**, **spreadsheet-style grids**, **file/PDF attributes**,
and **Docs** are built. The unified `Item`/`ItemTypeDefinition`/`links`/`attributes`
primitives in `lib/types.ts` remain the foundation.

The destination for the module half of that vision is spelled out in
[`docs/MODULE_PLATFORM.md`](docs/MODULE_PLATFORM.md): **installable modules**.
Today you *compose* a workspace inside the app; the goal is to *install* an
arbitrary small `.tsx` app through a port wizard, so the brain grows new organs
without growing new databases. Its two prerequisites are the same two items in
the gap list above — a single honest `Item` (§5, `docs/CANONICAL_FIELDS.md`) and
one write path — which is why those come before any further UI work.
