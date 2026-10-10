# Random Task

Widget id: `modules-widget-random-task`

This is the Modules dashboard card whose stored type is `random-task`. The card is `RandomTask` in `components/Modules/module-bodies.tsx`, wrapped by `ModuleCard`. Configure/add is `ModuleConfigDialog.tsx`. The desk is `modules-panel.tsx`. The draw helper is `rand` / `tasksInList` in `module-helpers.ts`. Storage keys are `brain2-modules-store` and `brain2-task-storage`.

Workspace views of kind `randomizer` are a different instrument (three of them, on other lists). They are not this widget.

## Data source + snapshot

**Source:** Live Chromium localStorage for origin `http://localhost:3000`, LevelDB under `~/Library/Application Support/cogs/Local Storage/leveldb`. Values are a prefix byte plus UTF-16-LE JSON. `brain2-data-profile` is absent, so the profile is Live. Demo keys were not used.

`brain2-modules-store` is the current table value (sequence 52496). `brain2-task-storage` is the current log value (sequence 78106, store version 17). The hub file `data/shared-persist.json` (`source: electron`) was behind this pair — a shorter modules blob and 3262 tasks against 3267 — so it was not used.

**Saved instance.** One.

| | |
|---|---|
| id | `mod-random` (the seeded id) |
| title | What should I do now? |
| kind | unset, so it renders as a dashboard widget |
| config | `{ categoryId: "1781214482554" }` only |

The code seed for that id is `config: {}`. The saved copy has a list. An empty `categoryId` would make `tasksInList` return every task. The configure select’s “Choose a list” item is that empty value, and Save does not require a list.

**Pool.** List `1781214482554`, name **to do**, color `#3B82F6`, `scheduleable: true`, description empty, created 2026-06-11. It is the only list with that name. It sits in the folder **next actions**. The list’s own default view shows type, priority, and date, and hides the estimate.

Vault size around this list: 3267 tasks, 621 lists, 2817 incomplete.

Membership of **to do**, then the card’s only gates (`lists` contains that id, and `completed` is false):

| | count |
|---|---|
| In the list | 102 |
| Open (the draw) | 80 |
| Completed (excluded) | 22 |

The card is not in its empty state. Empty copy would be “No open tasks. All clear!”

What those 80 actually are:

- Type `task` 58, type `item` 22. None set `itemTypeId`. Stage is `clarified` on all 80. `hiddenFromTodo` is false on all 80.
- Status: 78 unset, 1 `active`, 1 `missed` (and `missedAt` is set). That missed row is still in the draw because `completed` is false.
- Title and description are both set on all 80, and they match on all 80. `taskDescription` is set on 4. `notes` and `body` are empty on all 80.
- `estimatedDuration` is 1 on 69, 30 on 5, and 10 / 15 / 20 / 45 on one each. It is missing on 2. `importance` is 3 on 72, 4 on 4, 2 on 1, 1 on 1, missing on 2. The same 69 items are duration 1 and importance 3. The same 2 tasks are missing both. No open item has `estimates` or `timeRough`.
- `scheduledDate` is unset on all 80. No open item’s schedule fields mention the day 2026-10-09. `scheduledMonth` is `2026-10` on 18. `scheduledYear` is `2026` on 35. `scheduledWeek` is set on 1. `scheduledTime` is set on 1. `deadline` is unset on all 80.
- 49 open items have `schedulePlacements` (`period` + `value`, sometimes `resolved`). 31 have none. Across those records the periods are week 55, month 39, day 3. 26 open items mention `2026-10` in a schedule field or a placement.
- 55 of the 80 also belong to other lists (47 other lists). 1 has subtasks. 2 have tags. 1 has attributes. `daysPushed` > 0 on 3, `weeksPushed` > 0 on 4, `monthsPushed` > 0 on 12.

The face rolls in component state. Nothing in the module record remembers the current id. Reload starts from `null` and rolls again. **Another** calls `rand` on the whole open array, so the current id can come back. The effect keeps a still-valid id when `open.length` changes, and rolls only when the previous id is gone.

The other two widgets on this desk are an analytics stat (`Points this week`) and a list explorer bound to a different list.

## a. Biggest problems right now

