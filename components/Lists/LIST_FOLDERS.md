# List ↔ folder membership

A list can live in **more than one folder** at the same time, the same way an
item can live in more than one list. List Settings → **In folders**.

This is **not** list nesting (`List.parentListId`) and **not** connected lists
(`List.linkedTargetListIds`). Those stay their own seams.

## Data model

Canonical write is on the **folder**:

```ts
Folder.listIds: string[]       // lists filed directly in this folder
Folder.parentFolderId?: string // folder tree — one parent (a forest)
```

There is no reverse `folderIds` on `List`. Direct membership is “every folder
whose `listIds` includes this list.” Helpers: `lib/folder-membership.ts`.
Store: `addListToFolder` / `removeListFromFolder` on `lib/task-store.ts`.

`List.parentListId` is a **list tree** (sublists), one parent, unrelated to
folders. Folders themselves stay a single-parent tree via `parentFolderId` —
a folder cannot have two parents, because that would corrupt the sidebar tree
and breadcrumbs. Lists-in-folders are the many-to-many half.

## Direct vs nested (inherited)

If list L is filed in folder F, and F lives in parent P:

| | ids | kind |
|---|---|---|
| Direct (default chips) | `[F]` | filed — you put it here |
| Show nested ON | `[F, P]` | F direct; P inherited (dimmed chip) |

- Inherited chips are **not removable**. Removing P would not mean “leave F”;
  it would silently delete the real placement. To leave P’s tree, remove F
  (the direct chip).
- Adding P while still in F is allowed: P becomes a **second direct**
  membership. Nested view then shows P as direct (direct wins; no duplicate).
- Nested never double-counts. Direct always beats inherited for the same id.
- Ancestor walks use a seen-set, so a corrupt folder cycle cannot loop.

## Cycles

A list is not a folder, so it cannot contain itself. The guard is:

- `listId === folderId` is rejected (`fileListInFolderBlockReason` → `"self"`).
- Virtual All Items lists cannot be filed.
- Auto-generated scheduled period folders (`na-sched-*`) cannot receive a filing.

Putting L in F never creates a folder-tree cycle. Moving **folders** still uses
`wouldCreateFolderCycle` in `lib/folder-selection.ts`.

## Editor

List Settings → **In folders**: searchable multiselect (same shape as item
**In lists** — search, colored folder-icon rows, selected chips with ×,
+ New folder, Selected (n)). Folders only; ordinary lists are not in this picker.

**Show nested** defaults off. Membership writes immediately to the store (same
as Connected lists), so the sidebar tree, Quick Access, and drag-into-folder
see the same `listIds` without waiting for Save. Save still writes the other
list fields (name, color, type, …).

## Other surfaces

| Surface | Behavior |
|---------|----------|
| Sidebar tree / Quick Access | A list appears under every folder that lists it |
| Drag list onto a folder | **Move** — unlinks every current folder, then files into the drop target (existing `fileCategoryIntoFolder`) |
| New folder from a selection | Keep vs move (`lib/folder-selection.ts`) |
| Home pin | Independent of folder membership |

## Future

- A small badge on a tree row when a list lives in more than one folder
  (“also in Kitchen”), so multi-filing is visible without opening Settings.
- Drag-onto-folder could offer Keep (add) vs Move, matching the new-folder
  placement radios, instead of always moving.
- Folder Settings could list the lists filed here with the same picker.
