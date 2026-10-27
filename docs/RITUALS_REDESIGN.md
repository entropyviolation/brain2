# Rituals redesign

_Last mapped: 2026-10-16_

Plan for every rite: Morning, Night, Start and End for week / month / season /
year, Star Lord, and the Home **Rituals** widget. Room map:
[`components/Reviews/README.md`](../components/Reviews/README.md). Design
language: [`DESIGN_STYLE.md`](DESIGN_STYLE.md).

Other widgets and rooms are being changed at the same time. Stay inside
`components/Reviews/`, `components/Home/home-review-banner.tsx`, and the
`lib/` helpers named here. Do not restyle shared chrome (`.hpp95`,
`home-widget-face.css`) from this plan.

## Why

Night and the other end rites are where you confirm the day while it is still
fresh, and look back at the plan, the tracking, and the summary. Morning and
start rites are where you look ahead. Today the end rites scroll forever, ask
one global "why", and stamp Done at the wrong time.

## Map (so you do not re-read it)

_Last mapped: 2026-10-27_

| Piece | Where | Notes |
|-------|-------|-------|
| Home widget | `components/Home/home-review-banner.tsx` | Tile + detail (`HomeWidgetDialog`). **Open** renders `RitualWalkDialog` itself (Phase 0) |
| `onStartReview` | `components/Home/home-dashboard.tsx` ~121 | Dead since Phase 0. Still clicks the header door if anything called it |
| Header door | `components/header-doors.tsx` ~183 | Lazy. The first click only loads the room. After load, `<Rituals />` replaces the button, so a click opens the menu, not a rite |
| Rite by slot | `components/Reviews/RitualWalkDialog.tsx` | Takes a `RitualTodoPlacement` (`lib/ritual-todo.ts` ~71). Opens morning / end / start / Star Lord directly |
| Night + end dialog | `components/Reviews/reviews.tsx` `ReviewDialog` ~82; sections ~305–510 | One long scroll. Unfinished list ~305: one shared `WhyBlockedControl`, `markDone` ~140 sets `completed: true` (completion popup fires with `completedAt` = now), `pushToNext` ~145 |
| Assumed times | `AssumedTimesSection.tsx` | Fields: finished time + minutes (`actualDuration`) + **Est.** (`timeRough`). No start field |
| Stepper | `RitualSteps.tsx` + `ritual-steps.css` | `RitualStepper` / `useRitualStep`. Lamp strip, `03 / 09` plate, optional index, Alt+←/→. Only Morning uses it |
| Morning | `components/Reviews/morning/` | Twelve steps on the stepper: Last night, Affirmations, To do for today, Week and month, Due within a week, Overdue, Daily habit priorities, Go through to do list, Day plan, Circumstances, Best day ever, Gratitude. Public door stays `components/Reviews/MorningReview.tsx` |
| Start | `StartRitualDialog.tsx` | Six sections, long scroll |
| Missed opportunity | `lib/services/completion-service.ts` `markMissedOpportunity(id, repo, missReason?)` | Status `missed`, `missedAt`. Lands on the Missed Opportunities list |
| Why prompt | `MissReasonDialog.tsx` | Optional preset + note, z-120 |
| Later reflection | `PostMortemDialog.tsx` | Satisfaction, resistance, focus, distraction 1–10 + note |
| Completion popup | `components/Completion/` | Fires on any false→true `completed` |

## Phase 0 — Fix the widget's Open (done)

_Last mapped: 2026-10-16_

**Was:** every Open in the widget clicked the header Rituals door. The door is
lazy: the first press only loads the room, later presses open the menu. The
detail was closing at the same moment, so the menu often closed again. No
press ever reached the rite.

**Built:**
- `ritualSlotPlacement(slot)` and `starLordSlotPlacement(slot)` in
  `lib/ritual-todo.ts` turn a menu slot into a `RitualTodoPlacement`.
- `components/Home/home-review-banner.tsx` holds the open walk and renders
  `RitualWalkDialog` (`next/dynamic`). The tile key, the banner key, and each
  detail row use `openWalk`: close the detail, open the rite next frame.
- The rite stays mounted when the square hides (last rite saved, Dismiss).
- `onStartReview` is accepted and unused. `home-dashboard.tsx` still passes
  its old door click; it is dead and can go when that file is free.
- Tests: `components/Home/home-review-banner.test.tsx` (night, week start from
  the detail, Star Lord), `lib/ritual-todo.test.ts` (slot placements), and the
  rituals case in `components/Home/home-overview.test.tsx`.

