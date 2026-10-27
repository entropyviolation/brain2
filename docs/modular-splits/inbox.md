# Split `components/inbox.tsx`

_Last mapped: 2026-10-27._ Planning only. Do not treat this file as a behavior change.

Pure structural extraction of `components/inbox.tsx` (~1791 lines). The app must look and work the same. No new behavior, no deleted behavior, no DOM, class, copy, or CSS edits.

The behavior contract already lives in the `inbox.tsx` / `inbox.css` row of [`components/README.md`](../../components/README.md) and in the file header at the top of `components/inbox.tsx`. This plan only moves that code. Links already has its own module (`components/inbox-links.tsx`); leave it there.

The working tree has unrelated session and tracking edits. The split touches only the files named below.

## Why `components/inbox/` can sit beside `components/inbox.tsx`

Callers import `@/components/inbox` (`components/header-doors.tsx`, `components/Mobile/MobileApp.tsx`) and `./inbox` (`components/inbox.test.tsx`). Those specifiers must keep resolving to the file `components/inbox.tsx`.

Next 15.2.4 (the compiled webpack in `next/dist/compiled/webpack`), TypeScript with `"moduleResolution": "bundler"`, and Vite (Vitest 4) were checked against a throwaway fixture, not this repo:

- `inbox.tsx` plus `inbox/row.tsx`: `./inbox` resolves to the file, `./inbox/row` resolves to the file inside the directory.
- `inbox.js` plus `inbox/index.js`: `./inbox` resolves to the file. The index is ignored.

So the parts live in `components/inbox/*.tsx`, and `components/inbox.tsx` stays the public module. `components/inbox-parts/` is unnecessary on this bundler.

Do not add `components/inbox/index.tsx` or `components/inbox/index.ts`. All three resolvers would ignore it in favor of `components/inbox.tsx`, and it would look like a second entry.

`inbox.tsx` and a directory named `inbox` are different directory entries. They coexist on this machine.

## Responsibilities

What the file does today, and where that job goes. Logic stays logic. JSX leaves become leaves. Nothing is rewritten into a reducer, a context, or a new callback shape.

| Job | Today | After |
| --- | --- | --- |
| Public module, client boundary, CSS side effect | `components/inbox.tsx` | Same file, thin |
| Open state, partition, selection, walk, batch mode, credit, handlers, effect order, sibling order of dialogs | `Inbox` (~660–1790) | `components/inbox/inbox-view.tsx` |
| Clocks, age marks, sticky day plates | `asDate`, `inboxClock`, `inboxAgeMark`, `inboxDayGroups` (~130–182) | `components/inbox/time.ts` |
| Caret after a row leaves the pile | `inboxCaretAfterRemoval` (~640–658) | `components/inbox/caret.ts` |
| Smart-parse chips on the walk sheet and on each row | `CaptureChips` (~188–221) | `components/inbox/capture-chips.tsx` |
| Stored door under the walk subtitle | `WalkOrigin` (~224–234) | `components/inbox/walk-origin.tsx` |
| Assigned lists plated by folder, × remove, double-click preview | `AssignedListPlates` (~236–287) | `components/inbox/assigned-list-plates.tsx` |
| Clarify / walk sheet (`data-ui-name="Clarify idea"`) | `TaskClarificationDialog` (~289–633) | `components/inbox/clarify-dialog.tsx` |
| Header trigger when the pin bar does not own `open` | trigger button (~1239–1263) | `components/inbox/trigger.tsx` |
| Title, partition keycaps, chord legend | mast, tabs, chord line (~1265–1317) | `components/inbox/chrome.tsx` |
| Undo sentences | banner (~1319–1344) | `components/inbox/undo-banner.tsx` |
| Search, scroller, day plates, rows, empty copy | well (~1346–1476) | `components/inbox/rows.tsx` |
| Sitting line and foot keys | foot (~1478–1579) | `components/inbox/foot.tsx` |
| Apply list, deadline, Select N, delete confirm | four dialogs (~1598–1721) | one file each, below |
| Bulk edit host (`EnhancedBulkAdd` `afterAdd`) | (~1729–1779) | `components/inbox/bulk-edit-host.tsx` |
| Merge confirm + merge plan wiring | (~1723–1787) | stays in `inbox-view.tsx` (already two imported dialogs; ~20 lines of props) |
| Scroll pin | refs, restore, release, layout effect, caret `scrollIntoView` (~691–711, ~1121–1133), and the pin reads inside the selection effect and Transfer to log | `components/inbox/use-inbox-rows-scroll.ts` |
| Chord `keydown` listener | (~1135–1221) | `components/inbox/use-inbox-chords.ts` |
| Links tab | `InboxLinks` from `components/inbox-links.tsx` | unchanged file |

