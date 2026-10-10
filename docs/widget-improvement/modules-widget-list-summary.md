# List Summary

Widget id: `modules-widget-list-summary`

The card is `ListSummary` in `components/Modules/module-bodies.tsx`, chosen by `ModuleBody` when `type` is `list-summary`. Membership is `tasksInList` in `components/Modules/module-helpers.ts`. Add and edit go through `ModuleConfigDialog`. The desk is `ModulesPanel` in `components/Modules/modules-panel.tsx`: widgets are `kind !== "workspace"`, each one a `ModuleCard`. Persist is `useModulesStore` (`lib/modules-store.ts`), Zustand persist version 2, physical key `brain2-modules-store`. Rows would come from `brain2-task-storage`.

## Data source + snapshot

**Live wins.** Read 2026-10-09 evening PDT from Chromium localStorage for origin `http://localhost:3000`, LevelDB at `~/Library/Application Support/cogs/Local Storage/leveldb`. Winning key `_http://localhost:3000\x00\x01brain2-modules-store`, sequence 52496, value present, table `019564.ldb`. The value is a `0x00` prefix plus UTF-16 JSON: 63,493 characters, 126,987 value bytes, persist version 2. `brain2-data-profile` is absent, so this is the live profile. Demo keys were not read. The current WAL at the read (`019569.log`) rewrote `brain2-task-storage` only. Later tables `019566.ldb`, `019568.ldb`, and `019570.ldb` are task-storage too. None of them contain `list-summary`.

`cogs-modules-store` in that LevelDB is a deletion (empty value, sequence 18631).

Saved List Summary instances: **none**.

| | Winning LevelDB record |
| --- | --- |
| Modules | 14 |
| Workspaces (`kind: "workspace"`) | 11 |
| Dashboard widgets | 3 |
| `type: "list-summary"` | 0 |
| Bound list | none |

No `categoryId`, no ratio, no empty list, no dangling list id. The card is not on the desk, so it is not summarizing a list.

The three widgets that are saved:

| id | type | title | config |
| --- | --- | --- | --- |
| `mod-points` | `analytics-stat` | Points this week | `{ "stat": "points-week" }` |
| `mod-random` | `random-task` | What should I do now? | `{ "categoryId": "1781214482554" }` |
| `mod-1781860762205` | `list-explorer` | reading list | `{ "categoryId": "1781860357899", "pickCount": 5 }` |

Those two list ids resolve in the live task store. `1781214482554` is **to do** (created 2026-06-11T21:48:02.554Z). `1781860357899` is **Reading List** (created 2026-06-19T09:12:37.899Z). They belong to the other cards. List Summary never reads them.

The code seed, used only when the key is missing, is also without this type:

```json
{ "id": "mod-points", "type": "analytics-stat", "title": "Points this week", "config": { "stat": "points-week" } }
{ "id": "mod-write", "type": "writing-prompt", "title": "Writing Assignment Generator", "config": {} }
{ "id": "mod-random", "type": "random-task", "title": "What should I do now?", "config": {} }
```

Persist replaces `modules` with the saved array. The key exists, so the desk does not grow a summary card back. `mod-write` is already gone from the live array.

An older table still in the folder, `005552.ldb` (mtime 2026-09-21), sequence 17980, is the same absence: 19 modules, 16 workspaces, the same three widget types, zero `list-summary`.

Two workspace views use kind `summary` (the rollup in `SummaryView`, not this card): **By shelf** on `tmpl-1784171518978-0-films` (group `shelf`), and **Per room** on `tmpl-1787704070305-2-cleaning-tasks` (group `room`). They are tabs inside workspaces. They are not `type: "list-summary"`.

Hub `data/shared-persist.json` (`updatedAt` 2026-10-10T06:16:30.605Z, source `electron`) has `brain2-modules-store` as a 61,026-byte string: version 2, 12 modules, 9 workspaces, the same three widgets, zero `list-summary`. LevelDB is the vault the app reads. It is ahead by two workspaces.

What the card would compute, if a `categoryId` were set: `tasksInList` keeps every item whose `lists` includes that id. Done is `task.completed === true`. The figure is `done/length`. The percent is `Math.round(done / length * 100)`, or 0 when length is 0. The caption is `{pct}% complete · {length - done} remaining`.

## a. Biggest problems right now

1. **The card is not on the desk.** The winning record and the September 21 record both have zero `list-summary` modules. Modules is showing Points this week, What should I do now?, and reading list. List Summary is the third type in the Add Module dropdown. That dialog opens on `list-explorer`. There is no live ratio to be wrong about, because nothing is bound.

2. **A list is optional at save, and the empty states share one sentence.** `needsList` shows the picker. Save still writes `categoryId: undefined` when the row is “Choose a list”. That render is “Configure a list to summarize.” A saved id whose list is gone drops the name (`categories.find` misses) and still prints the fraction for any items that still carry the id, or `0/0` when none do. A real list with no items prints the same `0/0`, a bar at 0% width, and “0% complete · 0 remaining”. List Explorer and Rules say “This list is empty.” This card does not.

