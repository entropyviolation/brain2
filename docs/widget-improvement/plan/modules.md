# Module cards

Implementation plan for the six widget types. The vault on 9 Oct 2026 has three dashboard cards. The work below is for those three. Writing Generator, List Summary, and Rules have no saved card; each gets only the smallest change that stops a new card from lying.

Leave the three saved records bound as they are: `mod-1781860762205` on Reading List `1781860357899` with `pickCount` 5, `mod-points` on `points-week`, `mod-random` on **to do** `1781214482554`.

## What is in use

`brain2-modules-store` has 14 modules: 11 workspaces and these 3 widgets. The desk is `ModulesPanel` in `components/Modules/modules-panel.tsx`. Each widget is a `ModuleCard`. The gear is `ModuleConfigDialog`. The bodies are in `components/Modules/module-bodies.tsx`.

| Card | Id | Live face |
| --- | --- | --- |
| reading list | `mod-1781860762205` | `list-explorer`. Draws 5 of 1,024 open books on **Reading List**. Prints `description` as the title, then every filled attribute as an unlabeled badge (Author, Genre, Brief Description, and whatever else is set). Last member touch 2026-09-24. Two other lists are also named Reading List: 82 books (touched 8 Sep) and 8 items (touched 23 Jul). The gear labels all three the same. |
| Points this week | `mod-points` | `analytics-stat`, `points-week`. Paints `3472.45` and the caption “points this week”. The week (Mon 5 Oct–Sun 11 Oct) is Mon 1,079.75, Tue 1,095.7, Wed 398, Thu 435, Fri 464, Saturday and Sunday empty. 147 ledger rows. Last week is 1,295. The number is not a control. |
| What should I do now? | `mod-random` | `random-task`. Uniform draw from all 80 open items on **to do** (102 members, 22 completed). 18 of the 80 have `scheduledMonth` `2026-10`. None are dated today. The line under most names is `1m · importance 3`. |

## Do these, in order

### 1. The reading list card shows a book name, author, and genre

**Change.** In `ListExplorer`, each of the five picks is the book name from `itemTitle`, then one secondary line of Author and Genre (`attr_author`, `attr_genre` on this list). Print whichever of those two is filled. Leave Brief Description, rec, notes, ☆, ownership, reread, and every other attribute off this face. Under the five, one line: the list name and the draw, **Reading List · 5 of 1,024**. **Surprise me (5)** stays at the foot of the field and still calls `randN` on the open pool (`completed === false`, which is all 1,024).

**Why this is the most useful.** This is the card that is wrong on every look. A typical book is about four unlabeled badges, and the blurb (median 54 characters, 1,011 books) is one of them. That stack is also the height of the row the points card and the random card share.

**Files.** `ListExplorer` in `components/Modules/module-bodies.tsx`. `itemTitle` in `lib/item-utils.ts`. The list’s `itemAttributes` from the task store, so the secondary line follows the Author and Genre fields by name.

**Acceptance.** On `mod-1781860762205`, five titles, author and genre on the books that have them (1,022 and 1,020), no badge row, and the line “Reading List · 5 of 1,024”. **Surprise me (5)** redraws five books. Points this week and What should I do now? sit in a row whose height is five names, not five blurbs.

### 2. One of those five opens on the same card

**Change.** The title sets an opened id in `ListExplorer` state. That state is one book: `itemTitle`, Author, Genre, and Brief Description as a short paragraph. **Open item** is the button that calls `onTaskSelect`. **Back** returns to the five and keeps the other four ids. **Surprise me** still replaces the whole draw.

**Why this is the most useful.** Step 1 takes the blurb off the catalog. Brief Description is filled on 1,011 of these books, and today the only way to read one book is `onTaskSelect`, which opens item detail and hides the tab bay. The five picks survive only because the panel stays mounted. The blurb belongs in a second state of this card.

**Files.** `ListExplorer` in `components/Modules/module-bodies.tsx`. `modules-panel.tsx` already passes `onTaskSelect` into `ModuleCard`; that callback stays the item door.

**Acceptance.** On the live reading list card, choose one of the five. The Modules tab stays up. The card shows that book’s name, author, genre, and blurb. **Open item** still reaches item detail. **Back** shows the same five, including the other four.

### 3. The gear tells the three Reading Lists apart

**Change.** In `ModuleConfigDialog`, each list option is the name, the member count, and the latest member `updatedAt`, as a short date. The three collisions read **Reading List · 1,024 · touched Sep 24**, **Reading List · 82 · touched Sep 8**, and **Reading List · 8 · touched Jul 23**. Saving still writes `categoryId`. The live card’s id stays `1781860357899` until someone picks a different row.

**Why this is the most useful.** The pointer is already the large, recently touched list. The menu is how it would become the 82 or the 8, because every row says “Reading List” and the placeholder and the empty row both say “Choose a list”.

