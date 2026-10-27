# `components/Home/Habits/habit-form/` — Habit form body

_Last mapped: 2026-10-27._

These files are the habit form body. `TaskForm` still lives in `daily-task-form.tsx`. The screen did not change. Visual order is still the flex `order` in `habit-form-dialog.css`. Each section stays a direct child of `.habit95-fields`. Other files do not import this folder.

| File | What moved |
|------|------------|
| `model.ts` | Frequencies, type tiles, tracking modes, list measures and targets, the grace sentence, trigger modes, `EMPTY_RITUAL_IDS`, the list-routing and source-order helpers, `resolveHabitSectionNavActive`, and `habitSectionNav`. No hooks. The type-tile icons sit on `HABIT_TYPES`. |
| `pickers.tsx` | `DailyHabitPicker` and `ListSentPicker`. Still two menus. |
| `identity.tsx` | Neglect line, Priority, Name, Gem, Frequency, and Type. |
| `sources.tsx` | Completion sources fieldset: legend, trust order, tag-role note, short row kinds, and the Counts Done / Fills minutes line. |
| `stats-source.tsx` | The Habits stats row. The parent still computes the percents and `statContext`. |
| `list-source.tsx` | The Lists row, including **Open list**. The popup stays on `TaskForm`. |
| `keywords.tsx` | `KeywordSourceFields` on the pipeline row, and the BIM Keywords fieldset. The two gates stay separate. |
| `target.tsx` | Target (goal, time, or count) or Climb. Both use `habit95-sec-target`. |
| `points-time-wording.tsx` | Points & bonus, time estimate, and done-task wording. |
| `tracking-fill.tsx` | Auto-fill from Tracking, only while that source is on. |
| `lift-and-connections.tsx` | `HabitFormLift` and `HabitFormConnections`. Not wrapped together. |

The draft, the locks, submit, and the section observer stayed in `daily-task-form.tsx`. Nothing in the split plan was left behind as a leftover.
