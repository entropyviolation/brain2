# UI critique — three improvements per section

A walk of every top-level tab and every sub-tab inside it, with **three concrete
interface improvements each**. Grounded in the captures in
[`screenshots/`](screenshots/) and judged against
[`DESIGN_STYLE.md`](DESIGN_STYLE.md) — Win95 furniture, photographed contents,
whimsy in mechanics rather than decoration.

This is an observation document, not a commitment. Nothing here has been built.
Do **not** execute this file top to bottom. Ranked UI work lives in
[`UI_NEXT.md`](UI_NEXT.md); the combined multi-agent plan (screens + mechanics,
conflicts resolved) is [`PLAN_OF_ACTION.md`](PLAN_OF_ACTION.md). After a
populated recapture (`COGS_FRESH=0`), delete any item here that was only a zero.

---

## Global shell (header + tab bar)

Captures: every screenshot; code: `app/page.tsx`, `app/win95.css`.

1. **The header is eleven equal-weight buttons.** Morning, Review, Settings,
   Tracking, Inbox, Metrics, Bulk Add, From Notes, Quick Add all compete at the
   same size and contrast, so nothing reads as primary and the row will wrap on
   a narrow window. A 1997 app would have solved this with a **menu bar** —
   `File / Capture / Review / Tools` — leaving only Quick Add and the two badge
   counters (Review 5, Inbox 1) as standalone buttons.
2. **Badges do not say what they are counting.** `Review 5` and `Inbox 1` are
   bare numerals with no tooltip and no distinction between "overdue" and
   "waiting". Hover text ("5 end-of-period reviews ready, oldest Thu Sep 17")
   would let the header answer the question without opening a dialog.
3. **Three capture doors, no explanation of which to use.** Quick Add, Bulk Add,
   and From Notes are separate top-level buttons for one verb. One **Capture**
   button with three modes inside (single / many lines / paste notes) would cut
   the header by two and make the choice legible at the moment of use.

---

## Home

The Home tab stacks a date bar, a review banner, four point cards, Today's
Progress, Needs Attention, then the sub-tab strip.

1. **The header block eats the fold.** On the daily-habits capture the actual
   sub-tab content starts roughly 430px down, and everything above it is
   currently zeros. The four point cards (All Time / Today / This Week / This
   Month) are four large cards carrying four digits; they should collapse into
   one status-bar-style line so habits are visible on open.
2. **`Needs Attention (1)` is collapsed by default.** The one element on the
   screen that is explicitly urgent is the one element hidden behind a
   disclosure triangle, while empty point cards get full-size cards. Invert it:
   show the attention item, collapse the counters.
3. **The review banner has no third option.** "Start review" or "Dismiss" —
   nothing for "not now, ask tomorrow." Dismissing a five-review backlog to get
   at your habits silently discards the prompt, which is the one prompt in the
   app with a real deadline.

### Home → Habits (Daily / Weekly / Monthly)

Captures: `01-home-daily-habits.png`, `01-home-habits-weekly.png`,
`01-home-habits-monthly.png`.

1. **Every row renders a different input widget with no visual grouping.** Number
   boxes with `/60` suffixes, bare checkboxes, `/275 rating` fields, and a text
   box (`Do something artistic/creative`) are interleaved in one flat table, so
   the eye cannot tell a five-second tick from a typed number. Group by input
   kind, or give each kind a distinct row tint so the cheap rows can be swept in
   one pass.
2. **Today is marked only by a faint green column wash.** The Fri 9/18 column is
   the whole reason the grid is open, and it is distinguished by a tint barely
   above the gray. It needs real chrome: a sunken column, a bolder header, or a
   left-anchored "today" rail.
3. **Two unlabeled 0% progress bars sit side by side.** The pair above the grid
   gives no legend for which is which (day vs period), and `Good day streak 0` /
   `Good days in the last month 0/30` are rendered as low-contrast chips in the
   far corner. Label the bars inline and promote the streak, which is the number
   a habit tracker exists to show.

### Home → Plan (Month / Week / Day)

Captures: `02-home-plan.png`, `02-home-plan-week.png`, `02-home-plan-day.png`.

