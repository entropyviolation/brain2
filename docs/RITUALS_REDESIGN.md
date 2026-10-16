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

| Piece | Where | Notes |
|-------|-------|-------|
| Home widget | `components/Home/home-review-banner.tsx` (~205 lines) | Tile + detail (`HomeWidgetDialog`). Every **Open** clicks `[data-rituals-entry]` or calls `onStartReview` |
| `onStartReview` | `components/Home/home-dashboard.tsx` ~121 | Also only clicks `[data-home-review-entry]`. Never opens a rite |
| Header door | `components/header-doors.tsx` ~183 | Lazy. The first click only loads the room. After load, `<Rituals />` replaces the button, so a click opens the menu, not a rite |
| Rite by slot | `components/Reviews/RitualWalkDialog.tsx` | Takes a `RitualTodoPlacement` (`lib/ritual-todo.ts` ~71). Opens morning / end / start / Star Lord directly |
| Night + end dialog | `components/Reviews/reviews.tsx` `ReviewDialog` ~82; sections ~305–510 | One long scroll. Unfinished list ~305: one shared `WhyBlockedControl`, `markDone` ~140 sets `completed: true` (completion popup fires with `completedAt` = now), `pushToNext` ~145 |
| Assumed times | `AssumedTimesSection.tsx` | Fields: finished time + minutes (`actualDuration`) + **Est.** (`timeRough`). No start field |
| Stepper | `RitualSteps.tsx` + `ritual-steps.css` | `RitualStepper` / `useRitualStep`. Lamp strip, `03 / 09` plate, optional index, Alt+←/→. Only Morning uses it |
| Morning | `MorningReview.tsx` (~1500 lines) | Nine steps on the stepper |
| Start | `StartRitualDialog.tsx` | Six sections, long scroll |
| Missed opportunity | `lib/services/completion-service.ts` `markMissedOpportunity(id, repo, missReason?)` | Status `missed`, `missedAt`. Lands on the Missed Opportunities list |
| Why prompt | `MissReasonDialog.tsx` | Optional preset + note, z-120 |
| Later reflection | `PostMortemDialog.tsx` | Satisfaction, resistance, focus, distraction 1–10 + note |
| Completion popup | `components/Completion/` | Fires on any false→true `completed` |

## Phase 0 — Fix the widget's Open (bug)

**Bug:** Open in the widget's detail view does not open the rite. Every Open
clicks the header button. That button is lazy: the first click loads the room
and does nothing else. After that it opens the menu, and the detail dialog is
closing at the same moment, so the menu often closes again.

**Fix:**
- Add `ritualSlotPlacement(slot)` in `lib/ritual-todo.ts` that maps an
  available slot (`lib/rituals.ts`) or Star Lord slot to a `RitualTodoPlacement`.
- The widget holds `walk` state and renders `RitualWalkDialog` itself (loaded
  with `next/dynamic` so Home does not parse the room early).
- Close the detail dialog first, then open the rite on the next frame.
- Tile **Open** and detail **Open** use the same path. Drop the DOM clicks.
- Test: detail Open on night, start, end, and Star Lord rows mounts that dialog.

## Phase 1 — Stepped walk for every rite

Every rite moves one question at a time with **‹ ›** and a collapsible side
nav, not an endless scroll.

- Extend `RitualStepper`: a left rail (step names, lamp for done / partial /
  empty), collapsed to the lamp strip under ~640px. Collapse state remembered
  per viewer. Keep Alt+←/→ and the plate.
- Step key per rite in `localStorage`: `brain2-ritual-step:{kind}:{periodKey}`.
  Morning keeps its existing key.
- Moving to another step saves a draft (same as Close). Last step's primary
  key is Save.
- Night / end steps: Unfinished · Assumed times · Look back (plan vs lived,
  tracking, summary) · This period (not night) · How the day was spent (night)
  · Summary / Gratitude / Plan reflection · Reflection · Tomorrow.
- Start steps: Look back · Undone from last period · Due soon · Priorities ·
  Must be done · Intentions · Plan · Gratitude.
- Star Lord: one step per part (before, ledger, inner alchemy, closing).
- Points are unchanged: sections are counted from the answers, not the steps.
- Docs: update the room README "Night / Review" and "Start" lists and the
  `RitualSteps.tsx` row (drop **Planned**).

## Phase 2 — Night: unfinished, scheduled items

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

## Phase 3 — Night: assumed times

1. Fields are **Start · Duration · Finish**, in that order. Editing any one
   recomputes the others: start + duration → finish (default); finish edits
   keep start and change duration; a duration edit keeps start.
   Pure helper `lib/assumed-time-math.ts` with tests.
2. **Negligible** key per row: sets `Task.timeNegligible = true` and duration
   0. It is not a rough estimate and is not asked again. Analytics treats it
   as zero time, not missing.
3. Rows from Phase 2 Done (`completedTimeUnknown`) appear here first.

## Phase 4 — Look back step (all end rites)

One read-only step that sets the period's plan beside what happened: the
morning or start answers (priorities, required, plan, best day), tracked time
by scope, done / pushed / missed counts, and the summary. A note field per
block (`PeriodReview.lookBack`). Night reads that day's morning. Week / month
read that period's Start ritual.

## Phase 5 — Morning: look ahead

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

## Phase 6 — Week / month / season / year

- **End rites:** the Phase 2 row keys (Push asks why; Done dates to the last
  day of the period with unknown time; Missed), the Phase 3 times, and the
  Phase 4 look back.
- **Start rites:** the Phase 5 lists, scaled: Due soon is the coming period;
  Overdue the same; the "bigger list" step shows the next period up (week →
  month, month → season, season → year) with **Do this period**.
- Do not change period keys, `endCompleted`, or the points ledger ids.

## Phase 7 — Make it beautiful

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