## Phase 1 — Stepped walk for every rite (done)

_Last mapped: 2026-10-16_

**Built:**
- `ReviewDialog` (`reviews.tsx`), `StartRitualDialog`, and
  `StarLordReportDialog` build a `stepDefs` array (`{ id, label, answered,
  body }`) and render `RitualStepper`. Morning already did.
- Step kept per rite in `localStorage`: `brain2-ritual-step:{end|start|star-lord}:…`.
- Moving to another step saves a draft (end and Star Lord: `persist(false)`;
  start: `handleSaveProgress`). Points stay as they were.
- `RitualStepper`: the side index opens by default at 720px and wider; a
  toggle is remembered. Under 640px the index is a strip above the card.
- Night steps: Unfinished items · Assumed times · How the day was spent ·
  Summary · Gratitude · Plan reflection (if a plan exists) · Reflection ·
  Tomorrow morning · Goals to focus on tomorrow · Tomorrow's plan. Week to
  year: This {period} replaces the time step; the last step is The … to come.
- Start: Undone · Priorities · Required · Intentions · Plan · Gratitude.
- Star Lord: Before you begin · The ledger · Inner alchemy · Closing.
- Tests: `review-dialog.test.tsx` (walk + draft on step, Finish),
  `StartRitualDialog.test.tsx` (new), `StarLordReportDialog.test.tsx`,
  `reviews.test.tsx`.

**Still to come here:** the **Look back** step (Phase 4) and the start
**Due soon** step (Phase 5) join these lists. The answered lamp is on / off;
a partial lamp can come with Phase 7.

## Phase 2 — Night: unfinished, scheduled items (done)

_Last mapped: 2026-10-17_ Built as below, with these choices: no `completedTimeUnknown` field — Done uses `completedCertainty: "estimated"` plus an unconfirmed `completedDate` estimate, which Assumed times already lists. Push notes are `PeriodReview.workedToday` (reason stays in `blockedReasons`). Missed ids are `PeriodReview.missedTaskIds`. Details: `components/Reviews/README.md` → Night / Review. Tests: `review-dialog.test.tsx` (unfinished rows), `lib/ritual-done.test.ts`.

Each row gets four keys: **Done · Push · Missed · (reason)**.

1. **Why blocked, per task.** Replace the one shared control with a
   `WhyBlockedControl` on each row (folded until opened). A row with a reason
   saves it into `blockedReasons[taskId]` whatever the outcome, Done included.
   Keep a small "same reason for all" shortcut that fills empty rows.
2. **Push asks why.** Push opens a ritual prompt (extend `MissReasonDialog`
   with an optional "Did you work on it today?" yes / no / a bit). Pre-fill it
   from that day's tracked sessions or step progress when known
   (`lib/item-activity.ts`). Skip still pushes. Stored on the ritual
   (`pushNotes[taskId] = { reason, workedToday }`).
3. **Done means done that day.** `completedAt` is the ritual's day, not the
   wall clock. Add `Task.completedTimeUnknown = true` (time unknown) so it
   lands in Assumed times. Then a short dialog: when (optional time or
   morning / afternoon / evening), satisfaction, resistance, focus (reuse
   `PostMortemDialog` fields). The global completion popup still runs once.
4. **Missed opportunity.** New key calls `markMissedOpportunity` with the row's
   reason. The row leaves the list, counted as missed in the footer.

Footer: `n done · n pushed · n missed`.

## Phase 3 — Night: assumed times (done)

_Last mapped: 2026-10-17_ Built as below. Rows from Phase 2 Done already land here through their unconfirmed `completedDate` estimate. Tests: `review-dialog.test.tsx` (Assumed times), `lib/assumed-time-math.test.ts`. Data needs no change for `timeNegligible` (checked 2026-10-22): no view flags a missing duration, and Velocity already skips zero-length rows.

1. Fields are **Start · Duration · Finish**, in that order. Editing any one
   recomputes the others: start + duration → finish (default); finish edits
   keep start and change duration; a duration edit keeps start.
   Pure helper `lib/assumed-time-math.ts` with tests.
2. **Negligible** key per row: sets `Task.timeNegligible = true` and duration
   0. It is not a rough estimate and is not asked again. Data treats it
   as zero time, not missing.
3. Rows from Phase 2 Done (`completedTimeUnknown`) appear here first.

## Phase 4 — Look back step (all end rites) (done)

