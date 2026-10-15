# List Settings redesign plan

The List settings dialog (`components/Lists/dialogs/EditListDialog.tsx`,
`data-ui-name="List settings"`). **Shipped** as described below, plus two tabs
added after review: **Rules** (auto-add, [`components/Lists/LIST_RULES.md`](../components/Lists/LIST_RULES.md))
and **Bulk edit**, and the item count in the status line. The Lists README
is the record of behavior; this file keeps the reasoning.
Mockup: [`mockups/list-settings.html`](mockups/list-settings.html).
House order: [`DESIGN_STYLE.md`](DESIGN_STYLE.md).

---

## What is wrong today

- **One endless scroll.** About twenty sections in a 600px column. Finding
  “Show in Home” means scrolling past ~400 attribute rows.
- **Pickers dump the universe.** In folders lists every folder; Child lists
  lists ~45 lists each with its own **Nest** key; Connected lists lists
  ~150 lists; Details and Spreadsheet each list ~200 attributes. What is
  actually chosen (“Selected (1)”) sits at the bottom.
- **The same table twice.** Details columns and Spreadsheet columns are two
  copies of the same ~200 rows.
- **Two lists for one switch.** “Add item-detail panels” and “Hide
  item-detail panels” are two lists that can contradict each other.
- **Noise at the top.** A raw id and “No habit reads this list” sit above
  the list's own name.
- **Bare toggles and an unguarded Delete** at the very bottom, next to
  ordinary switches.

## The shape

A properties sheet, after Display Properties
(`designrefs/60d7202cb958e11734ce0567eb382868.jpg`): a monitor that
previews the thing, tabs, one action row at the foot.

1. **Identity strip** (always visible): a beige CRT showing the list's orb
   on velvet with its color ring and name — the same object the Lists
   desktop shows. Name field beside it. Under the name, one status row: id
   + Copy, habit routes, and live counts (folders · nested · connected,
   views offered). The counts replace “Selected (n)”.
2. **Tabs** — milled keys, lamp + CRT on the open one: **General · Places ·
   Items · Views · Behavior**, each with a count.
3. **Foot**: a blue lamp “Unsaved changes” on the left (no orange), then
   **Cancel · Save changes**. The unsaved-changes guard stays.

### General
Icon as an orb grid on velvet (pick, Upload, All orbs…). Color swatches
(the ring on the orb, the pip in rows). Description. Item name with a live
preview of the words it changes (“+ Add item”, “12 items”).

### Places
- **Map** on a pale circuit board (snowflake circuitry,
  `designrefs/d09ee9b9…`): folders above the list's orb, nested lists
  below, connections left and right with arrows that show which way items
  flow. Empty slots are dashed. The map is the summary; it is read-only.
- Three equal pickers under it: **In folders**, **Nested lists**,
  **Connected**. Each one is chips of what is chosen, then a search field,
  then a short scrolling result list. Clicking a result adds it; × on a
  chip removes it. No per-row **Nest** keys.
- Folders: photographed folder cut-outs (`folderFor`), auto folders
  marked, **show nested** off by default.
- Connected: the direction is a two-key rocker above the search, and each
  chip shows its arrow.

### Items
- **Item types** as a grid of keys with the type's orb and a lamp.
  Click = allowed. Double-click = default for new items (a DEFAULT tag and
  a CRT readout). **New type…** stays.
- **Item-detail panels** as one table: each panel has one three-way switch,
  **Type · Show · Hide**. Replaces the Add and Hide lists.
- **Item attributes** with a real empty state, **+ Add attribute**,
  **+ Completion tiers**.

### Views
- Five cards, like Display Properties' wallpaper thumbnails: a little
  drawing of Default, Checklist, Icons (orbs on velvet), Details,
  Spreadsheet. The card's lamp = offered on the toolbar. Clicking a card
  opens its settings below.
- Default: built-in vs customized rows, the row parts as keys, and a live
  row preview.
- Checklist: the tick variables as keys, + Checkbox variable.
- Details and Spreadsheet share **one** column table with two checkbox
  columns (Details, Spreadsheet). The open view's column is tinted. On this
  list first; the Vault group is collapsed until opened or searched.

### Behavior
- Send to Scheduler, Sent this week, Show in Home, Show in All as bar
  rockers (the house `HabitBarRocker` family), each with one line of
  explanation.
- **Dangerous actions** in their own red-edged well. Clear list and Delete
  sit under clear flip-up safety covers: lift the cover, then press. The
  cover drops again if you leave. Delete still asks once more.

## Materials and rules kept

- `fm98-dialog` frame, Win95 title bar, the house close key.
- Pixel face, three type sizes, navy focus ring on fields.
- Lights green, blue, or purple only. Red only on the Danger lamp and keys.
- Orbs and folder cut-outs are the beauty; labels stay utilitarian
  ([Lists — a room that turned out well](DESIGN_STYLE.md)).

## Phases

1. **Tabs + identity strip + foot.** Move today's sections into the five
   tabs without changing the editors. `EditListDialog.tsx`.
2. **Pickers.** Chips + search + short results for folders, nested, and
   connected (`InFoldersEditor.tsx`, `ListChildrenEditor.tsx`,
   `ConnectedListsEditor.tsx`), then the Places map.
3. **Merge duplicates.** One column table for Details + Spreadsheet
   (`DetailsViewSettings.tsx`, `SpreadsheetViewSettings.tsx`,
   `ColumnPickerPanel.tsx`); one Type/Show/Hide panel switch.
4. **Views cards, type grid, rockers, safety covers.**
5. **Docs**: `components/Lists/README.md`, screenshot reel.

## Open questions

- Should the map be clickable (click a node to open that folder or list)?
  Proposed: not in phase 2.
- Should the dialog grow to the large size (about 940px)? Proposed: yes;
  the current 600px is what forces the scroll.
