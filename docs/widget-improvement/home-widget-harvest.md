# Harvest leftover

Widget id: `home-widget-harvest`

Runtime id is `harvest` (`data-widget="harvest"`). The square is `HarvestTile` in `components/Home/home-glance-tiles.tsx`. The face is `harvestFace` in `lib/home-glances.ts`. The dialog is the shared silver handheld in `components/Home/home-widget-dialog.tsx`, opened from `home-overview.tsx`. Catalog copy lives in `lib/home-widgets.ts`.

**Source that wins:** Electron localStorage for `http://localhost:3000`, LevelDB under `~/Library/Application Support/cogs/Local Storage/leveldb`, read while `electron:dev` was running on the evening of 9 Oct 2026. Profile key `brain2-data-profile` is absent, so this is the live vault, not demo. No demo keys were used.

| Blob | What the tile uses it for |
| --- | --- |
| `points-store` (unprefixed) | Earned: `getDayPoints` sums every ledger row on the widget day |
| `brain2-task-storage` | “Still possible”: `getPossibleDayPoints` sums `rewardValue` of incomplete tasks whose `scheduledDate` falls on that local day |
| `brain2-habits-store` | Not read by the tile. This is the habit sheet the 50×ratio score is computed from |
| `brain2-home-widgets` (persist v9) | Order, hidden, Follow the clock |

The hub file `data/shared-persist.json` (`updatedAt` 2026-10-10T06:19:27.903Z, `source: electron`) matches the ledger: 823 rows, 68 on 2026-10-09, sum **464**. It does not match the layout switch: the hub still has Follow the clock **off**, and the desktop LevelDB has it **on**. The running app reads the desktop, so the strip follows the wall clock.

**What the tile is bound to.** Follow the clock is on, so `homeWidgetDate` passes the wall clock into `HarvestTile`. The Home cursor is a different day: `brain2-home-date` is `2026-09-24` and `brain2-home-date-follows-today` is `0`. The habits sheet can sit on 24 Sep while this square, if it were showing, would score Friday 9 Oct 2026. The square is not showing. `harvest` is in the order and in `hidden`, tucked with Night well and Inbox mill since persist v5, and still tucked in this vault.

**Face the component would paint for Friday 9 Oct 2026** (the day Follow the clock selects):

| | |
| --- | --- |
| Caption | Left |
| CRT | `1` |
| Footer | `1 left of 465` |
| Detail, nixie well | same footer as the label, digit `1` |
| Detail, Earned | `464` |
| Detail, Still possible | `1` |

`harvestFace` rounds both inputs. Leftover is `Math.round(possible)` only. The footer total is that leftover plus `Math.round(earned)`. Zero leftover and zero earned would read “Nothing left today”. Zero leftover and any earned would read “Day paid”. Today takes the third branch.

**Earned, 464, from the 68 ledger rows that day:**

| Kind | Rows | Points |
| --- | ---: | ---: |
| Daily habit completions (`habit-day:…`, 50 each) | 7 | 350 |
| Weekly grade lift (25 × both rails) | 1 | 50 |
| Beat the prior 30-day average | 1 | 5 |
| Inbox handled | 58 | 58 |
| One other non-habit point | 1 | 1 |

Not on the ledger that day: the raw-day accomplishment bonus, the 75% grade bonus, the “higher than yesterday” lift, and the prior-7-day average beat.

**Habit scoring for the same Friday, from `brain2-habits-store`.** 52 habits. 28 are daily, none waived for this date by a stored exemption or a creation-day waiver. Each full day is 50 points (`DAILY_HABIT_COMPLETION_POINTS`), not the habit’s `rewardValue` (those sit between 10 and 40 and are not what `syncDailyHabitDayPoints` writes). Recomputing the ratio matches the ledger: 7 habits at 50 (350), no partials, 21 at 0.

| | Habits | Points |
| --- | ---: | ---: |
| Paid in full | 7 | 350 |
| Still unpaid (18 ordinary dailies + 3 climbs with no cell) | 21 | 1,050 |
| Day ceiling | 28 | 1,400 |

Nine of the 18 empty ordinary dailies still use original seed ids; nine were added later. The unpaid gap is not only leftover demo rows. Overall raw completion is 7/28 = **25%**. The stored accomplishment line is **30** (bonus **50**). The day is under that line, so the +50 has not been written and is still in reach. It is not part of the tile’s `1`.

The `1` is one incomplete task with `rewardValue` 1 and a `scheduledDate` on this local Friday. Nineteen other tasks scheduled that local day are already completed, and their stored `rewardValue` is 0, so they add nothing to “still possible.”

Same function on the Home cursor (24 Sep), which this desktop is not using while Follow the clock stays on: earned **565.8** (rounds to 566), task remainder **0**, face **`0` / “Day paid”**. That day’s habit sheet still had on the order of 880 points of the 50×ratio pool unpaid. “Day paid” there means no incomplete scheduled task had a reward, not that the habit day was finished.

## a. Biggest problems right now

The CRT is not points still available from habit scoring. `getPossibleDayPoints` never opens the habits store. It adds `rewardValue` on incomplete scheduled to-dos. Tonight that sum is **1**. The habit sheet still has **1,050** of **1,400** daily completion points unpaid (21 of 28 habits at 0). The footer then adds that 1 to the whole ledger, so the square says **1 left of 465**. 465 is not a pool. It is 350 habit points, 55 of bonuses, 58 inbox points, 1 other point, and 1 unpaid to-do reward. A day that is 25% through its habits reads as one point short of done.

