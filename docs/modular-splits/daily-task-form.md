# Split `daily-task-form.tsx`

_Last mapped: 2026-10-27._

Plan only. Pure structural extraction of the habit create/edit form. Same props, same behavior, same DOM, same class names, same copy, same hook order inside `TaskForm`. No product change. Do not touch `components/Modules/`. The working tree has unrelated session and tracking edits; do not revert, stage, or rewrite those files.

The form is one draft (`WeeklyTask` in `useState`) plus a scroll well. Visual order is flex `order` in `habit-form-dialog.css`. Document order is not that visual order. The sections that are worth lifting are already local: searchable pickers, the keyword source row, and the field groups named below. The draft, the locks, submit, and the section observer stay in the original file. They are one state machine. Splitting them would move hooks.

Item detail, the To do drawer, and the To do task card stay separate editors. This plan is only the habit form.

## 1. What the file does, and what must stay importable

`components/Home/Habits/daily-task-form.tsx` (~2745 lines). `"use client"`. `TaskForm` starts at ~664.

`TaskForm` is the create/edit body. `TaskFormDialog` in `daily-task-form-dialog.tsx` mounts it. The dialog, the sand close, and `data-ui-name="Habit form"` stay where they are.

The form owns the draft, the dirty snapshot (`serializeSnapshot` / `onDirtyChange`), preset locks (keywords, lift logs, sleep, list, coverage, floor, completion sources), submit cleanup, and the milled section strip. The strip scrolls `.habit95-fields` only. It does not hide sections. The active key is `resolveHabitSectionNavActive`: nearest intersecting top, or the last intersecting section when the well is scrolled to the end. A clicked key stays pinned until a hand scroll.

Page sections, in **document** order inside `.habit95-fields`:

1. Neglect line, when `neglectPrioritySentence` returns one (~1406).
2. Priority (~1409).
3. Name, including **Open item in Lists** on edit (~1478).
4. Gem (~1505).
5. Frequency (~1516).
6. Type (~1543).
7. Completion sources (~1566).
8. Target (goal / time / count) or Climb (~1989 / ~2051). One of them. Shared id `habit95-sec-target`.
9. Points & bonus (~2120).
10. Time estimate (~2165).
11. Done task wording, a `<details>` (~2237).
12. Auto-fill from Tracking, only while the Tracking-tags source is on (~2265).
13. Lift when a log says, daily only (~2386).
14. Connections, daily yes/no only (~2462).
15. BIM Keywords, only while `keywords` is in the source order (~2594).

Then `.habit95-actions` (Delete habit on edit, Cancel, Add Habit / Update Habit). Siblings of the `<form>`, not inside it: `HabitListPopup` and `PriorityReasonDialog`.

CSS then paints a different order (neglect, priority, name, frequency, type, gem, target, sources, auto-fill, keywords, connections, lift, points, time, wording). That lives in `.habit95-fields > .habit95-sec-*` in `habit-form-dialog.css` (~115–129). Do not edit that file.

### Public exports (keep these names on this path)

| Export | Role |
|--------|------|
| `TaskForm` | The form component. |
| `resolveHabitSectionNavActive` | Pure helper for the active section key. |

`TaskFormProps` is not exported. Leave it unexported.

Callers that must keep compiling without an import edit:

- `components/Home/Habits/daily-task-form-dialog.tsx` — `import { TaskForm } from "@/components/Home/Habits/daily-task-form"`.
- `components/Home/Habits/daily-task-form.test.tsx` — `import { resolveHabitSectionNavActive, TaskForm } from "./daily-task-form"`.
- `components/Home/Habits/daily-task-form-dialog.test.tsx` — `vi.mock("@/components/Home/Habits/daily-task-form")`.

`TaskForm` props, including defaults, stay:

`onSubmit`, `onCancel`, `onDelete?`, `initialTask?`, `defaultFrequency = "daily"`, `onDirtyChange?`, `onLeaveForItem?`.

No new public export from `daily-task-form.tsx`. No `habit-form/index.ts`. Other files do not import the new modules.

