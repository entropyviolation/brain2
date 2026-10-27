# Split `entry-dialog.tsx`

_Last mapped: 2026-10-27._ Plan only. Do not treat this file as a behavior change.

`components/Home/Tracking/entry-dialog.tsx` is about 1366 lines. `EntryDialog` (~172–180) remounts the draft when the open block changes. `EntryDialogForm` (~182–1365, about 1184 lines) owns every draft field, save, edges, transit, and the popup body. The only public export is `EntryDialog`. Callers already import it from `@/components/Home/Tracking/entry-dialog`.

This split is structural. The popup must look and behave the same. No new features, no copy edits, no class-name edits, no DOM wrappers.

The working tree already has unrelated session and tracking edits under `components/Home/Tracking/` and `lib/`. The implementer must not revert, stage, or edit those files. `tracking-chrome.css` is one of them. Import it as today. Do not modify it.

Do not touch anything under `components/Modules`.

## Responsibilities

The dialog is the one editor for a painted block (Time Grid, Activity Log, Day Log, week grid, Tracking log, Data, header Now, Operations log, To Do spent rows, phone day, pen recent blocks). Sleep sync, pen-action sync, and screen-time sync stay on the views. This plan does not move them.

What the file does today, and where that should live after the split:

| Responsibility | Today | After |
| --- | --- | --- |
| Remount the draft when `entry.id` changes, including **Next timeblock** (`jumpId`) | `EntryDialog` | Same component, still the public export |
| Dialog chrome, unsaved-changes guard, dirty snapshot | `EntryDialogForm` return + `useUnsavedGuard` | Stay in the form. Hook calls stay in this component, in the same order |
| Draft `useState` / `useEffect` / `useMemo` | Form, top to bottom | Stay in the form. Do not regroup them into hooks |
| Span lock default, night label, objective floor date | `initialSpanLock`, `nightLabel`, `blockFloor` | Pure module |
| Lock icon button | `SpanLockButton` | Presentational module |
| Clock follow (lock start, end, or duration) | Closures `currentSpan` through `commitDuration` (~591–688) | Plain functions. Setters passed in |
| Save, instant vs interval, spend validation, mood pen create, `mirrorDetails` | `save` / `saveNow` (~326–421) | Plain function. Guard timing stays in the form |
| Anchors, settle, overlap “also end” | `afterEndsSaved`, `settle`, `linkEdge`, `unlinkEdge`, `takeEdge` (~423–482) | Plain functions |
| Drive reprice, **Calculate**, add transit block | `repriceTransit`, `calculateDrive`, `addTransit`, `driveEnds` (~484–589) | Plain functions |
| Popup sections | One return (~760–1363) | One component per section, same elements |

Already separate, and they stay where they are: `BlockPenSection`, `VariantChips`, `CatalogTagChip`, `MoodStretchCard`, `CompanionSection`, `NowObjectivesList`, `PersonPipelinesEditor`, `OptionalClock` (from `log-activity-dialog.tsx`), and `EdgeAnchor` / `CertaintyToggle` / `DriveCommuteSection` / `NextBlockSection` / `TransitSection` (from `entry-edges.tsx`). Do not fold those files into this folder. Do not wrap them in an extra DOM node.

## Stable exports

Keep this import working, unchanged, for every current caller:

```ts
import { EntryDialog } from "@/components/Home/Tracking/entry-dialog"
```

Call sites (do not edit them): `time-grid.tsx`, `week-grid.tsx`, `infinite-strip.tsx`, `tracking-activity-log.tsx`, `tracking-log-view.tsx`, `actual-day-view.tsx`, `phone-day-timeline.tsx`, `pen-recent-blocks.tsx`, `components/Analytics/time/TrackingAnalytics.tsx`, `components/header-tracking/current-moment/update-state.tsx`, `components/Operations/panels/OperationLogFeed.tsx`, `components/Home/ToDo/task-card/SpentBlocks.tsx`. Tests: `entry-dialog.test.tsx`, `companion-section.test.tsx`.

Rules:

