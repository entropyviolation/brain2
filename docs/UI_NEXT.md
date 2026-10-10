# UI next — layout backlog

Open placement work. Style, including the four failures, is
[`DESIGN_STYLE.md`](DESIGN_STYLE.md). This file is not a second style law.
A note here does not override
[the screen stays pleasing](DESIGN_STYLE.md#the-screen-stays-pleasing).

Shipped placement (the Plan window, the Scheduler frame, Lists toolbar
groups, the Home top strip, the Tracking pen well) is not reopened here.

---

## Needs Attention open when count > 0 — shipped

`components/Home/NeedsAttention.tsx`. When nothing is stored yet and the
visible count is above zero, the queue starts expanded. Empty counters stay
collapsed. A stored collapse still wins.

## Ritual “not now” — shipped

`components/Home/home-review-banner.tsx`. Start / Not now / Dismiss share one
key group. Not now writes `rituals-snooze-until` (ask tomorrow).

## Habit rows by input kind — shipped

`components/Home/Habits/task-grid.tsx` groups rows by input kind (Lamps /
Goals / Climb / Text) so cheap ticks sit together. Same completion math.

## Push-count legend — shipped

`components/Home/ToDo/TodoTable.tsx` shows a table-head legend for pushes
(what a push is and which period the tube counts).

## Goal steppers — shipped

`components/Home/Goals/GoalsContainer.tsx`: `-1` / `+1` use `.is-stepper`;
`Log` is quieter. Objectives wear a stronger nameplate. CRT values use
`formatCrtNumber`.

## Est. on remaining sleep clocks — shipped

The Tracking “Sleep this day” form is gone. Do not put it back.

Morning Review (`#morning-bedtime`, `#morning-waketime`) and the block-editor
sleep clocks (`entry-dialog.tsx`) wear `~` and the dashed **est.** chip when
the value is still assumed (remembered sleep log or painted Sleep). Basis copy
comes from `sleepClockEstimateBasis` in `lib/estimated-values.ts`. Editing the
clock clears the mark; Save writes `definite` / `estimated` on the night.

## Operations empty-state objects — shipped

`components/Operations/OperationsView.tsx`. An empty board shows
`OPERATION_PRESETS` as pickable objects before commit. The name field stays.

## Temporal polarity chrome (deferred)

Prospective / Retrospective is already named in
[`TEMPORAL_POLARITY.md`](TEMPORAL_POLARITY.md), CANONICAL_FIELDS, quiet
`data-ui-help`, and `data-temporal` attrs. Do **not** rename “Add Plan”, add
polarity lamps on every dialog, or invent a second chip family beside **est.**
This backlog is only if a later pass wants fascia legends that spell the words
on Day Log / Plan day without churning muscle memory.

## Module orbs — shipped

`components/Modules/modules-panel.tsx`. Each module on the board gets an orb
or photograph. Leave Trip, Tidy, and Film DNA interiors alone (failure 3).

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

## Shipped — Debt + screen-family polish (2026-10-10)

Shell fascia tightened; Rituals/Inbox share one phosphor count grammar; Nav
dims when dead. Home overview: Progress + Rituals hero; Points one primary CRT;
Moon / Days Until quieter. Habits control: tubes lead, sheet lamps quieter,
willpower reward-scale. Just Start keeps mill phosphor Done. Plan week/month
inherit Day rail voice. Period data: Habits coarser periods follow Home day.
World write: ItemDetail → `commitItemEdit`; ingest finish → `applyLinkedEffects`.
Tracking / Lists / Scheduler / Analytics / Ops / Modules / Docs / dialogs
polished per DESIGN_STYLE. Wave 10: body search, description mirror, Tidy/Trip
Items dual-write shim.
