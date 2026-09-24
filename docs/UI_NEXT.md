# UI next — executable work toward the living application

Ranked work for anyone making Brain2 look and feel like [`DESIGN_STYLE.md`](DESIGN_STYLE.md):
**a vintage machine that is also a painting** — motif, cabinet, and one
impossible motion. The test is whether a screen can sit beside Habits Daily
and Lists Icons without looking like a SaaS product or like a Windows replica.

[`UI_CRITIQUE.md`](UI_CRITIQUE.md) is an unranked observation dump from empty-ish
captures. Do **not** work it top to bottom. This file is what to do, in order, and
what not to “fix.”

The **combined multi-agent work order** (screens + mechanics + ontology, with
conflicts resolved) is [`PLAN_OF_ACTION.md`](PLAN_OF_ACTION.md). This file is the
UI lane inside that plan.

**Standard, one line:** Never SaaS the frame. Never plain the contents. Never costume the whole app as one still. Object chrome (milled silver around a black-mirror well, photograph in the cavity) is the Willpower gems language — copy it onto other jewels. A dissolve or melt on a real verb is the impossible layer, not a defect. User-facing copy describes an event, a date, and a count.

---

## Do not do these

These were scored as defects in the critique. They are features, or they fight the
house style.

- Do not collapse empty Queue, Plan sidebar, funnel buckets, or KPI cards so the
  workspace reflows when the last item completes. Reserved space that says
  “nothing here yet” is Explorer furniture and muscle memory.
- Do not hide Tracking pens, To Do sort/filter, or the header’s capture doors
  behind a single popover or a `File / Capture / Review` menu. That is modern
  progressive disclosure. A toolbar **is** the chrome the design doc asks for.
- Do not make Delete red as a principle. Win95 safety is confirmation + undo
  (`lib/action-history.ts`, wired in `app/page.tsx`), not chroma. Grade
  destructiveness from the running app (hover, confirm, Cmd/Ctrl-Z), not from a
  PNG.
- Do not merge Home streaks with Analytics → Streaks. Glance vs analysis are
  different jobs. Same for “the same number must not appear twice.”
- Do not treat Lists’ two status-bar counts as a data bug. Left is sidebar
  scope, right is the open location (`enhanced-list-view.tsx`). Labels are fair;
  “disagreeing counts” is not.
- Do not judge density from `docs/screenshots/` until a **loaded-store** recapture
  exists. Default `npm run capture-screenshots` clears localStorage
  (`COGS_FRESH`); only Tracking is seeded. Empty to-do / plan / funnel / zeros
  are the harness, not the decade-scale product.