`components/Modules/workspace/housecleaning/TidyView.tsx` has an `addTaskForm` helper. That name is unrelated. Leave it.

## 2. New files, and what stays

New folder: `components/Home/Habits/habit-form/`. Interior to Habits. The public file stays `components/Home/Habits/daily-task-form.tsx` and re-exports the two names above.

Every new `.tsx` starts with `"use client"`, matching `habit-sources-field.tsx` and `gem-picker.tsx`. `model.ts` is pure and has no directive.

Do not wrap a section in an extra DOM node. A section component returns the existing element, or a fragment whose children are those elements, or `null`. `.habit95-fields > …` is what the flex order uses. A wrapper `<div>` would change the layout.

Pass props. Do not add context, and do not wrap sections in `memo`. Copy the JSX, the class names, the ids, the inline `style` objects, and the copy. Do not restyle.

### `habit-form/model.ts` (~200 lines)

Pure values and functions that are already local. No React.

Move:

- `FREQUENCIES`, `HABIT_TYPES`, `TRACKING_MODES`, `LIST_MEASURES`, `LIST_TARGETS`, `GRACE_SENTENCE`, `TRIGGER_MODES`, `EMPTY_RITUAL_IDS` (~179–243, ~564).
- `sourcesForListRouting` (~230).
- `seedTextTriggers` (~244).
- `reasoningUnderLogLine` (~250).
- `emptyClimb` (~258).
- `withSourceOrder` (~502).
- `resolveHabitSectionNavActive` (~640). Re-export it from `daily-task-form.tsx`.
- The section-nav array (~1259–1278) as a pure function, `habitSectionNav`, same ids and labels, same conditions. Not re-exported from `daily-task-form.tsx`.

`EMPTY_RITUAL_IDS` stays one module-level array. The reviews selector uses it as a fallback (`?? EMPTY_RITUAL_IDS`). A fresh `[]` each render would change that identity.

`habitSectionNav` inputs are the ones the array already reads: `task.type`, `task.frequency`, `showTracking`, and whether `sourceOrder` includes `"keywords"`. Copy the conditions. Do not unify them with the fieldset gates in the next paragraph.

### `habit-form/pickers.tsx` (~230 lines)

Move `DailyHabitPicker` (~269) and `ListSentPicker` (~386) verbatim. Same hooks in each: two `useState`, `useRef`, two `useId`, one `useEffect`.

Do not merge them into one picker. The labels, aria text, empty rows, and “no match” sentences differ. A shared dismiss hook is a second edit with no seam worth taking.

### `habit-form/identity.tsx` (~200 lines)

One component. Fragment of the first six blocks, so they stay direct children of the well:

- Neglect `<p>` (~1406).
- Priority fieldset (~1409), including the star, the log, Permanent priority, Morning ritual (edit only), and Ignore neglect.
- Name field (~1478), including `autoFocus` and **Open item in Lists**.
- Gem fieldset (~1505).
- Frequency fieldset (~1516). The click still sets `rewardValue` from `defaultHabitPoints` when `creating && !rewardTouched`.
- Type fieldset (~1543). `setType` stays a parent function passed in.

`reasoningUnderLogLine` is called from this file. `rewardTouched` state stays in `TaskForm`.

### `habit-form/sources.tsx` (~220 lines)

The Completion sources fieldset (~1566–1987) minus the two large row bodies below. Keeps the legend, the trust-order hint, the tag-role note, `HabitPipelineEditor`, the short row kinds, and the “Counts Done / Fills minutes” status line.

Short kinds stay in this file. They are small and have no seam of their own:

- `tags` (~1587).
- `trackingStats` (~1633).
- `trackingTags` and the manual fallback (~1970–1978).

`commitPipelines`, `setRowSources`, and the lock setters stay in `TaskForm` and are passed down.

### `habit-form/stats-source.tsx` (~180 lines)

The `habitsStats` branch (~1672–1835): `StatSourceBuilder`, the “how many must be higher” field, the daily-completion-average readout, `DailyHabitPicker`, the daily-habit total readout, and the floor fields. Parent still computes `dailyPercents`, `averageRows`, `averageMean`, `sumKeys`, and `statContext`, and passes them in. `statContext` keeps its `new Date()` in `TaskForm`.

