# `components/Reviews/` — Rituals

Global **BRAIN2** header **Rituals** control (not a top-level tab). Day rituals use
sun (morning) and moon (night). Week / month / quarter / year offer **Start
ritual** (plan the coming period) and **Review ritual** (end: clarify, push,
document, evaluate). Dialog shells use the shared pin-bar milled fascia
(`.hpp95` / `components/header-popup-chrome.css`).

Internal persistence still uses `PeriodReview` / `reviews-store` so existing
data opens unchanged. User-facing copy is Rituals.

## Public door

Other rooms may import:

- `Reviews` from `reviews.tsx` — header Rituals control (`Rituals` is the same component). The pin bar keeps a thin key (`components/header-doors.tsx`) and loads this room the first time that key is pressed; the next press opens the menu. The mobile shell mounts it (`components/Mobile/MobileApp.tsx`).
- `PostMortemDialog` from `PostMortemDialog.tsx` — Analytics opens a task reflection (`components/Analytics/ReflectionView.tsx`).
- `RitualWalkDialog` from `RitualWalkDialog.tsx` — Home → To Do opens the rite for that calendar day.

This room writes **`lib/reviews-store.ts`** (`useReviewsStore`: `saveReview`, `replaceMorningReview`, `replaceStartRitual`). `PostMortemDialog` saves the task reflection through `saveCompletionReview` in `lib/services/completion-service.ts`.

Interiors stay in this room: `MorningReviewDialog`, `MorningReview`, `StartRitualDialog`, `ReviewDialog`, `StarLordReportDialog`, `AffirmationsDialog`, `CommitmentMarkList`, `DayReviewTomorrowSection`, `NightTimeGlance`, `WhyBlockedControl`, `PeriodReviewStudio`, `AssumedTimesSection`, and `pendingAssumedTasks`.

This room also writes **`lib/star-lord-store.ts`** for the three Star Lord Reports.

## Files

| File | Purpose |
|------|---------|
| `reviews.tsx` | `Rituals` header button (`Reviews` alias) — day sun/moon + **prior-day night** + period Start/Review; **Star Lord Report** on the local new moon, full moon, and birthday; `ReviewDialog` (`data-ui-name="Period review"`) for night/end; `.hpp95` shell |
| `RitualWalkDialog.tsx` | Opens the same morning, start, end, or Star Lord dialog from a Home → To Do row |
| `StarLordReportDialog.tsx` | Star Lord Report (`data-ui-name="Star Lord Report"`). Preparation, three ledger questions, three inner-alchemy questions, closing. New moon is at home, facing north. Close saves a draft. Save awards section points plus the whole-ritual bonus |
| `StartRitualDialog.tsx` | Start / planning ritual for week–year (`data-ui-name="Start ritual"`): undone from last period, priorities, must-dos, **mark assigned tasks** required / prioritized, intentions, plan, gratitude |
| `MorningReview.tsx` | `MorningReviewDialog` (`data-ui-name="Morning review"`) — day morning (sun) ritual (HM2); same answers as text `gm` |
| `CommitmentMarkList.tsx` | Shared required / prioritized task checkboxes (`marks`: `required` \| `prioritized` \| `both`) for morning sections and start-ritual rows |
| `AffirmationsDialog.tsx` | Spoken-affirmations ritual from the morning dialog |
| `DayReviewTomorrowSection.tsx` | Night / day end: "make a plan for tomorrow" (plan log + schedule/create tomorrow to-dos) |
| `NightTimeGlance.tsx` | Night ritual: time grid, day log, and activity log pinned to that ritual's day, plus a short analysis note. Day-log slabs keep their pen colors inside the dialog |
| `WhyBlockedControl.tsx` | Why blocked? Presets stay tokens. **Other** on a ritual row opens a single-line field. The optional prompt passes `noteAlways` so a multiline note sits beside any preset, and `aboveDialog` so pointer events stay on. The list is the shared menu layer, above that window. The field keeps spaces while you type; the saved note is trimmed |
| `MissReasonDialog.tsx` | Optional why. The reason menu is the shared portaled select (`components/ui/menu-layer.ts`), above this dialog and its scrim (z-120), so the list stays visible and clickable. The note is a textarea about six lines tall (`max-h-40`); longer text scrolls inside the field, and the window itself caps at the viewport. Spaces stay in the field while typing; Save stores the trimmed note. Skip, the close key, and a blank Save resolve with no reason. Callers still push, miss, or mark |
| `PeriodReviewStudio.tsx` | Week, month, season, and year: period stats, then the shared reflection questions |
| `PostMortemDialog.tsx` | Later per-task note from **Reflect** on a period ritual, or from Analytics. Satisfaction, resistance, focus, distraction (optional 1–10; clearing a score removes it, and a score this dialog does not show is left as saved) and its own note (`completionReview.reflectNotes`). It does not select goals, award the quick review, or edit length, start, or the quick-review `notes` — those stay on the completion popup (`components/Completion/`). It does not create, revise, or delete the `review:${taskId}` points row. A note saved before this split, and never awarded, still opens here; saving it stores `reflectNotes` and leaves `notes` alone. Close saves a changed note. |
| `AssumedTimesSection.tsx` | Confirm assumed completion times in the end ritual. Optional **Est.** marks duration or start as a rough estimate (`Task.timeRough`) |

