# Plan of action — screens first, mechanics intact

This is the **work order**. It combines Person B’s screen brief, the
[`UI_NEXT.md`](UI_NEXT.md) executable UI lane, the gap-closing ontology list,
and the short “do these / skip the 70-item audit” instruction. Conflicts are
resolved here so later agents do not re-litigate them.

**Brief (Person B).** Do the screens. Keep A’s mechanics. Measure **interiors**
against Home → **Habits** (favorite surface; most developed / closest-to-perfect
UI — Habits Tab Control Panel, analog furniture, Willpower gems, CRT phosphor,
skeuomorph from [`DESIGN_REFS.md`](DESIGN_REFS.md)). Measure the **cabinet**
against Lists Icons (`docs/screenshots/05-lists.png`) and the **frame** against
[`DESIGN_STYLE.md`](DESIGN_STYLE.md) (motif, cabinet, impossible — not a frozen
Windows dialog). Not against READMEs alone.

Brain2 is a **living, perfect second brain**: a vintage machine that is also
a painting (motif, cabinet, impossible motion), whimsy in *mechanics*. An **item** is captured once and then
**connected and used in as many rooms as it can honestly serve**. **Analytics
is the heart** — mass personal data collected, presented, analyzed, and turned
into the next tool. The header mark is **BRAIN2**. Persist keys are
**`brain2-*`** (`lib/storage-keys.ts`); leftover **`cogs-*`** keys are copied
and dual-written, never deleted. A record is a map of a life: dated, incomplete,
and kept at its own order of abstraction. Description stays distinct from
inference. The next period starts where the last one stopped. The miss between
an order and its report is the next input. A coincidence is shown and never
called a cause. How those three ideas join — and the laws that keep them from
eating each other — is [`MAP_LOOP_MEANING.md`](MAP_LOOP_MEANING.md). The work
orders stay the work orders: map
[`ScienceandSanityBrain2.md`](ScienceandSanityBrain2.md) (Wave 13), meaning
[`JungBrain2.md`](JungBrain2.md) (Wave 14, not started), loop
[`cyberneticsbrain2.md`](cyberneticsbrain2.md) Part 3 (Wave 15, not started).
Beauty is not a theme pack.
If a change would look like a second product next to Habits Daily *or* Lists
Icons, the new UI is wrong — not Habits, not Lists. How to extend:
[`DESIGN_STYLE.md` — Look at Habits](DESIGN_STYLE.md#look-at-habits--how-to-extend).

---

## How the briefs were combined

Four documents were saying overlapping things. Discretion:

| Source | What it is allowed to decide |
|--------|------------------------------|
| Person B | Visual test, protect list, the two style breaks, contents-plainness, `~` + **est.**, Working Now as one gesture, gold-standard Lists polish. |
| [`UI_NEXT.md`](UI_NEXT.md) | Ranked UI sequence, and every **do-not** that stops a critique item from becoming the wrong medicine. |
| Gap-closing / [`ARCHITECTURE_MODULARITY.md`](ARCHITECTURE_MODULARITY.md) | Ontology, write door, period-as-data, shadow DBs, module rungs. **Corrects** the gap list where it names the wrong file as the write door. |
| “Do these / skip the rest” | Analytics sample-size, shared Analytics range, chart → Lists, Plan capacity line, Notes honesty, global Working Now, item history, selective restore, workflow dry-run + run log. Everything else in the 70-item audit is **out**. |

**Hard overrides (Person B vs UI_NEXT).** Person B asked to collapse empty
sidebars, hide capture behind `File / Capture / Review`, merge Home/Analytics
streaks, and treat Lists’ two status counts as a data bug. Those fight the house
style. **UI_NEXT wins on those five.** Empty reserved space is Explorer furniture.
A toolbar *is* the chrome. Glance vs analysis may show the same number. Lists’
left count is sidebar scope, right is the open location — labels are fair;
“disagreeing counts” is not.

**Hard override (gap list vs architecture).** Do **not** “route every mutation
through `lib/services/item-mutation-service.ts`.” That file is workflow *wiring*.
The one write door is `task-store` as implementation, `taskRepository` as the
caller-facing seam; workflows and implied actions keep listening via
`dispatchItemMutation`. A third API is a sixth door.

**Hard override (gap list vs “do not build”).** Do **not** wire Just-Start →
Tracking. Do **not** add extra capture tokens, list-rule packs, schema
inheritance, operation panel presets, a custom Metrics chart builder, user
Telegram grammar, or inline Done **est.** confirm (CompletionTimeLine already
does that).

**Foundation is not greenfield.** `Item.title` is already the field of record
(persist v11–v12, `itemTitle()`, `lib/item-title-reads.test.ts`). `Task` remains
the persisted document (`ItemRecord = Task`). Do not collapse task-kind fields
onto `Item`. The remaining naming debt is parked-note text living in
`description` because search indexes `description` and not `body`
([`CANONICAL_FIELDS.md`](CANONICAL_FIELDS.md) open question).

---

## Protect first (do not sand these down)

Keep motif + cabinet + the impossible. Never SaaS the frame; never plain the
contents; never Lucide-the cabinet; never freeze the frame as a Windows dialog.

- **`~` + dashed amber est.** — basis in tooltip, click to correct
  (`lib/estimated-values.ts`, `components/Home/ToDo/CompletionTimeLine.tsx`).
  Spread it to every derived number still wearing a straight face.
- **Tracking** — paint / scissors / occupancy-≤-24h / ghosts-to-confirm / sleep
  that cannot disagree with the grid. Photographed pen tray stays in the open.
- **Working Now** — one gesture → Done row + `timeLogs` + Tracking block +
  habits. Loudest control on Operations too. Stop must stay one click.
- **Home → Habits** — favorite surface; most developed UI. Instrument rail,
  analog furniture, WILLPOWER week, CRT phosphor, designrefs skeuomorph. Look
  here when extending Plan / To Do / Goals / Tracking / Lists interiors. Refine
  packing; do not sand the console into cards, and do not clone `.hab95` onto
  Explorer chrome.
- **Lists** — orbs, velvet, auto-organize, Explorer furniture. Refine; do not
  restyle toward SaaS. Do not smash the title bar into a Habits cockpit.
- **Feral module interiors** — Tidy, Film DNA, Trip map. Unique look, shared
  Items. Do not sand into `components/ui/`.
- **Cmd-K** over the current screen, colon-path capture, honest undo of real
  writes (`lib/action-history.ts`, wired in `app/page.tsx`).
- **Win95 safety** — confirmation + undo, not “make Delete red.” Grade
  destructiveness from the running app.

---

## How future workers know they didn’t cheat

- Judge the **open screen**, not the README. If the only evidence is
  `DESIGN_STYLE.md` or a folder README, it is not a UI fix.
- Sit before/after next to `05-lists.png` and `05-lists-content-*`. If it looks
  like a second product, revise the new UI.
- Recapture affected `docs/screenshots/*.png` + `.txt` **in the same step**. No
  confident virtues for unphotographed tabs.
- Empty-state **and** populated-state both. A chart that looks smart at zero is
  a bug. Default `npm run capture-screenshots` clears localStorage
  (`COGS_FRESH`); only Tracking is seeded. Empty to-do / plan / funnel / zeros
  are the harness, not the decade-scale product. Recapture with
  `COGS_FRESH=0` against a loaded fixture before treating empty theater as
  product truth.
- Count things you name (view kinds = the actual `MODULE_VIEW_KINDS` length).
  Don’t invent 18.
- Destructive actions quieter than primary; never same-size ⚙ and ✕.
- Duplicate chrome is a bug when it is **two sources of truth** (two dates that
  can disagree), not when two surfaces glance at the same fact.
- New rooms: both halves — Win95 furniture **and** photographed objects —
  unless the interior is a document (spreadsheet) or an allowed-feral module.

---

## Do not build (wrong medicine)

From the audit and from [`UI_NEXT.md`](UI_NEXT.md). Treat as closed.

- Reusable list-rule packs; attribute-schema inheritance; synced operation
  panel presets; custom Metrics chart builder; user-extensible Telegram grammar.
- Just-Start → Tracking wiring; extra capture tokens (`tomorrow` / `30m`
  already parse); inline Done **est.** confirm.
- Collapse empty Queue, Plan sidebar, funnel buckets, or KPI *frames* so the
  workspace reflows when the last item completes. Reserved space that says
  “nothing here yet” is furniture. **Exception:** a chart *axis* performing
  precision with no series is contents-lying — keep the frame, put one sentence
  inside it.
- Hide Tracking pens, To Do sort/filter, or header capture doors behind a
  single popover or a macOS-style `File / Capture / Review` menu.
- Merge Home streaks with Analytics → Streaks.
- Extract a shared `PeriodNavigator` with visual variants. Unify the *period as
  data*, not the chevrons. Habits’ pill chrome must not become the house look.
- Merge Goals’ Day/Week/Month/Year/All (objectives, priority this period) with
  Goals’ period-kind filter (goals of this kind). Label them; do not fuse them.
- Sand installed module interiors into `components/ui/`.
- Restart “collapse `Task` onto `Item`” as if persist v12 never happened.

[`UI_CRITIQUE.md`](UI_CRITIQUE.md) is an unranked observation dump. Do **not**
work it top to bottom. After a populated recapture, delete critique items that
were only zeros.

---

## Waves (sequence that actually moves the product)

Work top to bottom. Later waves assume earlier ones. Parallel **lanes** inside a
wave are named so agents do not share files.

### Wave 0 — See the real app (prerequisite for every visual PR)

**Lane: Capture.** `scripts/screenshot-manifest.mjs`, `scripts/capture-screenshots.mjs`,
`docs/screenshots/`.

- Recapture against a **populated** store: `COGS_FRESH=0 npm run capture-screenshots`
  while `npm run dev` is up, using a backup with lists, painted weeks, planned
  work, and operations. Keep a dedicated fixture if local data is precious.
- Add **Docs** as `12-docs*.png` (only top-level tab with no image).
- Add missing *distinct* surfaces, not every period combo: Lists Icons + Details
  content modes; Scheduler Gantt/Dependencies only if they actually differ; one
  Operations panel per kind that is not Home; Modules board vs one non-Trip
  workspace.
- Then walk the running app (hover, confirm, undo, keyboard) for anything still
  intended to change.

### Wave 1 — Analytics correctness (not chrome) ✅

**Lane: Analytics.** `components/Analytics/**`. Shared date state lives in
`analytics-range-store.ts` — **do not** touch Home Plan or Scheduler for this.

This is the first *product* wave because lying numbers are worse than an ugly
calendar.

- [x] Interpretive tabs (Calibration, Regret, Correlation, Context Switch, Plan
      vs Reality): show **n / sample-size**. Do not present a sparse week as a
      finding. Hide or watermark when the window is too thin.
      Calibration/Correlation: a sentence + n + caveat.
- [x] **One shared date range** across Analytics tabs, remembered, labeled once
      (“last 30 days” or the actual window). Sleep / Habits / Tracking /
      Plan-vs-Reality comparable without re-picking.
- [x] From a chart: **open the underlying items in Lists** (the Lists jump is
      the loop). CSV was optional and is **not** shipped.
- [x] Empty charts: no full axes, blank heatmaps, or KPI cards performing
      precision. One sentence **inside the existing chart frame**.
- [x] Group the tabs: categories on a **bar** (Behavior / Time / Accuracy / Meta /
      Library), views of the selected group on a **view changer** beneath. Item
      Types stays in Analytics as the Library browse surface; Settings still
      edits types. **Do not** treat “move Item Types to Settings” as a goal.
      Expansion of Analytics (more views, better viz, bulk drill) is desired.
- [x] Polish after honesty: habit bars sorted by completion; Tracking breakdown
      + tag in one drill card; Plan vs Reality is a visual, not two lists
      (window ribbon of every period in the range); Context Switch legend for
      “switch”; Regret: one line of what the number *is*; Metrics: jump to log
      that metric; Reflection: prompt history.
      **Do not** merge Home streaks here (stayed split on purpose). Sleep is
      copy-linked to Home → Tracking.
- [x] Cross-section density (linked small multiples over the shared range) and
      Item Types library (sort, counts, drill, Open in Lists). Canvas may be
      contemporary; **title bar + status bar** stay an instrument frame beside Lists. Nav,
      range, and canvases are the studio observatory (see `DESIGN_STYLE.md`
      rule 9).

**Remaining gaps (leave):** Sleep cannot switch the Home night without
`app/page.tsx`. No CSV. Streaks stay split on purpose (Home glance vs Analytics
analysis). Predictive / ML analytics and a custom Metrics chart builder are out.

### Wave 2 — Two style breaks (hours, unambiguous, do next) ✅

These cannot sit beside Lists. Worth more than the rest of the critique combined.

**Lane: Plan.** `components/Home/Plan/**` only. ✅

- [x] Kill dark slate, purple chips, large radii, and “Schedule and organize your
      time with elegance” (`plan-panel.tsx`).
- [x] Win95 window, gray calendar, same furniture as Tracking/Operations
      (`.plan95` in `plan-chrome.css`).
- [x] Events: time range + wrapped title + `+N more` + tooltip.
- [x] Keep Plan on `useCurrentDate`. Dragging unplanned items onto the grid stays
      the sidebar’s job when it has work — reserved empty rail, no ghost
      illustration.
- [x] **Capacity line** in the planned-tasks sidebar: planned minutes vs waking
      window for that day (“11h into a 9h window”).

**Remaining (Plan, leave):** Capacity needs both ends of a night (or 3+ typical
nights). Official `docs/screenshots/02-home-plan*.png` were recaptured 2026-09-21.
**Middle ground shipped** — do not sand opalescence off chips; do not recramp
cells.

**Lane: Scheduler.** `components/Scheduler/**` only. ✅

- [x] Wrap Funnel / Gantt / Dependencies in real window chrome (same family as
      Lists/Operations/Tracking) — `.sch95` in `scheduler-chrome.css`.
- [x] Human caption in the title bar (`Scheduler — Funnel` / Gantt /
      Dependencies); `h2` **Enhanced Scheduler** removed from
      `enhanced-scheduler.tsx` + its test.
- [x] Funnel/Gantt/Dependencies are **view modes** (toolbar); Always→Day are
      **periods** (folder tabs + Address) — different chrome, not two sibling
      tab rows.
- [x] Empty buckets stay reserved **one-line furniture**, not seven `0 · Empty`
      cards and not mascots.
- [x] Task cards carry orbs the way Lists items do — chrome first, then
      contents. Drag into buckets stays the mechanic.

**Remaining (Scheduler, leave):** `docs/screenshots/06-*.png` (+ `.txt`) are
stale. `~` / **est.** on durations is Wave 4. Do **not** make Gantt editable /
carry-over / commitment budget.

Do **not** extract shared calendar chrome between these two lanes.

### Wave 3 — One period cursor (data bug, not “duplication”)

**Lane: Period.** `lib/use-current-date.ts` (or a new `usePeriodCursor` beside
it), `components/Home/ToDo/todo-panel.tsx`, Habits week nav *data* only.

- Give To Do the **same selected day** as the Home header. Today `todo-panel.tsx`
  owns a private `focusedDate` / `TodoPeriodNav`; Plan and Tracking use
  `lib/use-current-date.ts`. The two navigators on To Do **can disagree**; the
  table obeys the inner one. That is the bug.
- Lift period as **data** across Habits week nav, To Do, Tracking, Plan,
  Scheduler, Reviews. Leave each surface’s chevrons local and Win95.
- **Goals:** label which control is “priority this period” vs “goals of this
  kind.” Do not merge.

### Wave 4 — Finish the est. convention

**Lane: Estimates.** `lib/estimated-values.ts` plus call sites. Audit, then
mark. Do not invent a second chip language.

Surfaces: To Do Done, Day Log, Morning Review sleep clocks, Analytics sleep `~` / **est.**, Reviews
Assumed Times, Settings “usually fall asleep around…”, Settings sleep copy,
Goals, Scheduler durations. Settings body-copy that *is* the estimate belongs
in the chip tooltip, not three paragraphs above a time field.

### Wave 5 — Lists gold standard (polish, then copy) ✅

**Lane: Lists.** `components/Lists/**`, `filemanager98.css`.
Explorer chrome is the Lists gold standard. **Interiors** now look at Home →
Habits first ([`DESIGN_STYLE.md` — Look at Habits](DESIGN_STYLE.md#look-at-habits--how-to-extend)).
Do not restyle this title/toolbar toward the Habits cockpit.

- [x] Toolbar separators like Explorer (New / View / Organize).
- [x] Optional labels on the two status counts (this folder vs tree) — **do not**
      delete one as a “bug.”
- [x] Stock the velvet: wider default icon grid so seven orbs don’t look
      abandoned (`lib/velvet-icon-grid.ts`).
- [x] **Default list display:** orbs (and a checkbox if the list is a checklist),
      not a lone blue hyperlink on white.
- [x] Inspector: facts (count, type, last touched) plus actions; Delete stays
      gray, separated, confirmed — not a sixth identical sibling.
- [x] Drop the nested duplicate title bar; inner caption = display mode.
- After this wave, other rooms copy Lists — they do not restyle Lists.

**Remaining gaps (leave):** official `05-*.png` captures are still stale
(write-ups updated). Saved icon positions stay put until **Auto-organize**.
Recapture later (`COGS_FRESH=0`). Do not restyle Lists toward SaaS.

### Wave 6 — Tracking chrome diet + Working Now everywhere

**Lane: Tracking.** `components/Home/Tracking/**`. ✅ Do not touch paint math,
sleep↔grid agreement, occupancy, ghosts, or pen nesting
([`COUNTS_AS.md`](COUNTS_AS.md), [`PEN_ACTION_FORMATS.md`](PEN_ACTION_FORMATS.md)).

- [x] Sleep this day form removed from Tracking (paint / block editor / Morning Review instead). Keep **est.** on remaining sleep clocks.
- [x] Open the grid on the first unpainted waking hour, not midnight.
- [x] Fold *settings* (cell size, From/To defaults, view options) into View
      settings. Pen tray is a photographed plate (View settings picker; default Cat traces).

**Lane: Working Now (global).** `app/page.tsx`, `components/cognitive-state.tsx`,
`components/Operations/WorkingNowControl.tsx`. Keep Home Tracking’s write path.

- Live indicator in **global chrome** (header or Cognitive State always-on),
  not only Home → Tracking. Stop is one click from Lists/Docs/Scheduler.
- On the Operations board, Working Now outranks Settings without becoming a
  SaaS primary.

**Remaining (Tracking, leave):** official `08-*.png` (+ `.txt`) are stale.
Working Now global did **not** ship — still this wave.

### Wave 7 — House chrome (grouped instrument, not a gray dialog)

**Lane: Shell.** `app/page.tsx`, `app/win95.css`, header dialogs.

- Eleven equal buttons will wrap. Group by verb (capture / review / system)
  with **Win95 separators**, not a macOS menu bar and not badge mystery meat.
- Leave Quick Add + Review/Inbox badges visible. Tooltips that say *what* the
  5 and the 1 are (oldest due, unclarified count).
- One Capture *grouping*, not three unexplained peers — **without** hiding the
  doors in a File menu.
- **From Notes:** live listing is this Mac (Notes.app). Electron IPC or
  localhost `/api/notes`. If you're on a phone browser, say so in the dialog.
  Don’t look broken.
- Home: do not collapse point cards when they have real four-digit values. Invert
  *empty* theater: urgent Needs Attention should not hide behind a disclosure
  while zeros take the fold. Expand Needs Attention by default when count > 0.
  The TOP strip (date + Review + points + Today's Progress) is **shared by all
  five Home tabs** — see Home interiors. Narrower wells ≠ hide real scores.
- Review: intent is a **square badge** in leftover strip space (not a full-width
  banner). Keep a “not now, ask tomorrow” so Dismiss is not the only way past
  a real deadline. Peek: still `HomeReviewBanner` full-width Alert.
- Dialogs: one size ladder (S/M/L). One save-vs-live rule, stated by the buttons.
  Cancel wherever Save exists.
- Item detail popup vs page: same tab vocabulary. List picker is secondary; don’t
  let it dwarf the body. Delete subordinate to Save.

**Lane: Home interiors** (after period cursor). Habits / To Do / Goals only.
A sibling owns the Home dashboard TOP strip files + `components/Home/README.md`
— record intent here; do not share those files.

- **Home dashboard TOP strip (all tabs — landed).** Date + Review due +
  one Points tile + **Today's Progress** is one shared instrument on Habits /
  Plan / To Do / Goals / Tracking. Not Habits-only. Intent vs peek:

  | Beat | Intent | Peek |
  |------|--------|------|
  | Shared analog strip | Same wells / CRT / leftover squares on every Home tab. | **Landed.** `HomeOverview` on all five tabs. |
  | Narrow wells | Compact stats that share one height and grow together up to 200px. | **Landed.** Equal-height tiles; wrap only when narrow. |
  | Square widgets | Review, one Points tile, Latest award, progress, screen pet, Days Until. Affirmation, weather, Next, Day lamp, Solar remainder, Tracking now, Night well, Harvest leftover, Inbox mill optional. × asks Are you sure? Click opens a silver handheld. | **Landed.** Caption plate + CRT + aligned footer. Detail is dark wells, nixie digits, chunky keys. |
  | Value-bar numerals | Centered. | **Landed.** |
  | Three-color fills | `percentLedTint` + `gradeTubeColor` + `outputGradeTubeColor`. | **Landed.** |
  | CRT | One green for CRT values: `--hab-crt-green` (`#7dffc4`) with grade-readout `--hab-crt-glow` (`0 0 3px`). Home strip matches Week grade / Perfect output. | **Landed.** Shared on `.home95` + `.hab95`. All Time shares the same face. |

  File packing stays with the Home sibling. Do not restyle Plan / Tracking
  interiors to match this *strip*. When those interiors are worked, look at
  Habits Daily (Habits Tab Control Panel, analog furniture, Willpower gems, CRT) — not this
  strip, not a card kit. See
  [`DESIGN_STYLE.md` — Look at Habits](DESIGN_STYLE.md#look-at-habits--how-to-extend).

- Habits Daily visual: ✅ metal console (`.hab95`, contained — no 100vw
  nacre slab), Today **solid mint** (not a gradient), photographed gems + picker
  (`habitGems`), WILLPOWER **side column / orb**, analog cockpit rockers,
  inset Daily/Weekly/Monthly keys above the sheet (milled bay; active = CRT +
  power lamp), header
  Habits + date + Settings, noble-gas tubes for Week grade / Perfect output,
  Daily heatmap as a **light** sidebar mosaic, **SORT HABITS** custom plate
  **above** grouped rockers (heatmap / Day view / hide / Loading bar /
  **Small LEDs**).
  The leftover white block was Needs Attention’s Home `#fff` card after
  `habit-chrome.css` failed to parse `aspect-square` (now `aspect-ratio: 1`).
  WILLPOWER stays a side column; **36** gems; furniture is `--chrome-face`
  (never `#c5c3bc`); CRT is off by default (`.hab-crt`). Hairline texture on
  furniture is wanted. Depth & spacing (nested bevels, tight pack, one header
  unit at Tracking scale) is house style —
  [`DESIGN_STYLE.md`](DESIGN_STYLE.md#depth--spacing). **Daily visual (working
  tree):** recessed Yes/No panel lamps (tint as on-color, not blast-white); gem only as far-left inset pressable
  (streak/× under the full title); **Day view** ON = today column + weekly %
  on the right; **Loading bar** default ON = quiet milled 10-pip channel + text
  % (OFF = smaller numeric LED — not a toy equalizer, not pastel bars, not cell lamps as percents).
  File-level packing: [`components/Home/Habits/README.md`](../components/Home/Habits/README.md#daily-layout--chrome-intent)
  (implementer owns that README).
  Still later: group rows by input kind; label the two 0% bars. Deferred from
  this interior: seraph-wing logo, ruby Quick Add, beetle-wing photo, ribbon-cable
  table edges, barrel-distortion CRT.
  **WILLPOWER week (shipped — example of perfect design).** Do not restyle
  this rail from another lane. Week-complete gems collect small around the
  crystal; row gem inverts while contributing; plate pinned to the rail foot;
  plate click is physics stir (crystal PNG occludes stones behind it);
  Settings still changes the orb. **Small LEDs** is the fifth Daily rocker
  (default ON = 15px; OFF = fill the cell) — not Loading Bar. See
  [`DESIGN_STYLE.md`](DESIGN_STYLE.md#willpower-gems--example-of-perfect-design).
  Do not grow the plate. Do not Lucide the satellites. Do not put
  change-image back on the plate. Do not change completion math. A sibling
  is on load jank — leave that lane alone. Habits README stays with the
  implementer.
- **Divine Machinery (docs: [`DESIGN_REFS.md`](DESIGN_REFS.md)).** Fawn Phase A
  **landed** on the Daily Habits interior only (table, WILLPOWER column, progress,
  Needs Attention) — jewel-PCB cartouche, packed wells, phosphor-in-bezel +
  nacre bloom sliders, lace lining; CRT/interlace is a CSS overlay (`.hab-crt`,
  off) not a fake-precision chart.   **Window gray shipped** (Settings set-point vs 24-min `--chrome-face` drift; never `#c5c3bc`). **Pinned mill title bar shipped** (`AppHeader`: full-width BRAIN2 caption + friend jewel + Friend / Review / System / optional **now** well / Capture groupboxes; Names latch; **now** between System and Capture when a Working session is live). Click the photograph for friend details. The chat button asks for a Stardew-style bubble (`lib/friend-suggestion.ts`: habits / To Do / Next Actions / affection / whims; species quirks). Click the bubble for the mission sheet: the task opens item detail on top; Accept lasts until the end of the day; Decline asks for a breakdown, then a first step, then a reason. Finishing an accepted mission grants friend points and a small cheer. Worn friend **persists across refresh**; auto-shuffle only on **Monday**. Gallery **Details** = history + personality. Preapproved pack from `animalsrcs/` (unnamed until you name them). Delete confirms. **Text-field focus is navy `#000080` app-wide**. **Later:** listBias UI, unsolicited clock, trinkets, **learned / predictive personality**. Plan: [`FRIEND_COMPANION.md`](FRIEND_COMPANION.md). Top tabs are **phase later**; do
  not Lucide the cabinet or costume Lists/Plan/Scheduler as one pixel screenshot.
  Those frames may speak pixel, silver, and one dissolve
  ([`DESIGN_STYLE.md`](DESIGN_STYLE.md)). Plan opalescence, Analytics studio exception (title+status stay
  Lists; interior is light paper, not dark mode), hairline texture,
  and WILLPOWER rules stay (small orb, pin to rail foot, PNG occludes stones
  behind the crystal). **WILLPOWER week is shipped** — the
  [canonical example](DESIGN_STYLE.md#willpower-gems--example-of-perfect-design).
  Do not “finish” the plate by growing it or putting upload back on the click.
- To Do: Filters & Sort popover already exists on Scheduler — match that
  pattern, don’t invent a third. Tooltip + amber/red on **Days (pushed)**.
- Goals: chunky −1/+1, quiet Log; Direction “never” / `0/0` as warnings.

When adding marks, use orbs (or equally specific photographs), not a Lucide set.
Tables may stay austere — they are documents inside the cabinet.

### Wave 8 — Operations, Docs, Modules (both halves)

**Lane: Operations.** `components/Operations/**`.

- Keep the CRT idea; make the phosphor readable.
- Empty CRT: readable type + preset cards that **preview** panels. Shape is a
  consequential choice — show it before commit.
- Tooltip on disabled New Operation.
- Menu bar vs panel tabs (don’t use the same bevel twice). Queue stays docked;
  empty is information, not a collapse-to-nothing.

**Lane: Docs.** `components/Docs/**` + capture scripts.

- Capture in `npm run capture-screenshots` (`12-*`).
- Page-setup dialog for Font/H-font/Page; toolbar keeps B/I/U/size.
- Status bar: `Saved 12:07`, not paste tips.

**Lane: Modules board.** `components/Modules/` board chrome only — **not**
Tidy / Film DNA / Trip interiors.

- Window frame + orb identity (it currently has neither half).
- Guard delete; explain workspace vs widget. Title bar is a caption, not a
  bordered input. Kind glyphs on view tabs. Dismiss the permanent onboarding
  sentence. Installing a room should feel like putting a new cabinet in the
  house.

### Wave 9 — History, recovery, automation you can debug

Leftover capacity from the audit. Do these; skip the rest of the 70.

**Lane: History.** Item detail + `lib/action-history.ts`.

- Per-item activity history (what changed, when) on item detail — plan-vs-reality
  at the item needs this. **History UI shipped** (`lib/item-activity.ts` +
  Item Detail History tab). Last-write undo stays `action-history.ts`.
  Selective restore remains the Backup lane.
- Make undo more total *when touching these files*: list deletes, schema edits,
  workflow runs as labeled actions. A visible “Undid: …” toast with redo. Do not
  boil the ocean in one PR.

**Lane: Backup.** `lib/data/backup.ts`, Settings, `data/recovery-backups/`.

- Per-store **selective restore** with a preview. **Shipped (backup half):**
  `previewBackup` + `restoreBackup(backup, { storeKeys, mode })` and Settings
  checkboxes (merge or replace; Win95 confirm, not red Delete).
- Surface rolling `data/recovery-backups/` as a first-class restore source, not
  a hidden folder. **Shipped:** GET `/api/recovery-backups` lists the folder
  when it exists; Settings shows those snapshots as a read-only preview source.
  Automatic rotating snapshots can follow once restore is a feature.

**Lane: Workflows.** `lib/workflow-engine.ts`, `components/` workflow UI.

- Dry-run (engine already supports omitting the adapter) plus a **run log** in
  the UI. Inspectable before trusted.

Durability beyond that (IndexedDB for the whole store, WAL,
`PersistStatusBanner` as a verified write, append-only per-field log) waits
until the Item graph’s remaining naming debt is closed — otherwise you snapshot
the wrong shape forever. Track it; don’t start it in the same PR as screens.

### Wave 10 — Ontology (continue Jeff Mod; do not restart)

**Lane: Item.** `lib/types.ts`, `lib/task-store.ts`, `lib/migrations.ts`,
`lib/item-utils.ts`, `lib/search.ts`, `docs/CANONICAL_FIELDS.md`.

Order:

1. Owner decision on parked notes: index `body`, move note text there, then
   `description` as a true title mirror. Write the migration. Keep a read shim
   for a release.
2. One write door as architecture already states (`taskRepository` /
   `task-store` / `dispatchItemMutation` listeners). Name the cross-store
   *transaction* that habit-tracking-sync, sleep-sync, work-session, points, and
   action-history already form.
3. Evict shadow databases: port `module.config.houseCleaning` and
   `module.config.tripItinerary` onto Items. Stylesheets untouched. Then Tidy
   subareas and trip stops appear in Cmd-K, Scheduler, ingest, and Analytics.
4. Habits, sleep, minutes, and plan prose keep their fast shapes as
   **projections** of Items, not independent truths.
5. Module rungs 2–4: manifest + grants (user approves once, visibly); then
   install wizard with dry-run; then LLM mapping assist at install time only
   ([`MODULE_PLATFORM.md`](MODULE_PLATFORM.md)).
6. Mark derived habit cells: every `habit-tracking-sync.ts` auto-fill carries a
   `FieldEstimate` and **est.**, with a derived-vs-ticked glyph on the grid
   (pairs with Wave 4).

Scheduler haunted mechanics *after* the window exists (Wave 2): remaining
commitment vs hours that exist; editable Gantt with slip copy; auto carry-over
§7.7. That is mechanics, not chrome — still later than honesty and the style
breaks.

### Wave 11 — Idea-bank top 10 (realistic leftovers)

Sep 2026 audit of the “realistic and worth doing” slice in
[`BRAIN2_FEATURE_IDEAS.md`](BRAIN2_FEATURE_IDEAS.md). Most of that slice is
**already shipped** (Gantt/CPM, Plan banners, backup JSON, nested lists,
formulas, notes/Docs, operations phases/next-rail/post-mortem, Direction
report, carry-over, event checklists, smart-parse, capture hotkey, priority
weights, Metrics change-points, Kanban-in-Modules). Do **not** rebuild those.

These ten are the highest-impact **gaps**. They stay offline-first and in
house style. Wave **9** already named #153 — finish it here as item 1, then
the rest. Parallel lanes as named. Do not start Wave 12 until 1–3 are real.

1. **Item history + selective restore (#153).** Lane: History / Backup.
   **History UI shipped** — append-only ledger `lib/item-activity.ts`, History
   tab on Item Detail page + popup. `lib/action-history.ts` stays last-write
   undo, not the ledger. **Backup half shipped** — Settings per-store preview
   restore (merge or replace chosen keys) and `data/recovery-backups/` as a
   read-only source when that folder exists. Do not touch `item-activity.ts`.
   This is Wave 9.

2. **Needs Attention: neglect + zombies (#239, #258).** **Shipped.** Lane: Home
   interiors (`lib/needs-attention.ts`, `NeedsAttention.tsx`). `neglected` is
   goals / operations / list items with no recent linked work (reuses
   `goalsNeedingAttention` + operation tree logs). `zombie` is `daysPushed` /
   `weeksPushed` / high entropy + long residence. Kill / split / clarify from
   the queue. DirectionReport and the operation heatmap stay their own views.

3. **Available-now filter (#253).** **Shipped.** Lane: Period / To Do
   (`todo-panel.tsx` Filters & Sort, `lib/available-tasks.ts` — same unmet-dep
   predicate as Scheduler). Hide tasks with unmet dependencies. Default off;
   persist in `cogs-todo-prefs`.

4. **Block dependency cycles on edit (#256).** Lane: Item detail — **shipped.**
   `useItemDetailDraft.addDependency` + `findCyclePath` / `wouldCreateCycle`
   refuse a loop; `CycleConfirmDialog` explains the path. Gantt still *shows*
   existing cycles — that is not this.

5. **“Usually takes you N min” (#130, #26).** **Shipped.** Lane: Estimates.
   `usualDurationMinutes` in `lib/estimated-values.ts` medians observed
   `timeLogs` / unflagged `actualDuration` on the same title (then a named
   item type). Dashed amber **usually ~N** on Working Now while live, on
   Done `CompletionTimeLine`, and as a CompletionDialog hint. Does **not**
   auto-rewrite `estimatedDuration`. Does not grow `beatTheClockMultiplier`.

6. **Past days + click-to-Day (#161, #163).** **Shipped.** Lane: Plan. Dim elapsed cells
   in month/week (not other-month only). Clicking a month day switches Plan
   to Day view for that date (`useCurrentDate`). Creating an event stays a
   distinct control, not the cell default.

7. **Inbox walk + batch (#243, #244).** ✅ Shipped. Lane: Shell / capture
   (`inbox.tsx`, `lib/inbox-batch.ts`). Multi-select → list / deadline /
   merge / delete (Are you sure? + Cmd/Ctrl-Z undo). **Walk selected** steps
   the current checkbox selection (Select all / Deselect all): rename, discard,
   recent lists. +1 point per handle, +50 when the Inbox hits 0. Navy
   selection outline. No extra capture tokens.

8. **Focus timer writes timeLogs (#129).** **Shipped** — `lib/focus-timer-log.ts`
   plus Modules `TimerView` / `Timer`. On complete, appends a `timeLogs` slice
   to Working Now’s task (or prompts which item). Stop stays one click. Do
   **not** auto-pick 52:17 from cognitive load (#264 stays out).

9. **WIP warning (#19).** **Shipped.** Lane: To Do. Soft cap (Filters & Sort,
   default 3 in progress / `status: partial`). Warns in the To Do chrome when
   exceeded — no hard block, no auto-reschedule. Cap persists in `cogs-todo-prefs`.

10. **Overcommitment early-warning (#238).** Lane: Analytics. **Shipped.**
    Classical change-point / slope on `daysPushed` + logged minutes over the
    shared Analytics range (`lib/overcommitment.ts`, Analytics → Behavior →
    **Overcommit**). One sentence + n, same honesty rules as Wave 1. Not a
    nanny that reschedules the day (#273 stays out).

**Explicitly not in this ten:** velocity chart, PERT capture UI, ghost row,
named weeks, definition-of-done field UI, Bayesian estimator, review-history
charts, capacity score, idea flags, priority override log, procedure chains,
summary auto-complete, Kanban-back-on-Lists.

### Wave 12 — Only then, new genius

More haunted mechanics (sweep, paint, confirm, one-write-many-records) — not
more tabs, cards, or Lucide. Wiki `[[links]]` that resolve to Items, PDF page
provenance, version history on doc bodies: second-brain loop, after the vault
shape is honest.

### Wave 13 — The map stays a map

Execute [`ScienceandSanityBrain2.md`](ScienceandSanityBrain2.md) **Part 3** in
order. That part is the sequence, the files, and the done-when. Do not
re-derive a queue from Part 1, from [`MAP_LOOP_MEANING.md`](MAP_LOOP_MEANING.md),
or by restating the slices here.

GS-1 and GS-2 may start once they reuse Wave 4’s est. mark (`~`, dashed amber,
hatch, hover sentence). They do not invent a second chip. UI slices follow the
screen law in this file. Ontology slices do not restart Wave 10. The product
chrome never names the book.

- [ ] **GS-1** One order on every derived value (observed / recorded / derived / inferred)
- [ ] **GS-2** Extensional Analytics sentences (range, subset, n, coverage)
- [ ] **GS-3** Extensional judgment copy (needs-attention, Analytics prose, friend/BIM — three lanes)
- [ ] **GS-4** Extensional check (gutter + optional review step + BIM count; never blocks save)
- [ ] **GS-5** Description, then inference (evening/weekly; `formulation` role `inference`)
- [ ] **GS-6** Time-binding handoff on the review, shown on the Plan rail
- [ ] **GS-7** Structural Differential on item detail, then the Tracking block dialog
- [ ] **GS-8** Single-parent ladders for types, tags, and lists; one Analytics Show as
- [ ] **GS-9** Graded completion by default; one click still means goal
- [ ] **GS-10** Dated formulations (wording, strength, certainty) via item activity

### Wave 14 — Meaning beside the average

Execute [`JungBrain2.md`](JungBrain2.md) in order. That file is the sequence,
the files, and the done-when. Do not re-derive a queue from
[`jungideas.md`](jungideas.md) or from [`MAP_LOOP_MEANING.md`](MAP_LOOP_MEANING.md).
Wave 13 and Wave 14 share no required order:
JG slices do not wait on GS slices. Yearly afternoon answers copy into a GS-6
handoff only when that field already exists.

The Meaning group defaults on. One setting hides it. `ReviewPeriod` does not
grow a season. Product chrome never names the book.

- [ ] **JG-1** Coincidence scanner (`lib/coincidence.ts`), no UI
- [ ] **JG-2** Meaning group, Coincidence Log, `showMeaningViews`
- [ ] **JG-3** Named outliers on Calibration, Habits, Cross-section
- [ ] **JG-4** Exception interview on the next morning review
- [ ] **JG-5** Optional affect mark on Quick Add, Inbox, and BIM
- [ ] **JG-6** Dream item type, symbol page, glyph after three dates
- [ ] **JG-7** Ask sideways on Just Start for stuck items
- [ ] **JG-8** Friend mission retirement, plus a symbol mission
- [ ] **JG-9** Life seasons as their own records, not a review period
- [ ] **JG-10** Yearly afternoon prompts (keep / revise / retire)

### Wave 15 — The miss is the next input

Execute [`cyberneticsbrain2.md`](cyberneticsbrain2.md) **Part 3** in order.
That part is the sequence, the files, and the done-when. Do not re-derive a
queue from Parts 1 or 2, from [`MAP_LOOP_MEANING.md`](MAP_LOOP_MEANING.md),
or by restating the slices here.

Wave 15 does not wait on Wave 13 or Wave 14. Where a file is shared, Part 3
names the seam (the formula panel's tone line, the friend score call versus
mission copy, the visible swing sentence versus the word Zombie). UI follows
the screen law in this file. The product chrome never names the book.

- [ ] **CY-1** The gap (`lib/error-signal.ts`), no UI
- [ ] **CY-2** Bands (7-day mean, one effector, silence inside the band)
- [ ] **CY-3** Reports on planned blocks (Confirmed / Partial / Silent)
- [ ] **CY-4** Ease the push after two swings
- [ ] **CY-5** Likely total on the plan; estimate unchanged
- [ ] **CY-6** Weekly weights, accept or reject, dated undo
- [ ] **CY-7** Order made, in bits, never added to points
- [ ] **CY-8** Gates on the existing Spectrum view
- [ ] **CY-9** Split chip when two receptors disagree
- [ ] **CY-10** Workflow intent, dry run, pause, run log
- [ ] **CY-11** Tone lamp into priority and the friend score

---

## Agent partition (do not share files)

Claim a **lane**. Do not share files.

**AMAP** = as much as possible
([`.cursor/rules/amap.mdc`](../.cursor/rules/amap.mdc)): when asked, parallelize
independent work.

| Lane | Owns | Does not touch |
|------|------|----------------|
| Capture | `scripts/capture-screenshots.mjs`, `scripts/screenshot-manifest.mjs`, `docs/screenshots/` | App behavior |
| Analytics | `components/Analytics/**` | Plan, Scheduler, Lists interiors |
| Plan | `components/Home/Plan/**` | Tracking paint, Scheduler |
| Scheduler | `components/Scheduler/**` | Home Plan |
| Period | `lib/use-current-date.ts`, To Do date ownership | Visual restyles of Habits pills |
| Estimates | `lib/estimated-values.ts` + audited call sites | New chip designs |
| Lists | `components/Lists/**` | Module interiors |
| Tracking | `components/Home/Tracking/**` | Pen math rewrites, counts-as model |
| Working Now | Header / cognitive-state / Operations control | Tracking grid internals |
| Shell | `app/page.tsx`, `app/win95.css`, header dialogs | Lists filemanager CSS |
| Home interiors | Habits / To Do / Goals components | Plan calendar, Tracking grid. **Willpower gems** is **shipped** (canonical in [`DESIGN_STYLE.md`](DESIGN_STYLE.md#willpower-gems--example-of-perfect-design)) — bounce / resize / Physics lab live on `habits-control-panel.tsx` / `willpower-gems.tsx` / `willpower-physics.ts` / `habit-chrome.css`. Home TOP strip (date / Review / points / Today's Progress) is a sibling on `home-dashboard.tsx`, `home-chrome.css`, `points-stats.tsx`, `daily-progress-quickview.tsx`, `home-review-banner.tsx` + `components/Home/README.md`. Load-jank is a sibling lane. |
| Operations | `components/Operations/**` | Modules board |
| Docs | `components/Docs/**` | Spreadsheet engine |
| Modules board | `components/Modules/workspace/ModuleWorkspace.tsx` and board chrome | `TidyView`, Trip, Film DNA |
| History / Backup / Workflows | `lib/action-history.ts`, `lib/data/backup.ts`, workflow UI | Item type collapse |
| Item | `lib/types.ts`, stores, migrations, search | UI restyles |

Docs follow **each** completed step (`.cursor/rules/update-docs-after-each-step.mdc`):
colocated README, this file (check off the wave bullet), [`SPEC_MAPPING.md`](SPEC_MAPPING.md)
if a spec’d surface moved, recapture the touched screenshot pair.

---

## File map (where to start)

| Concern | Start here |
|---------|------------|
| Visual law | [`DESIGN_STYLE.md`](DESIGN_STYLE.md), `docs/screenshots/05-lists.png` |
| Divine Machinery refs | [`DESIGN_REFS.md`](DESIGN_REFS.md) (`designrefs/` catalog; Habits now, pin bar shipped, tabs later) |
| Ranked UI only | [`UI_NEXT.md`](UI_NEXT.md) |
| Unranked observations | [`UI_CRITIQUE.md`](UI_CRITIQUE.md) — do not execute in order |
| Spec checklist | [`SPEC_MAPPING.md`](SPEC_MAPPING.md) |
| Item fields | [`CANONICAL_FIELDS.md`](CANONICAL_FIELDS.md) |
| Write door / period data | [`ARCHITECTURE_MODULARITY.md`](ARCHITECTURE_MODULARITY.md) |
| Module rungs | [`MODULE_PLATFORM.md`](MODULE_PLATFORM.md) |
| Idea bank (not a commitment) | [`BRAIN2_FEATURE_IDEAS.md`](BRAIN2_FEATURE_IDEAS.md) |
| Map, loop, meaning (the join) | [`MAP_LOOP_MEANING.md`](MAP_LOOP_MEANING.md) |
| Map and territory (Wave 13) | [`ScienceandSanityBrain2.md`](ScienceandSanityBrain2.md) Part 3 |
| Meaning beside the average (Wave 14) | [`JungBrain2.md`](JungBrain2.md) |
| The miss is the next input (Wave 15) | [`cyberneticsbrain2.md`](cyberneticsbrain2.md) Part 3 |

---

## Standard

Never SaaS the frame. Never plain the contents. Never costume the app as one still.
A record is a map: dated, indexed, and honest about what it leaves out.
Prefer one kind cut over a 90-item sweep. The living application is built by
finishing the cabinet, not by densifying the demo.
