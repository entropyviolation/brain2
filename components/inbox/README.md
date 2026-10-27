# `components/inbox/` — Inbox parts

_Last mapped: 2026-10-27._

The public import is `@/components/inbox`, which is the file `components/inbox.tsx`. That file is the client door: it imports `components/inbox.css` once and re-exports `Inbox`. There is no `index` file in this folder. An index here would be ignored, or it would steal that import.

Links stay in `components/inbox-links.tsx`. Behavior stays on the `inbox.tsx` / `inbox.css` row in [`components/README.md`](../README.md).

`inbox-view.tsx` owns the state, the handlers, the selection effect, and the order of the dialogs. The other files are the leaves it composes.

| File | What it paints or holds |
| --- | --- |
| `inbox-view.tsx` | `Inbox`. Session, credit, walk, batch, transfer, and the dialog order |
| `time.ts` | Clocks, age marks, sticky day plates |
| `caret.ts` | `inboxCaretAfterRemoval` |
| `capture-chips.tsx` | Smart-parse chips on the walk sheet and on each row |
| `walk-origin.tsx` | Stored door under the walk subtitle |
| `assigned-list-plates.tsx` | Assigned lists by folder, × remove, double-click preview |
| `clarify-dialog.tsx` | Clarify / walk sheet (`data-ui-name="Clarify idea"`) |
| `trigger.tsx` | Header key when the pin bar does not own `open` |
| `chrome.tsx` | Mast, partition keycaps, chord legend. Links sits between the keycaps and the legend |
| `undo-banner.tsx` | Undo sentences |
| `rows.tsx` | Search, scroller, day plates, rows. The well stays mounted on Links (`hidden`) |
| `foot.tsx` | Sitting line and foot keys |
| `apply-list-dialog.tsx` | Apply list |
| `deadline-dialog.tsx` | Set deadline |
| `select-n-dialog.tsx` | Select N |
| `delete-confirm-dialog.tsx` | Are you sure? |
| `bulk-edit-host.tsx` | Bulk edit. `afterAdd` keeps arrival, door, and monkey |
| `use-inbox-rows-scroll.ts` | Scroll refs, restore, release, and the layout restore |
| `use-inbox-chords.ts` | Window chord listener |

## Leftover

_Last mapped: 2026-10-27._

The caret `scrollIntoView` effect stays in `inbox-view.tsx`, after the selection effect. The scroll hook is called with the state, before the memos. Putting that effect inside the hook would register it before the selection effect, and it needs `nestedOpen`, which is known only after the walk and the batch mode are decided. The layout restore did move. It still runs before the passive effects, with no dependency array.
