# Default view reading rows

Default is a **reading list**, not Checklist and not a column grid. Each row is
a status **pip** (a lamp, not a checkbox) + 16px orb + name (strikethrough when
done) + type / U·I / date / chips. Complete checkboxes appear only in
**Checklist**. Selection ticks appear only in **Select** mode.

## Built-in layout

Unset lists (`List.defaultView` missing, or `custom` not true) keep this chrome:

| Bit | Default |
|-----|---------|
| Status pip | On |
| Icon (16px orb) | On |
| Name | Always on |
| Item type | On |
| Urgency / importance | On |
| Date | On (when the item has `scheduledDate`) |
| Attribute chips | On (first three filled values from the list schema) |
| Tags, list names, estimate, description snippet | Off. Tags are item names (not Tracking catalog ids); when shown, a color bead appears if the name also matches a Tracking tag. |

## Per-list custom

**List Settings → View mode settings → Default view mode settings.**

- **Use default layout** — built-in row. Lists that never customize stay here.
- **Customize this list** — show/hide the bits above, optionally add extra
  attributes as compact meta (search + on-this-list first), and pick
  **Comfortable** vs **Compact** density.

Persists on `List.defaultView`. Independent of Details `detailsColumns` and
Spreadsheet `sheetConfig`. Extra attributes are reading-row chips, not a
spreadsheet column picker.

Helpers: `lib/default-view-prefs.ts`. UI: `dialogs/DefaultViewSettings.tsx`.
Rows: `list-content/ListContentDefault.tsx`. Folder **All Items** uses the same settings on `__all-items__{folderId}`; Home All on `__all-items__root`; see [`FOLDER_ALL_ITEMS.md`](FOLDER_ALL_ITEMS.md).

<a id="sort"></a>

## Sort

_Last mapped: 2026-10-24_

A clipboard key on the Bulk add / Add item row (Default display only) opens a read-only bulk-add paste of the rows on screen (`Tag:` headers included). **Copy all** copies the names only, one per line. **Close** hides the box. A **Sort** plate sits at the right of that row (Default
display only). Pick a key; a direction key appears beside it (it is hidden on
Custom order, which has no direction). The picker is the house milled select,
not the OS popup: a sunken face with a black caret and a metal list portaled
onto the shared menu layer, navy highlight, a dot on the current key, and an
**Attributes** nameplate before the list's own fields (same look as the
Habits Sort). Arrow keys, Home / End, Enter, and Esc work.

| Key | Reads | Starts |
|-----|-------|--------|
| Custom order | The list's stored order (what every list did before Sort) | — |
| Date added to list | `Task.listAddedAt[listId]`, else `createdAt` | Newest first |
| Date created | `createdAt` | Newest first |
| Name | `itemTitle()` | A to Z |
| Item type | type name | A to Z |
| Scheduled date / Deadline | `scheduledDate` / `deadline` | Oldest first |
| Urgency / Importance | 1–5 | Highest first |
| Estimate | `estimatedDuration` | Lowest first |
| *Attributes* | Any attribute on this list's schema (or an item-only definition on its rows): numbers numerically, booleans, dates, selections by option order, text A to Z | Lowest / A first |

Rows without a value sink to the bottom in both directions; ties keep stored
order. Files, images, and formula attributes are not offered.

Persists on `List.defaultView.sort` (`{ key, dir }`, `key` = a built-in or
`attr:<attributeId>`). It is **not** gated on Customize: a list can sort with
the built-in row. Choosing Custom order clears it. Folder / Home **All Items**
keep it on their `__all-items__` list once that record exists; lists with no
List record (smart lists) keep a sort for the session only.

**Date added to list.** The task store stamps `Task.listAddedAt[listId]` (ISO)
whenever an existing item gains a list — `updateTask`, `setTasks` (moves, merges,
bulk placement), and connected-list links — and drops the entry when the item
leaves, so a re-add restamps. Lists an item was created into have no entry, and
items older than this field have none: both read `createdAt`
(`lib/list-added-at.ts`). On All Items the earliest join across the item's
lists stands in.

Why attributes: a list is a model of a kind of thing, and its attributes are
the dimensions that kind varies along (mood, energy, confidence, source,
stage…). Ordering by any of them is the first step toward lists that can be
read along whatever axis a thought actually varies on — see
[`components/ItemTypes/README.md`](../ItemTypes/README.md#toward-a-type-that-models-thought).

Helpers: `lib/list-item-sort.ts` (`sortListItems`, `listItemSortOptions`,
`sanitizeListItemSort`), `resolveDefaultViewSort` / `setDefaultViewSort` in
`lib/default-view-prefs.ts`. UI: `list-content/ListSortControl.tsx`. Sorting
happens in `enhanced-list-view.tsx` (`shownTasks`) after the caption search.

## Search this list

The open list's caption has a magnifier key. It splits the caption: the name
stays on the left, a CRT search field takes the right half. Names only by
default; **All fields** also reads notes, body, tags, subtasks, and attribute
values. See [`README.md`](README.md) → One-list search.

## Future plans

- Sort in Checklist / Icons (today Sort applies to Default only; Details sorts
  by its own column headers).
- Drag to reorder in Custom order, and a "save this sort as custom order" key.
- Secondary sort (e.g. Urgency, then Date added).

- A pip click that does **not** become a hidden complete checkbox (the lamp
  stays a lamp).
- Optional “this list’s name” on rows when browsing All Items (today, list
  names skip the open list so a Books row does not say Books again).
- Remember a per-list extra-attribute order if a reading row ever needs more
  than “on-this-list first”.