### `habit-form/list-source.tsx` (~160 lines)

The `lists` branch (~1837–1956): `ListSentPicker`, **Open list**, the two `Habit95Select`s, Grace, `GRACE_SENTENCE`, and `data-testid="list-pipeline-preview"`.

`applyRouting` and `keepRouting` move with this branch, unchanged. They call `sourcesForListRouting`, `withSourceOrder`, and the parent lock setters. **Open list** still does `closest("[data-ui-name='Habit form']")` and writes `listPopupHost`. Pass an `onOpenList(listId, host)` callback; the popup stays in `TaskForm`.

### `habit-form/keywords.tsx` (~200 lines)

- `KeywordSourceFields` (~566), used by the keywords pipeline row.
- The BIM Keywords fieldset (~2594): phrase rows, mode select, unit words, connector, Add keyword, Try a phrase.

Parent keeps `phrase` state, `patchTrigger` / `addTrigger` / `removeTrigger` (they set `triggersLocked`), `loggedNow`, and `phrasePreview`. The fieldset still mounts only when `sourceOrder` includes `"keywords"`. The pipeline row still renders `KeywordSourceFields` whenever `row.kind === "keywords"`, which is a different gate. Leave both gates as they are.

### `habit-form/target.tsx` (~150 lines)

Two components, or one component that returns one fieldset:

- Target (~1989): Amount, unit, Cell progress tube. Amount still syncs `coverageLink` when coverage is on, and stays read-only when `listMeasure.derived`.
- Climb (~2051): Weekly + / Daily +, starting value, increment, unit, the cadence hint.

Return the fieldset or `null`. Do not wrap the pair. Only one is mounted today. Both use `id="habit95-sec-target"`.

Mount gates stay distinct from the nav key:

- Nav key: `task.type` is goal or climb (`habitSectionNav`).
- Target fieldset: goal, time, or count.
- Climb fieldset: incremental.

Time and count are legacy goal aliases and the draft normalizes type on init. The extra fieldset condition is still real. Do not collapse it into the nav condition.

### `habit-form/points-time-wording.tsx` (~180 lines)

One fragment, three direct children, always mounted:

- Points & bonus (~2120). The completion-points `onChange` still calls `setRewardTouched(true)` before `setTask`.
- Time estimate (~2165). `setTimeEstimate`, `setEstimateNA`, `estimateHold`, `measuredInTime`, and `usesRate` stay parent functions and flags passed in.
- Done task wording (~2237), still a `<details>`, still collapsed until opened.

These three are one read. Splitting them would make three short files and no new seam.

### `habit-form/tracking-fill.tsx` (~140 lines)

Auto-fill fieldset (~2265). Tag catalog, minutes threshold, unit / pen-detail field, combine mode, pen count, “Auto-fill is on”. Parent keeps `link`, `setLink`, `toggleLinkTag`, `createTrackingTag`, `showTracking`, `periodWord`, `linkedPenCount`, and `trackingNumberFields`. The fieldset still mounts only when `showTracking` is true. `TRACKING_MODES` comes from `model.ts`.

### `habit-form/lift-and-connections.tsx` (~230 lines)

Two components in one file. Each returns its fieldset or `null`.

- `HabitFormLift` (~2386). Daily, any type. Blocks, Remove, Add a block. Each edit still sets `logsLocked`.
- `HabitFormConnections` (~2462). Daily yes/no. Sleep clock (`ClockPicker`) and the to-do list block. Add / Remove still set `sleepLocked` or `listLocked`.

Lift is not inside the connections gate. Connections is not inside a wrapper with lift.

### What stays in `daily-task-form.tsx`

The file should land near ~800 lines: the draft and the shell, not the field markup.

Stays:

