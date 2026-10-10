# Affirmation

Widget id: `home-widget-affirmation`

The square is `AffirmationTile` in `components/Home/home-overview.tsx`. The pool is `affirmationLinesForHome` and the face is `pickDailyAffirmation` in `lib/home-widgets.ts`, reading `lib/affirmations.ts` (`findAffirmationsCategory`, `getAffirmationItems`, `affirmationText`). Lines live on the Lists list named Affirmations, in `brain2-task-storage`. Layout is `brain2-home-widgets` persist v9. Chrome is `HomeWidgetDialog` in `components/Home/home-widget-dialog.tsx`. The morning ritual (`components/Reviews/MorningReview.tsx`, `components/Reviews/AffirmationsDialog.tsx`) uses the same list and a different picker.

## Data source + snapshot

**Live wins.** Chromium localStorage for origin `http://localhost:3000`, LevelDB at `~/Library/Application Support/cogs/Local Storage/leveldb`. Keys `brain2-task-storage` (persist version 17) and `brain2-home-widgets` (version 9). `brain2-data-profile` is absent, so this is the live profile. No demo keys were read.

`electron/preload.js` keeps a localStorage value that is already present. The hub file `data/shared-persist.json` (`updatedAt` 2026-10-10T06:09:31.476Z, `source: electron`) is the seed, not the face.

| | LevelDB (wins) | Hub |
| --- | --- | --- |
| Tasks / lists | 3,269 tasks, 620 lists | 3,262 tasks, 633 lists |
| Affirmations list | Same id, same counts, same two date picks below | Same |
| `widgetsFollowClock` | `true` | `false` |
| Affirmation on the strip | Hidden | Hidden |

The task blobs differ. The Affirmations list does not, for the fields this tile uses.

**List.** One list, name `Affirmations`, id `affirmations-1782360085418` (the ritual’s `affirmations-${Date.now()}` shape). Match is case-insensitive (`AFFIRMATIONS_LIST_NAME` is `affirmations`). Membership is 63 items: **57 active**, **6 completed**. Every active line is a `title` (none are description-only). **None of the 57 match the 8 built-in strings** in `DEFAULT_AFFIRMATIONS`. Completed items are dropped by `getAffirmationItems`, so the tile’s pool is 57, in task-store order. Lengths: min 9, median 55, max 145. Eight lines are longer than 80 characters; two are longer than 120; none are longer than 160.

**Which line today.** Follow the clock is on, so `homeWidgetDate` keys the hash to the wall clock, local **2026-10-09**, not the stored Home day. `pickDailyAffirmation` is `hash(dateKey) % pool.length` with `hash = (hash * 31 + char) >>> 0`. That index is **8** (the 9th active line). The sentence is 65 characters:

> I have been given endless talents which I begin to utilize today.

`brain2-home-date` is `2026-09-24` and `brain2-home-date-follows-today` is `0` (an explicit other day). If Follow the clock were off, the same pool would show index 49: “I will win a Nobel Prize” (24 characters). That is the hub’s clock setting. The running profile would not show it.

**Strip.** Order index of `affirmation` is 4 (after Today’s Progress). It is in `hidden`, with `next`, `daysuntil`, `night`, `harvest`, `inbox`, `flow`, and `paint`. Visible: Rituals, Points, Latest award, Today’s Progress, Weather, Screen pet, Day lamp, Moon, Solar remainder, Tracking now. The catalog default already tucks Affirmation (`DEFAULT_HOME_WIDGET_HIDDEN`). This layout is not that default: Weather, Day lamp, Solar remainder, and Tracking now were turned on, and Days Until was turned off. Affirmation stayed off.

**Ritual, same day.** `brain2-reviews-store` has a day review `periodKey` `2026-10-09` whose morning is `{ source: "telegram", completed: false, resumeStep: "bed" }` and has no `affirmations` field. The spoken step was never reached. Across the store, 8 of 15 reviews have a morning and 5 of those have affirmation lines. The home tile does not read that store.

## a. Biggest problems right now

1. **The line never reaches the strip.** The only daily sentence is hidden, and a reset would hide it again. Today’s morning is still parked at `bed`, so nothing was saved as spoken either. The list is full (57 lines). The widget fails by absence.

2. **Opening it repeats the square.** The detail is one `<p className="home-widget-lead">` of the same string. No list name, no “9 of 57”, no date key, no jump to the item, no sign that 6 completed lines are already out of the pool. The handheld has a caption and a power lamp and then a second copy of the CRT.

