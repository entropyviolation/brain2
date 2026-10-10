# UI next — layout backlog

Open placement work. Style, including the four failures, is
[`DESIGN_STYLE.md`](DESIGN_STYLE.md). This file is not a second style law.
A note here does not override
[the screen stays pleasing](DESIGN_STYLE.md#the-screen-stays-pleasing).

Shipped placement (the Plan window, the Scheduler frame, Lists toolbar
groups, the Home top strip, the Tracking pen well) is not reopened here.

---

## Needs Attention open when count > 0

`components/Home/NeedsAttention.tsx`. `defaultCollapsed` defaults to `true`,
so a first visit starts shut.

When nothing is stored yet and the visible count is above zero, the queue
starts expanded. It sits in the reading order. Empty counters do not take
the fold while the queue is the thing with a count. A stored collapse still
wins — the person closed it.

## Ritual “not now”

`components/Home/home-review-banner.tsx`. The banner’s keys are Start and
Dismiss (both prompt states).

Add a third key in that same group: not now, ask tomorrow. Dismiss is not
the only way past a review that has a real deadline. Not a second banner.

## Habit rows by input kind

`components/Home/Habits/task-grid.tsx`, cells in
`habit-completion-cell.tsx`. Boolean lamps, goal numbers, text, and climb
(`value / target`) sit in one flat list, so a tick and a typed number
interleave.

Group the rows by input kind — one block per kind — so the eye can sweep the
cheap rows together. Same completion math. Same lamps and fields.

## Push-count legend

`components/Home/ToDo/TodoTable.tsx`. The tube (`todo-push-tube`) only titles
itself `` `${pushed} pushes` ``. The key is `pushedKeyForPeriod` in
`todo-utils.ts` (`daysPushed` / `weeksPushed` and the coarser counts).

The column needs a legend the eye can read without opening the cell: what a
push is (the task was moved onto the next open period) and which period the
number counts. Put it on the header, in the same row as the other column
labels.

## Goal steppers

`components/Home/Goals/GoalsContainer.tsx`. For a numeric goal, `-1`, `+1`,
and `Log` are the same `gol-btn` in `.gol-actions`.

The steppers are the control the hand uses. Make `-1` / `+1` the larger pair.
Keep `Log` in that same group, quieter. Boolean goals stay the single
mark-complete key.

## Est. on remaining sleep clocks

The Tracking “Sleep this day” form is gone. Do not put it back.

Clocks that remain:

- Morning Review, **Fell asleep** and **Wake time** —
  `components/Reviews/MorningReview.tsx` (`#morning-bedtime`, `#morning-waketime`).
- A sleep block in the block editor, **Fell asleep** and **Woke up** —
  `components/Home/Tracking/entry-dialog.tsx`.

When that time was not typed, it wears `~` and the dashed **est.** chip, with
the basis in the tooltip (`lib/estimated-values.ts`). The chip sits on the
clock. A time the person entered stays unmarked.

## Operations empty-state objects

`components/Operations/OperationsView.tsx`. An empty board (`.ops-empty`) is
one sentence. The shape choice is a `<select>` of `OPERATION_PRESETS`
(`lib/operation-types.ts`): Standard, Blank, Trip, Project, Paid job.

When there are no operations, that empty region shows those presets as
pickable objects, in one group, before commit. The name field stays the name
field. The sentence can go.

## Module orbs

`components/Modules/modules-panel.tsx`. A module whose `icon` is already a
photograph paints `mod-ws-jewel`. The others fall through to a Lucide kind
glyph (`meta.icon`).

Each module on the board gets an orb, or an equally specific photograph.
`OrbPickerDialog` (`components/Icons/OrbPicker.tsx`) is already wired from
`components/Modules/workspace/ModuleSettingsDialog.tsx`. The board is the
place the object shows.

Leave Trip, Tidy, and Film DNA interiors alone. That limit is failure 3 in
[`DESIGN_STYLE.md`](DESIGN_STYLE.md).

## Person birthday cakes

The person plaque (`components/People/person-detail.tsx`) shows days until the next birthday beside a pixel cake that matches the milled fascia and the phosphor candle. That drawing is what ships, so the plaque matches the house now.

Later, the cake comes from a folder of cute PNGs, the same idea as willpower gemstones (`public/gems-removebackground/`) and list orbs (`public/orbs-removebackground/`). The folder is not created in this step. The plaque stays the drawn cake.

## Shipped — Now capture and Quadruple Inbox

These are on the phone ingest path (`lib/ingest/`), not a new screen.

**Now with a payload.** Bare `now`, `status`, and `where` stay a status readout.
`now <text>` and `/now <text>` are Now capture, split on `|`:

1. Doing now — Activity through this minute, the rest of the day cleared.
2. Just did — a Tracking log event.
3. About to do — a 30-minute header plan.

Empty segments are skipped. One segment keeps the prose as doing-now, so
`Now been putting laundry away…` is that capture and the words stay.
`/now` alone replies with the template and the current lanes. `currently`
still paints an activity span through midnight.

**Quadruple Inbox.** A Telegram update with neither `update_id` nor
`message_id` is logged with a null dedupe key and is not applied. When a
message id is present it is stored on the ingest event and a repeat is deduped.
