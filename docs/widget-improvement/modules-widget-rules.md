# Rules

Widget id: `modules-widget-rules`

Cause→effect card. In code the type is `"rules"`, the catalog label is **Rules / Cause→Effect** (`MODULE_META` in `components/Modules/module-helpers.ts`). The card body is `RulesModule` in `components/Modules/module-bodies.tsx`. The only editor is `ModuleConfigDialog`. The dashboard grid is `modules-panel.tsx`. Matching is `ruleMatches`. Storage key is `brain2-modules-store` (`lib/modules-store.ts`, persist version 2).

## Data source + snapshot

**Live wins.** Electron localStorage, origin `http://localhost:3000`, LevelDB under `~/Library/Application Support/cogs/Local Storage/leveldb`. Key `brain2-modules-store` (127,177 bytes on disk; 63,588 characters of JSON). Item and list facts come from the same origin’s `brain2-task-storage` (3,267 tasks, 621 lists, persist version 17). `brain2-data-profile` is absent, so the profile is Live. Demo keys were not read.

Hub file `data/shared-persist.json` (`source: electron`, `updatedAt` `2026-10-10T06:11:42.442Z` at read time) also has **zero** Rules widgets. It is behind the live vault: 12 modules against 14, 3,262 tasks against 3,267, 633 lists against 621. Its `cogs-modules-store` blob is the same string as its `brain2-modules-store`. The localhost LevelDB has no `cogs-modules-store` key.

Live modules: **14**. **3** dashboard widgets, **11** workspaces. Rules instances: **0**. The string `"rules"` does not appear in the live modules JSON. Saved rules: **0**. Incomplete causes: **0**. Incomplete effects: **0**. Rules that have never fired: **0**, because none are stored.

The three widgets that are stored:

| Widget | Id | Bound list |
|---|---|---|
| Points this week (`analytics-stat`) | `mod-points` | none |
| What should I do now? (`random-task`) | `mod-random` | `to do` (`1781214482554`) — 102 items, 80 open, no list attributes |
| reading list (`list-explorer`) | `mod-1781860762205` | Reading List (`1781860357899`) — 1,024 items, all open, 11 list attributes |

The two modules present live and missing from the hub are workspaces (GradSearch, Foxtide Work 2026 — Field plan), not Rules cards.

What the editor could attach a rule to, from live `brain2-task-storage`: **31** lists have `itemAttributes` (152 attributes). **590** lists do not, so the dialog would say the list has no attributes. **27** of those 590 still have items carrying attribute values. **4** of the 31 schema lists have zero items, so the card would stop at “This list is empty.” Attribute types across the 152: string 48, number 43, selection 39, text 9, boolean 3, and a handful of datetime, goal, link, url, file, image, multistring.

The list already pinned on the dashboard is the large Reading List. Its list schema is almost all text. Fill: Author 1,022, Genre 1,020, Brief Description 1,011, rec 452, ☆ 80, i own it? 41, reread 29, notes 27, Subgenre 107, PDF LINK 3, pages 1. The book item type adds Cover, Author, ISBN, Status, Page count, Pages read, Files. `RulesModule` and the dialog call `mergeListAttributes` without item types, so those seven stay hidden. On the items themselves, Status is set once and the other six type attributes are unset.

Films (`tmpl-1784171518978-0-films`, 342 items, not bound to a widget) is the live list where a number cause would have numbers: Year set on 336, all greater than 0; Rating set on 107, all greater than 0. Liked is a real boolean, stored on every row (90 true, 252 false).

A second Reading List (`1788885729133`, 82 items) repeats the same text-heavy shape. `books i want to own` (81 items) has Where to Buy, Notes, and cost set on **zero** items.

## a. Biggest problems right now

**The card is not in the vault.** Nothing in `brain2-modules-store` is type `"rules"`. The desk already points a widget at the one large attributed shelf (Reading List, via List Explorer) and another at a list with no schema (`to do`, via Random Task). Cause→effect was never saved, so there is no live badge, no incomplete rule, and no rule that failed to fire.

**A blank cause still matches, and the card would hide that.** Add Rule inserts `{ op: ">", value: "", label: "Flag", color: "#ef4444" }` (`ModuleConfigDialog`). `ruleMatches` does not treat that blank as unfinished:

- Numeric ops run `Number(rule.value)`. `Number("")` is `0`, and `0` is not `NaN`. A blank `>` is `> 0`. On Films Year that badges **336 of 342**. On Films Liked, `Number(true)` is 1 and `Number(false)` is 0, so the same blank badges the **90** trues. On Reading List `pages` it badges the **1** item that has a number.
- `contains` with a blank value is `includes("")`, which is true for every item, including an empty attribute (`String(value ?? "")`).
- `=` with a blank value matches only the empty string. A missing attribute becomes the string `"undefined"` and does not match. That is a different blank from `is empty`.

The tests cover `"x"` as a non-numeric compare. They do not cover `""`. The card then prints the effect label and an em dash. It never prints the cause, so a Flag badge would not show that the comparison was blank. First match makes it worse: a blank `contains` at the top wins every row, and every later rule’s win count stays 0.

**The body is every item, and the schema it trusts is the short one.** `tasksInList` keeps completed items and does not sort. The body is a `max-h-72` scroll of title plus badge. On the Reading List already on this desk that is 1,024 rows, 1,023 of them an em dash if the only number rule is `pages`. The footer is `defs.length` from list-only attributes, so that card would say “11 attributes” and omit the book type. The `to do` list bound to the other widget has no list attributes; the dialog disables Add Rule. 590 lists get the same dead end, including 27 whose items already hold values.