_Last mapped: 2026-10-17_ Built in `components/Reviews/LookBackSection.tsx` with one note (`lookBack`), not one per block. Tracked time by scope stays on the night's How the day was spent and the period stats steps. Not scored.

One read-only step that sets the period's plan beside what happened: the
morning or start answers (priorities, required, plan, best day), tracked time
by scope, done / pushed / missed counts, and the summary. A note field per
block (`PeriodReview.lookBack`). Night reads that day's morning. Week / month
read that period's Start ritual.

## Phase 5 — Morning: look ahead (done)

_Last mapped: 2026-10-17_ Built as three steps (`components/Reviews/LookAheadSection.tsx`, `lib/ritual-due.ts`). Overdue rows have Do today and Missed (no Push: an overdue task has no obvious next slot). Telegram `gm` opens with `Deadlines: n due within a week (next: …, 2d) · n overdue` (`carryPreface` in `lib/ingest/apply-morning-gm.ts`).

New steps, after **To do for today**:

- **This week and month** — the week and month to-do lists, sorted by the
  importance rating (the walk's `dayRatings`, else `priority`). Each row has
  **Do today** (adds the task to today's list, or moves it with a
  `pushCardWorkingQueue`-style patch). Read-only otherwise.
- **Due within a week** — every open task with a due date in the next 7 days,
  with a countdown (`3d 4h`). Sorted soonest first.
- **Overdue** — open tasks with a due date before today. Same keys: Do today,
  Push, Missed.
- Helper `lib/ritual-due.ts` (`dueWithin(tasks, now, days)`, `overdue(tasks, now)`)
  with tests. Telegram `gm` gets the counts only.

## Phase 6 — Week / month / season / year (done)

_Last mapped: 2026-10-17_ End rites already share `ReviewDialog`, so Phases 2–4 apply to every period (Done dates to the period's last day). Start rites got the look-ahead steps; only week start has a bigger list (the month), since seasons are not a schedule slot.

- **End rites:** the Phase 2 row keys (Push asks why; Done dates to the last
  day of the period with unknown time; Missed), the Phase 3 times, and the
  Phase 4 look back.
- **Start rites:** the Phase 5 lists, scaled: Due soon is the coming period;
  Overdue the same; the "bigger list" step shows the next period up (week →
  month, month → season, season → year) with **Do this period**.
- Do not change period keys, `endCompleted`, or the points ledger ids.

## Phase 7 — Make it beautiful (partly done)

_Last mapped: 2026-10-17_ **Built:** tone per rite on `RitualStepper` (`tone` prop), unfinished / assumed rows as cards (`.rv-row`), look-back and look-ahead cards, CRT tally and countdowns. Checked at 1280px in the app. Partial lamp built 2026-10-22: `RitualStep.answered` may be `"partial"` (half-lit, not counted); night uses it on Unfinished items and Reflection. **Planned:** the widget face (another session is changing widget faces; wait for it), dark mode pass (the `.hpp95` shell is light-only today).

- One rite shell: milled fascia header with the period nameplate, the rail on
  the left, a single question card in the middle, ‹ › and Save on a key bar.
- Each step card: a title line, a one-line prompt in italic, then the fields.
  Generous spacing. No nested borders.
- Tone by rite: dawn amber for Morning and Start, ink blue for Night and End,
  north silver for Star Lord. Tokens live in `ritual-steps.css`.
- Rows (unfinished, due) are the To Do silver cards, not bordered boxes.
- Widget: CRT shows the next rite's name and count; the detail lists rites
  as rows with their own lamp and one **Open** key.
- Check light, dark, and ~375px wide.

## Data changes (all optional fields, nothing renamed)

| Field | Where | Meaning |
|-------|-------|---------|
| `completedTimeUnknown` | `Task` | Done during a past day, clock time not given |
| `timeNegligible` | `Task` | Took no meaningful time |
| `pushNotes` | `PeriodReview` | Per task: reason + worked today |
| `missedInRitual` | `PeriodReview` | Task ids marked missed from this rite |
| `lookBack` | `PeriodReview` | Notes on the look back step |

## Order and checks

Phases 0 → 7, one commit each. Each phase: `npx vitest run components/Reviews lib`,
`npx tsc --noEmit`, update `components/Reviews/README.md` with `_Last mapped_`.
Telegram walks (`lib/ingest/apply-ritual.ts`) keep working; add the new
fields there only where a text answer is natural (Push reason, Missed).