- Do not extract a shared `PeriodNavigator` with visual variants.
  [`ARCHITECTURE_MODULARITY.md`](ARCHITECTURE_MODULARITY.md): unify the *period
  as data*, not the chevrons. Habits’ *selectors* must not become the house look;
  its **depth & spacing** language should (nested bevels, tight pack, one header
  unit — [`DESIGN_STYLE.md`](DESIGN_STYLE.md#depth--spacing)).
- Do not restack a screen as floating white cards on the PCB desktop, or open 16–24px gaps
  between sibling metrics “for air.” That is the old Home look. Pack one
  instrument.
- Do not sand installed module interiors into `components/ui/`. Feral rooms,
  shared `Item` ontology ([`MODULE_PLATFORM.md`](MODULE_PLATFORM.md)).
- Do not add a tab, empty state, or tooltip that teaches general semantics.
  The practice is the existing rooms. Copy describes an event, a date, and a
  count ([`ScienceandSanityBrain2.md`](ScienceandSanityBrain2.md),
  [`DESIGN_STYLE.md`](DESIGN_STYLE.md)).

---

## 0. See the real app before changing pixels

- Recapture against a **populated** store: `COGS_FRESH=0 npm run capture-screenshots`
  while `npm run dev` is up, using a backup with lists, painted weeks, planned
  work, and operations. Keep a dedicated fixture if local data is precious.
- Add **Docs** to `scripts/screenshot-manifest.mjs` / `scripts/capture-screenshots.mjs`
  as `12-docs*.png`. It is the only top-level tab with no image; UI drift there
  is currently invisible.
- Add missing *distinct* surfaces, not every period combo: Lists Icons + Details
  content modes; Scheduler Gantt/Dependencies at more than one period only if
  they actually differ; one Operations panel per kind that is not Home; Modules
  board vs one non-Trip workspace.
- After that recapture, delete any critique item that was only a zero. Then walk
  the running app (hover, confirm, undo, keyboard) for anything you still intend
  to change.

---

## 1. Two style breaks — hours of work, unambiguous, do first

These cannot sit beside Lists. They are worth more than the rest of the critique
combined.

- **Home → Plan:** ✅ Win95 window (`.plan95`) and a gray calendar *inside* it.
  Dark slate, purple chips, large radii, and *“Schedule and organize your time
  with elegance”* are gone. Event chips show a usable time range, wrap the
  title, and overflow (`+N more` + tooltip). Shared `useCurrentDate` cursor.
  Capacity line in the reserved sidebar. **Middle ground shipped** — do not
  sand opalescence off chips; do not recramp. `02-home-plan*.png` recaptured
  2026-09-21; capacity needs both ends of a night.
- **Scheduler:** ✅ window chrome around Funnel / Gantt / Dependencies
  (`.sch95`). Human caption in the title bar; `h2` **Enhanced Scheduler**
  removed. View modes (toolbar) vs Always→Day periods (folder tabs) are
  different chrome. Empty buckets are reserved one-line furniture. Task rows
  carry orbs; drag into buckets stays the mechanic. Stale `06-*.png`; `~` /
  **est.** is later; Gantt stays a document.

---

## 2. Contents-plainness pass (the debt the design doc already named)

Chrome on Home, Scheduler, Operations, Docs, Modules, Analytics is “on the right
track.” Objects are not. Borrow Lists’ orbs and velvet; do not invent a second
illustration language.

- **Lists Default display:** ✅ orbs on the working surface (complete checkbox
  if the list is a checklist). Not a lone blue hyperlink on white.
- **Modules board:** it is currently neither half — plain heading, white cards,
  Lucide glyphs, icon-only `⚙` / `✕` (`components/Modules/`). Window frame +
  photographed identity per module. Confirm on remove. Do not restyle Trip /
  Tidy / Film DNA *interiors*.
- **Scheduler funnel / task cards:** gray empty boxes and generic task chrome
  should hold objects when they hold work. Empty buckets may stay reserved
  one-line *furniture*, not illustrated mascots.
- **Home → Habits / To Do / Goals / Analytics KPIs:** when adding marks, use
  orbs (or equally specific photographs), not a Lucide set. Tables may stay
  austere — they are documents inside the cabinet — but the surrounding window
  stays file-manager furniture.
  **Home dashboard TOP strip (all tabs):** date + Review due + points wells +
  **Today's Progress** is one shared instrument on Habits / Plan / To Do /
  Goals / Tracking — not a Habits-only skin. **Landed:** equal-height square
  row that wraps (review / points / progress / affirmation / weather / Widgets overlay);
  All Time shares the same metal/CRT face; centered CRT numerals in
  `--hab-crt-green`; three-color fills from Habits tubes; weather sun/cloud/rain
  glyphs. File packing: Home README. Do not treat this as Daily-sheet chrome.
  **Habits Daily:** ✅ contained gunmetal console (`.hab95`), current-day **solid** mint column (not a gradient),
  jewel-PCB Habits Tab Control Panel (Week grade + Perfect output **noble-gas tubes**,
  streak + Good days, **Sort Habits** above grouped rockers, New habit,
  WILLPOWER **orb**). Analog cockpit rockers instead of iOS pills
  — Heatmap View, **Day View**, Hide Completed Today, **Loading Bar**,
  **Small LEDs** (default ON = 15px Yes/No lamps; OFF = fill the cell). Heatmap is a
  Daily sidebar rocker on the **light** sheet — spacious jewelry cells, not a
  dark board. **Day View** ON: only today’s column + weekly % on the right
  (list of today). **Loading Bar** default ON: quiet milled channel of 10 via-dots
  (each = 10%) plus a text %; OFF keeps the smaller numeric dot-matrix LED.
  Not a toy equalizer, not pastel bars, not cell lamps reused as percents. Hairline grooves
  on the furniture are wanted — do not sand them off. **Shipped on the sheet:**
  recessed Yes/No panel lamps (tint as on-color, not blast-white), percent strip/LED with Settings tint, one inset
  gem/edit at the far left (title wraps; streak/× under the name; no gem before
  the title). Delete only in habit settings. That packing is now house
  style — see [`DESIGN_STYLE.md`](DESIGN_STYLE.md#depth--spacing) and
  [`components/Home/Habits/README.md`](../components/Home/Habits/README.md#daily-layout--chrome-intent)
  — do not treat it as a Habits-only trick, and do not restyle Plan / Tracking
  interiors to match.
  **WILLPOWER week (shipped — example of perfect design):** week-complete gems
  collect small around the crystal; the far-left row gem **inverts** while
  contributing; plate click is physics **stir** (not a file picker); stones
  that pass behind the crystal PNG are occluded by it; Settings still changes
  the orb. **Small LEDs** is the fifth Daily rocker (default ON = 15px lamps;
  OFF = fill the cell) — not Loading Bar. Do not grow the plate or Lucide the
  satellites. See
  [`DESIGN_STYLE.md`](DESIGN_STYLE.md#willpower-gems--example-of-perfect-design).
  File-level packing stays with the Habits implementer.
- **Operations board:** keep the CRT idea; make the phosphor readable; show
  Shape presets as pickable objects before commit. **Working on this now** is
  the verb of the tab — it should outrank Settings without becoming a SaaS
  primary.
- **Analytics charts with no series:** ✅ empty series keep the existing chart
  frame and one sentence (`components/Analytics/chart-frame.tsx`). Interpretive
  views watermark a thin sample instead of drawing precision they do not have.
  No mascot empty states. Categories sit on a Behavior / Time / Accuracy / Meta /
  Library **bar**; the view changer beneath lists the views in that group.
  **Item Types is the Analytics library** (browse / sort / counts / drill);
  Settings still edits types. Do not move it out. The data canvas may be
  contemporary (density, small multiples); the frame stays an instrument in
  this house (quoted bevel or silver), not a dark CRT theme. Do not “fix”
  Analytics back to gray recharts-in-Win95, and do not freeze that frame as
  a Windows dialog.
- **Gold-standard check after every visual PR:** open Lists → folder Icons, then
  All Items orb grid, then the changed screen. If it would look embarrassing
  next to those two, revise the new UI, not Lists.

---

## 3. One period cursor — wire To Do; don’t fake “duplication”

- Give To Do the **same selected day** as the Home header. Today
  `todo-panel.tsx` owns a private `focusedDate` / `TodoPeriodNav`; Plan and
  Tracking use `lib/use-current-date.ts`. The two navigators on To Do **can
  disagree**; the table obeys the inner one. That is a real bug, not “one cursor
  rendered twice.”
- Lift period as **data** (`usePeriodCursor` in
  [`ARCHITECTURE_MODULARITY.md`](ARCHITECTURE_MODULARITY.md)) across Habits week
  nav, To Do, Tracking, Plan, Scheduler, Reviews. Leave each surface’s chevrons
  local and Win95.
- **Goals:** Objectives’ Day/Week/Month/Year/All and Goals’ period-kind filter
  (incl. custom / aspirational) are two filters on two record types. Do not
  merge them. Label which is “priority this period” vs “goals of this kind” so
  they stop reading as one control copied twice.

---

## 4. The house’s distinctive convention — finish it

Rule 8 in [`DESIGN_STYLE.md`](DESIGN_STYLE.md): anything the app invented
(duration, clock window, sleep, assumed times) is a leading `~` plus a dashed
amber **est.** chip. Tooltip states the basis in plain words and is clickable to
confirm or correct (`lib/estimated-values.ts`,
`components/Home/ToDo/CompletionTimeLine.tsx`).

- Audit every derived value: To Do Done, Day Log, Analytics sleep
  `≈` / `▦`, Reviews Assumed Times, Settings “usually fall asleep around…”.
- Settings body-copy that *is* the estimate belongs in the chip tooltip, not
  three paragraphs above a time field.
- Tracking no longer has a **Sleep this day** / Fell asleep / Woke up form.
  Sleep clocks live on Morning Review and the block editor; keep `~` + dashed
  steel **est.** Do not write cutesy empty-state essays (design doc rule 4).

---

## 5. Chrome that is a grouped instrument

Grouped, dense, readable. The frame may be silver, pixel, or engraved, and it
may do one impossible thing. It may not become glass or a brand gradient.
Future screens copy
[`DESIGN_STYLE.md`](DESIGN_STYLE.md#depth--spacing): denser hierarchy, nested
bevels (raised cabinet → sunken well → raised control), less floating-card
isolation, more instrument-console packing. Tight 4–8px gaps inside one
instrument. Header / toolbar as one textured unit at dashboard width. Precious
marks stay small. Hairline grooves, pinstripes, and engraved rules on that
furniture are wanted — do not sand them off. A room’s field (nacre, velvet,
phosphor) meets its gutters without stealing the global PCB header.

- **Lists toolbar:** ✅ bevel separators (New / View / Organize) and **This
  folder** / **Tree** labels on the two status counts. Do not treat those
  counts as a data bug.
- **List interior:** ✅ inner caption is display mode, not the list name again.
  Inspector: facts (count, type, last touched) plus actions; Delete stays gray,
  separated, confirmed.
- **Global header:** ✅ grouped by verb (review / system / capture) on a full-width pinned mill title bar (`AppHeader` + `shell-chrome.css`). BRAIN2 caption + today's-friend jewel share that chassis. Tek POWER lamp, milled keys, IRIX nested wells, phosphor counts (not orange). Lucide hidden on the keys (Lists toolbar language). Header stays on item detail. Do not hide doors behind a menu. Top tabs still later.
- **Home header vs Needs Attention:** do not collapse the point cards when they
  have real four-digit values. Narrower wells + leftover **square widgets**
  (shared TOP strip, all five Home tabs) is the next cut — not a second set of
  Cards per tab. Do invert *empty* theater: urgent Needs Attention
  should not be the thing hidden behind a disclosure while zeros take the fold.
- **Tracking:** ✅ photographed pen tray stays in the open (View settings picker;
  default Cat traces, not velvet). Beads default to one row; Expand (right of
  Tree) unwraps and reads Conceal while open. **New pen** reveals the hidden
  creator. Selected/detail copy sits on steel plates. Cell size, From/To
  defaults, and view options live in View settings — not the pens you press
  every stroke. Grid auto-scrolls to the first unpainted waking hour instead of
  opening on midnight sleep. Official `08-*` shots are still stale.
- **Item detail popup vs page:** same tab vocabulary. List picker is secondary
  to the item body.
- **Dialog geometry:** one size ladder (small / medium / large). One rule for
  live-edit vs Save/Cancel, stated by the buttons.

---

## 6. Mechanics that feel haunted, not decorated

Beauty here is proof this is a different type of software.

- Keep and extend **Auto-organize**, freeform orbs, uploads with knocked-out
  backgrounds (`lib/remove-background.ts`). New whimsy must be a tool (paint,
  snap, install a room) or one impossible gesture on that verb (a sweep that
  leaves cursors, a window that melts on close). Never a Lottie on a white card.
  Home → Habits
  WILLPOWER plate stir + week-gem collection is that family — **shipped**
  ([canonical example](DESIGN_STYLE.md#willpower-gems--example-of-perfect-design)).
  Do not cut it as decoration, and do not put change-image back on the plate.
- Plan: dragging unplanned items onto the grid is the sidebar’s job when it has
  work — not a ghost “Nothing to plan here” illustration.
- Scheduler funnel: drag into buckets is the mechanic; make the *objects*
  precious, not the chrome glassy.
- Operations Queue: stay docked; fill it with ranked next actions (the reason it
  exists). Empty is information.
- Modules: installing a room should feel like putting a new cabinet in the
  house. Board = vintage machine + objects; interior may go feral.

---

## 7. How to ship a visual change

- Sit the before/after next to `05-lists.png` and `05-lists-content-*`.
- Check depth & spacing ([`DESIGN_STYLE.md`](DESIGN_STYLE.md#depth--spacing)):
  nested bevels, tight pack, one header unit — not stacked cards on the desktop.
- Check **est.** if any number was not typed by the user.
- Verify in the **browser**, not only a screenshot: empty *and* loaded, hover,
  confirm, undo.
- Update the colocated README, this file if a bullet is done, `SPEC_MAPPING.md`
  if a spec’d surface moved, [`PLAN_OF_ACTION.md`](PLAN_OF_ACTION.md) if a wave
  bullet is done, and recapture the touched `docs/screenshots/` pair.
- Prefer one kind cut over a 90-item sweep. The living application is built by
  finishing the cabinet, not by densifying the demo.
