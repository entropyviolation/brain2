# Details table columns

Details is the Lists **table** display (`currentDisplay === "table"`). Name, the complete tick, and Open stay as chrome. Extra columns are chosen per list.

## Settings

**List Settings → View mode settings → Details view mode settings.**

Pick columns from the shared attribute catalog (`lib/spreadsheet-catalog.ts`): attributes held by items on this list first, then other known vault attributes, plus built-in item fields (title stays as the Name column; type, status, importance, dates, estimates, tags, …). Search and **On this list** filter the picker. Checked columns can move up/down.

## Persistence

Stored on **`List.detailsColumns`** (ordered ids). Independent of:

| Field | View |
|-------|------|
| `List.sheetConfig.columnIds` | Spreadsheet |
| `List.displayedAttributes` | Shown-attributes default / other views |
| `List.defaultView` | Default reading rows |

Unchecking a Details column hides it in this list’s Details table only. It does not delete the attribute and does not change Spreadsheet columns.

| Value | Meaning |
|-------|---------|
| `undefined` | Current Details defaults: schema attributes in `displayedAttributes` order (or declaration order), plus Urgency / Importance / Scheduled on Next Actions lists |
| `[]` | No extra columns (Name / ✓ / Actions remain) |
| `["pages", "__field_importance__", …]` | Those columns, in that order |

Helpers: `lib/details-columns.ts` (`resolveDetailsColumnIds` / `defaultDetailsColumnIds`). UI: `dialogs/DetailsViewSettings.tsx`. Render: `list-content/ListContentDetails.tsx`. Folder **All Items** persists `detailsColumns` on `__all-items__{folderId}`; Home All on `__all-items__root` ([`FOLDER_ALL_ITEMS.md`](FOLDER_ALL_ITEMS.md)).

## Independence from Spreadsheet

Details imports the spreadsheet catalog so there is one attribute map, not a third. Column *choice* is a different array. Saving Details never writes `sheetConfig`.