**Files.** `components/Modules/ModuleConfigDialog.tsx`. Counts and `updatedAt` from `useTaskStore` tasks. List names from the lists on that store.

**Acceptance.** Gear on `mod-1781860762205` shows three different Reading List rows with 1,024 / 82 / 8 and those touch dates. Cancel leaves the card on the 1,024. Choosing the 82 and saving would retarget the card; choosing the 1,024 again restores it.

### 4. Points this week opens onto the seven days

**Change.** `AnalyticsStat` for `points-week` keeps the phosphor scope and the large total. Format the total the way Home already formats this week (`toLocaleString` in `components/Home/points-stats.tsx`), so the figure is `3,472.45`. The same well, under the total, shows the seven local days from Monday (`getDayPoints`, week starting Monday). A day with no ledger rows is empty. A caption under the days reads: 147 rows, Monday 5 Oct through Friday 9 Oct, two days still ahead, last week 1,295. The same line says Monday’s 1,079.75 includes 2 points from two task-and-day pairs stored twice on 5 Oct. The ledger stays as stored. The total stays the sum of every row (`getWeekPoints`). Use the same grouped format for any stat value this component paints, so an all-time total cannot appear as `15137.499999999998`.

**Why this is the most useful.** The saved card is this week. The week is five unequal days — Monday and Tuesday are 2,175.45 of the 3,472.45, Friday is 464 from 68 rows — and the card is a bare sum plus a caption that repeats the title. Home already shows the grouped total. This card drops the days.

**Files.** `AnalyticsStat` in `components/Modules/module-bodies.tsx`. `getDayPoints` and `getWeekPoints` in `lib/points-store.ts`. The week bounds already use `date-fns` `weekStartsOn: 1`. Leave `components/Home/points-stats.tsx` as the format reference; do not restyle it.

**Acceptance.** `mod-points` shows `3,472.45`, then Mon 1,079.75, Tue 1,095.7, Wed 398, Thu 435, Fri 464, and Saturday and Sunday empty. The basis names 147 rows, Mon 5–Fri 9, two days ahead, last week 1,295, and Monday’s extra 2 points. The title stays “Points this week”.

### 5. What should I do now draws from this month, and says so

**Change.** `RandomTask` defaults to open items on the bound list whose `scheduledMonth` is the current local month (`formatLocalMonthKey`), and whose `status` is not `missed`. On this vault, 18 of the 80 have `scheduledMonth` `2026-10`. If the missed row is among them, the month draw is 17; otherwise it is 18. The census line still reads **to do · 18 this month · 80 open**. A control widens the draw to the other open items and still leaves the missed row out (79 in the draw). **Another** chooses from the active slice and skips the current id until the slice wraps. When that month slice is empty, the card says the month is empty and draws from the open list. A missing `categoryId` renders “Choose a list” and an empty pool. In the dialog, Save for `random-task` stays disabled until a list is chosen. Leave `tasksInList` as it is (`undefined` still means every task for other callers).

**Why this is the most useful.** The title asks what to do now. Every one of the 80 is equally likely, including 31 with no placement and one already `missed`. Eighteen are marked for this month. Clearing the list in Configure would silently draw from all 2,817 incomplete records, because “Choose a list” stores no `categoryId`.

**Files.** `RandomTask` in `components/Modules/module-bodies.tsx`. `formatLocalMonthKey` in `lib/date-utils.ts`. The Save guard in `components/Modules/ModuleConfigDialog.tsx`. `rand` / the draw stay in `components/Modules/module-helpers.ts`.

**Acceptance.** On `mod-random`, a fresh roll is one of the 18 with `scheduledMonth` `2026-10`, and the card reads “to do · 18 this month · 80 open”. **Another** does not repeat the current item until those 18 have each appeared. Widening draws from the 79 open items that are not missed, and the card still says 80 open. The missed item stays out of both draws. The gear cannot save this card with an empty list.

### 6. The pick line and Mark done match the item in hand

**Change.** Omit the duration and importance line when either field is missing. Omit it when the pair is the repeated 1 minute and importance 3. Show it when the pair is anything else (duration 30 on five rows, 10 / 15 / 20 / 45 on one each, importance 4 on four rows, and the single 2 and the single 1). **Mark done** calls `requestTaskCompletion` and leaves the current id on the card until that dialog saves. Show **Mark done** only when `resolveDetailView` gives `capabilities.completable` — the same gate item detail uses. The 22 open rows of type `item` have empty capabilities, so the button is absent for them.

**Why this is the most useful.** After the draw is a month slice, the card still describes 69 of the 80 with the same `1m · importance 3`, prints `undefinedm` and `importance undefined` for the two tasks missing both fields, and completes the item in the same click that clears the name. Those 22 generic items are not completable on the item page, and this button completes them anyway.

