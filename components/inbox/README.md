# `components/inbox/` — Inbox parts

_Last mapped: 2026-10-27._

The public import is `@/components/inbox`, which is the file `components/inbox.tsx`. That file is the client door: it imports `components/inbox.css` once and re-exports `Inbox`. There is no `index` file in this folder. An index here would be ignored, or it would steal that import.

Links stay in `components/inbox-links.tsx`; its Link BIMBY strip is `link-guess.tsx` here. Behavior stays on the `inbox.tsx` / `inbox.css` row in [`components/README.md`](../README.md).

`inbox-view.tsx` owns the state, the handlers, the selection effect, and the order of the dialogs. The other files are the leaves it composes.

## Keys

_Last mapped: 2026-11-06_

Every button on every Inbox screen is the house silver keycap (`docs/DESIGN_STYLE.md#keycaps`). That covers the Inbox, Monkey brain, and Links tabs, the foot keys, the row tools, the Link BIMBY strip, Clarify, and the four small dialogs. The paint is one rule in `components/inbox.css` ("Word keys"). The dialogs sit outside `.todo95`, so it does not reuse `.todo-cap`. It uses `!important` and a long `:not()` chain to beat the win95 mill rule and the `.fm98-dialog` key rule. Any override (primary, short cap, lit filter) needs that same chain, or the base wins. Apply list and Set deadline now carry `inbox-dialog` so they get the cap.

- Primary cap: `inbox-cap-primary` on Save & Clarify, Apply, Select, and Yes, delete. Navy legend, navy lamp, navy ring.
- Short cap: row tools, Links kind filters, and the BIMBY strip.
- A latched filter (Links kinds, To review) is the dropped cap in CRT glass. An approved verdict stays down in sage, a rejected one in brick.
- Left out: the partition keys (already latching caps), row titles, the chip ×, list picker rows, and the title-bar close cap.

## Folders

_Last mapped: 2026-10-27_

- `dialogs/` — Apply list, Set deadline, Select N, Are you sure?
- `clarify/` — Clarify / walk sheet, the stored door, assigned list plates
- `hooks/` — scroll pin, window chord listener
- `helper/` — the Inbox Helper BIMBY dialog

| File | What it paints or holds |
| --- | --- |
| `inbox-view.tsx` | `Inbox`. Session, credit, walk, batch, transfer, and the dialog order |
| `time.ts` | Clocks, age marks, sticky day plates |
| `caret.ts` | `inboxCaretAfterRemoval` |
| `capture-chips.tsx` | Smart-parse chips on the walk sheet and on each row |
| `clarify/walk-origin.tsx` | Stored door under the walk subtitle |
| `clarify/assigned-list-plates.tsx` | Assigned lists by folder, × remove, double-click preview |
| `clarify/clarify-dialog.tsx` | Clarify / walk sheet (`data-ui-name="Clarify idea"`) |
| `trigger.tsx` | Header key when the pin bar does not own `open` |
| `chrome.tsx` | Mast, partition keycaps, chord legend. Links sits between the keycaps and the legend |
| `undo-banner.tsx` | Undo sentences |
| `helper-waiting.tsx` | _2026-11-07._ Strip above the rows: "Proposed timeblock awaiting approval" while blocks sent from BIM chat to the Tracking BIMBY wait for Add. Click closes the Inbox and opens the Tracking chat. Hidden when none are open. _2026-11-09:_ a second strip, "Proposed habit change awaiting approval", for cells the Habits BIMBY proposed from BIM chat; click opens the Habits chat |
| `rows.tsx` | Search, scroller, day plates, rows. The well stays mounted on Links (`hidden`) |
| `foot.tsx` | Sitting line and foot keys |
| `dialogs/apply-list-dialog.tsx` | Apply list |
| `dialogs/deadline-dialog.tsx` | Set deadline |
| `dialogs/select-n-dialog.tsx` | Select N |
| `dialogs/delete-confirm-dialog.tsx` | Are you sure? |
| `link-guess.tsx` | Link BIMBY on the Links tab: the shared guess queue (`useLinkGuesser`, Guess all, Stop), `LinkGuessBar` (tally, To review), and the guess strip with ✓ / ✗ and a comment. _Last mapped: 2026-11-06_ |
| `helper/inbox-helper-dialog.tsx` | Inbox Helper BIMBY (`lib/inbox-bimby/`). The **Inbox helper** foot key opens it. Ask reads the checked ideas, or all in view; each idea shows File, Merge into and Clarify keys. `inbox-view.tsx` owns `helperFile` / `helperMerge`. _Last mapped: 2026-11-07_ |
| `bulk-edit-host.tsx` | Bulk edit. `afterAdd` keeps arrival, door, and monkey |
| `hooks/use-inbox-rows-scroll.ts` | Scroll refs, restore, release, and the layout restore |
| `hooks/use-inbox-chords.ts` | Window chord listener |

## Leftover

_Last mapped: 2026-10-27._

The caret `scrollIntoView` effect stays in `inbox-view.tsx`, after the selection effect. The scroll hook is called with the state, before the memos. Putting that effect inside the hook would register it before the selection effect, and it needs `nestedOpen`, which is known only after the walk and the batch mode are decided. The layout restore did move. It still runs before the passive effects, with no dependency array.