- `"use client"`, the file header (shortened so it points at `habit-form/` and still describes the form), `TaskFormProps`, `TaskForm`.
- Re-exports of `TaskForm` and `resolveHabitSectionNavActive`.
- Every hook now in `TaskForm`, in the same order. List in §7.
- `handleSubmit` (~874).
- Trigger editors, tracking-link editors, `commitPipelines`, `patchStatsRow`, `statContext`, catalog create/edit, `loggedNow`, time-estimate setters, `setClimb`, `setType`, `canSubmit`, neglect sentence, section-nav state, the intersection observer, `jumpToSection`, `prioritizeHabit`, `resolvePriorityReason`.
- The `<form id="habit95-form" className="habit95-form">` shell: the `<nav className="habit95-section-nav">` (too small to file alone), `.habit95-fields` with `ref={setFieldsEl}`, the section components in the document order above, `.habit95-actions`.
- `HabitListPopup` and `PriorityReasonDialog` as siblings of the form.

The nav buttons stay in this file: `className="habit95-btn habit95-section-key"`, `key={`${id}:${label}`}`, `aria-current`, `aria-controls`, `jumpToSection`.

Do not extract a `useHabitDraft` hook. That moves the hook list into another function. The order inside `TaskForm` is the invariant.

## 3. Extraction order

After each step the form still renders, and `npx vitest run components/Home/Habits/daily-task-form.test.tsx` passes. Do not start the next step on a red run.

1. **`model.ts`.** Move the constants and pure functions. Import them back. Re-export `resolveHabitSectionNavActive` from `daily-task-form.tsx`. Switch the nav array to `habitSectionNav(...)` without changing its output. No JSX move.
2. **`pickers.tsx`.** Move the two pickers. No prop change at the call sites.
3. **`keywords.tsx`.** Move `KeywordSourceFields` first, then the BIM fieldset. Call sites pass the same values.
4. **`identity.tsx`.** Replace the neglect-through-type block with the component. Fragment, same order.
5. **`target.tsx`.** Target and Climb.
6. **`points-time-wording.tsx`.** Points, time, wording.
7. **`tracking-fill.tsx`.** Auto-fill.
8. **`lift-and-connections.tsx`.** Lift, then connections.
9. **`list-source.tsx`.** Lists row only. Sources fieldset still in the original file.
10. **`stats-source.tsx`.** Habits-stats row only.
11. **`sources.tsx`.** Move the rest of the fieldset. It renders the two row components.

Stop there. Do not continue into submit, the observer, or the locks.

## 4. Behavior and visual invariants

- Same `TaskForm` props and default `defaultFrequency`.
- Same DOM order inside `.habit95-fields` as the numbered list in §1. Tests look at document order (`Priority` before `Name`, sources before the target field). Visual order stays the CSS flex order. Do not reorder nodes to match the screen.
- Section roots stay direct children of `.habit95-fields`. Same ids (`habit95-sec-*`), same `tabIndex={-1}`, same `habit95-sec-*` classes on those same elements. `jumpToSection` uses `getElementById`, `closest(".habit95-fields")`, `scrollTop += delta - 8`, and `focus({ preventScroll: true })`.
- Form `id="habit95-form"` and `className="habit95-form"`. Nav `aria-label="Habit sections"`. Actions classes `habit95-btn`, `habit95-btn-danger`, `habit95-btn-default`.
- Same copy, including curly quotes, `{n}` / `{value}` braces, and the Add Habit / Update Habit labels. Same placeholders and aria-labels. Same `data-testid="list-pipeline-preview"`.
- Same inline styles (`marginTop: 8`, `marginTop: 6`, `alignSelf: "flex-start"`, `alignItems: "end"`). Do not move them into CSS.
- Nav keys appear only for mounted sections, with the existing exceptions: the Target **key** is goal or climb; the Target **fieldset** also allows time and count. Keywords **section** follows `sourceOrder`. Keywords **row config** follows `row.kind`.
- Unmounted sections are absent, not hidden. Weekly text still omits lift, connections, and the target key.
- Active key: initial state `"habit95-sec-priority"`. Observer options stay `{ root, rootMargin: "0px", threshold: [0, 0.01, 0.1, 0.5, 1] }`. Pinned key until a hand scroll. Max scroll still selects the last intersecting section (`scrollTop >= maxScroll - 1`).
- Submit still normalizes climb, tracking link, coverage, floor, time estimate, done phrase, triggers, exemptions, sleep, list, gem, pipelines, list-sent, tagged-task tag, and the morning-ritual id list. Skip or a blank why still stores no `reasoning`.
- Frequency on a new habit still fills completion points from the period default until the points field is edited (`rewardTouched`).
- Name `autoFocus` stays. Picker search inputs stay `autoFocus`. Enter on those searches and on Try a phrase still `preventDefault`.
- Delete still `window.confirm` with the same sentence. Cancel still calls `onCancel`. **Open item in Lists** still calls `openHabitInLists` then `onLeaveForItem`.
- Dirty snapshot keys stay the same set, in the same shape, so the unsaved guard does not flip.
- Preset sync effects stay: first run skips (`skipTriggerNameSync`, `skipLinkSync`), then name/frequency/type refresh unlocked presets.
- No CSS edits. No copy edits. No behavior edits dressed up as cleanup (unused-looking branches, TIME/COUNT, the two keyword gates).

