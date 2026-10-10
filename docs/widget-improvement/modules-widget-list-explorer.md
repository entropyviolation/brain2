# List Explorer

Widget id: `modules-widget-list-explorer`

One saved card. The body is `ListExplorer` in `components/Modules/module-bodies.tsx`, wrapped by `ModuleCard` and switched on `module.type === "list-explorer"`. The gear opens `ModuleConfigDialog`. The catalog grid is `ModulesPanel` in `components/Modules/modules-panel.tsx`. Picks use `randN` and `tasksInList` in `components/Modules/module-helpers.ts`. The record is `useModulesStore` (`lib/modules-store.ts`, persist v2, key `brain2-modules-store`). The rows it draws are `brain2-task-storage`.

## Data source + snapshot

**Live wins.** Read 2026-10-09 from Chromium localStorage for origin `http://localhost:3000`, LevelDB at `~/Library/Application Support/cogs/Local Storage/leveldb`. Keys `_http://localhost:3000\u0000\u0001brain2-modules-store` and `brain2-task-storage`. Book type schema from `brain2-item-types-store`. `brain2-data-profile` is absent, so this is the live profile. Demo keys were not read. That origin has no `cogs-modules-store` twin.

One list explorer is saved. It is a widget (`kind` absent), created 2026-06-19T09:19:22.205Z.

```json
{
  "id": "mod-1781860762205",
  "type": "list-explorer",
  "title": "reading list",
  "config": { "categoryId": "1781860357899", "pickCount": 5 }
}
```

`framing` is unset. The dashboard also holds two other widgets (`mod-points`, `mod-random`) and 11 workspaces. None of those are this type.

| | |
| --- | --- |
| Target list | `1781860357899`, name **Reading List**, created 2026-06-19T09:12:37.899Z, item type `book` |
| Pointer | Present. Not missing. |
| Members | 1024 |
| `completed` | 0 |
| `stage` | `clarified` on all 1024 |
| `completionStatus` | unset on all 1024 |
| Open pool the card draws from | 1024 (it keeps rows with `completed === false`) |
| Empty? | No |
| Last member touch | 2026-09-24T00:51:44.717Z (created and touched; nothing newer) |
| `title` vs `description` | Both set on all 1024, and they match. The card reads `description` directly. |

The list is the large catalog, not a dead id. Two other lists share the name **Reading List** and are not this module’s target:

| List id | Created | Type | Members | Last touch |
| --- | --- | --- | --- | --- |
| `1781860357899` (the card) | 2026-06-19 | book | 1024 | 2026-09-24 |
| `1788885729133` | 2026-09-08 | book | 82 | 2026-09-08 |
| `tmpl-1782212661888-0-reading-list` | 2026-06-23 | none | 8 | 2026-07-23 |

Pairwise overlap is 1 item. The card points at the list that is largest and most recently touched. The pointer is not stale. The name collision is. The config menu labels all three “Reading List” and shows no count.

Fill on the targeted list (list attributes, plus the Book type’s Status):

| Field | Where | Filled |
| --- | --- | --- |
| Author (`attr_author`) | list, text | 1022 |
| Genre (`attr_genre`) | list, text | 1020 |
| Brief Description | list, text | 1011 |
| rec | list, text | 452 |
| Subgenre | list, text | 107 |
| ☆ | list, text | 80 |
| i own it? | list, text | 41 |
| reread | list, text | 29 |
| notes | list, text | 27 |
| PDF LINK | list, url | 3 |
| pages | list, number | 1 |
| Status | Book type, selection | 1 (`to-read`) |

Book Status options are `to-read`, `reading`, `read`, `abandoned`. Cover, ISBN, page count, pages read, and files exist on the Book type and are empty on this list. Author on the type (`author`) is also empty; the names live in `attr_author`.

Brief Description length: median 54 characters, p90 91, max 262. 802 of 1011 are longer than 40 characters. Author median is 14 (max 49). Genre median is 10 (max 37).

Badges the card would paint per book (every non-empty attribute, unlabeled): min 0 (1 book), mean 3.7, median 4, p90 5, max 7. 844 attribute values are strings longer than 40 characters. No attribute value is an object. No item has an icon.

Hub `data/shared-persist.json` matches this explorer (same id, title, list, pickCount, no framing) and the same 1024 members. The modules arrays differ around it: LevelDB has 14 modules, the hub copy 12. Task totals differ too (live 621 lists / 3267 items, hub 633 / 3262). The snapshot above is LevelDB.

## a. Biggest problems right now

1. **Five draws from 1024, each one a pile of unlabeled text.** `pickCount` is 5. Almost every book has Author, Genre, and Brief Description. The body prints `description` as the title, then every filled attribute as a `Badge` of `String(value)` with no field name. A typical book is about four badges. The blurb is one of them: median 54 characters, and 157 blurbs are over 80. Notes (up to 183 characters, 27 books) and `rec` (452 books) join the same row of chips. The card’s job is “something to read.” It currently types the catalog entry into the well.

2. **Nothing narrows the pool, and the read state is empty.** The filter is `completed === false`. That flag is false on all 1024, `stage` is `clarified` on all 1024, and Book Status is set on 1 book. “Surprise me (5)” is a shuffle of the whole library. The type already has `to-read` / `reading` / `read` / `abandoned`, and the card cannot set or filter them. `i own it?` (41) and `reread` (29) are too sparse to act as a stand-in.