- The public module remains the file `components/Home/Tracking/entry-dialog.tsx`, not a folder index. TypeScript resolves that file before `entry-dialog/index.ts`. **Do not add `entry-dialog/index.ts` or `index.tsx`.** A barrel inside the folder can steal the import.
- Public surface stays one value: `EntryDialog`. Do not export `EntryDialogForm`, `EntryDialogProps`, section components, or helpers from the public file.
- `EntryDialogProps` may be exported from the internal `types.ts` for siblings. It is not public today (`contentClassName`, `onOpenEntry`, `entry`, `onClose`). Do not add props.
- `EntryDialog` still renders `EntryDialogForm` with `key={entry.id}` and `onOpenEntry={(e) => setJumpId(e.id)}`. A grid click that swaps `entry`, and **Next timeblock**, must remount the draft.

Suggested public file, after the move:

```ts
export { EntryDialog } from "./entry-dialog/entry-dialog-form"
```

## New files and what moves

Folder: `components/Home/Tracking/entry-dialog/`. Names stay specific so they do not collide with `entry-edges.tsx`, `entry-dialog.css`, or `entry-dialog.test.tsx` at the Tracking root.

CSS stays at the Tracking root. The form imports these three, in this order, and no section file imports CSS:

1. `../tracking-chrome.css`
2. `../entry-dialog.css`
3. `../tracking-settings.css`

Do not edit those stylesheets. Do not move them.

### Form (state owner)

`components/Home/Tracking/entry-dialog/entry-dialog-form.tsx`

- `"use client"`.
- `EntryDialog` and `EntryDialogForm`.
- Every `useState`, `useEffect`, `useMemo`, and `useUnsavedGuard` that is in the form today, called in the same order. `driveBusy` / `driveMsg` stay after the transit functions’ current hook slot (~514). `durDraft` stays where it is (~593). `baseline` stays a `useState(draft)` on the first render (~739). Do not pull those up next to the other fields.
- Store selectors stay here (`useTimeTrackingStore`, pen session, work session, task store).
- Derived values the sections and the save function share: `chain`, `origin`, `last`, `scope`, `pen`, `assignedPens`, `penTagIds`, `liveVariantIds`, `blockFields`, `overlapping`, `isDirty`, `durationApplies`, `driveEnds`.
- Composes the sections below inside the existing `Dialog` / `DialogContent` / `div.space-y-3`.
- Keeps the unsaved-changes prompt as a sibling of `Dialog` inside a fragment, not inside `DialogContent`.

`data-ui-name="Tracking entry"` and `data-ui-docs="components/Home/Tracking/README.md"` move with `DialogContent`. Update the stamp path in the same step (see Doc updates). Do not leave a decoy copy of those strings in the public file.

### Pure modules (no hooks, no JSX)

`labels.ts` — `blockFloor` (~129), `initialSpanLock` (~159), `nightLabel` (~167). Same formulas. `blockFloor` is only used when adding a completed objective (`addCompletedNowObjective(..., blockFloor(entry))`).

`span-edits.ts` — the clock-follow functions (~591–688) as plain functions: `currentSpan`, `placeSpan`, `editSpan`, `onStartTime`, `onEndTime`, `onStartDate`, `onEndDate`, `durationHelp`, `commitDuration`, and the `heroMin` read. They take the current draft fields and the setters they already call. Same early returns. A linked clock still clears `startEventId` / `startJoinId` or `endEventId` / `endJoinId` only when that clock actually moves (`placeSpan`).

`save-block.ts` — the body of `saveNow` (~327–421). `save` in the form stays `() => runAsAction("edit block", saveNow)`. Preserve both branches:

- Instant: `kind: "instant"`, `endMin: startMin`, certainty from `startC` twice, `settle()`, `onClose()`, return. No `afterEndsSaved`, no `mirrorDetails`.
- Interval: `endMin` is `1440` when the end clock is midnight on the same day; `wrapEndDate` is set only when the dates differ; transit manual flag uses the live store row (`liveOrigin`), not the render snapshot; then `afterEndsSaved(endMin)`; `mirrorDetails` only when `!wrapEndDate`; then `onClose()`.

