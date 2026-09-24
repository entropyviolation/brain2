# Module Lists import

How workspace modules land as **real lists and items** under **Module Lists**. This
is the data-fidelity seam — not Lists chrome (icon layout, Quick Access, search
bar). Folder filing lives in `lib/module-lists.ts`; record projection lives in
`lib/module-list-import.ts`.

Tidy is the gold standard. Trip Itinerary follows the same shape at a lighter
depth. Budget, Book Tasting, Film DNA, and Blank already create ordinary lists
at instantiate time, so they only need the folder filer.

## Where Module Lists come from

```
Module Lists/                          folder-module-lists  (hidden from global All)
  {Module title} Lists/                module-lists-{moduleId}
    Whole house                        parent list (Tidy)
      General, Kitchen, Living Room…   nested lists via List.parentListId
    Needed                             supplies
    Itinerary                          parent list (Trip)
      2026-07-10 — Lima, Peru          nested day lists
    Accounts, Films, Packing…          lists the template already seeded
```

`syncModuleListFolders` creates the two folder levels and files any list with
`createdByModuleId` (or an unfiled list a workspace view binds).
`syncModuleListContents` then upserts Tidy / Trip records into those lists.
Both run when the Lists tab hydrates (`enhanced-list-view.tsx`) and when a
template is instantiated (`instantiateModuleTemplate`).

Stable ids (`mll-{moduleId}-…` lists, `mli-{moduleId}-…` items) make re-import
update in place instead of duplicating.

## Source of truth

| Surface | Writes | Reads |
|---------|--------|-------|
| Tidy UI (`TidyView`) | `module.config.houseCleaning` | same |
| Trip Itinerary UI | `module.config.tripItinerary` | same |
| Module Lists items | projection (silent upsert, no workflows / points) | Lists, search, Analytics |

Until two-way sync, **Tidy / Trip remain the write source for mapped fields**
(title, priority, estimates, actuals, completed, parent, list membership of the
projection). A later Lists-tab edit of those fields is overwritten on the next
sync. User extras are kept (see Merge).

## Tidy field map (source → Lists item)

| Tidy (`HouseTask` / area / needed) | Lists |
|------------------------------------|-------|
| `title` (full string) | `title` + `description` (never truncated) |
| Area (`Kitchen`, …) | Nested **list** under **Whole house** (`parentListId`). Items belong to the area list, not a flat house dump. |
| `importance` Crucial / Important / Preferred / Optional / Unclassified | `importance` 5 / 4 / 3 / 2 / 1 **and** attribute `tidyImportance` (the word, for table view) |
| `estMin` | `estimatedDuration` (minutes) + attribute `estMin` when > 0 |
| `actualSec` (clock `3:51` = 3m 51s) | `actualDuration` = seconds/60 (fractional minutes) + attribute `actualSec` |
| `done` / `completedAt` | `completed`, `status` (`done`/`active`), `completedDate`. **Showing completed is the default: done rows are imported.** |
| `parentId` | `parentTaskId` pointing at the imported parent item. 2/2 and 0/2 are **computed** (`subtaskProgress`) from children. |
| Duplicate titles | Separate items (source id is part of the stable item id) |
| Section rollup `7 open · 2h 30m est · 3 done` | **Not stored.** `rollupFromItems` counts **leaves** (open / done / est on open), matching Tidy. |
| Needed row | Item on the **Needed** list; `got` → `completed` |
| Any-length / importance filter widgets | Not imported (UI chrome). Data is unfiltered. |
| Stuck templates, sidequests, subarea sessions, plan tiers | Not imported yet (behavior + skin; see Future). |

Chores use `type: "item"` so they stay list rows (not Next Actions / To-Do Done).
Area lists are `scheduleable: false`, checklist + table enabled, item label
`chore`.

### How the user's Whole house sample looks

```
Module Lists / Tidy Lists /
  Whole house
    General          (TAKE OUT TRASH, DO LAUNDRY, …)
    Kitchen          Do dishes [Crucial, Est 15m]
                     Sort/ clean out stinky pots… [Crucial, Est 45m]
                     Put existing dishes away [Important, Est 10m, Actual 3:51] ✓
                     sort/clean out fridge [Important, Est 30m, Actual 5:52] ✓
    Living Room      Get rid of jenny/elijah giveaway clothes. [Crucial, Est 15m]
                       move bags… [Crucial]
                       figure out heavy thing [Crucial]
                       clear rug area [Crucial, Est 10m, Actual 3:09] ✓
    Bedroom          clear elijah dresser top [Crucial, Est 15m, Actual 0:28]
                       get stuff off [Important, Est 5m, Actual 0:28] ✓
                       sort stuff [Important, Est 10m]
    Bathroom / Entryway / Hallway / Laundry  (same pattern)
  Needed
```