`Inbox` keeps the handler cluster (session reset, credit, walk, batch, transfer, partition, select, slice) inside `inbox-view.tsx`. Those functions close over the same state and call each other. A second hook around them would be a new abstraction, not a move.

The selection-pruning effect (~750–771) stays in `inbox-view.tsx` next to `selectedIds` / `focusId`. It calls `inboxCaretAfterRemoval` and the scroll-pin refs. Move the call, not the effect body.

## Stable exports

Public surface today is one named export:

```ts
export function Inbox
```

`InboxProps` and `TaskClarificationDialog` are file-private. `onTaskSelect` is accepted and unused (`_onTaskSelect`). Mobile passes it (`components/Mobile/MobileApp.tsx`). The pin bar passes it through `hideTrigger` (`components/header-doors.tsx`). Keep the prop on the public props. Do not start calling it.

`components/inbox.tsx` after the split:

```ts
"use client"

import "./inbox.css"

export { Inbox } from "./inbox/inbox-view"
```

Requirements for that file:

- `"use client"` stays on the module callers import. `header-doors.tsx` still does `import("@/components/inbox").then((mod) => mod.Inbox)`.
- `import "./inbox.css"` stays on this module, once. Part files do not import the CSS. `inbox-links.tsx` does not import it today; the sheet arrives because `Inbox` does.
- Re-export `Inbox` only. No `export *`. Part files may export whatever `inbox-view.tsx` needs. Those names stay off the public module.
- The long file header moves onto `inbox-view.tsx`. The barrel keeps a short pointer at that file and at the `components/README.md` inbox row.

Each part that uses hooks or renders JSX gets its own `"use client"`, same as `inbox-links.tsx`. `time.ts` and `caret.ts` stay plain modules.

## New files and what moves

Line numbers are the current `components/inbox.tsx`. Copy the bodies. Keep names, strings, class names, `data-*` attributes, `aria-*` labels, titles, and JSX structure.

| Path | Moves |
| --- | --- |
| `components/inbox/time.ts` | `asDate`, `inboxClock`, `inboxAgeMark`, `inboxDayGroups`, and the plate result type |
| `components/inbox/caret.ts` | `inboxCaretAfterRemoval` |
| `components/inbox/capture-chips.tsx` | `CaptureChips` |
| `components/inbox/walk-origin.tsx` | `WalkOrigin` |
| `components/inbox/assigned-list-plates.tsx` | `AssignedListPlates` |
| `components/inbox/clarify-dialog.tsx` | `TaskClarificationDialog`, including the `boundTaskId` reset during render, the Cmd/Ctrl+Enter effect, and `HabitListPopup` |
| `components/inbox/trigger.tsx` | The `DialogTrigger` button, including `data-inbox-entry=""` and the three title strings |
| `components/inbox/chrome.tsx` | `DialogHeader` mast, the three `role="tab"` keys, the chord `<p className="inbox-chord-manual">` |
| `components/inbox/undo-banner.tsx` | The `inbox-undo` block and its label sentences |
| `components/inbox/rows.tsx` | `.inbox-list-well`, `.inbox-search`, `.inbox-rows-scroll`, empty states, day plates, rows |
| `components/inbox/foot.tsx` | `.inbox-foot` / `.inbox-foot-empty` and every foot key |
| `components/inbox/apply-list-dialog.tsx` | Apply list dialog |
| `components/inbox/deadline-dialog.tsx` | Set deadline dialog |
| `components/inbox/select-n-dialog.tsx` | Select N dialog |
| `components/inbox/delete-confirm-dialog.tsx` | Are you sure? dialog |
| `components/inbox/bulk-edit-host.tsx` | `EnhancedBulkAdd` element and the `afterAdd` body |
| `components/inbox/use-inbox-rows-scroll.ts` | Scroll refs and the two scroll effects, plus `restorePinnedRowsScroll` / `releaseRowsScrollPin` |
| `components/inbox/use-inbox-chords.ts` | The window `keydown` effect |
| `components/inbox/inbox-view.tsx` | `Inbox`, `InboxProps`, remaining state, memos, handlers, and the composition |
| `components/inbox/README.md` | Map of the folder. Behavior stays in `components/README.md`. See Doc updates. |