1. **This panel is a different product.** Dark slate canvas, purple event chips,
   large radii, and the tagline *"Schedule and organize your time with
   elegance"* — it is the one surface that reads as a modern SaaS calendar, the
   exact thing `DESIGN_STYLE.md` forbids. It should be a Win95 window with a
   calendar inside it, like Lists and Operations are.
2. **Event chips truncate to uselessness.** `02:00 Product Strat…` in a
   cell that has room for two more lines; no tooltip, no time range, no
   indication that more events exist on that day. Show `2:00–3:30p` plus a
   wrapped title, and an `+2 more` affordance.
3. **"Planned This Month (0)" occupies a full sidebar to say nothing.** A tall
   empty rail with a ghost icon and "Nothing to plan here" costs a quarter of
   the width. Collapse it to a strip when empty, and give it a real job when
   full — dragging unplanned items onto the grid.

### Home → To Do (Day / Week / Month)

Captures: `03-home-todo.png`, `03-home-todo-week.png`, `03-home-todo-month.png`.

1. **The controls outnumber the content.** Sort select, two icon-only buttons
   (`⇅` and a list glyph, neither labeled nor tooltipped), Status select, a
   "Show All Tasks" toggle, and Add Task sit above a table that says "No tasks
   scheduled for this day." Hide sort/filter chrome behind one **Filters &
   Sort** popover, the way Scheduler already does.
2. **The `Days (pushed)` column is unexplained.** It is the most interesting
   column in the table — the app quietly measuring procrastination — and it is a
   two-word header with no legend. It deserves a tooltip and a visual escalation
   (amber at 3+, red at 7+).
3. **Two date navigators on one screen.** The global date bar at the top says
   `Friday, September 18 2026`; the panel has its own `‹ Today › Friday, Sep 18,
   2026`. When they can disagree, the user has to check which one the table is
   obeying. One period cursor for the whole Home tab.

### Home → Goals

Capture: `04-home-goals.png`.

1. **Objectives and Goals repeat the same period filter twice.** Objectives has
   `Day / Week / Month / Year / All`; Goals has `All / Day / Week / Month / Year
   / Custom range / Aspirational` — different order, different contents, stacked
   ~200px apart. One shared period control for the pane.
2. **`-1 / +1 / Log` on every card is three buttons for one number.** The Log
   button is full-width blue on every card, so four goals produce four large
   primary buttons; the increment/decrement pair is the control people actually
   use. Swap the emphasis: chunky steppers, quiet Log.
3. **"Direction in Life" states failure in muted gray.** `0/0 days`, `Drift days
   0`, and four goals listed as **never** — the section is telling you nothing
   has moved, in the lowest-contrast type on the page, using a dash where a
   number should be. A neglected goal listed as "never" should read as a
   warning, not as a footnote.

### Home → Tracking (Time Grid / Activity Log / Day Log)

Captures: `08-home-tracking.png`, `08-home-tracking-activity.png`,
`08-home-tracking-daylog.png`, `08-home-tracking-week.png`,
`08-home-tracking-block.png`.

1. **The Sleep this day form is gone.** Tracking no longer shows Fell asleep /
   Woke up clocks under the sub-tabs. Sleep is painted on the Time Grid and
   edited in the block editor or Morning Review. Keep **est.** on those clocks.
2. **The grid opens scrolled to midnight.** Rows 12:00 AM–6:00 AM (the sleep
   block) fill the visible area while 9 AM–11 PM — the hours the From/To fields
   are pre-filled for — are below the fold. Auto-scroll to the first unpainted
   waking hour.
3. **Six stacked control rows before any data.** Activity/Location/Mood tabs,
   the pen well, a "What on?" tag row, the date bar, then cell-size + From/To +
   Fill, then a one-line instruction. The pen well is the one that belongs in
   the velvet spirit; the rest should fold into **Work settings** and the
   toolbar.

---

## Lists

Captures: `05-lists.png`, `05-lists-list.png`, `05-lists-details.png`,
`05-lists-cards.png`.

The gold standard — so the improvements are refinements, not rescues.