3. **The fraction is one boolean on every member.** `completed === true` is the only done test. `status === "missed"` leaves `completed` false, so a miss stays in “remaining.” Cancelled rows and notes do too. Subtasks are ignored. There is no `completedDate` window, so the number is lifetime membership. Attributes are ignored. The Rules card already matches attribute rules. This one cannot point “done” at a list field.

4. **Nothing opens.** `ListSummary` does not take `onTaskSelect`. The body is not a button. Gear is the shared Configure Module dialog. × calls `removeModule` immediately. Workspace tiles open and can pop out. This card has no second surface, so the ratio has nowhere to show its rows.

## b. Layout, UI, design, and style

Read from `docs/DESIGN_STYLE.md`. The largest type is the thing the region is for. The next size is the control. The smallest is the caption. One region, one job. A number and its bar are one instrument. The modules catalog is still the flatter chrome (`modules-chrome.css`; phosphor token `#3dff8a`). Analytics Stat is the widget that already sits on the black-green scope. A 12px mark is a precious mark. A 9px line is for a short word, not a sentence. Doors that work stay visible.

### Overview

The only surface is the dashboard card in `.mod95`, under “Dashboard widgets”. `.mod-grid` is one column, two from 768px, three from 1024px. This desk has three widgets, so at `lg` they share one row. `ModuleCard` is a raised gadget well, `min-height: 156px`, square corners, `data-mod-type="list-summary"`. No rule in `modules-chrome.css` targets that type. The scope well (`--mod-scope` `#0b1a12`, `--mod-phosphor` `#3dff8a`) is only `[data-mod-type="analytics-stat"]`.

Title bar, 12px bold: `ListChecks`, truncated title, an 18×16 gear, an 18×16 ×. Those two keys are milled. The body is a sunken field (`margin: 6px`, `padding: 8px`) holding, once a list is set:

- A name row: a 12×12 swatch painted with `list.color`, then the list name at `text-sm`. `.mod-widget-body .rounded-full` forces radius 0, so the swatch is a square.
- The fraction at `text-3xl font-bold` (`done/length`). Not tabular.
- An 8px track. The class is `rounded-full`; the stylesheet squares it, sinks the track (`--mod-lo`), and paints the fill `--mod-blue` (`#000080`), not the list color.
- A `text-sm` line: percent complete, then remaining.

Reading order is name, fraction, bar, caption. The fraction is the right largest type. The name and the percent line are the same `text-sm`, so the basis is not a smaller caption under the value. The percent repeats the bar, and the bar repeats the fraction. Three figures, one fact. With no list, the field is one muted sentence and the 156px well stays mostly empty. That slack is leftover well, not a second region.

The body has no control. Gear and × stay in the caption, which is the right place for those doors. Nothing in the field is pressable, so the number cannot be opened.

### Detail view

There is no list-summary detail. Full-screen open and `openModulePopout` are the workspace path. The nearest surface is `ModuleConfigDialog`: shared `Dialog`, `sm:max-w-md`, title “Configure Module” or “Add Module”.

For this type the body is three fields. Type lists all six widget types and starts on `list-explorer` when adding. Title’s placeholder is “List Summary”. The list control’s placeholder and the “none” row both say “Choose a list”. Names only, no count, no “this list is missing.” There is no preview of the fraction. The footer is Cancel and Save or Add. This file does not use the unsaved-changes guard. Changing Type and saving turns the card into another widget and drops `categoryId` unless the new type also keeps a list.

The sheet is the flat shared dialog. The style note still lists bare `components/ui/dialog.tsx` sheets among the flatter surfaces. This column edits type, title, and a list. It is not a view of the list.

## c. New features for the detail view

The live record has no instance and no list. The detail is where a chosen list becomes rows. The overview card can keep one fraction once the desk holds the split.

1. **Open the card onto the list.** The well opens the way a workspace tile does. Header is the list name and the same `done/length` the card shows. Rows use `itemTitle`. A row calls `onTaskSelect`, the door Explorer and Rules already have. Done rows sit in a second group under the open ones, so the remainder is a list you can start, not only a caption.

2. **Missing and empty are the first screen.** No `categoryId`: the detail is the list picker, and Add stays disabled until a list is chosen. An id that no longer matches a list says the list is gone and offers another list, and it does not print `0/0`. Zero members says “This list is empty.” That is the sentence Explorer and Rules already use.

3. **Split the boolean the card hides.** Four counts: active, done (`completed`), missed (`status === "missed"`), cancelled. The card can keep done over length. The detail shows that “remaining” is not all still to do. Subtask checks stay off this face unless the row has them, and then they are a count on the row, not a second ratio for the list.

4. **A period on the same list.** A rocker for lifetime, this week, this month, using `completedDate`. Lifetime stays the card’s number. The week is the large type on the detail, so a long list does not sit at one stale percent.

5. **Done can be a field.** Default remains `task.completed`. When the list’s real finished state is an attribute, the detail can pick that field the way Rules already picks an attribute. The card’s caption names the field it counted.

6. **One figure on the card, phosphor for the fraction.** After the detail exists, the card keeps the fraction, one bar, and a caption that is only the remaining count. The fraction uses tabular numerals on the same black-green glass as the analytics card (`--mod-scope` `#0b1a12`, `--mod-phosphor` `#3dff8a`). The keys stay milled. The list color stays the 12px mark. Type and title stay on the gear. The desk is the list.
