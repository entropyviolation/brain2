# Folder All Items

Each real folder (not auto scheduled period folders) has an aggregate **All Items** view: union of items in that folder’s lists, plus uncategorized items filed only on the All Items pool.

## Identity

- Open target: `{ type: "folder-all", folderId }`.
- Backing list id: `__all-items__{folderId}` (`lib/folder-all-items.ts`). Sync creates this record; it is **not** a child list the user converts or files.
- Grid / tree label stays **All Items**. Do not rename the backing list to change that.
- Quick Add and Telegram use the same shorthand: `folder: all: item` (also `all items`, and a bulk header `Folder: all:`). That files the item on this pool. It does not create a list named all. A bare `all: item`, with no folder in front, is still a list named all.
- Inbox **Apply list** uses the same pool. Search `cleaning: all` or `all cleaning` (missing space after the colon is fine; `all items` too). The row is that folder’s nameplate plus **All**, not a list named All. Applying adds `__all-items__{folderId}` onto the selected ideas and leaves every other list id in place. `lib/folder-all-query.ts` resolves the folder (exact, then unambiguous prefix / contains). A tie shows each close folder. Opening the folder in that picker offers the same row. A blank search does not list an All row for every folder.

**Home / global All** (`folder-all` + `__root__`, Quick Access **All** → All Items) uses the same inspector chrome. Backing list id: `__all-items__root` (`GLOBAL_ALL_ITEMS_LIST_ID`). Sync creates it (`syncGlobalAllItemsList`) and does **not** file it on any folder. Adding items here still leaves them uncategorized (empty `lists`); the backing record is view prefs only. **Module Lists All** is a normal folder All Items view.

## List Settings

The right inspector (Add Item / Bulk add / …) includes **List Settings**, same place as a normal list.

Opening it is `EditListDialog` on the backing All Items list. **View prefs persist on that list document** (`List.defaultView`, `detailsColumns`, `sheetConfig`, `checklistCheckboxVars`, `enabledDisplays`) via `updateList`. Reload keeps them. The user does not create a real child list.

### Shown

- Display options offered (which toolbar modes this All Items view offers)
- View mode settings host: Default, Checklist, Details columns, Spreadsheet columns — same host as other lists

### Omitted (and why)

| Section | Why |
|---------|-----|
| Delete / Clear list | Delete must not remove the folder or child lists. On global All, Clear must not strip the universe. Folder Clear would strip `__all-items__` membership from uncategorized items only, which is easy to confuse with wiping the folder. |
| In folders | Filing the virtual All Items id into other folders is blocked (`virtual-list`). Global All is not a folder child. |
| Connected lists | `isLinkableListId` is false for `__all-items__*`. Linking would copy aggregate membership onto real lists. |
| Name, icon, item type, attributes, rules, Home/All pins | Identity of an auto-managed pool, not view chrome. |

`onDelete` is a no-op if the editing list is a folder All Items id (including `__all-items__root`).

## Applying prefs

While All Items is open, content uses the backing list as `openCategory` so Default / Details / Spreadsheet / Checklist honor those fields. `openFolderAll` stays true (extra Lists column, checkbox filter). Active display mode still lives in `lists-ui-store.listDisplay` keyed by the folder-all target (`__root__` for Home All).

## Inclusion checkboxes

Folder All Items: list checkboxes live in the **right inspector** (`AllViewCheckboxFilter`, `aria-label="Filter lists"`), not in the item pane. **Select all** / **Deselect all** plus **Uncategorized**. **Show uncategorized only** stays at the top of the item pane.

Home / global All: the same inspector hosts **folder** inclusion checkboxes (`aria-label="Filter folders"`) — which folders’ items appear — plus **Uncategorized**. Same filter semantics as before; they are no longer a floating column in the content pane.