1. **Orbs float in the top-left corner of a very large velvet desktop.** Seven
   icons occupy about 15% of the surface; the rest is empty texture. Icons could
   spread on a larger default grid, or the window could size to its contents, so
   the cabinet looks stocked rather than abandoned.
2. **Two different "where am I" indicators disagree.** The status bar reads
   `0 folder(s), 7 list(s)` on the left and `2 folder(s), 4 list(s)` on the right
   in the same capture. Whatever the intent (current view vs total), it needs
   labels — this is the one piece of chrome the whole app copies.
3. **The toolbar has eleven buttons with no separators.** `Up | New List | New
   Folder | Import spreadsheet | Completed | Settings | Select | View: Icons List
   Details Cards | Auto-organize` runs together in one strip. Real Explorer used
   grouped bevel separators; adding them would let the eye find the view toggles
   instantly.

### Lists → list contents (Default / Checklist / Icons / Details / Spreadsheet)

Captures: `05-lists-content-default.png`, `05-lists-content-checklist.png`,
`05-lists-content-spreadsheet.png`.

1. **Default display is a blue underlined hyperlink on white.** A list holding
   one item shows `Example task` as bare 1996 link text — no orb, no checkbox, no
   metadata. This is the "contents made plainer" failure mode; items inside a
   list should carry their orbs the way they do in Icons display.
2. **The right inspector rail is six identical gray buttons.** Add Item, Bulk
   add, List Settings, Change icon, Pin to Home, **Delete List** — same size,
   same weight, destructive action in the stack (red text is the only
   difference). Separate Delete, and let the rail show list facts (count, type,
   last touched) as Explorer's property pane did.
3. **Two nested title bars say the same thing.** The window is `Example List —
   Lists` and the inner pane is `Example List` again, each with its own caption
   buttons, costing ~55px to duplicate one name. The inner pane should carry the
   display mode instead.

---

## Docs

Code: `components/Docs/DocsPanel.tsx`, `DocsHome.tsx`, `DocumentEditor.tsx`.
Editor chrome visible in `09-modules-workspace.png` (module Plan view).

1. **Not captured in `screenshots/` at all.** `docs/README.md` lists `12-*` as
   planned; Docs is the one top-level tab with no reference shot, which means UI
   drift there is invisible to review. Add it to `npm run capture-screenshots`.
2. **The formatting toolbar is three font selects in a row.** `Font Merriweather`
   / `Size 16` / `H-font Playfair Display` / `Page Merriweather` — four
   typography controls, two of which (H-font, Page) need explanation, all
   competing with B/I/U. Move document-wide typography into a **Page setup**
   dialog and leave inline formatting in the toolbar.
3. **Save state is invisible while typing.** The panel tracks
   `saved / saving / error` but the status bar shows `Plain paste · click image to
   resize · click link to open · 37 words` — tips, not state. For a body stored
   in IndexedDB, a persistent `Saved 12:07` indicator is the difference between
   trust and refresh-anxiety.

---

## Scheduler (Funnel / Gantt / Dependencies)

Captures: `06-scheduler.png`, `06-scheduler-gantt.png`,
`06-scheduler-dependencies.png`, `06-scheduler-day.png`.

1. **It is the only tab with no window chrome.** A bare `Enhanced Scheduler`
   heading (with the internal code name still in the UI) on the teal desktop,
   then white cards floating with no frame. Lists, Operations, and Home all have
   title bars; this reads as an unfinished page.
2. **Two tab rows that are not the same kind of thing.** Funnel/Gantt/Dependencies
   (view mode, rendered as blue pills) sits directly above
   Always/Year/Month/Week/Day (period, rendered as folder tabs), so five period
   tabs look like siblings of three view tabs. Separate them visually, or move
   the period into the toolbar.
3. **Seven "Empty" cards is a worse answer than one sentence.** The funnel
   renders This Year / This Month / Next Month / This Week / Next Week / Today /
   Tomorrow as full cards all reading `0 · Empty`, in a zig-zag two-column order
   that makes the day→year reading direction hard to follow. Collapse empty
   buckets to one-line rows and keep the cards for buckets with work.

---

## Operations

Captures: `10-operations.png` (board), `10-operations-workspace.png`.

