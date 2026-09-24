# Checklist ticks & Next Actions archives

## Checklist checkbox variables

Checklist view is the only Lists display whose point is **ticks**.

| Column | Default | Meaning |
|--------|---------|---------|
| **Completed** | Always on | Completes the item. Labeled in the column header. |
| **Missed opportunity** | Off | Too late — same `status: "missed"` as everywhere else. |

Default is **one** checkbox: Completed. Missed opportunity is not a second default tick.

Add extra variables: **List Settings → View mode settings → Checklist view mode settings**. Persist on `List.checklistCheckboxVars` (`undefined` = Completed only). Helpers: `lib/checklist-checkbox-vars.ts`. Folder **All Items** uses the same field on `__all-items__{folderId}`; Home All on `__all-items__root` ([`FOLDER_ALL_ITEMS.md`](FOLDER_ALL_ITEMS.md)).

Ticking **Completed** opens the same **Task completed** reflection as any other completion (`CompletionDialog` via `requestTaskCompletion`). The box does not stay checked if you **Undo** or dismiss (overlay / Escape). **Skip** / **Save** apply the completion. Completing from checklist does not skip the dialog.

Missed opportunity still has no points and no popup.

## Completed / Missed Opportunities as real lists

These live as auto-created lists **inside Next Actions** (search names first, reuse, don’t duplicate):

| List | Canonical id | `List.autoArchive` |
|------|----------------|--------------------|
| Completed | `na-smart-completed` | `"completed"` |
| Missed Opportunities | `na-smart-missed` | `"missed"` |

Membership is on the same `Task.lists` array as any connected list. Completing joins Completed; marking missed joins Missed Opportunities. Leaving that state drops auto membership. A **manual remove** records `listMembershipExclusions` and stays off. A **hand-add** of an item that is not in that state is not swept away.

The old toolbar **Completed** / **Missed Opportunities** buttons are gone. Open the lists from the Next Actions tree like any other list.

Period To Do (daily/weekly/monthly) stays a live schedule filter. Archives are not a fake filter view.

## Future plans

- More checkbox variables (cancelled, deferred) if a list wants them.
- Per-column sort / counts on the checklist header.
- Optional “show but don’t copy” overlay for archives (today they really join `Task.lists`).