1. **The title asks for now, and the draw is the whole open list.** Every one of the 80 is equally likely. The card never reads month, year, week, placements, missed, or item type. 18 are marked for this month and 26 touch October 2026 somewhere in the schedule; the other draws are the rest of the backlog, including 31 with no placement and 1 already `missed`. None are dated today.

2. **The line under the name is the same on most picks, and broken on two.** For 69 of 80 the card renders `1m · importance 3`. That pair does not separate one item from another. The two tasks with both fields empty interpolate to the words `undefinedm` and `importance undefined`.

3. **Mark done closes the item before the person has looked.** It writes `completed: true` through `updateTask` (points and the completion dialog follow, already completed; Undo can reopen) and clears the pick in the same click, so the card has already rolled a new id. 22 of the 80 are generic items. Their type capabilities are empty, so item detail does not treat them as completable, and this button still completes them.

4. **Clearing the list in Configure would silently switch the pool to all 2817 incomplete tasks.** “Choose a list” stores no `categoryId`. The saved card is pointed at **to do**; the control that looks like a placeholder is the vault-wide draw.

## b. Layout, UI, design, and style

The desk skin is `.mod95`: a milled widget well, 12px bar, sunken body (`modules-chrome.css`). The analytics stat sibling paints that body as a phosphor scope. Random Task does not. Its body is the shared outline button and a `text-sm` link. The screen-style rules that apply here are one job per region, the large type for the thing the region is for, a caption that is a count, and a destructive action kept in the group but separated.

### Overview

The card has two regions. The bar is identity plus Configure and Remove (`What should I do now?`, shuffle icon, two 18×16 metal keys). The body is supposed to be the pick. In practice the name is a 14px semibold line, the caption is 12px muted, and **Another** / **Mark done** are the same outline size in one `flex` row. On a three-column desk (1024px and up) that well is a short sentence and two peer buttons. The list name, the blue list color, and the count 80 are absent, so the instrument never says what it drew from.

The name uses `description`. On this pool that matches `title` for all 80, so the label is the real name today. The four `taskDescription` values never appear. The list’s own view hides the estimate; the card leads with it.

**Another** and **Mark done** share one weight. Completing is the destructive verb and sits on the same baseline as a reroll. There is no status strip and no lamp that says a pick is live. The empty state, if the 80 were ever all completed, is one muted sentence with the buttons gone.

Configure is a generic dialog: type, title, list. It does not show that this list has 80 open of 102, or what **Another** will ignore.

### Detail view

There is no Random Task detail. The name is a button titled “Open task”. It calls `onTaskSelect`, and the shell mounts `EnhancedTaskDetail` for that id and hides the tab bay, Modules included. The desk stays mounted underneath, so the in-memory pick survives Back.

That page is the shared item record (`.id95`): fascia, type-driven tabs, save / complete / missed. A `task` gets scheduling, dependencies, subtasks, analysis, and time. A generic `item` gets Details. 22 of the 80 take the smaller page. Nothing on that page is about the draw: no pool, no “this was 1 of 80”, no skip, no October slice. The widget’s job ends at the click.

## c. New features for the detail view

A detail for this card should stay on Modules and answer the draw. The item page can stay the record, opened from the name, with the picker still there when you come back.

- **The open 80 as the document.** Current pick as the large name. Under it, one status line: list **to do**, 80 open, 22 done. The rest of the pool is a quiet list: skip, or take that row as the pick. **Another** walks that list without repeating until it wraps.
- **A now slice, visible.** Separate the 18 with `scheduledMonth` `2026-10` (and the 26 that mention October at all) from the 31 with no placement and from the rest. Default the draw to that slice, and show the count so a uniform 80 is a choice you can see.
- **Gates the card currently skips.** Drop the `missed` row. Offer “tasks only” so the 22 generic items are a switch, not a silent complete. Hide duration and importance when they are the repeated 1 and 3; show them when they differ (the five 30-minute rows, the 4/2/1 importance rows). Never print a missing field as `undefined`.
- **Mark done becomes the pending completion.** The same confirm-first path item detail uses, and only for a completable task. The pick stays put until that dialog saves, so Undo is not staring at a different name.
- **The four longer notes.** When `taskDescription` is set, the detail shows it under the name. The overview keeps the name only.