## Entry point

The pin-bar Rituals key (`header-doors.tsx`) loads this room the first time it
is pressed. The next press opens the menu. The key sits in the **Rituals** group,
beside System and Capture. The mobile shell still mounts `Reviews` directly.

- **Rituals** opens a menu of every period. Badge = count of available/undone
  slots (`lib/rituals.ts` → `countAvailableRituals`), plus an open Star Lord Report.
- **Day:** sun → morning dialog for today; moon → night dialog for today; a second moon row opens **yesterday's** night (so a missed night is not stuck on today).
- **Week–year:** Start ritual → `StartRitualDialog` for the **current** period;
  Review ritual → end dialog for the **just-ended** period.
- **Star Lord Report:** shown when today is the local new moon, the local full moon, or the birthday in Settings → **Birthday**. A birthday that falls on a moon keeps both rites. An undone report from yesterday stays in the menu through the next day. The walk is preparation, the ledger, inner alchemy, and a closing toward the north. Answers live in `lib/star-lord-store.ts`. Telegram `rituals` lists an open report and points at Header → Rituals; the questions themselves are the desktop dialog.
- Menu footer reminds Telegram: `rituals · gm · gn · review week · ritual start week`.
- Home overview tile **Rituals due** counts rites due for this day. Open resumes that rite. The handheld groups today, last night, and longer first-run slots, without the app path or the telegram verb. The header badge can still be the full undone count. Analytics → Reviews reads morning / start / end slices.

## Model (day vs other periods)

| Period | Start | End |
|--------|-------|-----|
| Day | Morning (sun) → `PeriodReview.morning` | Night (moon) → review root + `endCompleted` |
| Week / month / quarter / year | Start ritual → `PeriodReview.start` | Review ritual → review root + `endCompleted` |

Legacy rows without `endCompleted` still count as end-done when they have end
body content, or when they are empty shells with no morning/start (old Save
Review). A morning-only or start-only shell does **not** mark the end ritual done.

## To Do day

Home → To Do, on the **day** lens, lists each rite on its calendar day
(`lib/ritual-todo.ts`). Monday is start of week. Sunday is end of week. That
is the Monday–Sunday week the rest of the app already stores (`getWeekString`),
chosen again here because the day of the rite should be the day you can point
at. End of month is the last civil day of that month, including 29 February.
Start of month is the 1st. Season start is the first day of the quarter
(1 Jan, 1 Apr, 1 Jul, 1 Oct). Season end is the last day (31 Mar, 30 Jun,
30 Sep, 31 Dec). Year start is 1 January. Year end is 31 December. Morning
and Night are every day.

**Star Lord ritual** is the named rite. It lands on the local day of the new
moon, the local day of the full moon, and the birthday. The full moon is the
mid-month rite. There is no separate civil 15th. A Feb 29 birthday falls on
1 March in a common year, the same rule as the menu. There is no other
weekday schedule.