3. **The only way to look at one book leaves the dashboard.** The title button calls `onTaskSelect`, which opens full item detail and hides the tab bay (`app/page.tsx`). The desk stays mounted, so the five picks survive, but the explorer itself has no opened state. The gear is a generic Configure Module dialog, not a view of the draw.

4. **The list menu cannot tell the three Reading Lists apart.** Saving the wrong row would point this card at 82 books or at 8. The live row is the 1024, and nothing in the dialog says so.

`itemTitle()` is the name reader everywhere else. This body uses `pick.description`. On this vault the two fields match on all 1024 rows, so the titles are right today. A later book whose `description` is a body would show that body as the name.

## b. Layout, UI, design, and style

The catalog well is already milled. `.mod-widget` in `components/Modules/modules-chrome.css` is a raised gadget (radius 0, `--mod-raised`), a caption bar, and a sunken field (`--mod-field`). That is the depth stack in `docs/DESIGN_STYLE.md`. Analytics Stat is the only widget that then gets the dark scope and `#3dff8a`. The style doc keeps that green for Analytics traces, and it still lists the Modules catalog as the flatter room. List Explorer should stay on the gray field. It should not borrow the CRT.

What breaks the well is the interior: shadcn `Badge variant="secondary"` at 10px, and an outline **Surprise me** button, with no clamp and no scroll. Failure 2 is a pile of floating chips where one instrument should be. The Rules widget already limits itself (`max-h-72 overflow-auto`). This one does not.

### Overview (card on the Modules catalog)

The card is a caption plus a document.

- Caption: BookOpen, the title `reading list` (12px, bold, truncated), gear, remove. Those two doors stay visible. That is correct.
- Document: up to five titles (`text-sm font-semibold`), then the attribute chips, then **Surprise me (5)**.

At the `lg` breakpoint the widget grid is three columns. This dashboard has exactly three widgets, so they share one row. Grid default is stretch, and the explorer has no max height. The blurb stack sets the row. Points and Random Task grow to match an instrument that is mostly Brief Description.

The field also omits the two facts that make the draw legible: the list name **Reading List**, and that these are 5 of 1024. List Summary already prints the list name and a count. This card does not. There is no author line. Author is a 14-character string on 1022 books and would fit. The blurb would not.

**Surprise me** sits under the pile, so the control that is the widget’s job scrolls away once five blurbs lay out. One group, at the foot of the field, is the right place (`docs/DESIGN_STYLE.md`, related controls in one group). The caption can stay the name and the two doors.

Type size is inverted. The book name is `text-sm`. The blurb, which is the long text, is a 10px chip. The name should be the only bold line. Author and Genre are the secondary line. The description belongs in the opened pick.

### Detail view (opened card / config)

There is no detail view. Two different clicks pretend to be one.

**Open a pick.** Full item detail replaces the desk and hides the tab bay. That page is the item, not the explorer. Coming back shows the same five only because the panel stayed mounted.

**Gear.** `ModuleConfigDialog` is `sm:max-w-md`, title “Configure Module”. One body, Cancel and Save at the foot, which matches the dialog note. It does not use the unsaved-changes guard: overlay, Escape, and Cancel drop a dirty draft with no Save / Stay / Discard. The type `<select>` can turn this card into a stat, a rules widget, or a random task and drop `pickCount` on save. For a card that has pointed at Reading List since June, that control is a trap sitting above the title.

Fields that do belong: title, list, framing verb, number of items (live value 5, input max 20; save only clamps to at least 1). The list control’s placeholder and the “none” row both say “Choose a list”, and every Reading List is the same string. Framing is empty, and the placeholder (“Read, Clean, Cook”) would prefix the book name. There is no preview of the five, no attribute picker, and no line that says 1024 open, 0 completed, Status filled on 1.

The opened pick should be a second state of this card, not a trip to item detail and not this form.

## c. New features for the detail view

The detail is the opened draw: one of the five, still on the Modules desk, with a door through to the item.

1. **One book, labeled.** Title, then Author and Genre as named lines (filled on 1022 and 1020). Brief Description as a paragraph under them, clamped, not a chip. `rec`, ☆, ownership, reread, notes, and PDF stay off this face unless the config turns them on. Open item is a button, not the title click. That keeps the five picks on screen.

2. **Choose the fields once, in that same view.** A short checklist of this list’s attributes, defaulted from fill rate: Author and Genre on, Brief Description on the detail only, everything else off. The catalog card then shows title plus the one-line author/genre, and the detail holds the blurb. The card stops painting median-four unlabeled badges times five.

3. **Say which Reading List, with the count.** The picker lists `Reading List · 1024 · touched Sep 24`, `Reading List · 82 · touched Sep 8`, and `Reading List · 8 · touched Jul 23`. The detail header repeats the chosen name and “5 of 1024”.

4. **A pool the detail can actually narrow.** Status cannot filter tonight (1 of 1024). Put the four Book statuses on the opened book as the way a book leaves the pool, and show the pool as “all 1024, none marked.” Genre can filter now (1020 filled). A “not in the last draw” skip matters at this size: reshuffle replaces all five, and with 1024 rows the same book can return immediately. Keep the other four pinned when one slot is redrawn.

5. **Foot of the detail, not under a blurb.** Surprise me, the draw count, and Back to the five stay one row. The catalog card keeps the same control in the field foot so the `lg` row stays a gadget height instead of a stack of 54-character descriptions.