3. **“Stable for the day” is stable only while the pool is frozen.** The index is `hash % 57` over current store order of non-completed items. Completing or inserting a line before index 8 changes what 2026-10-09 says, with no pin and no note. The 6 completed items have already shifted this pool off the 63-line list.

4. **The footer cannot say what the face is.** It is the hardcoded word `today`. The catalog preview footer is `Today's line`. With Follow the clock on, “today” happens to match 2026-10-09. It does not say which line, and it would still say `today` if the clock switch were off and the square were on September 24.

5. **Built-ins are a silent substitute.** An empty or missing list paints `DEFAULT_AFFIRMATIONS` (8 lines) with the same chrome. This vault is not on that path. Nothing on the tile would tell you if it were.

## b. Layout, UI, design, and style

### Overview

The tile is the shared home square: nameplate, CRT, silver footer, height `--home-tile-h` (156px), width flexing 132–200px (`home-overview.tsx`, `home-chrome.css`). That is the equal-height module in `docs/DESIGN_STYLE.md`. Hide × sits outside the open target and asks before removing the square. Click is the rest of the tile.

What this face does with that frame:

- The nameplate is **Affirmation**, with pip `#ff8ad4` (`.home-tile.is-affirmation`). The lamp is the one mark that is not shared CRT green. That part fits: a small phosphor ahead of the name.
- The sentence is the value, and it is set like a hint. `.home-affirmation-line` is 11px, line-height 1.25, centered, `-webkit-line-clamp: 4`, overflow hidden. CRT padding is 4px 6px. The style sheet’s CRT glyph pad is about 8px 14px, and the largest type is supposed to be the thing the region is for. Here the thing is a sentence, and the type is the caption size. Today’s 65 characters, near the median of 55, can wrap inside four lines. The two lines over 120 characters, and the 145-character max, are the ones the clamp cuts. There is no tooltip with the rest.
- The footer is one word, `today`, at the smallest size. It does not carry the index. The square already knows the day from the clock switch. The missing fact is “9 of 57”.
- `.home-tile-open` uses `cursor: default`, so the square does not look pressable. That is shared chrome. On a tile whose only action is “read this sentence”, the dead cursor hides the detail that is supposed to hold the full line.

### Detail view

`HomeWidgetDialog` is the silver handheld: power pip, uppercase title **Affirmation**, one scroll, ×. Sibling instruments use it as wells (Points, Today’s Progress, Days Until). Affirmation passes a single lead paragraph.

`.home-widget-lead` is the right material for a value: dark LCD `#07140f`, phosphor `#7dffc4`, 18px, weight 700. It will show all 65 characters. Two things fight the sentence. Letter-spacing `0.03em` is label tracking on a line meant to be spoken. And the lead is the entire body. Style for a dialog is one body, actions in one row at the foot when there is a decision, three type sizes, sibling wells of one height. This body has the large type and nothing else: no wells, no 11px note, no key. A clean close is correct (nothing is edited). An empty instrument is not.

The square and the dialog therefore tell the same fact twice, at 11px and at 18px, and neither names the list the line came from.

## c. New features for the detail view

1. **Open on this line, then the pool.** Keep the sentence as the lead, without label tracking. Under it, three wells in the existing handheld: list **Affirmations**, place **9 of 57**, date key **2026-10-09** (because Follow the clock is on). A one-line note that 6 completed items are excluded. The square can stay a glimpse; the detail is where the 145-character lines belong, unclamped.

2. **A key to the item.** The line is a list item title. One foot key opens that item in Lists. Editing stays on the list, which is already the source of truth. Do not add a second editor in the handheld.

3. **Pin the index for the date.** Show the rule (`hash % active count`, store order). Let the detail pin this sentence for 2026-10-09, or step to the next active line, without completing anything. Completing a line above index 8 should not silently replace the sentence the day already showed. The 6 completed lines are the proof that the modulus already moves.

4. **A fold of the 57, today’s line marked.** The other lines stay in the scroll, not on the square. Completed lines sit in a second fold, out of the hash. That is the whole “where did today’s sentence come from” view. The morning ritual’s random five stay in the ritual. A status well can read spoken or not from `morning.affirmations` when that array exists. For this day it would read not spoken: the morning is still at `bed` and has no affirmation lines.