## 5. Test plan

Existing coverage is the lock. Search hit one suite that imports the module, plus a dialog suite that mocks it.

After every step in §3:

```bash
npx vitest run components/Home/Habits/daily-task-form.test.tsx
```

That file already covers fields, submit label, create submit, gem, priority and the why dialog, document order, section jump, `resolveHabitSectionNavActive`, omitted keys, ritual, ignore-neglect, goal target, climb submit, delete, tracking auto-fill, time N/A, collapsed wording, coverage, the daily-habit picker filter, tagged tasks, grace, BIM keyword modes, list source, stats pipeline, and the shared tag catalog.

Once, after step 11:

```bash
npx vitest run components/Home/Habits/daily-task-form-dialog.test.tsx
```

That mock must still resolve `TaskForm` from `@/components/Home/Habits/daily-task-form`. No need to run the tracker or Lists habit tests for a split that does not change the dialog props. Run them only if an import of `TaskForm` or `TaskFormDialog` fails.

Do not add a new test file. Do not export `habitSectionNav` just to unit-test it. The form tests already lock the keys and the helper. Add a case in `daily-task-form.test.tsx` only if a move drops a behavior the suite never rendered. None of the moves in §2 do that.

## 6. Docs after the split

Update these in the same step as the last extraction. Do not add a `BRAIN2_FEATURE_IDEAS.md` entry. Do not edit `SPEC_MAPPING.md` or `DESIGN_STYLE.md` (the dialog path and the sand close do not move).

- `components/Home/Habits/habit-form/README.md` — new, short. Purpose sentence: these files are the habit form body; `TaskForm` still lives in `daily-task-form.tsx`. File tree and one line per file (what moved). `_Last mapped: 2026-10-27_`. Say the screen did not change.
- `components/Home/Habits/README.md` — public-door bullet still names `TaskForm` (`daily-task-form.tsx`). File-table row for `daily-task-form.tsx` stays the behavior note and adds that the sections live in `habit-form/`. New rows for that folder’s files. Do not drop the behavior (priority, section strip, sources, keywords, Open item in Lists, dirty snapshot).
- `components/Home/README.md` — no habit-form file list today. Leave it. The room doc is the Habits README.
- `components/README.md` — the Home cell does not name this form. Add one short clause: create/edit habit is still `TaskForm` from `Home/Habits/daily-task-form.tsx`, with the field groups in `Home/Habits/habit-form/`. Do not grow the cell into a second file catalog.
- `docs/README.md` — one index row for `modular-splits/` (this plan). The folder is a split plan, not a feature.
- `docs/tree.md` and `docs/tree.txt` — doc sync only (`.cursor/rules/doc-sync.mdc`), not this step. The Habits README names `habit-form/` and still says `TaskForm` lives in `daily-task-form.tsx`.

Also point the header comment in `daily-task-form.tsx` at `habit-form/` so it does not claim the field markup still lives in that one file.

## 7. Risks

