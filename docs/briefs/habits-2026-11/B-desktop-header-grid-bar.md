# Brief B: Desktop header keys, Today key, grid header bar

Read `docs/briefs/habits-2026-11/00-shared-contract.md` first. Desktop and Electron only. Don't change anything the phone shell renders. Follow `docs/DESIGN_STYLE.md`, and `.cursor/rules/` for design style while styling. Silver chrome, never gold.

Attach: screenshot 1 (the header row) and screenshot 2 (the Habits tab, with the annotated bar).

## 1. Keycap header keys

Every key in the Habits header row becomes a keycap: **‹**, **Today**, the date plate, **›** and **Settings**.

- **Reuse what exists.** The repo already has silver keycaps: commit `916240f` ("one silver keycap plate") and `70bc371` ("header go keys use w95fa like the weekday plate"). Search for `keycap`, and match the keycap that's closest in size, along with its font, plate, pressed state and focus ring.
- **Don't invent a new keycap.**
- **Date plate:** the date shows as a keycap that holds its text. It stays clickable if it's clickable today.

## 2. Hide Today on the current period

- **When Today shows:** only when the cursor is not already on the period that contains today. That's the day in day view, and the week, month or season in those tabs.
- **Shared helper:** add `isOnCurrentPeriod` to `components/Home/Habits/period/habits-period-cursor.ts` (contract), with tests. Session D uses the same helper on iOS.
- **No layout jump:** when Today hides, the row stays put. Keep its space, or make sure the plate doesn't move enough to be noticeable. Pick whichever looks right.

## 3. Soften the bar above the grid

The column header row (Task / Sun 11/1 / Detail / %) and the group row (LAMPS) are harsh next to the chrome above them. The problems are heavy stripes, hard dark rules and boxy cells.

- Make them softer and closer to the brushed silver plates above, with lighter rules, gentler contrast and a consistent font.
- Keep column alignment, sticky behavior, double-click breakdowns and resize, if any.
- The Daily / Weekly / Monthly / Season keys may get a matching touch only if needed to fit, without restyling them.

## Done when

- The header row is all keycaps.
- Today shows only away from the current period, in every tab.
- The grid header sits quietly under the chrome.
- Screenshots of before and after are shown.
- The phone is unchanged. Check `phone/` renders the same.
- Tests for `isOnCurrentPeriod` pass, along with the existing week navigation tests.
- `components/Home/Habits/README.md` is updated.