The catalog line (“Points still available today. The footer reads how many are left of the day’s possible total.”) describes the habit remainder. The code comment on `harvestFace` says the same thing: unpaid possible, and “left of” is earned plus still possible. The implementation’s “possible” is a different ledger from the “earned.” When that task remainder hits 0, the face says **Day paid** even if most of the 50×ratio pool is still open, which is what 24 Sep would show.

The detail repeats the mistake. The nixie digit and the “Still possible” well are the same rounded `1`. “Earned” is the mixed 464, so the three figures cannot be read as one ratio. Nothing names the 21 habits, the 25% versus the 30% accomplishment line, or the 58 inbox points sitting inside the 464.

The square is also hidden, so the strip does not currently show this face. The math above is what `HarvestTile` renders for the wall-clock day as soon as Widgets turns it on. Follow the clock is on and the Home cursor is 24 Sep, and the tile has no date on it, so that turn-on would score a different day than the sheet underneath without saying so.

## b. Layout, UI, design, and style

### Overview

The tile is the shared home square: nameplate, CRT, silver footer, equal height `--home-tile-h` (156px), width flexing with the row (`home-overview.tsx`, `home-chrome.css`). That matches the milled fascia in `docs/DESIGN_STYLE.md`: one glass, equal-height siblings, phosphor on the value (`#7dffc4` on `#040a08`), not a white card. Hide × sits outside the open target and asks before removing the square. The caption lamp is `--home-caption-pip: #d6ff4a`, a yellow-green that reads as a live lamp on the silver nameplate, unlike the navy stop used on Latest award.

What this face does with that frame:

- The nameplate says **Left**, 9px. The catalog name and the dialog title are **Harvest leftover**. Two names for one instrument. “Left” does not say left of what, and it does not say which day.
- The CRT is one integer at 20px, centered. The largest type is the value, which is right for the house, and the value is the one-point to-do. Beside it, Points is showing **464** for the same Friday. The harvest glass looks like a remainder of that 464. It is not.
- The footer is 10px, two-line clamp, max height 44px. `1 left of 465` fits. The failure is the sentence, not the clamp. The style guide’s smallest type is the caption of an estimate. This caption states a total the estimate does not belong to.
- No date. Follow the clock is on; the Home cursor is 24 Sep. `docs/DESIGN_STYLE.md` asks two dates that can disagree to be one cursor, or to be labeled as two jobs. This square does neither.

### Detail view

`HomeWidgetDialog` is the silver handheld (power pip, caption **Harvest leftover**, one scroll, ×, width `min(34rem, …)`, radius 18px). There are no settings, so none are shown. That part is right.

Inside, one full-width dark well, then a 2×2 `WidgetWells` row with Earned (phosphor green) and Still possible (navy nixie `#4a7fd4`). The opening well is also nixie. Points uses this same handheld for meters and a source split. Harvest uses it to print the tile again.

Against this Friday:

- The opening label is the footer sentence, forced uppercase at 9px with 0.12em tracking (`home-widget-well-label`). The style guide’s 9px slot is a short engraved word, not a sentence. `1 LEFT OF 465` is the sentence.
- The opening digit and “Still possible” are the same `1`. Two nixie readings of one figure, and the second well is not a second fact.
- “Earned” is 464 at 18px glow. It is larger than the 9px label and smaller than the tile’s 20px CRT, which is a sane hierarchy, and it is the wrong sibling. It is not “earned of the same 465.”
- There is no meter, no day name, and no row. Today’s Progress already folds a remain list in this handheld. Inbox mill lists titles and offers a key. Harvest has neither, so the unpaid habits — the thing the caption claims — are not in the room.
- The wells are one instrument (dark LCD, inset rule, 6px gap), not a restack of white cards. Keep that. The miss is that the instrument has only one job and the three numbers do not do it.

## c. New features for the detail view

1. **One pool in the opening wells.** First paint is the habit completion remainder for the day the square is actually scoring: **1,050** still unpaid, **350** paid, **1,400** ceiling, **21** of **28** daily habits at 0. The CRT on the square should be that 1,050 (footer `1050 left of 1400`), not the to-do’s 1. Put the scheduled-task remainder in a third well labeled as a to-do reward (**1** today). Put inbox and other +1 credits (**59** today) in a fourth, or one line under the wells. Do not add them into the habit ceiling.

2. **A folded list of habits still short of 50.** Same remain-list pattern Today’s Progress already uses in this dialog: one summary, then a row per unpaid daily habit with the gap (50, or less when a goal is partial). Twenty-one rows at 0 is the list for this Friday. Do not list the 58 inbox handles. A row can open that habit. The 7 paid habits stay out of the list; the paid well already holds 350.

3. **The accomplishment line, as a status, not a second score.** Under the wells, one line: raw completion **25%**, stored line **30**, bonus **50** not written. That is the bonus still in reach. Do not invent a grade-bonus remainder; the 100/300 grade bonus and the yesterday lift are simply absent today. The weekly grade lift (**50**) and the 30-day beat (**5**) are already inside Earned and should be named there so 464 is not a lump.

4. **Name the day on the square when the cursor and the clock disagree.** Caption or footer carries the widget day (`Fri 9` or `2026-10-09`) while Follow the clock is on and `brain2-home-date` is `2026-09-24`. When the switch is off, the same label keeps “Day paid” from being read as the sheet’s day by accident. The handheld title can stay **Harvest leftover**; the nameplate should match it, or the nameplate stays **Left** and the date is the other word on that plate. One name, one day.