**Hook order.** `TaskForm` hooks, top to bottom, must stay in this order. Plain consts between them are fine. Do not insert a hook, and do not move one into a child.

1. `useThemeStore` colors
2. `useTimeTrackingStore` tags
3. `useTimeTrackingStore` scopes
4. `useHabitsStore` `defaultHabitPoints`
5. `useHabitsStore` `tasks`
6. `useHabitsStore` `weeklyData`
7. `useHabitsStore` `weeklyHabitData`
8. `useHabitsStore` `monthlyHabitData`
9. `useHabitsStore` `quarterlyHabitData`
10. `useHabitsStore` `morningRitualPointMultiplier`
11. `useUserSettingsStore` daily full mark
12. `useHabitsStore` `habitExemptions`
13. `useHabitsStore` `gradeTolerance`
14. `useHabitsStore` `outputGradeTolerance`
15. `useHabitsStore` `accomplishmentThreshold`
16. `useReviewsStore` morning review for `ritualDayKey` (`localDayKey(new Date())` is a plain const just before this selector)
17. `useState` `ritualOverride`
18. `useTaskStore` lists
19. `useTaskStore` tasks
20. `useState` `openListId`
21. `useRef` `listPopupHost`
22. `useState` `fieldsEl`
23. `useState` `activeSection` (`"habit95-sec-priority"`)
24. `useState` `priorityReasonOpen`
25. `useRef` `sectionNavRef`
26. `useRef` `pinnedSectionRef`
27. `useRef` `jumpScrollingRef`
28. `useState` `triggersLocked`
29. `useState` `logsLocked`
30. `useState` `sleepLocked`
31. `useState` `listLocked`
32. `useState` `coverageLocked`
33. `useState` `floorLocked`
34. `useState` `sourcesLocked`
35. `useRef` `estimateHold`
36. `useState` `rewardTouched` (read by the frequency click, written by the points field)
37. `useState` `phrase`
38. `useTimeTrackingStore` `addTag`
39. `useState` `task`
40. `useState` `baseline`
41. `useEffect` dirty snapshot
42. `useRef` `skipTriggerNameSync`
43. `useEffect` keyword preset sync
44. `useRef` `skipLinkSync`
45. `useEffect` connection / coverage / floor preset sync
46. `useEffect` active-section fallback
47. `useEffect` `IntersectionObserver`

Picker hooks stay inside the pickers, in their current order. They already ran as child components.

**`"use client"`.** The public module stays a client module. New components are client modules too. `model.ts` must stay free of hooks and browser-only calls so a client file can import it without pulling a second copy of the draft.

**Closures.** Several handlers call `setTask({ ...task, ... })` with the `task` from that render, not a functional update. Pass `task` and `setTask` and keep that shape. A drive-by conversion to functional updates is a behavior change. Do not `memo` a section: a stale `task` prop would skip those updates. `listPopupHost` is a ref written from the Open list click during the event; the popup reads `listPopupHost.current` on render. Keep that timing.

**CSS.** Flex `order` and the sunken well assume the section nodes are direct children of `.habit95-fields`. A fragment is safe. A `<div>` around one section, or around the pair of lift and connections, is not. Ids must stay on the fieldset / div / details the observer and `jumpToSection` already find. Two mounted nodes with `habit95-sec-target` would make `getElementById` pick the first.

**Submit and locks.** `commitPipelines` sets several lock flags and then `withSourceOrder`. If a row component sets the draft itself and forgets a lock, the name/frequency effect will put the preset back. Pass the existing functions. Do not reimplement them in the child.

**Stores during render.** `loggedNow` calls `useHabitsStore.getState()` during render (~1191). Leave that call in `TaskForm`. Moving it into a section that is sometimes unmounted would change when it runs. The result is only displayed in BIM Keywords; the call site still stays put.

**Dirty tree.** Limit the edit to `daily-task-form.tsx`, `habit-form/**`, the docs in §6, and `daily-task-form.test.tsx` only if a characterization import must stay pointed at `./daily-task-form` (it should). Do not stage or revert the session and tracking files already in the worktree.
