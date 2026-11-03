# Habits, Nov 2026: shared contract

_Written 2026-11-01._ Five sessions (A–E) run at the same time, each in its own worktree. Every one of them reads this file first. It fixes the names they share, so their branches merge cleanly.

## Who owns what

| Session | Owns | Stays out of |
|---|---|---|
| A: Paused + shorthand + cell history (data) | `lib/types.ts` habit fields, `lib/habits-store.ts` (the only persist version bump), new `lib/habit-pause.ts`, `lib/habit-exemption.ts`, `components/Home/Habits/habit-form/`, one switch in the control panel | Styling, `phone/` layout, `settings-dialog.tsx`, `lib/habit-helper/` |
| B: Desktop header + grid header bar | Desktop header keys, desktop Today, the bar above the grid (`control-bar/` styles, `habit-grid.css`, header markup), `isOnCurrentPeriod` | Data logic, `phone/`, settings dialog |
| C: Desktop settings | `settings-dialog.tsx` and any new `settings/` folder beside it | Habit form, control bar, `phone/` |
| D: iOS habits | `components/Home/Habits/phone/`, phone-only CSS, the new phone week grid and cell popup | Anything the desktop renders, store write logic |
| E: Daily habit helper | New `lib/habit-helper/`, `components/Lab/HabitHelper/`, `app/lab/habit-helper/`, a new agent adapter, a Chat key on Habits | Habit form, grid, phone layout |

## Shared names

If your worktree doesn't have a name below yet because another session owns it, add **exactly** this line or stub yourself, and don't add more. The identical copies merge without conflict.

```ts
// lib/types.ts, on WeeklyTask (owner: A)
/** Short label for the iOS period grid. "read 5 pages" → "read". */
shorthandName?: string
/** Paused spans. The last span with no `to` is the active pause. Days are YYYY-MM-DD, `to` inclusive. */
pauses?: { from: string; to?: string }[]

// lib/types.ts, on TaskCompletion (owner: A)
/** Append-only change log for this cell. Newest last. */
changes?: HabitCellChange[]

export type HabitCellChangeSource =
  | "manual-desktop"   // a person in Electron / desktop web
  | "manual-ios"       // a person in the phone shell
  | "llm-suggestion"   // an approved proposal from a helper (E)
  | "auto-tracking"    // Tracking minutes / coverage
  | "auto-link"        // sleep, list, tag, keyword, daily-floor links
  | "wand"             // exemption / missed-op wand
export interface HabitCellChange {
  at: string                 // ISO time
  source: HabitCellChangeSource
  from?: number | boolean | string | null
  to: number | boolean | string | null
  note?: string              // e.g. a verbatim missReason
}
```

```ts
// lib/habit-pause.ts (owner: A)
export function isPausedOn(habit: WeeklyTask, dayKey: string): boolean
export function isPausedNow(habit: WeeklyTask, todayKey: string): boolean
export function pausedOverlaps(habit: WeeklyTask, startKey: string, endKey: string): boolean
/** Habits the list should show for a view: hides habits paused now unless showPaused. */
export function visibleHabits(tasks: WeeklyTask[], todayKey: string, showPaused: boolean): WeeklyTask[]

// lib/habits-store.ts (owner: A)
showPausedHabits: boolean            // default false
setShowPausedHabits: (v: boolean) => void
```

```ts
// components/Home/Habits/period/habits-period-cursor.ts (owner: B)
/** True when the cursor already shows the period that contains today. */
export function isOnCurrentPeriod(cursor: Date, period: "day" | "week" | "month" | "season", today: Date): boolean
```

Display name rule for D and E: `habit.shorthandName?.trim() || habit.name`.

## Rules for every session

- Read `CLAUDE.md`, the folder `README.md`s you touch, and `docs/DESIGN_STYLE.md` (desktop) or `docs/MOBILE_STYLE.md` (iOS).
- Only A bumps the habits persist version. Everyone else adds optional fields that need no migration.
- Run the tests for the files you touched (`npx vitest run <paths>`) and `npx tsc --noEmit`.
- Update the folder README once, as `CLAUDE.md` says. Mark anything not built as **Planned**.
- Commit on your own branch. Don't merge, push, or switch branches.

## Merge order

A, then B, C, D, E. After the merge: run the full test suite, then reinstall the iPhone app (`BRAIN2_IOS_TEAM_ID=25YWDVDMKT npm run ios:reinstall -- --force`), and check the paused switch on desktop and in iOS Tools.
