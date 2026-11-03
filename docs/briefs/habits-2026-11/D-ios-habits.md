# Brief D: iOS habits

Read `docs/briefs/habits-2026-11/00-shared-contract.md` first. Phone shell only: `components/Home/Habits/phone/` and phone-only CSS. Follow `docs/MOBILE_STYLE.md`. **The desktop and Electron habit grids must not change.** Today the phone's Week view mounts the desktop `TaskGrid` or `PeriodHabitList`. Replace that on the phone only, and leave those components alone.

Attach: screenshot 3 (the iPhone day view, annotated) and screenshot 4 (BIM chat history font).

## 1. Progress bar backing

Put a black or dark gray backing behind the iridescent progress bar at the bottom (the 14% bar), so the bar stands out. Match the dark CRT used for latched keys.

## 2. BIM chat font

Every habit name and detail line uses the BIM console chat history font, not the system font. That's the message text in screenshot 4. It's probably `--bim-mono` (DotGothic16) in `components/Bim/*.css`. Confirm by inspecting the BIM chat message styles. Size it so names stay readable at 44px rows.

## 3. Cleaner day rows

- **Lamp habits:** drop the "0 / 1" and "1 / 1" counts. A lamp row is just the gem, the name and the LED toggle.
- **Source line:** don't show it in day view for any habit ("By hand", "to do · sent · 147…"). No setting to bring it back is needed.

## 4. Day navigation in day view

- **Day view** (the default) shows **‹ Sun, Nov 1 ›**, and the chevrons move one day. That matches the desktop day lens (`period/habits-day-lens.ts`).
- **Week mode** keeps today's week range and week navigation.
- The horizontal drag already moves by the lens. Keep the two in step.

## 5. Today key in the thumb bar

Show it only when the view isn't on the current day or period. Use `isOnCurrentPeriod` (contract). If it isn't in your worktree yet, add exactly that function.

## 6. Week view: full-width grid

- **Width:** the container spans the full screen width, unlike day view.
- **Rows:** one per habit, labeled with `shorthandName?.trim() || name`. Add the field to the type exactly as the contract says if it isn't there yet.
- **Daily habits:** an iOS-sized **n × 7** grid of simple squares, one column per day (Mon–Sun, following the week's start), with day initials and dates in the header.
- **Brightness:**
  - Met: fully lit.
  - Partial: lit in proportion to progress. Goal 5 with 2 marked = 40% brightness.
  - Not done: dark.
  - Exempt or paused: the existing exempt hatch.
  - Missed opportunity: the existing missed-op mark.
- **Weekly, monthly and season habits:** shown in their own grids below the daily grid, with columns that follow the same windows the desktop uses (`habitWeekWindow`, `habitMonthWindow`, and the season equivalent). Those windows are already picked in the control panel, so on the phone they're changed through the Tools sheet. Don't change the desktop grids to do this.
- **Fit:** all rows and columns are visible without sideways scrolling on a 390pt-wide phone. Squares are as large as fit, but at least 28pt, with 44pt tap targets using padding.
- **Tapping a square:**
  - **Lamp habit:** nothing happens. No popup.
  - **Any other habit:** a popup (a bottom sheet is fine) for that habit and day or period:
    - **The value**, editable, for example "Exercise 30 / 15". Use the existing number and text fields (`habit-value-field.tsx`). The day is fixed to that cell.
    - **History:** the cell's `changes` list (contract), newest first, each with date and time, old → new value, and source in plain words ("Manual · iPhone", "Manual · desktop", "Suggested by helper", "From Tracking", "From link", "Wand"). If there's no history yet, say "No history yet".
    - Edits write through the existing store functions with `source: "manual-ios"` if that argument exists, and without it if it doesn't.
- **Paused habits:** hidden unless **Show paused habits** is on in Tools (session A adds the switch and `visibleHabits`). When shown, paused cells use the exempt hatch.

## Done when

- Each item above works on the phone.
- The desktop renders exactly as before. Spot-check the desktop day and week grids.
- Tests cover lamp rows (no count, no source), the day/week navigation lens, Today visibility, brightness math (2/5 → 0.4), shorthand fallback, and lamp tap = no popup.
- The app is reinstalled and checked on the phone, from the repo root and unsandboxed: `BRAIN2_IOS_TEAM_ID=25YWDVDMKT npm run ios:reinstall -- --force`. The phone must be unlocked. Wait for `[ios-reinstall] … installed`.
- Screenshots from the simulator or phone are shown.
- The phone section of `components/Home/Habits/README.md` is updated.
