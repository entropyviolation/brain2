# Brief A: Paused habits, shorthand name, cell history (data)

Read `docs/briefs/habits-2026-11/00-shared-contract.md` first. You own every name it lists under A. Other sessions code against those names right now, so keep them exactly as written.

Start in plan mode. List any open questions before you write code.

## 1. Paused state

Use case: "water plants" during a three-month art residency. While the habit is paused, it doesn't count against any score and doesn't appear in the list. Nothing about it is deleted.

- **Pause key:** at the very top of the habit's settings (`components/Home/Habits/habit-form/`), add a **Pause habit** key. While the habit is paused it reads **Unpause habit**.
- **Pause popup:** pressing the key opens a popup with two choices:
  - **Until a date.** The date is the last paused day. The habit unpauses on its own at midnight after that day.
  - **Indefinitely**, until you unpause it.
- **Unpause:** closes the open span (`to` = yesterday, or today if the pause started today). Earlier spans stay.
- **Store:** store spans in `pauses` (contract). Put the helpers in a new `lib/habit-pause.ts`. Automatic unpause is computed from the date, not run on a timer: a span whose `to` is in the past is simply over.
- **Exemption:** every day, week, month and season that overlaps a pause is exempt. Fold this into `lib/habit-exemption.ts`, so the grades, points, Week grade, Good days, streaks, priority math and `lib/habit-done-log.ts` all see the same exemption with no extra wiring. Look for anything that reads the task list directly and skips exemption, such as the daily floor in `lib/habit-completion-source.ts`. Paused habits must not count there either.
- **Data is kept:** stored completions, settings, links and gems stay as they are. Nothing is rewritten. If a cell inside a paused span has a value, it keeps that value and still shows as exempt.
- **What shows when:**
  - **While actively paused:** the habit doesn't appear in any Habits list (desktop day, week, period, heatmap or phone) for any date, past or future, unless **Show paused habits** is on.
  - **After unpausing:** the habit reappears. Its paused periods look exactly like the existing exempt cells.
  - **With Show paused habits on while paused:** the habit appears with its paused span in the exempt style, and a small "Paused" or "Paused until Mar 3" label is fine.
- **Show paused habits switch:** `showPausedHabits` (default off), shown as a switch in the Habits Tab Control Panel's advanced or rocker area, using the existing `CockpitSwitch` or rocker. The phone Tools sheet mounts the same panel, so iOS gets the switch automatically. Check that it does.
- **Filter in one place:** export `visibleHabits` and use it where each view gets its list, not separately in each view. Touch `phone/` only at the line where the list is fetched.
- **Persist:** bump the habits persist version once, with a migration that only fills in missing keys (`showPausedHabits: false`). Stores and the phone copy must carry `pauses` and `shorthandName` through the field patch sync (`lib/phone-window.ts`, the habit patch path). Check that a phone edit doesn't drop them.

## 2. Shorthand name

- **Field:** an optional **Shorthand name** under the name in the habit form, with a hint like "read 5 pages → read". Saving an empty value clears it.
- **Where it's used:** only the iOS period grid (session D) and the helper (session E). Desktop keeps showing the full name everywhere.

## 3. Cell change history

- **Log every change:** every write to a habit cell appends a `HabitCellChange` (contract). That includes values, toggles, exempt and missed-op wands, missed reasons, Tracking or link autofill, and approved helper proposals.
- **Source:** decide it at the write call. For a person, use `manual-ios` in the phone shell (`components/Mobile/use-in-mobile-shell.ts` or the equivalent check) and `manual-desktop` otherwise. Autofill paths pass their own source.
- **Expose the source:** give the store's write functions an optional `source` argument, so session E can pass `llm-suggestion`.
- **Size limit:** keep only the newest 50 entries per cell.
- **No backfill:** old cells have no history, and that's fine.

## Done when

- Pausing "water plants" until a date takes it off every list.
- Its days, weeks and months are exempt in every grade.
- After the date passes, the habit is back, with the paused stretch shown as exempt.
- Turning Show paused habits on shows the habit while it's paused, on desktop and in iOS Tools.
- No stored completion or setting has changed.
- Tests cover: span math, inclusive `to`, automatic unpause by date, exemption across day/week/month/season, `visibleHabits`, migration, the phone patch round trip, and history append and cap.
- `components/Home/Habits/README.md`, `habit-form/README.md` and `docs/SPEC_MAPPING.md` (if habits are mapped there) are updated.