Spend errors stay these exact strings: `"Amount is dollars and cents, such as 4.50."` and `"Amount, what it was spent on, and the source each need a value."` Mood still creates a pen only on save (`resolvePenId`), and does not write the stretch sentence into notes.

`edge-actions.ts` — `afterEndsSaved`, `settle`, `linkEdge`, `unlinkEdge`, `takeEdge`. Pass `overlapping` in. Today `afterEndsSaved` closes over `overlapping`, which is declared later (~702). That is safe only because save runs after render. An extracted function must take `overlapping` as an argument so it cannot hit the temporal dead zone.

`transit-actions.ts` — `repriceTransit`, `calculateDrive`, `addTransit`, and the `driveEnds` lookup. Keep `runAsAction("calculate driving commute", ...)`, the `Driving` pen color `#64748b`, the `as never` on `addPen`, and the result sentences (`About ${…} min leaving ${…}` and `, but only ${…} min fit between the blocks`). `Calculate` still writes the store and then `setFrom` / `setTo` / `setDriveMsg` in that order.

`draft.ts` — one function that builds the object compared by `snapshotsEqual` (~712–738). Same keys, same order is irrelevant to `snapshotsEqual`, but do not add or drop keys. Included today: `penId`, `secondaryPenIds`, `from`, `to`, `fromDate`, `toDate`, `spanLock`, `durationEstimated`, `title`, `fieldTexts`, `notes`, `nowObjectives`, `reading`, `assumed`, `startC`, `endC`, `endEventId`, `startEventId`, `startJoinId`, `endJoinId`, `amountText`, `spentOn`, `spentSource`, `variantIds` (the live list, not the raw one), `tagIds`. Not included, and still must not be: `splitAt`, `showDates`, `newTag`, `alsoOthers`, `startOff`, `endOff`, `driveMsg`, `durDraft`.

`types.ts` — `EntryDialogProps` only.

### Presentational sections

Each section is a function component with **no hooks**. The parent keeps the `useState` calls, including fields for sections that are hidden (spend state exists even when the block is not a spend entry; duration state exists when duration is hidden). The parent keeps the conditions (`spendEntry`, `durationApplies`, `isMood && scope`, `!isInstant(entry)`, objectives live-or-present, Company pipelines).

The component’s root is the same node the form renders today, or a fragment when the form renders several siblings. Do not add a wrapper `div`.

| File | Root | Moves |
| --- | --- | --- |
| `span-lock-button.tsx` | `button.trk-span-lock` | `SpanLockButton` (~134–157). Same `aria-label`, `title`, `data-no95=""` |
| `entry-intro.tsx` | fragment: `DialogHeader` + help `p` + optional source `p` + optional sleep `p` | ~770–791 |
| `entry-clocks.tsx` | `div.trk-section.trk-entry-clocks` | ~793–883. `OptionalClock`, `CertaintyToggle`, **Date** / **Hide date**, date inputs |
| `entry-duration.tsx` | `div.trk-section.trk-duration-edit` | ~885–926. Readout keeps `data-testid="entry-duration-readout"` and `data-estimated` |
| `entry-spend.tsx` | `div.trk-section.trk-spend-edit` | ~928–968. Datalist id stays `entry-spend-sources` |
| `entry-display-name.tsx` | `div.trk-section` | ~970–986. Still omitted when `spendEntry` |
| `entry-assumed.tsx` | `div.trk-section.trk-assumed-row` | ~1000–1011 |
| `edge-anchors-section.tsx` | fragment | ~1013–1057. Both `EdgeAnchor`s, the overlap checkbox, `NextBlockSection`, `DriveCommuteSection`, `TransitSection`. Not named `entry-edges` — that file already exists |
| `entry-pen-block.tsx` | `BlockPenSection` (no wrapper) | ~1059–1090, including **Name this group** (`addPenGroup`, then tick member variants, clear secondaries, `setVariantsFor`) |
| `entry-variants.tsx` | `div.trk-section.space-y-1.5` | ~1092–1126 |
| `entry-tags.tsx` | `div.trk-section.space-y-1.5` | ~1128–1192. Keep the comment that a block tag is not a pen tag |
| `entry-fields.tsx` | fragment: fields `div` and/or the door `button`, matching which of those the parent renders today | ~1202–1236. `data-testid="entry-fields"`. Door still hidden for mood and spend |
| `entry-objectives.tsx` | `NowObjectivesList` (no wrapper) | ~1240–1289. Callbacks move verbatim, including park / attach / tie-step |
| `entry-notes.tsx` | the current `div` around the notes label and textarea | ~1291–1294 |
| `entry-tools.tsx` | fragment: `div.trk-entry-tools` + `div.trk-entry-actions` | ~1296–1358. Split, delete, Save, **show in timegrid** |