`rows.tsx` receives the scroll ref and the existing wheel/scroll handlers as props. It does not own the pin.

`use-inbox-rows-scroll` is called unconditionally at the top of `Inbox`, in the same relative order as today's hooks: state, then this hook, then memos, then the selection effect, then the chord hook, then the undo callback. Match that order so hook order does not change.

`use-inbox-chords` takes the same values the effect closes over. Copy the dependency array verbatim, including the `eslint-disable-next-line react-hooks/exhaustive-deps` comment. Do not add the handler identities to that array.

Leave these files alone:

- `components/inbox.css`
- `components/inbox-links.tsx` (it has its own `asDate`; do not dedupe it into `time.ts`)
- `components/inbox.test.tsx` (import stays `./inbox`)
- `components/Modules/**`
- `lib/inbox-*`
- `components/ItemDetail/InboxClarifyKey.tsx` (a different control)

## Extraction order

Each step leaves `export function Inbox` importable from `components/inbox.tsx`. Until the last step, `Inbox` still lives in that file and imports the new parts. Run `components/inbox.test.tsx` after each step.

1. **Pure helpers.** Add `time.ts` and `caret.ts`. Replace the local functions with imports. No JSX changes.
2. **Shared and clarify leaves.** Add `capture-chips.tsx`, `walk-origin.tsx`, `assigned-list-plates.tsx`. Then move `TaskClarificationDialog` into `clarify-dialog.tsx` in one edit so the sheet does not pass through a half-moved state. Keep the setState-during-render reset and the input `key`s (`task.id`, `${task.id}-duration`, `${task.id}-reward`).
3. **JSX leaves, parent still owns state.** Order: `undo-banner.tsx`, `trigger.tsx`, `chrome.tsx`, `rows.tsx`, `foot.tsx`, then the four batch dialogs, then `bulk-edit-host.tsx`. Pass the existing callbacks. Do not change which nodes are conditional and which stay mounted with `hidden` (see invariants).
4. **Scroll hook, then chord hook.** Move those effects verbatim. The selection effect and Transfer to log keep calling the same restore/release functions.
5. **Barrel.** Move `Inbox` into `inbox-view.tsx`. Replace `components/inbox.tsx` with the client directive, the CSS import, and `export { Inbox } from "./inbox/inbox-view"`. Do that in one edit so the public name never disappears.
6. **Docs** for this step, listed below. The tree snapshot is a doc sync (`.cursor/rules/doc-sync.mdc`), not this step.

## Visual and behavior invariants

Pixels, accessible names, and store writes stay as they are. `components/README.md` is the checklist. These are the seams a move can break even when the source looks the same.

**Module and paint**

- `@/components/inbox` and `./inbox` still resolve to `components/inbox.tsx`.
- The dynamic import in `header-doors.tsx` stays the chunk boundary. Part files are static imports from the view, not extra `import()` calls.
- `inbox.css` loads from the public module once.
- Class names stay, including `inbox-dialog`, `inbox-clarify`, `fm98-dialog`, `inbox-rows-scroll`, `inbox-row`, `inbox-foot`, `inbox-foot-empty`, `inbox-partition`, `inbox-partition-monkey`, `inbox-partition-links`, `b2-keycap-tab`, `b2-shell-count`, `inbox-clarify-save`, and the `bg-[#000080] hover:bg-[#000060]` classes on Apply and clarify and on Yes, delete.
- `data-ui-name="Inbox"` and `data-ui-name="Clarify idea"` stay, both with `data-ui-docs="components/README.md"`.
- `data-inbox-entry=""`, `data-inbox-row={task.id}`, `data-focused`, `data-selected`, and `data-testid="inbox-walk-origin"` stay.
- Copy stays byte-for-byte, including the chord legend, empty states, undo sentences, Apply list description (`folder&apos;s`), and the bulk-edit description with its curly quotes.

**Mount shape**

- The idea well uses `hidden={partition === "links"}`. It stays in the tree on the Links tab. Do not switch that to `{partition !== "links" && …}`, which would remount `.inbox-rows-scroll` and zero `scrollTop`.
- The chord line uses the same `hidden` attribute.
- `InboxLinks` stays `{partition === "links" ? <InboxLinks links={linkTasks} /> : null}`.
- The undo banner stays conditional on `undoLabel && partition !== "links"`.
- The foot stays `{pileTasks.length > 0 && …}`. On Links, `pileTasks` is `[]`, so the foot is absent. The idea pile behind Links stays empty so chords and the foot stay idle.
- `.inbox-foot-empty` is still added when the visible pile count is 0.
- Sibling order under the fragment stays: main dialog, clarify sheet, Apply list, deadline, Select N, delete confirm, merge confirm, bulk edit, merge plan.
- The clarify sheet stays one mounted dialog for the whole walk. `boundTaskId` still resets draft state when `task.id` changes. Do not add a `key={task.id}` on `TaskClarificationDialog`.
- Row keys stay `task.id`.