The menu above stays what it is: the current start all period, the just-ended
review after the period closes, and one extra day for yesterday's night and
an undone Star Lord report. To Do does not show those on the wrong day. A
submitted rite is **Done** for its day. Opening the row opens this room's
dialog (`RitualWalkDialog`). The row is not a stored task.

## Morning ritual (HM2)

Same flow as before — see historical morning steps in this README's morning
section below. Desktop and text `gm` share `replaceMorningReview`.

## Start ritual (week–year)

1. **Undone from last period** — pull into this period or note them.
2. **Priorities** — free text for what matters most.
3. **Must be done** — required outcomes, plus `CommitmentMarkList` (`marks="both"`) that marks this period's assigned tasks **Required** or **Prioritized** (`Task.todoMarks`).
4. **Intentions** — tone / focus.
5. **Plan** — concrete plan for the period.
6. **Gratitude**.

**Close** saves a draft. **Save progress** / **Save Start ritual**. A start ritual that was already submitted stays submitted if you close it after a tweak. Undone from the last period uses the same date-scoped unfinished list as the night ritual. Telegram: `ritual start week` (etc.). After must-dos, the text walk asks `required: 1, 8` and `priority: 2` (a bare comma list marks required).

## Night / Review (end) flow (`ReviewDialog`)

1. **Unfinished items** — the ritual's own period, not "today". A past day uses the Undone ledger (`lib/ritual-unfinished.ts`), so work that rolled onto the next day still appears. Done completes in place. **Push** uses the Scheduler's `pushCardWorkingQueue` (`lib/ritual-push.ts`): the task is reassigned to the next open period and the row leaves this ritual. A failed push leaves the row. One shared **Why blocked?** (`WhyBlockedControl`) sits above the unfinished list and is applied on Push. Presets stay the token. **Other** opens a text field; the words are stored with the token (`{ reason: "other", note }`). Spaces stay while typing; the saved note is trimmed. A blank Other stays the token `"other"`.
2. **Assumed times** — correct or confirm. Optional **Est.** (`Task.timeRough`) means the duration or the start (or both) is a rough estimate. It stays on the task and shows on Done rows.
3. **This period** (week, month, season, year — not night) — missed points, points vs last period, the habit grade for that span vs the previous one (weeks listed inside a month or season; months inside a year), daily habits never done in the span, and a tracking breakdown by the scopes already on the desk (activity, location, and the rest). Then the longer reflection (`PeriodReview.arc`).
4. **How the day was spent** (night only) — time grid, day log, and activity log for that date, plus a short note (`timeReflection`). Day-log colors are the pen colors.
5. **Summary** / **Gratitude** / **Plan reflection** (day/week/month)
6. **Reflection** — went well / improve / learned (these stay separate from the longer arc questions)
7. **Wake-up reminder** and **What matters most tomorrow?** (night only). Empty shows nothing. The next morning shows the reminder first, then what matters most.
8. **Goals to focus on tomorrow** (night only) — `tomorrowFocusGoalIds`. Tasks that serve those goals (or their objectives) are listed first in the next morning and are more likely to be suggested. Points use the goal-focus multiplier (Settings → Points → Points rules, default 1.5×). If an objective multiplier already boosts the task, the larger one is kept — they are not multiplied together. Beat-the-clock stays inside the base.
9. **Tomorrow's plan** — the prompt is "make a plan for tomorrow". The plan log and tomorrow's to-dos stay.

**Close** is a text link (`.hpp-link-close`); it saves a draft (`endCompleted: false` unless the ritual was already submitted) and awards no points. The longer answers restore on reopen. Primary **Save** submits it as done and awards points.

Points (`lib/ritual-points.ts`, edited in Settings → **Points** → **Points rules**): **10** per section actually filled or confirmed, plus **30** for submitting the whole ritual. Vacuous sections (nothing unfinished, nothing assumed) count. Optional blanks do not. Each answered reflection question counts on its own, including each filled arc question on a week, month, season, or year. A photo with no caption counts as the inspiration question. Fear and its reframe are one question. The stats panel is not a question. Night does not score `arc`. Re-saving replaces that ritual's ledger row (`ritual:{period}:{key}`) instead of stacking.