Open **Kitchen** for that room's chores (done included). Open a parent item's
children via `parentTaskId` (Lists content views still show them as rows in the
same list; the data is nested). Kitchen rollup from children: N open · Xm est ·
N done — derived, not a string on the list.

## Trip Itinerary field map

| Trip | Lists |
|------|-------|
| Trip | Parent list **Itinerary** under `{Module} Lists` |
| Day (`date` + city) | Nested list named `YYYY-MM-DD — City` (travel days use `A → B`) |
| `dayNote` | Day list `description` |
| Schedule `plan` / `note` | Item; `scheduledDate` / `scheduledTime`; full `text` as title |
| Schedule `flight` | Item `type: "flight"`; title from flight title; number / detail in attributes + notes |
| Sleep name / address | Item tagged `sleep` when sleep rows are shown |

## Other modules (not a second pile)

| Module | What lands in Module Lists |
|--------|----------------------------|
| **Budget / Book Tasting / Film DNA / Blank / Itinerary packing** | Lists the template already created (`Accounts`, `Films`, `Packing`, …). Folder filer only. Film DNA already maps catalog fields onto items (`lib/filmrecs-catalog.ts`). |
| **GradSearch** | Nothing. The program catalog is bundled research data (`workspace/gradsearch/data.json`). Favorites, notes, score overrides, and verified edits stay in the explorer’s `gs-*` localStorage, the same keys as the standalone app. |
| **Habits / Goals / Tracking** | First-class stores (`habits-store`, `goals-store`, `time-tracking-store`). They are not workspace shadow databases and are **not** copied into Module Lists. |
| **Operations** | Own lists via `lib/operation-lists.ts`, filed under Module Lists when an itinerary module is created. |

## Idempotent sync / merge

1. Plan lists + items from current module config (pure).
2. `addModuleCreatedLists` files new lists; existing lists update name / parent /
   schema in place (user `icon` and `hiddenFromGlobalAll` kept).
3. Each item: insert, or `mergeImportedItem` onto the same id.
4. Mapped fields overwrite. **Preserved:** `notes`, `body`, `links`, extra tags,
   extra list membership (e.g. also on a user Errands list), extra attributes,
   `why` / `consequences` / `deadline`.
5. Source rows that disappeared: projected item is deleted **unless** the user
   filed it on a non-import list, in which case it is detached from Tidy lists.
6. Writes go through `upsertImportedItem` — no workflow `create`, no points, no
   completion popup (Tidy already recorded the work).

Re-running sync with unchanged Tidy state is a no-op (`importedItemUnchanged`).

## Known gaps

- Tidy is still a **shadow database**. Lists is a projection, not the live
  document. Completing a chore in Lists does not complete it in Tidy; the next
  sync restores Tidy's `done` flag.
- Lists content views do not indent `parentTaskId` children (chrome is another
  lane). The parent/child link and 2/2 counts are in the data.
- Stuck mode, sidequests, subareas, and plan tiers are not items yet.
- Trip days are not yet `flight`-typed catalog rows with every segment field.
- No Module Lists copy of Habits / Goals / Tracking (they already have homes).

## Future improvements / plans

1. **Two-way sync.** TidyView reads/writes Items; `houseCleaning` shrinks to
   layout prefs (filters, theme, timer). Same for `tripItinerary`. This is the
   [`MODULE_PLATFORM.md`](../../docs/MODULE_PLATFORM.md) debt payoff.
2. **Merge picker.** When Lists and Tidy disagree on a mapped field, prompt
   instead of Tidy-wins.
3. **Rollup chrome.** Show `rollupFromItems` on Whole house / area lists in the
   Lists status bar (UI lane).
4. **Hierarchy in list content.** Indent or nest `parentTaskId` children in
   checklist/default views.
5. **Stuck / Needed / plans as first-class types** (`chore`, `supply`,
   `stuck-prompt`) once the item-type registry is the install contract.
6. **Live bind.** Subscribe to `modules-store` so Tidy keystrokes update Lists
   without opening the Lists tab (today: Lists hydrate + template instantiate).

## Code

| File | Role |
|------|------|
| `lib/module-lists.ts` | Module Lists folders, hide-from-All, `createdByModuleId` filing |
| `lib/module-list-import.ts` | Orchestrate plan → upsert |
| `lib/module-list-import-shared.ts` | Ids, importance map, merge, rollups |
| `lib/module-list-import-tidy.ts` | Tidy areas / chores / needed |
| `lib/module-list-import-trip.ts` | Trip days / schedule / sleep |
| `lib/module-list-import.test.ts` | Kitchen + Living Room fixture + trip + instantiate |