**Scroll**

- `rowsScrollRef` still points at `.inbox-rows-scroll`.
- `useLayoutEffect` still restores the pin on every commit, with no dependency array.
- The focus effect still `scrollIntoView({ block: "nearest" })` unless the pin is held or that caret id is suppressed.
- Transfer to log still records `scrollTop` before the rows leave, holds the pin across the later log write, and drops it on `requestAnimationFrame` then `setTimeout(…, 0)` (or `setTimeout` only when `requestAnimationFrame` is missing).
- Wheel still releases the pin. The scroll listener still ignores events fired while restoring, and otherwise writes the pin back.
- When the focused row disappears during a pin, the caret still goes to a neighbor that stayed (`inboxCaretAfterRemoval`), and that neighbor is marked so `scrollIntoView` does not run for it.

**Interaction**

- Header key counts the revisit pile only (`monkeyBrain` not set). A clear revisit pile shows no count. Each dialog tab keeps its own count. `data-heavy` is still set when that count is `>= 10`.
- `hideTrigger` still omits the in-file button. Controlled `open` / `onOpenChange` still win over internal state. Closing still runs `resetSession`.
- Search is a title substring. Select all, Select N, Select unsorted, shift-click, and the other foot actions use the rows in view. A check the search hides is cleared. `L` with a selection still opens Apply list when the search field is focused, and does not filter the pile.
- Chords stay off while a nested dialog is open, on the Links tab, and while an editable target is focused, except `L` stealing Apply list from `.inbox-search`.
- Walk with checks walks the selection. Walk with none starts at the caret. One sheet for the queue. Skip, Discard, End walk, Save & next, and the not-walking labels stay.
- Clarify, file, bulk edit, and Transfer to log leave `createdAt` and `captureOrigin`.
- Points stay +1 per handled idea and +50 when the revisit pile hits 0 (`lib/inbox-credit.ts`). The foot still counts this sitting.
- Delete, including one row’s trash, still asks. Merge still needs two and still uses `MergeItemsConfirmDialog` / `MergeItemsDialog` from `components/Lists/dialogs/`.
- Apply list still honors `folder: all` / `all folder` via `ListPicker` `offerFolderAll` and `ensureFolderAllListsForIds`.
- Pencil and trash stay on the row, with the same `stopPropagation` on mouse down and click.
- Assigned-list double-click still previews in `HabitListPopup` (`browse`) portaled to the clarify dialog (`container={hostRef.current}`). Single click does not open it. The chip × still removes the list. `mousedown` still `preventDefault`s when `event.detail > 1`.

## Test plan

Automated:

- After every extraction step: `npx vitest run components/inbox.test.tsx`.
- The suite already locks the public behavior: header count, newest first, no Clarify All, Links tab, delete, walk selection, discard credit, rename, folder All Items, Apply list, Apply and clarify, deadline, merge undo, `L` with and without the search field focused, `x` / `w`, select all, delete confirm, row attributes, file, Monkey brain, bulk edit, Select N, unsorted, search scope, folder plates and list preview, `createdAt` through clarify and bulk edit, capture-origin lines, Transfer to log, and the scroll hold (`keeps the idea list scrolled when a checked idea transfers to the log`).
- Do not rewrite those tests to import a part file. They import `Inbox` from `./inbox`.
- When `data-ui-name="Inbox"` leaves `components/inbox.tsx`, update the stamp row in `components/UiNames/ui-names-stamps.test.ts` to the file that contains that attribute (`components/inbox/inbox-view.tsx` if the `DialogContent` stays in the view). The attribute strings stay the same. Then run `npx vitest run components/UiNames/ui-names-stamps.test.ts`.
- No new product tests are required. A unit test for `inboxCaretAfterRemoval` is optional and must not replace the UI suite.

Manual, after the barrel step, in the running app (`npm run electron:dev` is the desktop shell):

