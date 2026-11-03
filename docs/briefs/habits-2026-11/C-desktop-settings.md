# Brief C: Habits settings, flip-through and reorganized

Read `docs/briefs/habits-2026-11/00-shared-contract.md` first. Desktop and Electron. Follow `docs/DESIGN_STYLE.md`. Your files are `components/Home/Habits/settings-dialog.tsx` and anything new beside it.

## The ask

The settings are hard to navigate. Make them clearer and organize them in a way that makes sense. Instead of one long scroll, they become **pages you flip through**.

## How

1. **Inventory every setting** in the dialog (`components/Home/Habits/README.md` has the settings table).
2. **Group them into about 5–8 pages** by what a person is trying to do. For example: Grades and scoring, Points and bonuses, Week and month windows, Lamps / LEDs / colors, Links and sources, Phone, Advanced. That's only a starting point. Propose your grouping, with one line per page saying what goes there and why, before building.
3. **Navigation:**
   - A page strip or tabs at the top, plus ‹ › keys, and ← → on the keyboard.
   - The current page name and "3 / 7" are always visible.
   - Each page fits without scrolling at the usual window size. If a page doesn't fit, split it.
4. **Labels:** plain words. Each setting gets a one-line hint saying what it changes.
5. **Behavior stays the same:** every store field, default and test keeps working. This is a layout and wording change.
6. **Remember the last page** opened, with per-viewer storage that's fine to lose.

## Done when

- Every setting that existed is on exactly one page.
- Nothing scrolls at the normal size.
- The existing `settings-dialog.test.tsx` passes, and new tests cover page flipping and that every setting is reachable.
- Screenshots of each page are shown.
- The README settings section says how the pages are organized.