### Board

1. **The empty state is 400px of black CRT with one line of green 8px text.**
   *"No operations yet. Name one above, pick the shape it should start as, or
   upgrade an existing task from its detail view."* The phosphor idea is right
   and on-style; the execution is unreadable and mostly void. Bring the type up,
   or show the preset shapes as pickable cards on the CRT.
2. **`New Operation` is disabled with no reason given.** The button is grayed
   until the name field has text, but nothing says so — and the name field's
   placeholder is the only hint. Enable-on-type is fine; the tooltip should
   explain the gate.
3. **The `Shape` select hides the most consequential choice.** Standard / Blank /
   Trip / Project / Paid job decides which panels the operation gets, and it is a
   bare dropdown with no preview. Show what each preset turns on before commit.

### Workspace (Home / To do / Phases / Parts / Timeline / Locations / Plan / Resources / Log / Queue)

1. **`Working on this now` is the least prominent button on screen.** The verb
   the whole tab is built around sits top-right in standard gray, the same weight
   as `Settings`. It should be the one loud control — and its lamp/clock state
   should be visible from the board too.
2. **Panel tabs and window menus use the same shape.** `Board | Settings |
   After-action report` (menu) and `Home | To do | Phases | Parts | Log` (panel tabs) are
   both gray bevel buttons in stacked rows, so navigation depth is ambiguous.
   Make the top row a real menu bar.
3. **The Queue rail stays full-width while empty.** `TO DO NEXT — Nothing
   actionable — add steps or clear dependencies` holds ~180px of the working
   width to deliver one sentence, and the Home panel's Notes pad is squeezed
   beside it. Collapse the rail to a tab when it has nothing ranked.

---

## Modules

Captures: `09-modules.png` (board), `09-modules-workspace.png` (Trip Itinerary).

### Board

1. **No chrome and no objects — the one tab that is neither half.** Plain heading
   + white cards on teal, generic Lucide glyphs for every module. Per
   `DESIGN_STYLE.md` this needs both a window frame and orb-style identity for
   each module.
2. **`⚙ ✕` on every card, with delete unguarded.** Two icon-only buttons per
   card, same size, one destructive, no confirm implied. At minimum the remove
   action should be visually subordinate and confirm.
3. **Widgets and workspaces are two sections with one create button.** "Build
   module" produces either kind, but the board shows them in unrelated layouts
   (empty full-width row vs card grid) with no explanation of the difference —
   the distinction that matters most for a platform tab is unexplained.

### Workspace

1. **The header is five buttons and a naked text input.** The title renders as an
   editable field with a visible border, so the workspace name looks like a form
   field rather than a title bar; Print/Export, Workflows, Settings, Pop out, and
   Add view then follow at equal weight.
2. **Five view tabs with no indication of what kind each view is.** `Plan |
   Itinerary | Activities | Packing | Before Trip` — a doc, a printable grid, a
   map, and two checklists all look identical. Small kind glyphs would make the
   module's shape legible.
3. **The description line is one-time onboarding copy in permanent space.**
   *"Write a trip doc, build a day-by-day itinerary (weather + flights by
   number), map activities by city, and pack."* Useful once. Move it into
   Settings or a dismissible strip.

---

## Analytics (16 views)

Captures: `07-analytics*.png`.

1. **Fourteen tabs in one wrapping row was a navigation failure.** Habits, Points,
   Tracking, Sleep, Plan vs Reality, Calibration, Streaks, Reflection, Reviews,
   Metrics, Correlation, Context Switch, Regret, Item Types, Overcommit — all equal weight.
   **Shipped:** categories on a bar (Behavior / Time / Accuracy / Meta / Library)
   with a view changer beneath. Do not flatten them back into one row, and do
   not send Item Types to Settings — OWNER reversed that: Analytics is the
   library / browse surface; Settings still edits types.
2. **Empty charts render full-height axes.** ✅ Empty series keep the frame and
   one sentence (`chart-frame.tsx`).
3. **The four KPI cards repeat Home's cards with different numbers.** Label the
   window ("last 30 days") once. Habits still shows window totals when there is
   a series.

Per-tab, the sharpest single fixes:

