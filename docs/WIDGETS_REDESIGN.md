# Widgets redesign plan

Home → the widget row at the top of every Home tab. _Last mapped: 2026-10-20._

**Status.**
- **Planned:** every phase below. Nothing is built yet.
- **Shipped before this plan:** 19 widget kinds in `lib/home-widgets.ts`, the row in `components/Home/home-overview.tsx`, the Widgets menu and Widget catalog, and the click-open handheld. Behavior as it is now lives in [`components/Home/README.md`](../components/Home/README.md#overview-widgets).

The house order is [`DESIGN_STYLE.md`](DESIGN_STYLE.md): failures first, then layout, then palette. Module rules are [`MODULE_PLATFORM.md`](MODULE_PLATFORM.md). Taste notes that bind this plan: cool paper and graph rule for diagrams, no yellow or amber, no celestial costume.

**Rule for every phase: break nothing.** Every widget that ships today keeps its reading, its click-open detail, its × with **Are you sure?**, Follow the clock, and its saved settings. The current look stays, as the **Classic** style. Old vaults and old backups load into the new model with nothing lost. Each phase ships with its tests, and `home-overview.test.tsx`, `home-dashboard.test.tsx`, and `lib/home-widgets.test.ts` stay green. Where a phase changes something you can see on purpose, it says so and updates the test on purpose.

---

## What a widget is

A **widget** is a small reusable app. The **Widget gallery** holds one entry per kind (Countdown, Language study, Weather…). Installing a kind puts one **instance** on the **Visual dashboard**. Some kinds allow one instance. Some allow one per something (one Language study per language, one Weather per city). Some allow many (Countdown).

Each instance has three faces of itself:

1. **The face.** A glance on the dashboard, like a gauge on a car dash. One number, one word, or one small picture. Never a form.
2. **The detail.** Click the face. The detail is the widget's own room, and it may look like anything (Law 4, "skins stay feral").
3. **The settings.** The gear in the detail. Settings for *this* instance only.

Later, people make their own kinds (Phase W10).

---

## How this plan is laid out

| Part | Phases | What it gives you | State |
|------|--------|-------------------|-------|
| 1. Names | W0 | Visual dashboard, Widget gallery, Countdown, Language study. Words only | Planned |
| 2. The model | W1 | Kinds and instances, one store, one migration | Planned |
| 3. The shell | W2 | Face / detail split, the gear, shared settings sections | Planned |
| 4. The look | W3 | The Cluster: a car-dash band (Oldsmobile VFD or Prius LCD), bay sizes, and Classic kept | Planned |
| 5. Arranging | W4 | Edit mode: drag to move, drag to resize | Planned |
| 6. The gallery | W5 | A page per kind, install and setup, first-run guides | Planned |
| 7. Countdown | W6 | Days Until remade as Countdown | Planned |
| 8. Language study | W7 · W8 | One widget per language; levels and placement tests | Planned |
| 9. Settings that matter | W9 | Real per-kind settings for the other 17 kinds | Planned |
| 10. Your own widgets | W10 | Make a kind from a readout | Planned |

Build order is in [Order of work](#order-of-work).

---

## Decisions

| # | Question | Decided (change here if you disagree) |
|---|----------|---------|
| 1 | Name of the row | **Confirmed 2026-10-20.** **Visual dashboard** to the person (`data-ui-name="Visual dashboard"`). **Widget container** in code and docs (`WidgetContainer`, `widget-container.tsx`) |
| 2 | Name of the catalog | **Widget gallery** |
| 3 | Name of the old look | **Classic**. Today's satin handhelds, kept as a full option. Default for an existing vault |
| 4 | Name of the new look | **Cluster**, an instrument cluster drawn from the photos in [`mockups/dashboard-inspo/`](mockups/dashboard-inspo/). Two lamps: **VFD** (1980s Oldsmobile, aqua) and **LCD** (2010-era Prius, cool white-cyan). Default for a fresh vault. See [W3](#w3--the-cluster) |
| 5 | Hide vs remove | × **hides** (parks the instance, keeps its settings, as today). **Remove** lives in settings and asks first |
| 6 | Layout model | **Confirmed 2026-10-20, as a dashboard.** One long horizontal instrument band, like a car dash: gauges, buttons, and mode switches laid out side by side. Widgets sit left to right in **bays** and fill the band's height. A second band (row) opens only when the first is full. Each widget keeps an order and a width; there is no free x/y. On a phone the band scrolls sideways like a dash, or stacks into bands. See [W3](#w3--the-cluster) |
| 7 | Where domain data lives | Settings live on the instance. Records stay in their stores or become Items (Law 1). Countdown marks stay in `home-days-until-store`; words, known ticks, and test results are Items |
| 8 | Ids of instances that already exist | A one-instance kind keeps its old id (`points`, `moon`…), so `data-widget`, tests, and UI Names stamps hold |
| 9 | Official exam questions | **Interim, accepted 2026-10-20: link and score, do not copy.** A better answer is still to come. See [W8](#w8--levels-and-placement) and its open question |
| 10 | Drag library | **None.** Pointer events, like `components/Home/Plan/use-plan-rail-drag.ts`. No new dependency |
| 11 | Settings validation | **zod** (already a dependency). Each kind has one schema with defaults |

---

## What already exists

Read these before building. File paths are the map.

| Piece | Where | Note for this plan |
|-------|-------|--------------------|
| Kind ids, labels, order, hidden defaults, catalog copy, migrations v2–v10 | `lib/home-widgets.ts` | Ids are a closed `as const` list. Catalog blurbs (`HOME_WIDGET_CATALOG`) become gallery copy |
| Order + hidden + Follow the clock | `lib/home-widgets-store.ts` (`brain2-home-widgets`, v10) | Becomes the source for the W1 migration |
| The row | `components/Home/home-overview.tsx` | An `if` per id. `OverviewTile` wraps hide + open + dialog. `ProgressTile` holds its popup state outside the dialog (Radix remounts on `modal` flip); keep that |
| The handheld | `components/Home/home-widget-dialog.tsx` | `HomeWidgetDialog`, `TileHide`, `WidgetWell(s)`. The gear goes in its caption |
| Menu + catalog | `home-widgets-menu.tsx`, `home-widget-catalog.tsx` | Become the gallery |
| Face skin | `home-chrome.css` (`--home-tile-h: 156px`, tiles 132–200px), `home-widget-face.css` (867 lines; Vocab and Affirmation already `grid-column: span 2`) | Becomes the Classic style |
| Countdown marks | `lib/home-days-until-store.ts` (v3 `items[]`), `lib/home-days-until-event.ts`, `components/Home/home-days-until.tsx` | Already many-per-family. Each mark becomes an instance |
| Vocab | `home-vocab-tile.tsx` (411), `-flashcards`, `-thousand`, `-dictionary`; `lib/vocab-store.ts` (`brain2-home-vocab` v2), `lib/vocab-words.ts`, `lib/vocab-lists.ts`, `lib/vocab/*` | Languages are already per-language inside one widget. Known words are already Items (`vocab-known`). Favorites are not |
| Points period | `points-stats.tsx`, localStorage `brain2-home-points-period` | Moves into instance settings |
| Backup | `lib/data/backup.ts` ~185, ~250, ~514 | New key joins all three tables. Old keys stay restorable |
| Module widgets | `components/Modules/` (`WIDGET_MODULE_CATALOG`) | A different "widget" today. W10 joins them |

---

## Part 1 — Names

### W0 · Names only

A word pass. No behavior changes, no persist changes.

- **Visual dashboard.** `data-ui-name="Home overview"` becomes `"Visual dashboard"` (`home-overview.tsx`, `ui-names-stamps.test.ts`). The CSS class `home-overview` stays until W1 so no style breaks.
- **Widget gallery.** The **Widget catalog** key and dialog title.
- **Countdown.** `HOME_WIDGET_LABEL.daysuntil` and catalog copy. The face caption reads `Countdown` unless the mark has a label.
- **Language study.** `HOME_WIDGET_LABEL.vocab`. "Vocab" survives as the name of one mode (Vocabulary).
- **Docs.** Every doc in [Docs to change](#docs-to-change) gets the new words, and the definition from [What a widget is](#what-a-widget-is).

Tests: update label assertions on purpose. Nothing else moves.

---

## Part 2 — The model

### W1 · Kinds and instances

**New files.**
- `lib/widgets/kinds.ts` — `WidgetKindId` and `WIDGET_KINDS`, one `WidgetKind` per kind (pure data, no React).
- `lib/widgets/instances.ts` — the instance type, sanitize, migrate, pure moves. Unit-tested.
- `lib/widgets/instances-store.ts` — zustand + persist, key `brain2-widgets`, v1.
- `components/Home/widget-container.tsx` — replaces the `if` chain with a registry lookup. `home-overview.tsx` re-exports it for one release.

```ts
type WidgetKind = {
  id: WidgetKindId              // "points", "countdown", "language"…
  name: string                  // "Language study"
  family: "score" | "clock" | "sky" | "capture" | "study" | "custom"
  cardinality: "one" | "one-per-key" | "many"
  keyLabel?: string             // "Language", "City"
  sizes: WidgetSize[]           // sizes the face can draw
  defaultSize: WidgetSize
  settings: ZodType             // with defaults; parse fills gaps
  setup?: SetupStep[]           // asked on install (W5)
  guide?: GuideStep[]           // first-run tour (W5)
  legacyIds?: string[]          // "daysuntil", "vocab"
}

type WidgetSize = "mini" | "compact" | "standard" | "wide" | "large"   // bay widths; see W3

type WidgetInstance = {
  id: string                    // stable; one-instance kinds keep the old id
  kind: WidgetKindId
  key?: string                  // "fr", a city id
  title?: string                // the person's name for it
  size: WidgetSize
  style?: "classic" | "cluster" // empty = the dashboard's style
  band?: number                 // which band (row) the bay sits in; empty = first that fits
  hidden: boolean               // parked; settings kept
  settings: Record<string, unknown>
  guideSeen?: boolean
  createdAt: string
}

type WidgetDashboard = {
  instances: WidgetInstance[]   // array order is face order
  followClock: boolean          // was widgetsFollowClock
  style: "classic" | "cluster"
  lamp: "vfd" | "lcd"           // Cluster lamp color and type
  bandHeight: "low" | "standard" | "tall"
}
```

Per-instance **Follow the clock** is a setting that overrides the dashboard one (`inherit | day | clock`).

**Migration** (`migrateLegacyDashboard`, pure, runs once when `brain2-widgets` is empty):
1. Read `brain2-home-widgets` through the existing `migrateHomeWidgetPersist`, so v2–v10 still land right.
2. Each id in `order` becomes an instance with `hidden` from `hidden`. Size is `standard`, or `wide` for `affirmation` and `vocab` (they already span 2).
3. `daysuntil` becomes one `countdown` instance per mark in `home-days-until-store`, id `countdown-<markId>`, settings `{ markId }`. No marks: one hidden countdown.
4. `vocab` becomes one `language` instance per language in `vocab-store`, id `language-<lang>`, key `<lang>`, settings `{ level }` from `levels[lang]`, `relationship: "native"` for `en`. The `active` language goes first.
5. `brain2-home-points-period` becomes `points.settings.period`.
6. Style is `classic` for a migrated vault and `cluster` for a fresh one.

The old key is read, never deleted, for one release. A rollback still finds it.

**Backup.** Add `brain2-widgets` to the three tables in `lib/data/backup.ts` ("Visual dashboard"). Restoring a backup that has only the old key clears `brain2-widgets` and migrates again, so an old backup still restores the old layout.

**Compatibility.** `vocab-store.languages` must still list every installed language, because `lib/vocab-lists.ts` writes the 1000-word Items only for those. Installing or removing a Language study instance calls `addLanguage` / `removeLanguage`. A test covers it.

Tests: migrate every persisted version v1–v10 plus a days-until v2 and v3 blob and a vocab v1 and v2 blob; round trip to the same visible faces in the same order. `home-overview.test.tsx` runs against `WidgetContainer` unchanged.

---

## Part 3 — The shell

### W2 · Face, detail, gear

**Split every kind in two.**
- `useFaceData(instance, date)` — the hook that reads stores today.
- `Face({ data, size, style })` — pure drawing, no store reads.

This split is what lets the gallery draw a real face from sample data, lets one kind draw at five sizes, and lets Classic and Cluster share one reading. Do it kind by kind; a kind not split yet keeps its old tile and only offers `standard`.

**The gear.** `HomeWidgetDialog` gets a gear key beside × in the caption (`aria-label="Settings for <title>"`). The gear turns the detail over to its settings side in the same dialog (no second popup, so the `ProgressTile` stacking rule still holds). A live face sits at the top of the settings side and redraws as you change things.

**Shared sections** every kind gets for free, in this order:

| Section | Holds |
|---------|-------|
| Face | Size (the kind's allowed sizes), style (inherit / Classic / Cluster), title, which readout leads when a kind has more than one |
| Day | Follow the clock: inherit / day being viewed / wall clock |
| Kind | The kind's own settings (W6–W9) |
| Guide | Show the guide again |
| This widget | Hide, Duplicate (`many` kinds), Remove (asks), Reset settings, Copy settings as JSON, Paste settings |

Each section has **Reset section**. Settings write through the zod schema; a bad paste is refused with the field that failed.

---

## Part 4 — The look

### W3 · The Cluster

**The brief.** This is the dashboard of your brain. A car dash at night: one dark glass panel, gauges glowing under it, everything readable in a glance, nothing you have to study. The meat is in the detail. It may feel a little surreal (a gauge for habits, an odometer for points) but it reads like a real instrument.

**The inspiration.** Six photos in [`mockups/dashboard-inspo/`](mockups/dashboard-inspo/): a late-1980s Oldsmobile digital cluster (`olds-*`) and a 2010-era Prius center display (`prius-*`). What we take from each:

| From | What we take | Where it goes |
|------|--------------|---------------|
| Oldsmobile | Aqua vacuum-fluorescent glow on a smoked, near-black glass | The **VFD** lamp |
| Oldsmobile | **Arc gauges** built from separate tick segments, with endpoint letters (E · F, L · H, C · H) and a small pictogram in the middle | Progress, Harvest, Day lamp, Language known meter, Solar |
| Oldsmobile | A big arc of numbered ticks around one large segment numeral (the MPH dial) | Points, Countdown |
| Oldsmobile | **Ghost segments**: unlit `888` behind the lit digits | Every segment numeral |
| Oldsmobile | Red-orange segments only at the danger end of an arc (redline, hot, empty) | Coral danger ticks: a miss pile, an old inbox, low daylight. Never amber or yellow |
| Oldsmobile | **Bar-graph tach**: a rising stack of bars beside a numbered scale | Fractions over time: Plan and lived, Harvest |
| Oldsmobile | ODOMETER label over a small dot-matrix number in the middle of a gauge | The second readout of a gauge (all-time points, days since start) |
| Oldsmobile | Tiny printed caps legends (`FUEL`, `RPM X 100`) and a red warning plate at the edge | Legends; tell-tale plates |
| Prius | Cool white-cyan LCD, huge chunky digits with a small unit beside them (`35 km/h`) | The **LCD** lamp; big readouts |
| Prius | **Bracket scale** `)` with three numbers (0 · 5 · 10) | Small range readouts: rate, pace, words per day |
| Prius | **Selector stack** `P R N D B` with the live letter boxed | Period and mode pickers on the face: Points `D W M A`, Language mode, Moon zoom |
| Prius | **Stair fuel gauge** (F, E, stepped bars) | Battery-like reserves: willpower, harvest left, cards due |
| Prius | **Energy monitor**: a dot-matrix outline with arrows that flow between parts | A flow diagram in large faces and details: habits → points → level; plan → lived; inbox → lists |
| Prius | Clock and `ODO` line in plain small type | The band's corner clock and date |
| Both | The bezel: brushed grey frame, a lip, and a soft glare across the glass | The band itself |

**The band.** One dark glass band spans the dashboard. It has a grey milled bezel with a lip on top, a soft diagonal glare (a CSS gradient, off under reduced transparency), and a faint vignette. Widgets are not separate objects on it. They are **bays** lit behind the same glass. A thin unlit rule separates bays, like the gap between the Oldsmobile's left and right pods.

**Fitting.** The band is wide and short, like a dash. Bays fill it left to right and stretch to its full height. A bay's width is its size. A second band opens below only when the first is full, and it carries the same bezel. Band height is a dashboard setting: low (about 120 px), standard (about 160 px), tall (about 220 px). Inside a bay, a face lays out for the band height it gets, so a gauge grows with the band rather than leaving dead glass.

| Size | Bay width | Good for |
|------|-----------|----------|
| `mini` | 1 unit (about 64 px) | A stacked pair of small arc gauges, a tell-tale, one number. Pet, Solar, Day lamp, Harvest, Inbox |
| `compact` | 2 units | A small dial or a selector stack. Countdown, Moon, Next |
| `standard` | 3 units | A full dial with ghost numerals. Points, Progress |
| `wide` | 5 units | Words and a bar graph. Affirmation, Language study |
| `large` | 7 units | An energy-monitor flow or a chart. Weather, Plan and lived |

Two `mini` bays stack top and bottom in one column, like the Oldsmobile's fuel-over-volts pods. The pet and Solar remainder default to `mini` in a fresh vault. A migrated vault keeps its sizes until you change them.

**Phones and narrow windows.** The band keeps its height and scrolls sideways, with snap points at each bay. A setting lets it stack into bands instead.

**Lamps.**
- **VFD** (Oldsmobile): aqua phosphor on smoked glass, ghost segments visible, slight bloom on lit segments.
- **LCD** (Prius): cool white-cyan on black, chunky digits, dot-matrix pictures.
- Both keep the house phosphor green `--hab-crt-green` for "fine", coral for "act", and never amber or yellow.

**The parts.** One kit in `components/Home/cluster/`, used by every kind's Cluster face: `ArcGauge`, `SegmentNumeral` (with ghosts), `TickDial`, `BarTach`, `BracketScale`, `SelectorStack`, `StairGauge`, `OdometerLine`, `FlowMonitor`, `TellTale`, `Legend`. Each is a pure SVG drawing with props, unit-tested, and shown in the gallery's hero. A kind composes them; it does not draw its own gauge from scratch.

**Buttons and modes on the band.** A car dash is not only gauges; switches and mode keys sit right beside them. The band does the same, laid out next to the gauges in one line:
- **Switch bays.** A narrow bay of real keys between widgets: lit push buttons with a lamp, rockers, and `SelectorStack` letters. Built-in switches: **Follow the clock** (today's menu toggle, moved onto the dash), **Lamp** (VFD / LCD), **Night** (dims the glass), **Edit** (arranging), and **Widgets** (opens the gallery). You place, remove, and reorder switch bays like any widget.
- **Mode keys on a widget.** A widget may put its own keys at the edge of its bay, like a trip button beside an odometer: Points `D W M A`, Countdown `Days / Weeks / Sleeps`, Language study `Word / 1000 / Cards / Level`, Moon `Phase / Sky`. Pressing one changes the face in place and saves to that instance's settings.
- **Dashboard modes.** One selector on the band switches whole layouts, like drive modes: for example **Morning**, **Work**, **Evening**, each a saved set of which bays show and in what order. Optional; one mode by default. _Planned within W4._
- Keys use the house transport-key and milled-fascia language ([`DESIGN_STYLE.md`](DESIGN_STYLE.md#transport-keys)), lit in the band's lamp color.

**Interaction on the glass.** A click on a bay opens the detail. A `SelectorStack` on a face is live: tap a letter to switch the period or mode without opening anything. A tell-tale shows its reason on hover. Segments light in order on load (about 400 ms) and hold still under reduced motion.

**Classic.** Today's satin handhelds (`home-widget-face.css`), unchanged, are the other style. A dashboard can be all Classic, all Cluster, or mixed per widget. Classic lays out in the same bays so editing works the same.

Add a **Cluster** subsection to `DESIGN_STYLE.md` under Palette, beside Phosphor and Milled fascia, with the table above and the photos.

---

## Part 5 — Arranging

### W4 · Edit mode

Faces only move while editing. Outside edit mode a click opens the detail, as today.

- **Enter.** An **Edit** key on the date bar beside **Widgets**, or **Arrange** in the Widgets menu. Esc or **Done** leaves.
- **Look.** The glass dims and the bays light their outlines, like a dash in service mode. Each bay shows a grip strip on top and a resize edge on the right. Clicks do not open details. × still hides. An empty slot at the end of each band, and a new band below, show where a bay can go.
- **Move.** Drag a bay. Others slide to make room in the band; drop commits the new order and band. Pointer events with capture, as `use-plan-rail-drag.ts` does.
- **Resize.** Drag the right edge. It snaps to the next width the kind allows and shows the width in units while dragging. Band height is set for the whole dashboard, not per bay.
- **Keyboard.** Arrow keys move the focused face one place. Shift + arrows step its size. The Widgets menu keeps its move keys.
- **Touch.** Same in edit mode; a long press starts the drag so scrolling still scrolls.
- **Undo.** Each drop or resize is one step on the shell's Cmd/Ctrl-Z.

Switch bays and dashboard modes ship with edit mode: they need the same placement.

Tests: drag reorders; resize stops at allowed sizes; clicks do not open details in edit mode; keyboard move and size; leaving edit mode restores click-to-open.

---

## Part 6 — The gallery

### W5 · Widget gallery, install, guides

The Widgets menu stays the quick list (lamp, hide/add, + for `many` kinds). **Widget gallery** opens full-frame.

**Gallery index.** A grid of kinds by family. Each card: the kind's face drawn live from sample data, the name, one line, and a badge: Installed, Installed ×3, or Not installed. A **Parked** shelf holds hidden instances.

**A kind's page.** On cool paper with graph rule, in this order:

1. **Hero.** The face at every size it draws, side by side on a strip of bezel, in the current style, with a Classic / Cluster switch.
2. **What it does.** Two or three sentences.
3. **How to read it.** A diagram of the face with numbered callouts: "1 — the remainder", "2 — the next sunset". Diagram grammar, not decoration.
4. **Where the numbers come from.** Chips naming the room and the store (Habits, Plan, Tracking, Lists), each a link.
5. **What you can tune.** The kind's settings, grouped, one line each.
6. **Ways to use it.** Short cases, many of them about several instances ("one Countdown per trip", "one Weather for home and one for the beach").
7. **Your instances.** Each with Open, Settings, Hide or Show.
8. **Install** / **Add another** / **Add a language** (by cardinality).

Copy lives in `lib/widgets/guides/<kind>.ts`, grown from today's `HOME_WIDGET_CATALOG` blurbs and the readings in `docs/widget-improvement/`.

**Install.** A kind with `setup` asks first, in a short sheet: Countdown asks for the date and what it counts to; Language study asks for the language and native or studying; Weather and Solar ask for a place. Every step has a default, so **Install** alone always works. A `one-per-key` kind does not offer a key already installed.

**First-run guide.** The first time an instance's detail opens, a kind with `guide` lights its parts one at a time with a short note each (three to five steps, **Next**, **Skip**). Off for everything with one setting in the gallery: **Show guides**. Back on from the gear's Guide section.

Tests: install with and without setup; duplicate key refused; guide shows once; Skip marks it seen; the gallery draws a face from sample data with no store reads.

---

## Part 7 — Countdown

### W6 · Days Until remade as Countdown

Each mark is its own instance. What stays: countdown, count-up, and auto; optional clock; unit or decimal; Plan event link and all-day scheduling (`home-days-until-event.ts`).

**New settings.**

| Setting | What it does |
|---------|--------------|
| Count in | Days, weeks, sleeps, workdays (Mon–Fri, skipping Plan days off), hours, or the full unit spread |
| Started on | A start date. The face gains a bar from start to mark, and the detail says how much of the wait is gone |
| Repeats | Never, yearly, monthly. A birthday rolls to next year the day after |
| Face | Numerals, split-flap, odometer, or nixie |
| Milestones | Lines at 100, 30, 7, 1 left (editable). Crossing one lights a tell-tale |
| After the mark | Switch to count-up, hide, or say "Done" for a day |

**Detail.** A calendar strip from start to mark with today marked, the Plan event if attached, milestones as ticks, and a notes field.

**Gallery cases.** A trip, a deadline, a sober streak (count-up), a birthday (yearly).

Tests: every existing days-until test still passes against the instance. Workdays, yearly roll, and milestones each get their own.

---

## Part 8 — Language study

### W7 · One widget per language

Kind `language`, cardinality `one-per-key`, key is the language. "Vocab" is now one mode.

**Relationship** (asked at install, changeable in settings):
- **Studying.** Every mode.
- **Native.** Vocabulary only: word power (SAT / Advanced / Extremely advanced), Flashcards, Look up. No level, no translate, no 1000 words. English installs as native by default.

**Modes.** Today the detail has **Word of the day**, **1000 words**, **Flashcards**, and **Look up**. Each becomes a mode you turn on or off and order in settings. **Level** joins in W8.

**Face** (pick in settings): word of the day; known meter (`312 / 1000`); level badge (`B1`); cards due; streak. Each size draws a subset: `mini` is the level or the due count, `wide` is the word with its definition.

**Settings.**

| Setting | What it does |
|---------|--------------|
| Relationship | Studying / Native |
| Modes | Which modes, in what order |
| Word level | Today's per-language level. With a placed level (W8) it can follow that level |
| Definition in | The language itself, or English |
| Show | IPA, reading (kana / pinyin), article, emoji |
| Voice | Speech voice and rate (`lib/vocab-speech.ts`) |
| Flashcards | Plain pass (today) or Leitner boxes. Boxes save each card's box on the word Item, so the deck remembers |
| Cards per day | New and review caps for Leitner |
| Daily goal | Words or minutes; drives the streak |

**Records.** Favorites move from `vocab-store.favorites` to an attribute (`vocab-favorite`) on the word's Item in that language's My words list, created on first favorite (Law 1). The store keeps reading the old field for one release. Known stays `vocab-known`.

**Migration.** W1 already made one instance per language. W7 moves favorites and drops `vocab-store.active` from use.

Tests: two instances for two languages; the same language twice is refused; native hides the right modes; favorites survive the move; `vocab-lists` still fills words for every installed language.

### W8 · Levels and placement

A placed level per language and per skill, on the CEFR scale (A1–C2). Japanese also shows JLPT (N5–N1) and Mandarin HSK (1–6). The mapping is a table in `lib/language-levels.ts` and the detail says it is approximate.

**Three ways to place.**

1. **Self-check.** The CEFR self-assessment "can do" lines per skill (listening, reading, speaking, writing). About two minutes. Labeled a self-check.
2. **Placement quiz.** An adaptive quiz in the formats the real exams use (DELF/DALF for French, DELE for Spanish, CILS/CELI for Italian, Goethe for German, JLPT, HSK): reading, listening (browser speech), vocabulary, and grammar items, each tagged with a level and a skill. It steps up after right answers and down after wrong ones, and ends with a level per skill and how sure it is. Items are written for Brain2 to the CEFR descriptors and the exams' task types, in `lib/language-placement/<lang>.ts`.
3. **Official practice paper.** For real exam questions. The page links the exam body's own free sample papers. You take one, enter the section scores, and Brain2 converts them with that exam's published pass marks (DELF: four sections of 25, 50 of 100 to pass, 5 minimum per section).

**Open question (Decision 9).** Link and score is the interim answer. A better way to bring real exam questions in is still to find: licensed item banks, exam bodies' practice APIs, or a partnership. Revisit before W8 ships, and keep a `TODO(W8-exam-source)` comment at the placement source switch in code.

**Why not bundle real exam questions today.** The papers belong to the exam bodies (France Éducation international, Instituto Cervantes, the Japan Foundation, and others). Linking and scoring is legitimate and accurate. Copying them into the app is not ours to do. If a body publishes papers under a license that allows reuse, we can bundle that set and say so on the page. See Decision 9.

**Records.** Each placement is an Item of type `language-assessment` in `Languages/<language>`: date, method, level per skill, overall level, raw scores, and the paper's link. Analytics can chart it like anything else.

**What the level changes.**
- Word of the day can follow the level (Common ≈ A1–A2, Everyday ≈ B1, Advanced ≈ B2–C1, Extremely advanced ≈ C2).
- 1000 words starts practice at the rank band that fits.
- The face can show the badge, and a tell-tale lights when a re-test is due (setting: every 1, 3, or 6 months).
- The **Level** mode shows the level per skill as bars, the history as a line, what the next level asks for, and an estimate of known words.

Tests: CEFR ↔ JLPT ↔ HSK table; adaptive steps; DELF scoring (pass, fail on a section under 5); assessment Item shape.

---

## Part 9 — Settings that matter

### W9 · The other 17 kinds

Each row is a kind's own section, on top of the shared ones. Every setting must change what the face or the detail shows; a setting that does nothing does not ship.

| Kind | Cardinality | Settings |
|------|-------------|----------|
| Rituals | one | Which rites count (morning, night, weekly); open on click or show the list; quiet when clear (0 vs hide for the day) |
| Points | one | Period (today's D / W / M / ALL, moved from localStorage); chart window; face: ticker, needle gauge, or number; show possible points |
| Latest award | one | Smallest amount that takes the face; sources (habits, bonuses, inbox); how far back the detail lists |
| Today's Progress | one | Periods on the face (today / week / month); habit piles or fraction; which lists count as to-dos; folds open by default |
| Affirmation | many (per list) | Source list; lines per day (now 5); starting lens; which lenses are on; voice |
| Weather | one per city | City; °F / °C; glance (next change, high/low, rain chance, wind); tides on or off; beach |
| Screen pet | one | Creature and palette; sleep threshold (now 20%); night hours; 12 / 24 h clock; clock on or off |
| Next | many | Look-ahead (today, 3 days, a week); Plan events, planned actions, or both; all-day on or off; a Plan calendar filter |
| Day lamp | one | The thresholds for each word; which bars count |
| Moon | one | Face (sprite, phase name, days to next major phase); chart opens at (zoom stop); True sizes default; place for moonrise and moonset |
| Solar remainder | one per place | Place; counts to (sunset / sunrise, golden hour, civil twilight, daylight left as a bar); format |
| Tracking now | one | Which axes (Activity, Location, Mood, Company); age after which the face warns |
| Night well | one | What counts as a real night (shortest sleep) |
| Harvest leftover | one | Face: remainder, `N left of M`, or bar |
| Inbox mill | one | Which lists are excluded (Monkey brain now); age that lights the tell-tale |
| Already flowing | one | Thresholds for Quiet / Flowing / Pushed / Mixed |
| Plan and lived | one | Waking hours window; thresholds for each word |

Do these kind by kind with the W2 face split; each lands with its tests.

---

## Part 10 — Your own widgets

### W10 · Make a kind

**Planned, after W1–W9.** Joins [`MODULE_PLATFORM.md`](MODULE_PLATFORM.md) rung 2.

- **Readout kind.** Pick a source (an Analytics stat, a list count, an attribute sum, a habit), a face (number, bar, word by thresholds, sparkline), and a name. It saves as a `WidgetKind` in data, not code, and installs like any other.
- **Module cards.** The Modules room's widgets (analytics stat, list summary, writing prompt, random task, rules) become kinds the gallery can install on the Visual dashboard.
- **Share.** Copy a kind or an instance as JSON (W2 already copies settings), paste it on another vault.

Law 5 holds: a made kind runs offline from its saved definition.

---

## Order of work

1. **W0** names. Small, safe, and it makes every later diff read right.
2. **W1** model and migration. Everything after builds on it. Ship it with the old faces untouched.
3. **W2** shell and gear, with the face split for Progress, Points, Pet, and Solar first.
4. **W3** the band, the gauge kit, and Cluster faces for the four split kinds.
5. **W6** Countdown and **W7** Language study, which are the two the request names. They can run side by side: they touch different files.
6. **W4** edit mode.
7. **W5** gallery, install, guides.
8. **W8** levels and placement.
9. **W9** the remaining kinds, one at a time.
10. **W10** your own widgets.

---

## Docs to change

| Doc | Change | When |
|-----|--------|------|
| `components/Home/README.md` | "Overview widgets" becomes "Visual dashboard"; the widget definition; file table rows for new files; Stores row gains `brain2-widgets` | W0, then each phase |
| `lib/README.md` | `lib/widgets/*`, `lib/language-levels.ts`, `lib/language-placement/*` | W1, W8 |
| `docs/FUTURE_WIDGET_IDEAS.md` | New words; ideas are written as kinds with a cardinality | W0 |
| `docs/widget-improvement/README.md` | New words; links to gallery copy | W0, W5 |
| `docs/DESIGN_STYLE.md` | Cluster subsection with the inspiration table | W3 |
| `docs/mockups/dashboard-inspo/` | The six reference photos (added 2026-10-20) | Now |
| `docs/README.md` | Index row for this plan | Now |
| `components/Modules/README.md` | Module widgets vs dashboard widgets; W10 join | W0, W10 |
| `docs/screenshots/` | Retake the Home shots | W3 |