**Files.** `RandomTask` in `components/Modules/module-bodies.tsx`. `requestTaskCompletion` in `lib/completion-events.ts`. `resolveDetailView` in `lib/item-types.ts`.

**Acceptance.** A 1-minute importance-3 pick on `mod-random` has no duration line. A pick missing both fields has no `undefined` text. A 30-minute pick shows `30m`. **Mark done** on a task opens the completion dialog and the name stays until Save. **Mark done** is absent on a generic item from this list. Cancel leaves that same task name on the card.

## Empty types, smallest fix

No saved card. Do these so the first card someone adds tells the truth. Stop there.

### Rules — a blank cause does not match

`ruleMatches` in `components/Modules/module-helpers.ts` treats a blank numeric value as zero: `Number("")` is `0`, so `>` with `""` is `> 0`. `contains` with `""` is `includes("")`, which is true for every value. **Add Rule** in `ModuleConfigDialog` inserts exactly `{ op: ">", value: "", label: "Flag" }`.

Treat a blank value on `>`, `>=`, `<`, `<=`, and `contains` as unfinished: `ruleMatches` returns false. **Add Rule** inserts `is set` and no value. Save stays disabled while a numeric op or `contains` has an empty value. The rule row says the comparison is unfinished. Cover `""` in `components/Modules/module-helpers.test.ts` (the suite covers a non-numeric `">"` against `"x"`, and does not cover a blank).

**Acceptance.** Add a Rules card, add a rule, leave the value empty, switch the operator to `>`. It does not save. A rule forced through with `op: ">"` and `value: ""` badges nothing. A blank `contains` badges nothing.

### List Summary — an empty list is not 0/0

`ListSummary` prints `0/0`, a bar at 0% width, and “0% complete · 0 remaining” when the list has no items, and the same fraction when the saved id matches no list (the name is dropped). Unbound already says “Configure a list to summarize.”

Keep that unbound sentence. A `categoryId` that matches no list says the list is missing and shows no fraction. A list with no members says “This list is empty.” and shows no fraction and no bar. Save for `list-summary` stays disabled until a list is chosen.

**Acceptance.** A new List Summary cannot be saved on “Choose a list”. Pointed at a list with no items, the card says “This list is empty.” Pointed at an id that is gone, it says the list is missing. Neither face shows `0/0`.

### Writing Generator — the sentence survives reload, and names its source

`WritingPrompt` builds `{ form, topic, constraint }` in a `useMemo` keyed on `nonce`, `categoryId`, and the whole `tasks` array. Nothing is written to the module. Reload, leaving the tab, or any task edit rolls a different sentence. Empty config and a list-backed config look the same.

On first show and on **New prompt**, write `{ form, topic, constraint, at }` onto this instance (`ModuleConfig` in `lib/modules-store.ts`). Render that record. A task-store update leaves it in place until **New prompt**. When `categoryId` is unset, the card says the topics are the built-in list.

**Acceptance.** Add a Writing Generator on built-in topics, note the sentence, reload. The same sentence is there, and the card says the topics are built-in. **New prompt** replaces it and the replacement survives the next reload.

## Leave for later

These are real, and they are the wrong cut while the three cards still lie.

- Book Status as a way out of the reading pool. Status is set on 1 of 1,024 (`to-read`). It cannot narrow tonight.
- A genre filter, an attribute checklist, redrawing one slot while the other four stay, and a “not in the last draw” skip. The face in steps 1–2 is title, author, genre, and one blurb.
- Opening a points day into its tasks. Friday is 68 rows for 464; the right shape is one line per task, with Monday’s two doubled pairs marked. The live gap is the seven day figures. Do that grouping after step 4, as its own pass.
- Habits logged today (the stat uses UTC `formatDateKey`; local 9 Oct has 7 completed cells) and the open/completed task counts (2,817 and 450, across every record type). This card is `points-week`. `formatLocalDateKey` already exists for the habit key.
- October’s 4,359.15 and `getMonthPoints` as a new menu entry. The week is the saved stat.
- A random-task pool browser, the four `taskDescription` notes, and a separate slice for the 26 items that mention October somewhere besides `scheduledMonth`.
- The type `<select>` that can turn any of these cards into another widget, and the dialog’s missing Save / Stay / Discard guard.
- A Rules ledger, match and win counts, piles, item-type attributes, reorder, and a workflow as the effect. Films would be a real number cause (Year on 336, Liked on 90); no Rules card is bound to it.
- A writing desk (three wells, locks, pools, a draft page) and a list-summary desk (rows, missed and cancelled counts, a week rocker, done-as-an-attribute).

## Do not

- Do not build features for cards the vault does not have.
- Do not restyle overview type. The reading list and the random card stay on the gray field. Phosphor `#3dff8a` stays on the analytics stat. Do not edit overview font CSS.
- Do not seed `mod-write` back, and do not point a new Rules card at Reading List or Films as part of this work.
- Do not change the three saved bindings while doing the steps above.