Telegram: `gn` / `good night` (today's night); `review week` / `ritual end week`
(just-ended period). The text walk follows the same steps, including assumed
times, the night time note or the longer stats and arc, the wake-up reminder,
what matters most, and goals to focus. `3 other the rain` stores Other with
that note. `cancel` leaves the walk. A reply inside the walk is not a `log:`.

## Available / undone list

| Surface | How |
|---------|-----|
| App — Rituals menu | Due / … / ✓ on each slot; badge on the Rituals key |
| App — Home tile | **Rituals due**: today's open rites; Open resumes that walk |
| Telegram | `rituals` or `reviews` → board with every slot, status, command, and app path |

Helpers: `lib/rituals.ts` (`listAvailableRituals`, `formatRitualsBoard`,
`endRitualPhase`, `startRitualPhase`). Star Lord slots are `lib/star-lord.ts`
(`listStarLordSlots`) and count on the same badge.

## Star Lord Report

Three rites, one dialog (`data-ui-name="Star Lord Report"`). The day is the
local calendar day that contains the new moon, the local day that contains the
full moon (`lib/lunar.ts`), or the birthday in Settings. February 29 is read
on March 1 in a year without that day.

1. **Before you begin** — three slow breaths, wash hands and face, sit facing north, optional incense or a cup of clear water. The new moon says to do this at home, in a quiet room.
2. **The ledger** — three questions for that rite (what to clear or plant, what the month has done, or the year's return to the source).
3. **Inner alchemy** — three further questions. The note asks to breathe the question into the belly and write what remains.
4. **Closing** — warm the palms, rest them over the heart, bow slightly toward the north, and the three lines beginning "May my thoughts match the clarity of the Void."

**Close** saves a draft and awards nothing. **Save Star Lord Report** submits it. Each answered question is a section. Re-saving replaces `ritual:star-lord:{kind}:{date}` in the points ledger. A rite that was already submitted stays submitted if you close it after a tweak.

## Telegram (BIM)

| Command | Ritual |
|---------|--------|
| `gm` / `good morning` / `ritual morning` | Day morning (sun) |
| `gn` / `good night` / `night` / `ritual night` / `review today` | Day night (moon) for today |
| `ritual start week\|month\|quarter\|year` | Start / planning |
| `review week\|…` / `ritual end week\|…` | End / review (just-ended) |
| `review` / `ritual` (bare) | First available/undone slot |
| `rituals` / `reviews` | Board, including an open Star Lord Report |
| `cancel` | Leave night/start/end |
| `STOP` | Leave morning (all caps) |

Backward compatible: `reviews` / `review` still work; preferred user language is Rituals.

## Morning review ritual (HM2) — detail

`MorningReviewDialog` captures:

1. **All nighter** checkbox (skip sleep clocks) or fell-asleep / wake / dream
2. **Five affirmations** from Lists → `affirmations`
3. **To do for today** — add lines and/or `rm 1 3`, then `CommitmentMarkList` for **Required — must be done today** and **3–5 highest priorities** (those ids become `todoMarks` on save)
4. **Daily habit priorities** — 1–3
5. **Go through to do list** — six-slot walk
6. **Plaintext day plan**
7. **Circumstances** — must-not / events / excitement (required tasks are asked with the to-do list)
8. **Best day ever**
9. **10 gratitude**

`completed: false` = in progress; `true` = full submit. Older saves without the
flag still count as done when populated. Closing the dialog saves the draft the
same way **Save progress** does, and does not mark the morning done. The top of
the dialog shows the previous night's wake-up reminder, then what matters most,
when those were written. Over Telegram, Live Location updates
are ignored until the ritual ends; the same share resumes on the next edit.
The text walk keeps every step above and adds the previous night's carry on
the opening prompt. Required items are a line of only comma-separated numbers
(`1,8` or `1, 8`); a line with any other text is a new to-do, not a split.
On the six-slot walk, importance, resistance, and excitement are 0–10 and may
be decimals (`- 90 200 6.5 3.5 9`). A line that fails stays on that same item.
`SKIP` leaves one item. `SKIP ALL` leaves the rest and continues at the day plan.

## Why-blocked reasons (HM3)

**Why blocked?** on a ritual push saves `blockedReasons`. A preset is the token (`"no-time"`). **Other** with text is `{ reason: "other", note: "the rain" }`. Other left blank is the token `"other"` — it does not pretend a custom reason was written. Analytics → Reviews shows the words. The regret ledger keeps the token only.

`MissReasonDialog` is the same preset control plus a note, for rooms that ask after the fact (Scheduler Push, To Do Push, missed tasks, header plan Skip, habit missed-op wand, operation Why missed). The dialog and its scrim are `z-[120]` so the prompt sits above the room that opened it. The reason list is the one portaled select menu, not a second copy in the page. It was painting underneath because the select's default `z-50` was copied onto the popper wrapper, under this scrim. Every select and dropdown now uses the shared menu layer (`components/ui/menu-layer.ts`), above this window, with pointer events on, so the options stay clickable. The note on this prompt is a textarea (several lines visible, `max-h-40`, scrolling inside the field). The dialog caps at the viewport (`max-h-[calc(100dvh-2rem)]`) and scrolls itself if the window is short. Ritual rows keep the inline control and a single-line Other field — that row is not this popup. A note with no preset is stored as Other. A preset with a note keeps both. Skip writes nothing and does not cancel the action that opened the prompt.

## Longer reflection (week, month, season, year)

One shape, `PeriodReview.arc` (`lib/period-arc.ts`). Night does not ask these. Headings: Growth and Accomplishments, Health and Well-Being, Relationships and Support, Planning for the Next Period, then inspiration (text and photos via the existing attachment store), joy, fear and reframe, best and worst, and an ideal next period. Wording follows the period ("this past week" / "this season" / "next year"). Empty answers are not sections. Analytics → Reviews reads them in those groups, photos included, inside the analytics range.

## Data

| Store / helper | Role |
|----------------|------|
| `lib/reviews-store.ts` | `PeriodReview[]` + operation reviews; morning + **start** helpers; period keys |
| `lib/rituals.ts` | Slots, available/undone, board text, phase helpers |
| `lib/pending-reviews.ts` | Just-ended **end** rituals still due (uses `endRitualPhase`) |
| `lib/ingest/apply-ritual.ts` | Telegram board, night, start, end walks; morning via `apply-morning-gm` |
| `lib/services/review-service.ts` | Carry-over helpers |
| `lib/ritual-push.ts` | Ritual push — the Scheduler's `pushCardWorkingQueue` |
| `lib/blocked-reason.ts` | Preset tokens, Other text, labels |
| `lib/period-arc.ts` | Shared reflection prompts and which answers count |
| `lib/period-ritual-stats.ts` | Period stats for the longer review (habit grade, points, tracking) |

## Period keys

| Period | Key format |
|--------|------------|
| Day | `YYYY-MM-DD` |
| Week | `getWeekString` range |
| Month | `YYYY-MM` |
| Quarter | `YYYY-Qn`. Menu and dialogs show `Quarter YYYY Qn (Season)` from `lib/seasons.ts` (Q1 Spring, Q2 Summer, Q3 Fall, Q4 Winter). 26 Sep 2026 is **Quarter 2026 Q3 (Fall)**. |
| Year | `YYYY` |

## Push behavior

**Push** in the review dialog calls `ritualPushPatch` → `pushCardWorkingQueue`.
The period being left is marked `pushed` and drops off this ritual's unfinished
list. Home → To Do Undone still lists it. The live schedule moves to the next
open period (a past week pushed today lands on the current week). A season
pushes the month the task sits on, and marks the season's other months that
held it. Counters (`daysPushed` / `weeksPushed` / `monthsPushed`) still increment.

## Icons

Day sun/moon: `RitualSunIcon` / `RitualMoonIcon` from `@/components/Icons`
(registered in `icon-registry.ts`).
