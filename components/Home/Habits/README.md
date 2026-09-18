# `components/Home/Habits/` — Habit Tracker

The Home **Habits** sub-tab. Supports five measurement types (boolean, goal, text, climb) at **daily**, **weekly**, and **monthly** frequencies. TIME/COUNT are legacy aliases for GOAL.

Climb (incremental) habits are **not** a per-key spreadsheet. They log one number per day, like a goal, with a derived target. Rules live in **`lib/incremental-habits.ts`**.

## Data

Single source of truth: **`lib/habits-store.ts`** (Zustand + persist, key `cogs-habits-store`, **version 5**).

| Field | Contents |
|-------|----------|
| `tasks` | Habit definitions (`WeeklyTask[]`) |
| `weeklyData` | Per-day completions keyed by local date (`YYYY-MM-DD`) |
| `weeklyHabitData` / `monthlyHabitData` | Weekly/monthly frequency completions |
| `gradeTolerance` | Raw daily % that counts as 100% on the **Week grade** curve (default 100 = no curve) |
| `outputGradeTolerance` | Raw elapsed row % that counts as 100% on the **Perfect output** curve (default 100) |

Completing a habit awards **50 points × that day’s completion ratio** (partial goals/climbs count) via `lib/habit-points.ts` / `points-store.upsertPoints`, and writes a `loggedAction` Done row (`lib/habit-done-log.ts`, id `habit-done-{habitId}-{YYYY-MM-DD}`) so it appears in To-Do **Done** (today / this week / this month) and in Analytics task counts. Unchecking removes that row and zeros that habit’s points for the day. Each elapsed day can also earn **+50** if that day’s **raw** column score is above 80%, **+100** if either Week grade or Perfect output is 75%+ after its curve, or **+300** if both grades are. Persist **v5** adds `outputGradeTolerance`. Persist **v4** adds `gradeTolerance`. Persist v3 migrates old multi-metric climb maps (`currentValues` / `weeklyIncrement`) into one habit per metric and copies logs onto `TaskCompletion.value`. Legacy `weekly-habits-*` localStorage keys are imported once on first load.

The same store is used by **`Lists/daily-habits-list.tsx`** — changes in Home or Lists stay in sync.

## Files

| File | Purpose |
|------|---------|
| `habit-tracker.tsx` | `WeeklyTaskTracker`: Daily / Weekly / Monthly tabs, week navigation, **Week grade** + **Perfect output** pills, hide-completed, settings |
| `grade-breakdown-dialog.tsx` | Week grade: raw vs curved day table + editable daily-curve tolerance; scrollable; 50/100/300 point rules |
| `output-grade-breakdown-dialog.tsx` | Perfect output: raw vs curved elapsed row % per habit + its own tolerance |
| `task-grid.tsx` | Compact spreadsheet: habits × 7 weekdays + week % with gradient progress bars; climb = `value / target`; 4+ day week-streak chips |
| `habit-grid.css` | Fixed-layout grid so Sun and week % fit; compact progress bars |
| `period-habit-list.tsx` | Checklist UI for weekly/monthly frequency habits; climb uses the same numeric `/ target` cell |
| `week-navigation.tsx` | Previous / next week, Today, date range label |
| `daily-task-form.tsx` | Create/edit: name, period frequency, type tiles, goal amount, or Climb cadence + start/increment/unit |
| `daily-task-form-dialog.tsx` | Win95 window wrapper for create/edit habit |
| `habit-form-dialog.css` | Title bar, sunken groups, raised **Add Habit** / Cancel buttons |
| `settings-dialog.tsx` | Import/export habit JSON, reset to defaults |

Pure logic (not in this folder): `lib/incremental-habits.ts`, `lib/calculations.ts`, `lib/habit-utils.ts`, `lib/habit-done-log.ts`, `lib/habit-week-streaks.ts`.

## Tabs in `habit-tracker.tsx`

| Tab | View |
|-----|------|
| Daily | `TaskGrid` for the selected week |
| Weekly | `PeriodHabitList` for habits with `frequency: "weekly"` |
| Monthly | `PeriodHabitList` for habits with `frequency: "monthly"` |

Habit **frequency** (daily / weekly / monthly tab) is independent of climb **cadence** (how the target rises). A meditation climb is usually `frequency: "daily"` and `cadence: "weekly"`.

## Habit types (`TaskType`)