| Tab | The one thing |
|-----|----------------|
| Habits | 15-row bar chart needs sorting by completion, not by habit order |
| Points | No indication of what earns points, next to a zero |
| Tracking | Breakdown and tag views are separate captures but one mental model — merge |
| Sleep | Duplicates Home Tracking / Morning Review sleep numbers without linking to them |
| Plan vs Reality | The most valuable comparison in the app, rendered as two flat lists |
| Calibration | Needs a plain-language reading of the score, not just the plot |
| Streaks | Overlaps Home → Habits' streak chips; pick an owner — **keep split** (Home glance vs Analytics analysis) |
| Reflection | Free text with no prompt history or search |
| Reviews | A log with no filter by period type |
| Metrics | No way to get from a metric chart to logging that metric |
| Correlation | Correlations need an n and a caveat, or they read as claims |
| Context Switch | Heatmap with no legend for what a "switch" is |
| Regret | The harshest framing in the app arrives with no explanation |
| Item Types | **Library in Analytics** (browse / sort / counts / drill). Configuration editing stays in Settings. Do not remove this view. |
| Cross-section | Linked density over the shared range — keep n visible; missing nights stay blank |
| Overcommit | Sentence + n on day-pushes + logged minutes; do not treat a sparse week as a finding; do not reschedule |

---

## Item detail (full page + popup)

Captures: `21-item-detail-popup.png`; code: `ItemDetailPage.tsx`,
`ItemDetailPopup.tsx`.

1. **The popup's tab strip collapses to one glyph-labeled tab.** With only
   Details visible, the strip renders as a single full-width button that looks
   like a section header, while the page version shows up to six named tabs. The
   two surfaces should agree.
2. **`Delete` and `Save Changes` sit on the same row, both prominent.** Red
   destructive button on the left, blue primary on the right, 600px apart at the
   top of the dialog — the most and least recoverable actions given equal
   billing above the content they act on.
3. **The list picker occupies more space than the item.** A search field, a
   scrolling four-row list tree, a `+ New list` button, and a `Selected (1)`
   caption take the entire right column, while "Detailed Description" gets a
   small box on the left. For most edits, list membership is the secondary
   concern.

---

## Global dialogs

Captures: `20-dialog-*.png`.

1. **Every dialog is a different width and vertical position.** Settings and
   Morning Review are both narrow and top-anchored; Bulk Add, Inbox, and Global
   Search each pick their own geometry. Win95 dialogs were rigid on purpose — one
   size ladder (small / medium / large) would make the app feel assembled.
2. **Settings explains itself in three paragraphs of body copy.** The "Default
   time of day" section alone runs two explanatory paragraphs plus a derived
   note ("usually fall asleep around 10:50 PM… averaging 8h 10m") above a single
   time field. The derivation is genuinely good — it belongs in the **est.**
   tooltip, not in the panel.
3. **Only one dialog has a Cancel button.** Morning Review offers Cancel / Save;
   Settings has just an ✕; Item detail has Save Changes with no discard. Whether
   edits commit live or on save should be one rule across the app, stated by the
   buttons.

---

## The five cross-cutting patterns

Everything above collapses into five repeated habits:

1. **Empty states are rendered at full weight.** Zero-value cards, blank charts
   with full axes, seven "Empty" funnel cards, an empty Queue rail, an empty Plan
   sidebar. The app is largest when it knows least.
2. **Controls are stacked before content instead of folded into chrome.** Home →
   Tracking has six control rows; To Do has six controls over an empty table.
   Toolbars and popovers exist for this.
3. **The same choice is offered twice on one screen.** Two date navigators on To
   Do, two period filters on Goals, two status-bar counts in Lists, two title
   bars in a list, streaks in both Home and Analytics.
4. **Destructive and primary actions share weight.** Delete List in a rail of six
   identical buttons, `✕` next to `⚙` on module cards, Delete opposite Save in
   item detail.
5. **Two tabs break the house style outright.** Home → Plan (dark modern
   calendar) and Scheduler (no window chrome) are the two surfaces that could not
   sit beside `05-lists.png`, which is the test `DESIGN_STYLE.md` sets.
