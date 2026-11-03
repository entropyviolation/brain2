# `components/Home/Habits/habit-form/` — Habit form body

_Last mapped: 2026-11-02._

These files are the habit form body. `TaskForm` still lives in `daily-task-form.tsx`. The split did not change the sections. On a phone the parent shows one section at a time; these files still mount the same sections. Visual order is still the flex `order` in `habit-form-dialog.css`. Each section stays a direct child of `.habit95-fields`. Other files do not import this folder.

| File | What moved |
|------|------------|
| `model.ts` | Frequencies, type tiles, tracking modes, list measures and targets, the grace sentence, trigger modes, `EMPTY_RITUAL_IDS`, the list-routing and source-order helpers, `resolveHabitSectionNavActive`, and `habitSectionNav`. No hooks. The type-tile icons sit on `HABIT_TYPES`. |
| `pickers.tsx` | `DailyHabitPicker` and `ListSentPicker`. Still two menus. |
| `identity.tsx` | Pause key (saved habits only), neglect line, Priority, Name with **Shorthand name**, Gem, Frequency, and Type. Submit trims `shorthandName` and drops it when empty. |
| `pause.tsx` | `HabitFormPause`: **Pause habit** / **Unpause habit** and the until-date or indefinitely popup. Edits the draft through `lib/habit-pause.ts`. Not a section key: `.habit95-sec-pause` sits at flex order -1, and on phone tabs it shows with the Priority tab, like the neglect line. |
| `sources.tsx` | Completion sources fieldset: legend, trust order, tag-role note, short row kinds, and the Counts Done / Fills minutes line. |
| `stats-source.tsx` | The Habits stats row. The parent still computes the percents and `statContext`. |
| `list-source.tsx` | The Lists row, including **Open list**. The popup stays on `TaskForm`. |
| `keywords.tsx` | `KeywordSourceFields` on the pipeline row, and the BIM Keywords fieldset. The two gates stay separate. |
| `target.tsx` | Target (goal, time, or count) or Climb. Both use `habit95-sec-target`. |
| `points-time-wording.tsx` | Points & bonus, time estimate, and done-task wording. |
| `tracking-fill.tsx` | Auto-fill from Tracking, only while that source is on. |
| `lift-and-connections.tsx` | `HabitFormLift` and `HabitFormConnections`. Not wrapped together. |

The draft, the locks, submit, and the section observer stayed in `daily-task-form.tsx`. Nothing in the split plan was left behind as a leftover.