| Type | Input | Done when |
|------|-------|-----------|
| Boolean | Checkbox | Checked |
| Goal / Time / Count | Number | Value ≥ `task.goal` |
| Text | Textarea | Non-empty text |
| Climb (`INCREMENTAL`) | Number vs a derived target | See cadences below |

### Climb cadences (`incrementalData.cadence`)

Configured in Add/Edit → **Climb**. One metric per habit. Logs persist as **`TaskCompletion.value`** (same field as Goal). Legacy `incrementalValues` maps are still read.

| Cadence | Example | Grid | Target | Week % | When the target rises |
|---------|---------|------|--------|--------|------------------------|
| **Weekly +** | Meditate *n* minutes | `logged / this week's goal` | Fixed for the whole week, starting at `startValue` | Sum of daily logs / (week goal × 7), capped at 100% | Next **Monday**, only if the previous week had **≥ 4 days** at or above that week's goal. Overshooting a day still counts as one hit. |
| **Daily +** | Chess rating +10 | `score / (last log + increment)` | Last **logged** score + `increment` | Week gain / (`increment` × 7), capped at 100% | Any log (including a drop) becomes the next day’s base. A skipped day keeps the previous base. Completing the day requires `log ≥ last log + increment`. |

Add/Edit fields for Climb: **Weekly +** / **Daily +**, starting value, increment, optional unit. `startedOn` is stored as a local `YYYY-MM-DD` so weekly bumps walk from a known week 0.

Default seeds: chess match and puzzle as separate **Daily +** habits; meditate as **Weekly +** (+1 min after 4+ days). Persist v3 splits the old combined chess habit.

## Add / Edit Habit window

Opened from the floating **Add** control (or Lists → + Add Habit). Chrome is a Windows 95 window: navy title bar, gray face, sunken fieldsets, raised **Add Habit** / **Update Habit** and Cancel. Type tiles: Yes/No, Goal, Text, Climb. Choosing Climb reveals cadence tiles and start/increment/unit — not a list of named metrics.

## Notes

- Daily tab **Week grade** is the mean of each elapsed day’s overall habit % after an optional daily curve (`calculateWeekToDateGrade`). **0% stays 0%** — the curve never lifts an empty day. Click the grade pill for a breakdown (raw vs curved) and to set **tolerance** (the raw % that counts as 100; 80% → each day gets +20, so 70/80/90/80 raw → 90/100/110/100 curved → 100% grade). Default tolerance 100 = no curve. The popup also notes daily points (50 per habit, fractional), **+50** when that day’s raw score is above 80%, and the 75% grade bonuses (+100 either / +300 both). Long popups scroll.
- Daily tab **Perfect output** is the mean of each daily habit’s **elapsed** row % (`calculateWeekToDateOutputGrade` / `calculateElapsedTaskPercentage`): boolean/text = hits / days so far; goal = sum / (goal × days so far); climb uses `incrementalWeekPercentage` on elapsed dates. The grid’s per-habit week % still uses a full 7-day denominator. Click the pill for a habit table and a separate **outputGradeTolerance** curve (same formula, independent of Week grade). On 0/100 boolean cells the two grades match; GOAL/climb can diverge because day % caps per cell while row % sums.
- Each daily habit row can show a compact **4+ week-streak** chip (`lib/habit-week-streaks.ts`): days done this week, `4+` when this week already has ≥4 hits, and `🔥 Nw` for consecutive weeks with 4+ completed days. This does not change climb Monday-bump rules.
- The daily grid is a fixed-layout compact table (`habit-grid.css`) so Sunday and the per-habit week **%** stay on screen. Weekday headers are `Mon` + `9/14` (date only, not a second weekday). Per-habit and daily-completion cells keep the gradient progress bars.
- Meeting a habit’s goal logs a Done item (`lib/habit-done-log.ts`) for that calendar day (and therefore that week/month). Daily points are 50 × completion ratio, not the old per-habit `rewardValue` (weekly/monthly habits still use `rewardValue` on first full complete), plus the per-day raw/grade bonuses above.
- Streaks for habits (including climb, using the derived daily target) are on Analytics → **Streaks** (`lib/streaks.ts`), not on the Habits grid.
- Default seed: 15 daily habits in `getDefaultHabits()` (chess match + puzzle; **Read at least 10 pages per day**, id `task-9` — Book implied-action target).
- Item-type / list rules can `incrementHabit` a numeric delta into that day’s **GOAL** completion (`lib/implied-actions.ts`) — that path is for pages/day-style goals, not climb committed scores.