- Header Inbox key: count matches the revisit pile only. Open, close, open again. Session reset (search, checks, slice) clears on close.
- Three tabs. Links hides the idea well without dropping it (switch back to Inbox and confirm the list scroll did not jump to the top if you had scrolled).
- Search, shift-click a range, Select N, unsorted, Dated/Bare, Walk one idea, Skip, End walk.
- One clarify from the pencil. Double-click an assigned list chip. Remove it with ×. Cancel.
- Check two, Apply list, cancel. Transfer is covered by the scroll test; if you try it by hand, the remaining rows stay at the same scroll offset.
- Pin-bar path: the header key uses `hideTrigger`. Confirm the dialog still opens from that key and that the in-file trigger is not a second button.

If the DOM and the store writes match, do not recapture `docs/screenshots/20-dialog-inbox.png`.

## Doc updates

Do these in the same step as the barrel, not as a later batch.

- `components/inbox/README.md` — new. Short map: public import is `@/components/inbox` (`components/inbox.tsx`), parts in this folder, CSS is `components/inbox.css` imported by the barrel, Links stays `components/inbox-links.tsx`. Point at the `components/README.md` inbox row for behavior. `_Last mapped: 2026-10-27_`. Do not copy the whole behavior essay.
- `components/README.md` — the `inbox.tsx` / `inbox.css` row keeps its behavior paragraph. Add that the dialog is assembled from `components/inbox/` and that the import path is still `components/inbox.tsx`. The `inbox-links.tsx` row stays.
- `components/Lists/README.md` — the sentence that Inbox imports the merge dialogs. Point it at `components/inbox/inbox-view.tsx` if that is where the imports land.
- `docs/tree.md` and `docs/tree.txt` — doc sync only (`.cursor/rules/doc-sync.mdc`). The room map does not list `inbox.tsx`. The new files belong in `components/inbox/README.md` and the `components/README.md` row.
- `docs/SPEC_MAPPING.md` §4.4 — keep the status. Say the public component is `components/inbox.tsx` and the clarify sheet is `components/inbox/clarify-dialog.tsx`.
- `docs/README.md` — one index row for `modular-splits/` (this plan). The folder is not indexed today.
- `scripts/screenshot-manifest.mjs` — add the part files that paint `20-dialog-inbox.png` to that shot’s `sources`, and add the same paths under `SOURCE FILES` in `docs/screenshots/20-dialog-inbox.txt`. Leave the PNG and the view-specific paragraph. UI and copy did not change.
- `docs/screenshots/README.md` — the Inbox row can keep `components/inbox.tsx` as the entry.

Leave `docs/BRAIN2_FEATURE_IDEAS.md` and `docs/widget-improvement/plan/shared-chrome.md` alone. They name `components/inbox.tsx`, which remains the public module.

## Risks

| Risk | What to preserve |
| --- | --- |
| Remounting the scroller | `hidden` on `.inbox-list-well`, not a conditional unmount. The scroll test is the lock. |
| Walk sheet remount | No `key` on the clarify dialog. Keep the `boundTaskId` render-time reset. |
| Stale or fresher chords | Copy the `keydown` effect and its dependency array. Do not “fix” the exhaustive-deps warning. |
| Double keyboard listeners | The chord effect lives in one hook, called once. The clarify Cmd/Ctrl+Enter effect stays inside the clarify dialog. |
| CSS order | One `import "./inbox.css"` on the barrel. A second import from a part can reorder the sheet in dev. |
| New public exports | Barrel exports `Inbox` only. |
| `index` file under `components/inbox/` | Do not add one. Resolvers bind `@/components/inbox` to `inbox.tsx`. |
| Hook order | Scroll hook and chord hook are unconditional, in the order in Extraction order step 4. |
| Dialog focus and stacking | Sibling order under the fragment stays. |
| `afterAdd` reading a stale `bulkSource` | Move that closure verbatim. It reads `bulkSource` from the render that created it, then calls `useTaskStore.getState()`. |
| Pin dropped too early | Transfer’s `requestAnimationFrame` + `setTimeout(0)` stays beside the handoff, not inside a cleaned-up effect with a new dependency. |
| Header chunk | Do not `import()` the parts from `header-doors.tsx`. The door already lazy-loads `@/components/inbox`. |
| Drive-by edits | Do not touch `components/Modules`, `inbox.css`, `inbox-links.tsx`, or the dirty session/tracking files. |
| Unused `onTaskSelect` | Keep it on the props. Removing it breaks the Mobile and header call sites’ types only if they pass it — they do pass it, and the type must still accept it. |