**The effect does not do anything.** `AttrRule` stores a label and a color. The first matching rule paints a badge. Workflows (`lib/workflows-store.ts`, the engine started from `app/page.tsx`) are a separate trigger → condition → action list. This widget never calls them. Order is the array order, and the editor has no reorder control, despite the caption “the first match decides the item's badge.”

## b. Layout, UI, design, and style

Judged against `docs/DESIGN_STYLE.md`. The catalog well is already a gadget: `.mod95` in `components/Modules/modules-chrome.css`, face gray, raised bevel, inset field, pixel font. Phosphor `#3dff8a` is reserved for the analytics-stat CRT (`--mod-scope` / `--mod-phosphor`). The Rules body does not use that well. Configure and Remove stay on the title bar (doors stay visible).

### Overview

The card is the whole product. `ModuleCard` shows the Workflow icon, the title, Configure, and Remove. `RulesModule` then has three sentences and one list:

- No list: “Configure a list and rules.”
- No rules: “No rules yet — configure this module.”
- Empty membership: “This list is empty.”
- Otherwise every item is a full-width `border rounded` button: truncated title, colored `Badge` with white text, or a 10px em dash. Under that, a 10px line: `{n} attributes · {m} rules`.

That list is the wrong figure for this vault. Reading List is 1,024 open items. Films is 342. A 18rem scroller of sibling white-bordered rows is a card restack inside the well the stat widget already refused: the stat body is one phosphor number on black glass; the rules body is one floating row per item. The cause (attribute, operator, value) is not on the row. The list name is not on the card. Completed rows are mixed in (`to do` would add 22 completed to 80 open). The 10px dash and the 10px footer are sentence-sized hints at nameplate size. A 9–10px engraved word is the style’s small type; a count sentence is not.

The badge is `style={{ background: matched.color, color: "#fff" }}`. The default color is `#ef4444`. That is a red chip with white type on the mill, not a lamp in a CRT. Sparse real flags on Reading List (i own it? 41, reread 29, ☆ 80, rec 452) would be the useful overview, and the card has no pile for them. The ☆ attribute’s id is `attr_`, so the cause select would show a broken id under a star name.

Peers in the widget grid (`mod-grid`: 1 / 2 / 3 columns) share the well chrome. Rules does not share the stat widget’s one-number instrument, so a Rules card beside Points this week would look like a different machine.

### Detail view

There is no Rules detail view. A row calls `onTaskSelect(item.id)` and leaves for item detail, which does not know which rule won. Configure opens `ModuleConfigDialog` (`sm:max-w-md`), which is the editor, not a reading of results.

The rule row is one `flex-wrap` line: “If”, a native `<select>` of attribute names, a native `<select>` of eight operators, a value input (hidden only for `is set` and `is empty`), “→”, a label input, a native color input, and a trash icon. Those peers wrap. The style guide’s orphan wrap is this row: the cause, the arrow, and the effect do not share one baseline once the dialog is `max-w-md`. Native selects and the color input sit beside the house `Input`. The dialog closes on Cancel and overlay click with no Save / Stay / Discard check (`onOpenChange={onClose}`). A dirty rule list is discarded as if it were clean.

Changing Type and saving writes `rules: undefined` whenever the type is no longer `"rules"`. Add Rule stays disabled when `mergeListAttributes` returns nothing, which is 590 live lists, and it never offers item-type attributes. Operators are the same eight for text, number, selection, boolean, datetime, goal, url, image, and file. Goal values are numeric only through `.current`. Nothing in the dialog shows match count, win count, or a rule that would match nobody.

## c. New features for the detail view

The detail view has to be built. The card should stay a summary lamp. The detail is where a rule is shown to be true, unfinished, or never fired.

1. **A ledger with match, win, and never.** One row per saved rule, in order: the cause in words, the effect label, how many items `ruleMatches` accepts, and how many of those wins are the first match. A rule with match 0 is marked never fired. A rule with matches but win 0 is marked shadowed by an earlier rule. That is the only way the first-match caption becomes visible. The live schemas already have never-fired causes waiting: Where to Buy, Notes, and cost on `books i want to own` (0 of 81), and the four schema lists with no items.

2. **Refuse a blank cause.** Do not save `>` / `>=` / `<` / `<=` with `""` (that is a compare to 0). Do not save `contains` with `""` (that matches every row). Show the coerced meaning if an old rule is already stored. Default the operator from the attribute type: `is set` / `=` for text, selection, and boolean; numeric ops only for number and goal. On Films, a Year rule should say “Year > 0 → 336”, and a Liked rule should say “Liked is true → 90”, not “Flag”.

3. **Piles, not the shelf.** Group items by the winning label, with a count, plus an unmatched pile. Reading List’s useful cuts are the sparse ones (rec 452, ☆ 80, i own it? 41, reread 29), not 1,024 titles. Put those counts in the same phosphor CRT the stat widget uses (`--mod-scope`, `#3dff8a`), as lamps on the mill. Open a pile to the titles. Keep the full scroll out of the overview card.

4. **Show the cause on both surfaces, and the list name.** The overview lamp is “{winning label} {count}” plus the list title. The detail row is “If {attribute} {op} {value} → {label}”. Include item-type attributes in `mergeListAttributes` (the book type’s Status is set on 1 of 1,024 and is currently invisible). Offer reorder, because order is the semantics.

5. **Keep the effect a badge until it is an action.** A second column can point at an existing workflow, which already has triggers and actions. Do not pretend the badge writes the item. The detail view’s job is to show which cause won, which rules never fired, and which blank compare would have badged the shelf.