Leave these inline in the form, one line each: `MoodStretchCard` (~988), `CompanionSection` (~1194), `PersonPipelinesEditor` (~1238). They are already modules. A wrapper would be a new fiber and a place to accidentally add a node.

`entry-intro.tsx` may return `DialogHeader` as its first element. That header stays inside `DialogContent`, where it is now.

## Extraction order

Each step should leave `entry-dialog.test.tsx` green before the next. Do not reorder hooks at any step.

1. Add the folder and move pure helpers (`labels.ts`, `span-lock-button.tsx`) with imports pointed back. Public export stays `EntryDialog` from the same path. Behavior diff should be empty.
2. Move `draft.ts` and switch the form’s object literal to it. Dirty detection must still ignore split time, the date toggle, the new-tag box, and the duration typing buffer.
3. Move `span-edits.ts`, then `edge-actions.ts`, then `transit-actions.ts`, then `save-block.ts`. Call them from the same events. Do not change statement order inside `saveNow`, `calculateDrive`, or `afterEndsSaved`.
4. Extract leaf sections that only display draft state: intro, assumed, display name, notes, duration, spend, fields, tags, variants.
5. Extract clocks, then edge anchors (fragment), then pen block, objectives, tools.
6. Move `EntryDialog` and `EntryDialogForm` into `entry-dialog-form.tsx`. Replace the public file with the re-export. Point the ui-name stamp at the new path. Move the file comment with the form, shortened on the public file to one line that points at the folder.
7. Docs, then the test run below. Stop. Do not keep extracting by turning state into custom hooks.

Out of scope, on purpose: a `useSpanClock` / `useEntryDraft` hook. Those `useState` calls are not one contiguous block (`durDraft` and `driveBusy` sit after effects and after plain functions). Pulling them together changes hook order for anyone with the dialog open across a hot reload, and it does not change the DOM. The plain-function split is the modular cut that keeps render identity.

## Visual and behavior invariants

DOM, classes, attributes, and copy stay. A section extraction that needs a parent returns a fragment.

Chrome:

- `DialogContent` class string stays `["trk95 trk-dialog trk-entry", contentClassName].filter(Boolean).join(" ")`.
- `aria-describedby={undefined}`.
- `data-ui-name` and `data-ui-docs` as above.
- `{...unsavedDismissProps(guard.requestClose)}` on `DialogContent`.
- Centered popup from `entry-dialog.css`. Phone still anchors to the bottom. Title stays the phosphor face with no `0 0 3px` bloom. No new glow, no new section chrome.
- `contentClassName` still appends (Data `an-popup`).

Copy and controls that tests and the README name:

- Title: `{displayName} · {start} – {end}` plus ` (next day)` when the chain crosses midnight.
- Help line: duration, scope name, ` · continues past midnight`, ` · pen {name}` when the display name differs.
- Instant source: `Added from {resolveLogSourceLabel(entry)}`.
- Sleep generated block: `Part of the night logged for {nightLabel}.` and the rest of that paragraph, unchanged. Notes stay the dream place.
- Clocks: **When** (instant), **Fell asleep** / **Woke up** (sleep), otherwise **Start** / **End**. One **Date** key (`Hide date` when open). Date inputs keep ids `entry-from-date` and `entry-to-date` and the same `aria-label`s.
- Certainty row stays Exact / ~ Est. / ?.
- Duration block hidden for instants and when either end is unknown (`durationApplies`). Hero `~ ` prefix when estimated. Help strings from `durationHelp` stay, including `Use minutes or hours, such as 45, 1:30 or 1h 30m.`
- Spend block replaces display name. Display name help stays the “Optional. Defaults to the pen name…” paragraph.
- **Assumed / reconstructed** switch id `entry-assumed`.
- Overlap checkbox: `Also end {n} overlapping block` / `blocks` ` in other views here`.
- Tags: `Also counts as`, `Tag: {name}`, `always`, placeholder `New tag…`, button `Add tag`, promote button `Always tag {pen} as {names}`.
- Split control id `entry-split`. Disabled when `entry.endMin - entry.startMin < 2`. `sr-only` text `Split block`.
- Delete confirm: `Are you sure you want to delete this ${event|timeblock}? This cannot be undone.` `sr-only` text `Delete block`.
- Primary key: `Save event` or `Save block`.
- Outline key label is exactly `show in timegrid`. Missing `entry.id` returns before the guard. Dirty draft still prompts; Cancel stays. Save or exit-without-saving then jumps. Clean draft closes and calls `showBlockInTimegrid` on a timeout of `0`.
- Unsaved prompt: outside click, ×, and Escape. A spend block saves in place from the prompt (`save()` then return). Every other block still `onClose()` and `window.setTimeout(save, 0)`. Do not “fix” that after the form gets smaller. The comment in the form says why: store writes during save must not re-render the open prompt.

State behavior:

- Four effects still copy `variantIds`, `tagIds`, `nowObjectives`, and `secondaryPenIds` from the store entry when those arrays change (split or merge while open).
- Switching primary pen still drops variants until they are ticked again (`variantsFor`).
- Naming a Company group still switches pen, clears secondaries, and ticks the member variants in one handler.
- `alsoOthers` still defaults to `true` and is not part of the dirty snapshot.
- Clearing a certainty button (`startOff` / `endOff`) still saves that edge as exact.
- Delete and split still call `onClose()` after the store write. Split does not save the rest of the draft first (it does not today).
- The dialog opens on the click. Nothing in this split may call sleep sync, pen-action sync, or walk the entry list to derive nights.

## Test plan

No new tests. The existing dialog tests are the contract. Run them after step 4 and again after step 6.

- `components/Home/Tracking/entry-dialog.test.tsx` — both describes. Covers the door label, retimes, span lock, midnight end, pen search, Company group, cross-view detail, variants, secondary pens, notes, split in half and at a minute, sleep labels, Date key, delete confirm, live objectives, mood stretch, centered popup, entry swap remount, dirty and clean dismiss, **show in timegrid** clean and dirty, block tags vs pen tags, assumed.
- `components/Home/Tracking/block-editor/companion-section.test.tsx` — imports `EntryDialog`.
- `components/UiNames/ui-names-stamps.test.ts` — after the stamp path change, the new file must contain both attribute strings.
- Do not run or edit the unrelated dirty-session tests unless a failure is clearly caused by this split.

Browser check, once, on a running app, because this is a rendered dialog even though the DOM should be unchanged:

- Open a block from the Time Grid. Confirm the title, clocks, Date key, Save, and `show in timegrid` label.
- Change Start, type a duration, close with Escape, and confirm the unsaved prompt. Cancel stays. Exit without saving closes.
- Open a clean block and click `show in timegrid`. The editor closes and the grid shows that block.
- Open an instant (Tracking log event) and a sleep block if the vault has one. Labels **When** vs **Fell asleep** / **Woke up**.

If the vault has no sleep or spend row, the unit tests already cover those branches. Say which of the two you could not click.

Do not add a screenshot run for this split. The pixels should not change. `docs/screenshots/` stays as it is.

## Doc updates

Do these in the same implementation step as the file move, not as a later pass.

