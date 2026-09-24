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
| Tags, list names, estimate, description snippet | Off |

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

## Future plans

- A pip click that does **not** become a hidden complete checkbox (the lamp
  stays a lamp).
- Optional “this list’s name” on rows when browsing All Items (today, list
  names skip the open list so a Books row does not say Books again).
- Remember a per-list extra-attribute order if a reading row ever needs more
  than “on-this-list first”.