- `components/Home/Tracking/README.md` file table (~95): `entry-dialog.tsx` is the public re-export. The editor lives in `entry-dialog/entry-dialog-form.tsx` plus the section files. Keep the behavior paragraph (show in timegrid, Date key, span lock, mood, sleep, details, guard). Point **Name this group** at `entry-pen-block.tsx` and **repriceTransit** / **Calculate** at `entry-dialog/transit-actions.ts`. Add a short tree of the new folder. `_Last mapped: 2026-10-27_` on the rows you rewrite. Do not restyle the feature description into a changelog.
- The “Block ends” section (~508) and the transit paragraph (~520) name `entry-dialog.tsx` and `repriceTransit`. Update the path. Leave the behavior.
- `components/Home/ToDo/README.md` mentions the editor path once (Spent blocks). Update the path if that sentence names the file as the implementation rather than the import. The import path is still correct.
- `docs/tree.txt` and the room map `docs/tree.md` are a doc sync (`.cursor/rules/doc-sync.mdc`), not this step. Name the new files in the Tracking README.
- `components/UiNames/ui-names-stamps.test.ts` (~89): path becomes `components/Home/Tracking/entry-dialog/entry-dialog-form.tsx`. Attributes unchanged. `data-ui-docs` still points at `components/Home/Tracking/README.md`.
- `docs/README.md`: one index row for `modular-splits/` when this folder is new, so the plan is findable. One sentence: structural split plans, no product change.
- Do not edit `docs/SPEC_MAPPING.md`, `docs/DESIGN_STYLE.md`, or screenshot sidecars. The feature does not move between missing and implemented, and the style does not change.
- Other docs that say `entry-dialog` as the import (`docs/analytics-plan/09-day-shape-clock.md`, `docs/UI_NEXT.md`, Data README) can keep that name. Update them only if they claim the whole editor source is the single file `entry-dialog.tsx`.

## Risks

- **Hook reorder.** The form’s `useState` list is not contiguous. A helper hook that gathers “all span state” changes order. Forbidden in this split.
- **Dirty baseline.** `useState(draft)` freezes the first render. A section that sets state during render, or a save path that omits a draft key, makes a clean block look dirty or a dirty block look clean. `variantIds` in the snapshot is `liveVariantIds`.
- **Extra DOM node.** A section root that is not the original element, or a fragment replaced by a `div`, shifts layout and breaks tests that walk the tree. Roots are specified above.
- **Stamp file.** The ui-name test reads source text. Moving `DialogContent` without updating the path fails CI. A comment in the old file that merely contains the attribute strings would pass the test and lie. Update the path.
- **Folder vs file.** `entry-dialog/index.ts` can capture `import "./entry-dialog"`. Do not add it.
- **`overlapping` dead zone.** `afterEndsSaved` must receive `overlapping` after it exists. Do not call it during render.
- **Guard timing.** In-place save for spend, deferred save for everything else. Collapsing those branches reintroduces the prompt re-render the comment describes.
- **CSS order and the dirty stylesheet.** Import `tracking-chrome.css`, then `entry-dialog.css`, then `tracking-settings.css`, once, from the form. Do not edit `tracking-chrome.css`. It has unrelated work in the tree.
- **Unrelated dirty files.** `now-objectives-list.tsx`, pen-color session files, `working-now-strip.tsx`, and `lib/` session work are out of bounds. This split only adds `components/Home/Tracking/entry-dialog/*`, replaces `entry-dialog.tsx` with the re-export, and updates the stamp test plus the docs listed above.
- **`key={entry.id}`.** If the key moves onto a child that does not own the draft state, **Next timeblock** keeps the previous block’s fields. The key stays on `EntryDialogForm`.
- **Company group handler.** It reads the store after `addPenGroup` in the same turn. Do not defer that read to an effect.
- **Calculate side effects.** Store update, Activity paint, then `setFrom` / `setTo` / `setDriveMsg`. Reordering those makes the duration field disagree with the block that was just written.

## Done when

- `EntryDialog` still imports from `@/components/Home/Tracking/entry-dialog`.
- The form file is a state owner and a composer. Section files are hook-free. Action files are plain functions.
- No class, copy, attribute, or element was added or removed.
- The tests in the test plan pass.
- The Tracking README and the tree list the folder.
- No file under `components/Modules`, and no pre-existing dirty tracking or `lib/` file, was edited for this split.
