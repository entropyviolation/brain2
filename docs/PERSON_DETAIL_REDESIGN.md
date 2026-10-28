# Person detail + rich Links redesign plan

_Last mapped: 2026-10-16_

The item detail view for a person on **People I Know** (and any list whose
item type is Person), plus the parts that apply to every item: the unsaved
guard on every way out, and a Links tab that can hold any relation, both ways,
drawn as a constellation.

House order: [`DESIGN_STYLE.md`](DESIGN_STYLE.md) (milled fascia, phosphor,
Willpower gems, "Checklist before shipping UI"). Room docs:
[`components/ItemDetail/README.md`](../components/ItemDetail/README.md),
[`components/People/README.md`](../components/People/README.md),
[`lib/README.md`](../lib/README.md).

---

## Where it stands

_Last mapped: 2026-10-16_

**Shipped:** every way out of item detail is guarded (Phase 0); the person
data layer (notes fold v19, rename-safe Gift ideas list, self, relation
vocabulary); the rich Links tab for every item (Phases 5–8.1); Company pen
double-click. **Next:** steps 1.1 → 2.1 → 3.1 (one rewrite of
`person-detail.tsx`), which also finishes 3.2–3.5 and 7.1. Pieces for that
rewrite are already in the tree and unwired: `components/ui/address-suggest-input.tsx`,
`components/People/detail/person-nicknames.tsx`, `components/People/detail/person-log.tsx`
(a copy of `Log` from `person-detail.tsx`; delete the original when wiring).

## How to use this file (agents read first)

1. Read **§1 Context pack** instead of re-reading the files it summarizes.
   Open a file only for the lines a step names.
2. Take the next step whose **Depends on** steps are all **Done** in the
   **§0 Status board**. Steps in the same row of the parallel map (§3) touch
   different files and can run side by side.
3. When you finish a step: tick it on the status board, fill its
   **Handoff** slot (what you built, exported names, surprises, line numbers
   that moved), and fix §1 if the code disagreed with it. Keep handoffs to a
   few lines. Future steps read handoffs, not your diff.
4. Run the step's checks before marking it Done. Never mark a step Done with
   a red test.
5. Update the room README the step names (`AGENTS.md` rule: `_Last mapped_`
   line, house voice). Phase 9 is the final sweep, not the only one.

Checks used everywhere:

```
npx vitest run <paths named in the step>
npx tsc --noEmit -p .
npm run lint
```

Full `npm test` at the end of each phase.

---

## 0. Status board

| Step | Title | Depends on | Status | Owner / date |
|------|-------|-----------|--------|--------------|
| 0.1 | Guard core: `guardAction` + live dirty check | — | ☑ | Claude · 2026-10-16 |
| 0.2 | Popup: guard every way out | 0.1 | ☑ | Claude · 2026-10-16 |
| 0.3 | Page shell + window close guard | 0.1 | ☑ | Claude · 2026-10-16 |
| 1.1 | Person fields stop re-rendering the popup | 0.1 | ☑ | Claude · 2026-10-16 |
| 1.2 | Popup render diet | 1.1 | ☑ | Claude · 2026-10-16 |
| 2.1 | Field padding + person field kit (CSS) | — | ☑ | Claude · 2026-10-16 |
| 3.1 | Person Details layout + orb well | 1.1, 2.1 | ☑ | Claude · 2026-10-16 |
| 3.2 | Address autocomplete | 1.1 | ☑ | Claude · 2026-10-16 |
| 3.3 | Notes leave Details (migration v19) | — | ☑ | Claude · 2026-10-16 |
| 3.4 | Gift ideas key + popup; rename-safe list | 3.1 | ☐ | |
| 3.5 | Company pen double-click + move up | 3.1 | ☐ | |
| 4.1 | Auto-create "self" | — | ☑ | Claude · 2026-10-16 |
| 5.1 | Relation vocabulary: registry + store | — | ☑ | Claude · 2026-10-16 |
| 5.2 | Person relation seeds | 5.1 | ☑ | Claude · 2026-10-16 |
| 6.1 | `lib/link-graph.ts` (pure ego graph) | 5.1 | ☑ | Claude · 2026-10-16 |
| 6.2 | Link composer (sentence builder, new relation) | 5.1, 6.1 | ☐ | |
| 6.3 | Link ledger (out / in / mutual, confirm) | 6.1 | ☐ | |
| 6.4 | Constellation view | 6.1 | ☐ | |
| 6.5 | `RichLinksPanel` wired into popup for people | 0.2, 6.2–6.4 | ☐ | |
| 7.1 | Self auto-populate from Relation words | 4.1, 5.2, 6.1 | ☐ | |
| 8.1 | Rich links for every item (popup + page) | 6.5 | ☐ | |
| 8.2 | Orb well for every item (fascia) | 3.1 | ☐ | |
| 9.1 | Docs sweep + screenshots | all | ☐ | |

---

## 1. Context pack (verified 2026-10-16, refreshed after 0.1–6.1)

Line numbers are approximate (`~`). Fix them in a handoff when they move.

### 1.1 Item detail shells

- **Popup** `components/ItemDetail/ItemDetailPopup.tsx` (~1515 lines),
  export `TaskDetailPopup`. Lazy-loaded by `app/page.tsx` ~91.
  - `overrideId` state ~112: in-popup navigation to another item. Every
    opener goes through the guarded `openItem` ~371 (0.2).
  - `handleNavigateToList` ~377: guarded (`guardAction`), then `onClose()`
    and `requestNavigateToListAfterPaint(listId, folders)`.
  - Guard ~360: `isDirty: isDraftDirty` (a function, read at call time).
    `useItemDetailSession` pins the open item and saves it on reload
    (the next load is the minimized dock, not a browser leave prompt).
    A click on the page behind the popup saves and minimizes; Escape and
    × still use `guard.requestClose`.
    `layerSafeDismiss` on `DialogContent`;
    `<UnsavedChangesDialog {...guard.prompt} />` ~1467.
  - `writeDraft(patch)` ~355 = `touchDraft(patch)` + `setTask(merge)`.
  - Details tab ~526: `id-details-grid` → `id-details-main`. For a person
    (`itemShowsPersonPipelines(task, lists)`), renders `<PersonDetail
    person onChange>` then `<PersonPipelinesEditor mode="person">` ~535–556,
    then `ItemAttributesSection` with `omitAttributeIds={[birthday, notes]}`
    ~565.
  - Notes tab ~944: `<ItemNotesLog entries={task.noteLog}
    standing={task.notes} …>`. Resources ~956. Links tab ~961:
    `LinkPicker` + `RelatedItemsPanel`. Tabs list built ~165:
    `popupTabs = [...visiblePanels, "links", "history"]`; trigger for links
    ~502.
  - `detailView` ~196: memo keyed on `task.type` and `task.lists` only (1.2).
  - Person block ~618: `<PersonDetail … pipelines={<PersonPipelinesEditor
    mode="person">} onNavigateToList={handleNavigateToList}>` (3.1). The
    attributes section gets `onLiveValue` → `touchDraft` (1.2).
- **Page** `components/ItemDetail/ItemDetailPage.tsx` (~1418 lines),
  export `EnhancedTaskDetail({ taskId, onBack })`. Has an `isEditing` mode.
  Own unsaved guard ~381 (0.3) over Back, list badge, habit settings, and
  `openItem`. Person block ~606 (same as popup). "Related"
  card ~885 with `LinkPicker` (only when editing) + `RelatedItemsPanel`.
  Notes ~1317.
- **Draft hook** `components/ItemDetail/draft/useItemDetailDraft.ts`: `task`,
  `setTask` (state + ref + listeners), `getDraft()` (ref), `touchDraft(patch)`
  (ref only, no render, notifies `subscribeDraft` listeners — the save lamp
  `ItemSaveFlag` listens), `originalTask` (**state only, no ref**),
  `commitDraft(next)` → `commitItemDraft(before, next)` then
  `setOriginalTask(saved)`; `addLink(relation, targetId)` /
  `removeLink(id)` patch `task.links` on the draft.
- **Isolated fields** `components/ui/isolated-text-field.tsx`:
  `IsolatedInput` / `IsolatedTextarea` (shadcn `Input`/`Textarea`, which
  carry `px-3`), local state, `onLiveChange` every key (keep cheap: ref
  writes), `onCommit` on blur / Enter, only when the text differs from the
  `value` prop. Not focused → re-syncs from the prop. Description already uses this pattern (popup ~585).
- **Save door** `lib/commit-item-edit.ts`: `TASK_FIELDS` allowlist ~40–118.
  `links`, `icon`, `personProfile`, `noteLog`, `attributes`, `notes` are in
  it. **Any new top-level Task field must be added here or Save drops it.**
- **Unsaved guard** `components/ui/unsaved-changes-guard.tsx`:
  `useUnsavedGuard({ open, onOpenChange, isDirty: boolean | () => boolean,
  onSave, onDiscard })` → `{ handleOpenChange, requestClose, guardAction,
  forceClose, promptOpen, prompt }`.
  Prompt = Save / Stay / Exit without saving. Used by many dialogs: keep
  the old signature working.

### 1.2 Person

- `components/People/person-detail.tsx` (~430 lines) `PersonDetail({ person,
  onChange, onLive, readDraft, pipelines, onNavigateToList, today })`. Text
  fields are `IsolatedInput`: keys go to `onLive` (host `touchDraft`, no
  render), blur commits through `onChange` (1.1). Patch may carry `icon`.
  Order (3.1): identity bay (`.person-orb` well → `OrbPickerDialog`, birthday
  plaque) → `.person-readout-strip` (Known for, Last saw, Close lamp
  `role="switch"`) → `person-grid` 2 columns (Full name, `NicknameField`,
  Relation (+ datalist friend/sister/boyfriend), Date met + Est., Instagram
  with `@` and open link, Address = precision `<select>` +
  `AddressSuggestInput` + map pin) → `<PersonTimeTogether>` → `pipelines`
  slot → `Log "Interactions"` → `GiftIdeasList` (+ Open list key) → `GiftLog`.
  Split files: `person-log.tsx` (`Log`), `person-nicknames.tsx`
  (`NicknameField`, chips inside the field), `person-gift-ideas.tsx`
  (`GiftIdeasList`, `GiftLog`; 3.4 builds the key + dialog here).
- `components/People/person-detail.css`: field rule ~68 is 32px with
  `padding: 0 10px` (2.1). Kit classes `.person-field`, `.person-chipfield`,
  `.person-key`, `.person-readout-strip` at the end of the file.
- `components/People/person-notes.tsx`: `PersonNotes`, the person Notes tab
  (3.3). Dated notes are `task.noteLog`; old `personProfile.noteLog` folds
  via `lib/person-notes-fold.ts` (persist v19).
- `lib/people-self.ts`: `PEOPLE_SELF_ID = "person-self"`,
  `ensureSelfPerson`, `isSelfPerson` (4.1).
- `components/People/person-pipelines.tsx`: `PersonPipelinesEditor` (memo
  since 1.2; person mode compares id, title, description, `personPipelines`)
  modes
  `person | pen | entry | list`. Row renderer ~60–110: swatch
  `.person-pipelines-swatch` (pen color) + label "Company pen · {who} —
  {pen name}" + Remove. `useCompanyTracking()` ~112.
- `components/People/detail/person-time-together.tsx`: `React.memo` on name +
  `personPipelines` (1.2); inner memo on store entries.
- `lib/person-profile.ts`: `PersonProfile` ~90 (`fullName, nicknames,
  relation, dateMet, dateMetEstimated, instagram, address{precision, text,
  lat?, lng?, parts?, source?} (3.2; `cleanAddress`), `addressTextForPick`,
  noteLog, interactions, giftIdeas, close`). `PersonDatedNote` = `{id, date,
  text}` — a subset of `ItemNoteEntry` (`lib/types.ts` ~821: `{id, date,
  time?, text, editedAt?}`). **`assembleProfile` ~330 rebuilds the profile
  field by field: any new field is dropped unless added there** (address
  coords and `self` are in). `presentPersonProfile` (typing) / `cleanPersonProfile`
  (trim).
- `lib/person-types.ts`: `PERSON_TYPE_ID = "person"`, `PERSON_ATTR =
  {birthday, notes}`; type `displayedAttributes: [birthday, notes]` so the
  People list column shows the `notes` attribute.
- `lib/people-i-know.ts`: `PEOPLE_I_KNOW_LIST_ID = "people-i-know"`,
  `findPeopleIKnowList`, `itemShowsPersonPipelines(task, lists)` (type person
  OR on that list), `ensurePeopleIKnowList()`, `createPerson(name, listId,
  pipelines?)`, `COMPANY_SCOPE_ID = "company"`, `personRecords`.
- `hooks/use-people-i-know.ts`: after task-store hydrate →
  `ensurePeopleIKnowList()`; starts `startPeopleSync()` (name matching
  between who-pens, Company pens, People I Know items).
- `lib/gift-ideas.ts`: list id `gift-ideas-for-${personId}`, tie
  `List.giftIdeasPersonId` (**already linked by id**). `findGiftIdeasList`
  matches by person id, then canonical id. **But `ensureGiftIdeasForPerson`
  and `renameGiftIdeasList` overwrite `list.name` with "Gift ideas for
  {title}" on every hydrate (`ensureCloseGiftIdeas`) and on title change
  (`noteSavedPeople`), so a user rename does not survive.**
  `addGiftIdeaOnList(personId, text)`.

### 1.3 Links today

- `lib/links.ts`: `RelationDef {id, label, inverse, inverseLabel,
  fromTypes?, toTypes?, family?, custom?, archived?, createdAt?}`,
  static `RELATIONS` (blocks, supports, refutes, reviews, goal-of,
  checklist-of, objective-of, subgoal-of, part-of, phase-of, resource-of,
  related) and `RELATION_BY_ID`. `inverseRelation(id)` (unknown = symmetric),
  `relationLabel(id)` (unknown = raw id), `inverseRelationLabel(id)`; all
  three fall back to `lib/relation-registry.ts` (5.1) for seed and custom
  ids. Person seeds: `lib/person-relations.ts` (5.2). Ego graph:
  `lib/link-graph.ts` (6.1).
  `addLink(links, rel, target,
  sourceId)` (no self, no dup), `removeLink`, `removeLinkByTarget`,
  evidence/stance helpers. Readers: belief graph, objectives, operations,
  gravity, needs-attention, item-merge, task-index, etc. **Keep every
  export's behavior for built-in ids.**
- `ItemLink` (`lib/types.ts` ~79): `{id, relation, targetId, stance?,
  weight?}` on `Task.links`. Stored on the source only. Backlinks are found
  by scanning: `useTaskStore.getBacklinks(id, relation?)`
  (`lib/task-store.ts` ~716).
- `components/ItemDetail/LinkPicker.tsx`: relation `Select` over
  `RELATIONS` + typeahead over `taskRepository.getAll()`.
- `components/ItemDetail/RelatedItemsPanel.tsx`: forward links grouped by
  relation (removable) + backlinks labeled with `inverseRelation`.

### 1.4 Reusable pieces (do not rebuild)

| Need | Use |
|------|-----|
| Orb image for an item | `iconFor(id, task.icon)` from `@/components/Icons/Icon` (`orbFor` hashes a default). `Task.icon` is in the save allowlist. |
| Orb picker popup (pick existing / upload new, bg removal) | `OrbPickerDialog({ open, current, onClose, onSelect(icon \| undefined) })` from `@/components/Icons/OrbPicker`. Example caller: `applyIcon` in `components/Lists/hooks/useListsIconChrome.ts`, mounted from `components/Lists/board/lists-dialog-host.tsx`. |
| Address search with parts | `searchAddresses(q, near?)`, `withParts(s)`, `reverseGeocode`, type `AddressSuggestion {id,name,label,lat,lng,parts,source}` in `lib/geo-address.ts`; `AddressParts` in `lib/pen-place.ts` ~20. Photon keyless; Google first when `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is set. Fails soft. Debounce pattern: `components/Home/Tracking/pen-settings/pen-place-editor.tsx` ~50–75. Place UI with keyboard nav: `components/Modules/workspace/itinerary/PlaceSuggestInput.tsx`. |
| Open pen settings from a color | `penColorDoubleClick(scopeId, penId)` + `PEN_COLOR_OPEN_TITLE` from `components/Home/Tracking/open-pen-settings.ts`. Host `PenSettingsHost` is mounted once in `app/page.tsx` ~309. |
| Gravity physics | `components/Lists/lib/list-icon-gravity.ts`: `makeGravityBodies`, `stepGravity(bodies, edges, dt, bounds, opts)`, `settleGravityField`, `prefersGravityReducedMotion`, `nodeGlowLevel`, `edgeCordOpacity`. Cord paint: `list-icon-force-links.ts` + `ListIconForceLinksOverlay`. |
| List summary | `ListSummary` in `components/Modules/module-bodies.tsx` ~184 (count / done bar). |
| Notes log UI | `ItemNotesLog` (`components/ItemDetail/tabs/notes/ItemNotesLog.tsx`), helpers `lib/item-notes.ts` (`makeNoteEntry`, `notesNewestFirst`). |
| Item type of an item | `assignedItemTypes(...)` (`lib/item-types.ts`, used in page ~362) and `task.type`. |
| Relation vocabulary home | `lib/item-type-store.ts` `relations` + `addRelations` / `updateRelation` / `archiveRelation` (5.1; persist `brain2-item-types-store`, still v2, in Settings full backup `lib/data/backup.ts` ~174). `migrateItemTypeState` returns only `types` — carry `relations` if you bump the version. Read through `lib/relation-registry.ts`. |

### 1.5 Invariants (do not break)

- Save goes through `commitDraft` → `commitItemEdit`. History lines keep
  working. Cmd/Ctrl+S keeps working. The save lamp keeps following keystrokes.
- A clean close stays silent. A dirty one asks Save / Stay / Exit without
  saving. Discard restores `originalTask`.
- People sync, Company pens, Time together, Last saw, Close → Gift ideas
  list, birthday countdown, interactions: same behavior.
- `Task.links` stays the one link store. Built-in relation ids keep their
  labels and inverses. Unknown ids stay symmetric. No existing link is
  rewritten.
- Notes move without loss (migration is additive; old fields read until
  folded).
- `brain2-*` keys only; Demo profile isolation untouched.
- Every existing test keeps passing. Tests that assert copy you change get
  updated in the same step, with the reason in the handoff.

---

## 2. The shape (what it should feel like)

**Details tab (person)** reads top to bottom as one biography:

1. **Identity bay.** Left: the person's orb on a velvet well (64px, the same
   object the Lists desktop shows). Click → `OrbPickerDialog`. Right: the
   birthday plaque (cake + "12 days to go" + date). Under them one
   phosphor readout strip: `KNOWN 3y 2m · LAST SAW 14d · CLOSE ●` (Close is
   a lamp key, not a bare checkbox).
2. **Biography grid** (2 columns, engraved nameplates, sunken white fields
   with 10px inner padding, 32px tall): Full name · Nicknames (chips inside
   the field; Enter adds) · Relation (datalist from relation words) · Date
   met + Est. · Instagram (`@` adornment, opens profile) · Address
   (precision select + live map search; a pin glyph when coordinates exist).
3. **Time together** (existing instrument).
4. **Company pens** (moved up from the bottom). Swatch and name
   double-click open pen settings.
5. **Interactions** log (stays: it feeds Last saw).
6. **Gift ideas key**: one wide metal key "🎁 Gift ideas for Elijah · 3".
   Opens a small milled popup with the list summary, quick add, quick
   notes, and Open list.

Notes and Dated notes leave Details. They live in the Notes tab.

**Links tab (person, later every item)**:

1. **Constellation** well (black-mirror CRT, phosphor grid): this item's orb
   in the center, linked items' orbs around it in sectors by relation
   family. Cords show direction: outgoing = solid phosphor with an
   arrowhead at the other orb; incoming = amber, arrowhead at the center;
   mutual = a twin strand. Hover a cord → "Elijah — is a member of →
   Foxtide". Click an orb → selects its ledger row. Double-click → opens it
   (guarded). Press the well → a short stir (Willpower gems verb). Reduced
   motion → static radial.
2. **Composer**, one sentence: `Elijah [is a member of ▾] [search… Foxtide]
   [Link]`. The relation box searches person relations first, then any;
   typing a new phrase offers **Create "is roommates with"** with a reverse
   phrase (or "same both ways").
3. **Ledger**: groups by relation as read from this item. Each row: orb,
   title, type plate, direction glyph (→ ← ⇄), and actions. An incoming-only
   row has **Confirm** ("add *child of Linda* here too"), which writes the
   reciprocal onto this draft so the pair becomes mutual.
4. **Suggestions** (dotted): derived edges, e.g. on Self "Oey James — is
   your friend (from Relation)". Accept pins it as a real link; Dismiss hides it.

---

## 3. Parallel map

```
Row A (independent):  0.1   2.1   3.3   4.1   5.1
Row B:                0.2   0.3   1.1   5.2   6.1
Row C:                1.2   3.1   3.2   6.2   6.3   6.4
Row D:                3.4   3.5   6.5   7.1   8.2
Row E:                8.1
Row F:                9.1
```

Two agents must not edit `ItemDetailPopup.tsx` at the same time. Steps that
touch it: 0.2, 1.2, 3.1 (slot only), 6.5, 8.1. Run those in sequence.

---

## 4. Steps

### Phase 0 — Never lose an edit (all items)

#### 0.1 Guard core: `guardAction` + live dirty check
- **Files**: `components/ui/unsaved-changes-guard.tsx`,
  `components/ItemDetail/draft/useItemDetailDraft.ts`, new test
  `components/ui/unsaved-changes-guard.test.tsx` (check if one exists first:
  `ls components/ui | grep unsaved`).
- **Do**:
  1. `isDirty: boolean | (() => boolean)`. Read it inside `requestClose` /
     `guardAction` (call it if a function). Old boolean callers unchanged.
  2. Add `guardAction(action: () => void)`: clean → run `action()` now.
     Dirty → keep `pendingRef.current = action`, open the prompt. Save →
     `await onSave()`; if not `false`, run the pending action. Discard →
     `onDiscard()` then the pending action. Stay → clear it.
     `requestClose` becomes `guardAction(forceClose)` (same behavior).
  3. In the draft hook: keep `originalRef` beside `originalTask` (write it
     in the same places `setOriginalTask` is called, including
     `commitDraft`), and expose `isDraftDirty(): boolean` =
     `!!taskRef.current && !!originalRef.current &&
     !snapshotsEqual(taskRef.current, originalRef.current)` (`snapshotsEqual`
     from `lib/unsaved-changes`). Add to the `ItemDetailDraft` interface.
- **Tests**: guard: clean action runs at once; dirty opens prompt; Save then
  action; Discard then action; Stay runs nothing; function `isDirty` is read
  at call time.
- **Done when**: tests green; no caller changed yet.
- **Handoff**: Already in the tree before this pass (commit 6579ec2's
  working set); verified, not rebuilt. `useUnsavedGuard` takes
  `isDirty: boolean | (() => boolean)` and returns `guardAction` beside
  `requestClose` (= `guardAction(forceClose)`). Draft hook keeps
  `originalRef` and exposes `isDraftDirty()`. Tests in
  `components/ui/unsaved-changes-guard.test.tsx`.

#### 0.2 Popup: guard every way out
- **Files**: `components/ItemDetail/ItemDetailPopup.tsx` (+ its test).
- **Do**:
  1. `isDirty: isDraftDirty` (function). Delete the render-time
     `snapshotsEqual` line ~320.
  2. `const openItem = useCallback((id) => guard.guardAction(() =>
     setOverrideId(id)), …)` and use it at every `setOverrideId(id)` call
     that opens another item (~571, ~967, ~1503). Discard here must reset
     the draft (`onDiscard` already does `setTask(originalTask)`; the new id
     reloads anyway).
  3. `handleNavigateToList` → `guard.guardAction(() => { onClose();
     requestNavigateToListAfterPaint(listId, folders) })`. Do not call
     `forceClose` and `onClose` both.
  4. Any later "Open list" / "Open item" buttons (3.4, 6.x) take this same
     `openItem` / `navigateToList` from props. Export nothing new; pass down.
- **Tests** (`ItemDetailPopup.test.tsx`): type in description, double-click a
  list badge → prompt shows, list not navigated; Save → saved + navigated;
  Exit without saving → not saved + navigated. Same for opening a related
  item. Clean double-click navigates with no prompt.
- **Handoff**: Already in the tree; verified. Popup ~360 `isDirty:
  isDraftDirty`; `openItem` ~371 = `guardAction(() => setOverrideId(id))`,
  used by every in-popup open; `handleNavigateToList` ~377 is guarded.
  Tests in `ItemDetailPopup.test.tsx` ("unsaved guard on every way out").

#### 0.3 Page shell + window close guard
- **Files**: `components/ItemDetail/ItemDetailPage.tsx`, maybe
  `components/ItemDetail/draft/useItemDetailUnloadGuard.ts` (new, tiny).
- **Do**:
  1. Page: `useUnsavedGuard({ open: true, onOpenChange: (o) => !o && onBack(),
     isDirty: isDraftDirty, onSave: handleSave, onDiscard })`. Back button,
     `handleNavigateToList`, `openHabitSettings`, and every `setOverrideId`
     go through `guard.guardAction`. Render `<UnsavedChangesDialog
     {...guard.prompt} />`. Do not prompt while `!isEditing` and clean.
  2. Both shells: while open, `useItemDetailSession` pins the item and
     writes the draft on `pagehide` / `beforeunload`. The browser does not
     ask to leave. The next load opens the minimized dock. Decided
     2026-10-24: a reload should keep the edit and come back parked, and a
     click on the page behind the popup does that same save-and-minimize.
     × and Back still ask.
  3. Look for other ways out while the popup is open: `grep -rn
     "COGS_NAVIGATE_TO_LIST_EVENT\|requestNavigateToList" components app lib`.
     If a global event can change room under an open dirty popup, route it
     through the popup's guard (a module-level `registerLeaveGuard(fn)` in
     `lib/unsaved-changes.ts` that `requestNavigateToListAfterPaint` consults).
     Record what you found in the handoff even if nothing needed changing.
- **Tests**: page Back with a dirty draft prompts; clean Back leaves.
- **Handoff**: Already in the tree; verified. Page ~381 has its own
  guard; Back, list badge, habit settings, and `setOverrideId` go through
  `guardAction`. `useItemDetailSession` (`useItemDetailUnloadGuard.ts`) is
  used by both shells: reload saves and the shell restores the minimized
  dock. Leave-path grep: only the two shells call
  `requestNavigateToListAfterPaint`; `COGS_NAVIGATE_TO_LIST_EVENT` is only
  heard by `app/page.tsx` ~237 and `useListsNavigation.ts` ~94, both after
  the shell already closed. **No global `registerLeaveGuard` was needed.**

### Phase 1 — Typing is instant

#### 1.1 Person fields stop re-rendering the popup
- **Files**: `components/People/person-detail.tsx`, both shells' person
  block (popup ~537, page ~576), `components/People/person-detail.test.tsx`.
- **Cause** (§1.2): controlled inputs → `setTask` per keystroke → 1.5k-line
  popup + deep compare re-render.
- **Do**:
  1. New props: `PersonDetail({ person, onChange, onLive, readDraft })`.
     `readDraft(): Task | null` is the host's `getDraft`. `onLive(patch)` is
     the host's `touchDraft` (no render).
  2. A local `ProfileText` field (in the same file) built on
     `IsolatedInput`: `onLiveChange(v)` → `onLive({ personProfile:
     presentPersonProfile({ ...readDraft()?.personProfile, [key]: v }) })`;
     `onCommit(v)` → `onChange({ personProfile: … })` with the trimmed /
     normalized value (Instagram → `normalizeInstagram`, names → trim).
     **Merge from `readDraft()`, never from the `person` prop**, or a second
     field's live keys get lost.
  3. Use it for Full name, Relation, Instagram, Address text, the nickname
     draft, and the composers inside `Log` (those are local `useState` already
     — leave them, they do not touch the draft).
  4. Date / checkbox / select fields stay as they are (one write per change).
  5. Hosts pass `onLive={touchDraft}` and `readDraft={getDraft}`.
- **Tests**: typing "Elijah" into Full name calls `onLive` 6 times and
  `onChange` 0 times; blur calls `onChange` once with the trimmed name; two
  fields typed then saved keep both values (render the popup, type, Cmd+S,
  read the store).
- **Done when**: no visible lag typing in any person field (check with React
  DevTools "Highlight updates": only the field repaints).
- **Handoff**: `PersonDetail({ person, onChange, onLive?, readDraft? })`.
  No separate `ProfileText`: the fields use `IsolatedInput` directly with
  helpers `latest()` (draft when ids match, else prop), `current()`
  (= `latest().personProfile`), `liveProfile(next)` and `attributesWith(id,
  value)`. Full name, Relation, Instagram, Address text are isolated (the
  Notes textarea was too, then 3.3 removed it). Nickname draft, Log
  composers, date / checkbox / select unchanged. Log array handlers still
  read the prop (one write per click, fine). Both hosts pass
  `onLive={touchDraft} readDraft={getDraft}`. Tests: `person-detail.test.tsx`
  ("types into a name …", 7 live calls for "Elijah " then one trimmed
  commit) and `ItemDetailPopup.test.tsx` ("keeps two person fields typed
  without blur when saved with Cmd+S"). DevTools repaint check not done
  (dev server 500s on an unrelated missing `lib/vocab/frequency/es.json`).

#### 1.2 Popup render diet
- **Files**: `components/ItemDetail/ItemDetailPopup.tsx`,
  `components/Lists/attributes/AttributeValueField.tsx` (read first ~60
  lines + grep `onChange=`), `components/ItemDetail/attributes/ItemAttributesSection.tsx`.
- **Do**:
  1. `detailView` memo deps: what `resolveDetailView` actually reads (open
     `lib/item-types.ts`, `grep -n "export function resolveDetailView" -A40`).
     Likely `task.type`, `task.lists`, maybe `attributes.sourceHabitId`. Use
     those, not `task`.
  2. Attribute string / number / long-text editors that call
     `onChangeValues` per keystroke: switch them to `IsolatedInput` /
     `IsolatedTextarea` with `onLiveChange` → a new optional
     `onLiveValues` prop that the host maps to `touchDraft({ attributes })`.
     Merge with the latest draft attributes (same rule as 1.1).
  3. `React.memo` on `PersonPipelinesEditor` and `PersonTimeTogether`
     (props stable once 1.1 lands).
- **Tests**: existing `item-attributes.test.tsx` + `attribute-editor.test.tsx`
  green; add one: typing in a string attribute does not call
  `onChangeValues` until blur, and Save keeps it.
- **Handoff**: The attribute editors were already `IsolatedInput` /
  `IsolatedTextarea` (commit on blur), so the per-key lag was not there;
  the gap was Cmd+S losing unblurred text. `AttributeValueField` gained
  `onLive` (string, number, link editors). `ItemAttributesSection` gained
  `onLiveValue(id, value)`; both shells map it to `touchDraft({ attributes:
  { ...getDraft().attributes, [id]: value } })`. Popup `detailView` memo
  keys on `task.type` + `task.lists` (`resolveDetailView` reads nothing
  else). `PersonPipelinesEditor` and `PersonTimeTogether` are `React.memo`
  with custom compares that ignore the host's `onChange` closure (it only
  writes the draft). Tests: `item-attributes.test.tsx` ("sends string keys
  live and commits once on blur"), `ItemDetailPopup.test.tsx` ("keeps a
  string attribute typed without blur when saved with Cmd+S").

### Phase 2 — Fields look finished

#### 2.1 Field padding + person field kit (CSS)
- **Files**: `components/People/person-detail.css`,
  `components/ItemDetail/chrome/item-detail-chrome.css` (~600 "Sunken white
  fields").
- **Do**:
  1. Person fields (~68 rule): `height: 32px; padding: 0 10px;
     box-sizing: border-box;` textarea `padding: 8px 10px`; date inputs keep
     the calendar glyph inside (`padding-right: 6px`). Select gets
     `padding: 0 28px 0 10px`.
  2. Detail-wide safety net for raw fields that have no padding class:
     ```css
     .id95 input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]):not([type="file"]):not(.id-title-input):not([class*="px-"]),
     .id95-dialog input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]):not([type="file"]):not(.id-title-input):not([class*="px-"]),
     .id95 textarea:not([class*="px-"]), .id95-dialog textarea:not([class*="px-"]) { padding-inline: 8px; }
     ```
     (`:where()` will not work: Tailwind preflight's `padding: 0` on
     elements would win.) Shadcn `Input` carries `px-3` so it is skipped.
  3. Person kit classes in `person-detail.css`: `.person-field` (engraved
     nameplate label: 10px small caps, letter-spacing .08em, `--id-nameplate`
     color), `.person-chipfield` (nickname chips inside a sunken field),
     `.person-key` (milled metal key, reuse `.id-btn` look), `.person-readout-strip`
     (phosphor `#7dffc4` on black, like the CRT title).
- **Check**: open a person, compare with screenshot 3: text no longer
  touches the left edge in Full name, Nickname, Relation, Instagram,
  Address, Date met, Birthday, and the Links tab search.
- **Handoff**: Person field rule ~68 is now 32px, `padding: 0 10px`,
  border-box; date `padding-right: 6px`; select `0 28px 0 10px`; textarea
  `8px 10px`; `.person-est` 32px to match. **Safety net changed from the
  plan's selector**: seven `:not()` attributes score (0,8,1) and would
  beat every component rule (it overrode the 10px person padding). It is
  now `:is(.id95, .id95-dialog) input:not(:where(…))` and
  `textarea:not(:where([class*="px-"]))`, which scores (0,1,1): above
  preflight's bare `input`, below any classed rule
  (`item-detail-chrome.css`, before the orb `filter: none` rule). Kit
  classes `.person-field`, `.person-chipfield`, `.person-key`,
  `.person-readout-strip` are at the end of `person-detail.css`, unused
  until 3.1 (`.person-key` is used by 3.3's Captured note). Visual check
  against screenshot 3 not done (dev server 500, see 1.1).

### Phase 3 — Person Details tab

#### 3.1 Person Details layout + orb well
- **Files**: `components/People/person-detail.tsx`, `person-detail.css`,
  both shells (pass slots + `onOpenItem`/`navigateToList` from 0.2).
- **Do**:
  1. Reorder to §2 "Details tab". Split the file: keep `PersonDetail` as
     the composer; move `Log` → `person-log.tsx`, `NicknameField` →
     `person-nicknames.tsx` (chips inside the field, Enter / comma adds,
     Backspace on empty removes the last), gift parts → 3.4's file.
  2. New prop `pipelines?: ReactNode`: the host passes its
     `<PersonPipelinesEditor mode="person">` here instead of rendering it after
     `PersonDetail`. PersonDetail renders it after Time together, before
     Interactions (3.5 relies on this).
  3. **Orb well**: `<button className="person-orb" data-orb>` with
     `<img src={iconFor(person.id, person.icon)}>`. Click → `OrbPickerDialog
     current={person.icon}`; `onSelect(icon)` → `onChange({ icon })` (draft;
     Save commits; `icon` is in the allowlist). Check the picker paints
     above the popup (both Radix portals: the later one stacks on top; if
     not, give it the popup's `container`). "Reset to default orb" = `onSelect(undefined)`.
  4. Close becomes a lamp key in the readout strip (same `aria-label="Close"`
     so tests still find it). Keep the `ensureGiftIdeasForPerson` call.
  5. Long help paragraphs become `title` tooltips or one muted line
     (DESIGN_STYLE: no UI text telling the person what to do).
- **Tests**: update `person-detail.test.tsx` for the new order only where it
  asserts order; add: orb click opens picker, pick writes `icon` on the
  draft.
- **Handoff**: Built as §2. New props `pipelines?: ReactNode` and
  `onNavigateToList?(listId)`; both shells pass the person-mode
  `PersonPipelinesEditor` in the slot and their guarded
  `handleNavigateToList`. **3.4: the Open list key already exists** on
  `GiftIdeasList` (`onOpenList`); reuse it in the dialog. Split:
  `person-log.tsx`, `person-nicknames.tsx` (Enter / comma adds, Backspace on
  empty removes the last, blur adds; still `aria-label="Nickname"` and an
  "Add nickname" + key), `person-gift-ideas.tsx` (moved as is; help lines
  became `title`s). Orb well `.person-orb[data-orb]` (76px velvet, 64px
  orb) → `OrbPickerDialog`; pick or Reset → `onChange({ icon })`. Close is
  a `role="switch"` lamp in the readout strip (`aria-label="Close"`), still
  calls `ensureGiftIdeasForPerson`. Help paragraphs for Close / Last saw are
  `title`s; Time together kept its own lines. Instagram has an `@` and an
  open-profile link. Precision change keeps address coords. No existing
  test asserted order; added three (order, nickname keys, orb pick).
  Checked in the app: **the picker did not stack above the popup** when
  portaled to `body` (both z 50, popup won). `OrbPickerDialog` gained
  `container?`; `PersonDetail` passes the nearest `[role="dialog"]` from the
  click (pattern from `PointAllocationField.tsx`). Also in the app: the
  house button chrome (`body.win95-app button…`) painted over the orb well,
  so it carries `data-no95`; the house field ring (0,6,2) boxed the nickname
  input, so `.person-chip-input` has a `body.win95-app …` rule; `.person-est`
  lost to `.person-detail label` and is now `.person-detail .person-est`.

#### 3.2 Address autocomplete
- **Files**: new `components/ui/address-suggest-input.tsx`,
  `lib/person-profile.ts`, `components/People/person-detail.tsx`.
- **Do**:
  1. `PersonAddress` gains optional `lat`, `lng`, `parts?: AddressParts`,
     `source?`. **Add them to `assembleProfile`** (keep numbers finite,
     parts as plain strings). Update `lib/person-profile` tests.
  2. `AddressSuggestInput({ value, onLive, onCommit, onPick, near?,
     precision })`: built on `IsolatedInput`; 300ms debounce, 3+ chars,
     `searchAddresses`; listbox with ↑ ↓ Enter Esc; cancel stale requests
     (pattern in `pen-place-editor.tsx` ~50). On pick → `withParts` →
     `onPick(full)`. Offline / empty: plain text still saves.
  3. Precision rule on pick: mailing → `label`; neighborhood →
     `parts.neighborhood, parts.city`; state → `parts.state, parts.country`;
     country → `parts.country`. Store the coordinates either way.
  4. A small pin glyph after the field when `lat/lng` exist; click opens
     `https://www.openstreetmap.org/?mlat=…&mlon=…` in a new tab. (A Leaflet
     mini-map is possible — `react-leaflet` is installed, see
     `components/Modules/workspace/itinerary/TripMapCanvas.tsx` — but only if
     it stays light; note the choice in the handoff.)
- **Tests**: mock `@/lib/geo-address`; typing shows suggestions; pick
  stores label + coords; neighborhood precision stores the neighborhood
  line; `assembleProfile` keeps coords.
- **Handoff**: `components/ui/address-suggest-input.tsx`
  `AddressSuggestInput({ value, onLive, onCommit, onPick, near? })` (+
  `.css`). **Not built on `IsolatedInput`**: that field ignores a new value
  while focused, and a pick must replace the typed text in place. Same
  contract otherwise (local text, `onLive` per key, commit on blur / Enter
  when changed). `onPick(full)` returns the text to show; a blur right
  after a pick does not re-commit. Option mousedown keeps focus. Pure
  `addressTextForPick(pick, precision)` and `cleanAddress` in
  `lib/person-profile.ts` (finite coords, known part keys only, source
  photon / google). Typing after a pick drops the coords (text no longer
  matches). Pin: inline SVG link to openstreetmap.org; **no Leaflet**, to
  keep the Details tab light. Escape closes the list but the popup's Radix
  escape listener may also see it (not handled). Tests:
  `components/ui/address-suggest-input.test.tsx` (4),
  `lib/person-profile.test.ts` (2 new).

#### 3.3 Notes leave Details (migration v19)
- **Files**: `lib/task-store.ts` (`TASK_STORE_PERSIST_VERSION` 18 → 19 +
  migrate branch), new pure `lib/person-notes-fold.ts` (+ test),
  `components/People/person-detail.tsx` (remove Notes textarea + Dated
  notes `Log`), both shells' Notes tab.
- **Data decision**:
  - Dated notes: `foldPersonNoteLog(task)` moves `personProfile.noteLog`
    into `task.noteLog` (same shape; skip ids already there; keep newest
    first) and deletes `personProfile.noteLog`. Run it in the v19 migrate
    for every task, and also in the person Notes tab on load (idempotent)
    so hub / backup imports in the old shape still fold.
  - Standing note: stays the `notes` **attribute** (the People list column
    reads it). In the Notes tab, for a person, `ItemNotesLog` gets
    `standing={attributes.notes}` and writes `attributes.notes`. If the
    person also has `task.notes` text (ingest), show it as a second pinned
    "Captured" note with a **Move into standing note** key. Nothing is
    deleted.
  - `PersonDatedNote` type stays (old snapshots); mark it deprecated.
- **Tests**: fold is idempotent, dedupes, keeps order; migrate v18 → v19
  fixture; Details no longer shows "Notes" / "Dated notes"; Notes tab shows
  the folded entries and the standing attribute.
- **Handoff**: `lib/person-notes-fold.ts`: `foldPersonNoteLog(task)`
  (same object back when nothing to fold), `hasPersonNoteLog`,
  `migratePersonNoteLogs(state)`. `TASK_STORE_PERSIST_VERSION` 19 (migrate
  branch after v18). New `components/People/person-notes.tsx`
  `PersonNotes({ person, onChange, onLive?, readDraft? })`: both shells'
  Notes tab render it when `itemShowsPersonPipelines`. **The on-load fold is
  display-only**: entries show folded, and the fold is written on the first
  notes edit, so opening the tab never dirties the item. Standing note
  writes `attributes.notes`; `task.notes` shows as "Captured" with
  **Move into standing note** (appends, then clears `task.notes`). Notes
  tab count in both shells counts folded entries. Details lost Notes and
  Dated notes. Updated tests: `person-detail.test.tsx` (first test now
  asserts Notes is gone; the dated-note lines were dropped from the log
  test), `task-store.item-record.test.ts` (version 18 → 19). New:
  `lib/person-notes-fold.test.ts`, `components/People/person-notes.test.tsx`.
  `PersonDatedNote` was not marked deprecated in code yet (cleanPersonProfile
  still reads it); do it in 9.1.

#### 3.4 Gift ideas key + popup; rename-safe list
- **Files**: new `components/People/detail/person-gift-ideas.tsx` (key + dialog),
  `lib/gift-ideas.ts` (+ test), `lib/types.ts` (`List.giftIdeasAutoName?`).
- **Do**:
  1. **Rename-safe**: when writing the auto title, also write
     `giftIdeasAutoName = title`. `renameGiftIdeasList` and the existing-list
     branch of `ensureGiftIdeasForPerson` rename only when `list.name ===
     list.giftIdeasAutoName`, or (legacy, no `giftIdeasAutoName`) when
     `list.name` starts with "Gift ideas for ". The id link
     (`giftIdeasPersonId`) is unchanged. Check `updateList` keeps unknown
     list fields (lib/README says it preserves `linkedTargetListIds`; verify
     it spreads).
  2. **Key** (in Details, last): `🎁 {list.name} · {n}`. No list: key reads
     "Start gift ideas" and calls `ensureGiftIdeasForPerson` (does not turn on
     Close).
  3. **Dialog** (`.id95-dialog` small, CRT title = list name): item rows
     (title, done strike), quick add (`addGiftIdeaOnList`), "Quick notes" =
     the old `GiftLog` (`personProfile.giftIdeas`, via `onChange`, so Save
     covers them), foot keys **Rename** (inline field → `updateList`),
     **Open list** → the guarded `navigateToList(list.id)` from 0.2 (closes
     the dialog first).
- **Tests**: user rename survives `ensureCloseGiftIdeas()` and a person
  rename; auto name still follows a person rename; key opens dialog; quick
  add puts an item on the list.
- **Handoff**: Done: `List.giftIdeasAutoName` and `giftIdeasNameIsAuto` in `lib/gift-ideas.ts` (tests: a hand rename survives hydrate and person renames). **Not done:** the key and popup (`person-gift-ideas.tsx`). Note: when the item popup is `stackAbove` it is `z-[80]`; give any dialog opened from it `z-[90]` (`OrbPickerDialog` now takes `className` for this).

#### 3.5 Company pen double-click + move up
- **Files**: `components/People/person-pipelines.tsx` (row ~95),
  `person-pipelines.test.tsx`.
- **Do**: on the swatch and the label of a `company-pen` row:
  `onDoubleClick={penColorDoubleClick(COMPANY_SCOPE_ID, pipeline.penId)}`,
  `title={PEN_COLOR_OPEN_TITLE}`, `cursor: pointer`. Timeblock rows: the
  block's pen. Position already moved by 3.1 (slot). Check the pen dialog
  stacks above the item popup and that closing it returns focus to the popup.
- **Tests**: double-click calls `openPenSettings("company", penId)` (spy on
  the module).
- **Handoff**: Done in `person-pipelines.tsx` (all modes; `data-opens-pen`), test in `person-pipelines.test.tsx`. Pen settings is a separate Radix dialog mounted later, so it stacks above a normal item popup. Moving the section up waits on the 3.1 `pipelines` slot.

### Phase 4 — Self

#### 4.1 Auto-create "self"
- **Files**: new `lib/people-self.ts` (+ test), `hooks/use-people-i-know.ts`,
  `lib/person-profile.ts` (`self?: true`, kept in `assembleProfile`).
- **Do**: `PEOPLE_SELF_ID = "person-self"`. `ensureSelfPerson()` after
  `ensurePeopleIKnowList()`: skip if a task has that id or
  `personProfile.self`, or the id is in `removedTaskIds`, or the one-time
  flag `brain2-people-self-v1` is set. Else `addTask({ ...createPerson("self",
  listId), id: PEOPLE_SELF_ID, personProfile: { nicknames: ["me"], self: true } })`
  and set the flag. Deleting Self is allowed and sticks. `isSelfPerson(task)`
  helper for 7.1. Check `lib/people-sync.ts` does not try to pair "self" with
  a pen (it matches by name; add an exclusion if needed).
- **Tests**: created once; not recreated after delete; not duplicated when a
  hub merge brings it back with the same id.
- **Handoff**: `lib/people-self.ts`: `PEOPLE_SELF_ID`, `PEOPLE_SELF_FLAG`
  (`persistKey("people-self-v1")`, so Demo gets its own), `isSelfPerson(task)`
  (id or `personProfile.self`), `ensureSelfPerson()` → id or null. Called in
  `hooks/use-people-i-know.ts` after `ensurePeopleIKnowList()`.
  `PersonProfile.self?: true` is kept by `assembleProfile`. People sync only
  goes pen → item, so Self never makes a Company pen; no exclusion added. A
  Company pen literally named "self" would join it by name (not handled).

### Phase 5 — Relation vocabulary

#### 5.1 Relation vocabulary: registry + store
- **Files**: `lib/links.ts`, new `lib/relation-registry.ts` (+ test),
  `lib/item-type-store.ts`, `lib/types.ts`.
- **Do**:
  1. Extend `RelationDef` (optional fields only): `fromTypes?: string[]`,
     `toTypes?: string[]` (absent = any), `family?: "family" | "friend" |
     "romance" | "work" | "group" | "place" | "task" | "evidence" | "other"`,
     `custom?: true`, `archived?: true`, `createdAt?: string`.
  2. `relation-registry.ts`: module map seeded from `RELATIONS` (+ 5.2
     seeds); `registerCustomRelations(defs)`; `getRelationDef(id)`;
     `allRelations()`; `relationsFor(fromType, toType?)` (scoped first, then
     any; archived hidden); `createRelationPair({ label, inverseLabel?,
     symmetric, fromTypes?, toTypes? })` → one def (symmetric) or two that
     point at each other, ids `rel-${slug}-${rand4}`.
  3. `links.ts`: `inverseRelation` and `relationLabel` read
     `getRelationDef` (built-in results unchanged; unknown still symmetric /
     raw). Add `inverseRelationLabel(id)`. Keep `RELATIONS` and every other
     export exactly as they are.
  4. `item-type-store`: add `relations: RelationDef[]` (default `[]`),
     `addRelations`, `updateRelation`, `archiveRelation`. No version bump
     needed (new field defaults). If you do bump, carry `relations` in
     `migrateItemTypeState`. On rehydrate and on every change →
     `registerCustomRelations`. Archive instead of delete so old links keep
     a label.
  5. Check `lib/mobile-sync.ts` for how item types travel to the phone; if
     types sync, relations ride along in the same blob.
- **Tests**: existing `lib/links*.test.ts` green unchanged; custom label and
  inverse read through `relationLabel` / `inverseRelation`; symmetric pair;
  scoped `relationsFor("person","band")`.
- **Handoff**: `RelationDef` (in `lib/links.ts`, not `lib/types.ts`) gained
  `fromTypes`, `toTypes`, `family` (`RelationFamily`), `custom`, `archived`,
  `createdAt`. `lib/relation-registry.ts`: `registerSeedRelations` (for
  5.2), `registerCustomRelations`, `getRelationDef`, `allRelations`,
  `relationsFor(fromType, toType?)`, `createRelationPair(input, now?)`.
  Built-ins always win over a custom def with the same id. The built-in
  map is built lazily because `links.ts` ↔ registry import each other.
  `links.ts`: `relationLabel` / `inverseRelation` fall back to the
  registry; new `inverseRelationLabel`. `isKnownRelation` still means
  built-in only. `useItemTypeStore`: `relations`, `addRelations`,
  `updateRelation`, `archiveRelation`; no version bump; rehydrate cleans
  and registers; a store `subscribe` re-registers on change (covers backup
  restore). `mobile-sync` does not carry item types, so relations stay on
  this device (backup carries them). `lib/item-type-store.test.ts`
  "rehydrates a version-mismatched snapshot" fails **at HEAD too**
  (reads a `cogs-` key); not caused here.

#### 5.2 Person relation seeds
- **Files**: new `lib/person-relations.ts` (+ test), registered in
  `relation-registry.ts`.
- **Seeds** (code, re-seeded like system types; `fromTypes: ["person"]`):
  friends-with ⇄ (sym, friend) · knows ⇄ (sym) · best-friends-with ⇄ ·
  partner-of ⇄ · married-to ⇄ · dating ⇄ · ex-of ⇄ (romance) ·
  parent-of ↔ child-of · mother-of → child-of · father-of → child-of ·
  sibling-of ⇄ · cousin-of ⇄ · grandparent-of ↔ grandchild-of ·
  aunt-uncle-of ↔ niece-nephew-of (family) · roommate-of ⇄ ·
  neighbor-of ⇄ (place) · lives-in ↔ home-of (toTypes any place) ·
  works-with ⇄ · manager-of ↔ reports-to · mentor-of ↔ mentee-of ·
  works-at ↔ employs (work) · member-of ↔ has-member · fan-of ↔ has-fan
  (group, toTypes any) · met-through ↔ introduced.
  Labels read as sentences: "is friends with", "is a member of", "has
  member", "is the mother of", "is the child of".
  Many-to-one inverses are fine (`mother-of` → `child-of`, while `child-of`
  → `parent-of`).
- Also export `RELATION_WORDS`: map a Relation field word to a seed from
  **self's** side: friend → friends-with; best friend; sister / brother /
  sibling → sibling-of; mom / mother → (person mother-of self); dad / father;
  boyfriend / girlfriend / partner → partner-of; husband / wife →
  married-to; coworker → works-with; roommate; cousin; neighbor; boss →
  (person manager-of self); ex. Lowercase, trims, plural-tolerant.
- **Tests**: every seed's inverse exists; every word maps.
- **Handoff**: `lib/person-relations.ts`: `PERSON_RELATIONS` (all seeds in
  the list above, with `family`; person ↔ person scoped, `lives-in`,
  `works-at`, `member-of`, `fan-of` go from a person to any type),
  `RELATION_WORDS` (word → `{ relation, personRelation }`: `relation` is
  Self's link toward P, `personRelation` the same edge from P's side; mom →
  Self `child-of` P, P `mother-of` Self), `relationWord(raw)` (lowercase,
  trims, `-ies` / `-es` / `-s`, joins "co-worker"), `RELATION_WORD_KEYS`
  (for 7.1's datalist). Extra words beyond the plan: bestie, parent, son,
  daughter, child, spouse, colleague, manager, mentor, grandma, grandpa,
  grandparent, aunt, uncle. The registry seeds them at module load
  (`seeds = [...PERSON_RELATIONS]`), so `relationLabel("member-of")` works
  with no setup. `relation-registry.test.ts` scoped-order test changed:
  person seeds are scoped too, so it checks `rel-plays-in` comes before
  `blocks` instead of index 0.

### Phase 6 — Rich Links tab

> Next: [`LINKS_REDESIGN.md`](LINKS_REDESIGN.md) builds on this phase
> (vocabulary v2, rules, densify, inbox). It also renames the Constellation
> to the radial plate in UI copy and drops the amber hues (§13 there).

New folder `components/ItemDetail/tabs/links/` with its own `rich-links.css`.
Everything here is used by people first (6.5) and by every item in 8.1, so
nothing in it may import from `components/People/`.

#### 6.1 `lib/link-graph.ts` (pure ego graph)
- **API**:
  ```ts
  type EdgeDirection = "out" | "in" | "mutual" | "derived"
  interface EgoEdge {
    key: string            // `${otherId}|${canonicalRelation}`
    otherId: string
    relation: string       // as read from THIS item
    direction: EdgeDirection
    outLinkId?: string     // on this item's draft
    inLink?: { sourceId: string; linkId: string; relation: string }
    family: string
    derivedFrom?: string   // e.g. "relation-field"
  }
  egoEdges(item: Task, all: Task[], derived?: EgoEdge[]): EgoEdge[]
  secondRing(edges, all, limit): { from: string; edge: EgoEdge }[]
  ```
- **Rules**: outgoing read as `link.relation`. Incoming from X with
  relation S read as `inverseRelation(S)`. If an outgoing R to X exists and
  an incoming reads as R from the same X → one `mutual` edge.
  `canonicalRelation = min(R, inverse(R))`. Out links come from the draft
  (`item.links`); incoming from the store tasks (saved state; skip
  `item.id` in `all`). Derived edges drop when a real edge has the same key.
- **Perf**: one pass over `all`. If `lib/task-index.ts` already keeps a
  backlink index, use it (check its exports first) instead of scanning.
- **Tests**: out, in, mutual merge, symmetric relation merge, derived
  dropped by a real edge, custom relation via registry.
- **Handoff**: `lib/link-graph.ts`: types `EdgeDirection`, `EgoEdge` (plus
  optional `label` for a derived edge with no seed, for 7.1's "your
  *coach*"), `egoEdges`, `secondRing(edges, all, limit, centerId?)` (the 4th
  arg is new: pass it so the center never shows on ring 2),
  `canonicalRelation`, `edgeKey`, `relationFamily` (seed / custom `family`,
  else evidence for evidence relations, task for other built-ins, other for
  `related` and unknown / custom). Backlinks come from
  `taskIndexOf(all).backlinks` (cached by array identity). Mutual merge is
  by canonical key, so `mother-of` + `child-of` merges (relation kept as
  the outgoing one). Two outgoing links with the same key both stay (the
  second key gets `#linkId`). Tests: `lib/link-graph.test.ts` (9).

#### 6.2 Link composer
- **Files**: `components/ItemDetail/tabs/links/LinkComposer.tsx`,
  `RelationCombobox.tsx`, `LinkTargetSearch.tsx`, `NewRelationForm.tsx`.
- **Do**: the sentence row from §2. `RelationCombobox`: popover with search;
  sections "For {type}" (`relationsFor(fromType, targetType)`), "Any",
  "Yours" (custom); last row **Create "{typed}"** → `NewRelationForm`
  inline: phrase, reverse phrase (prefilled by a tiny heuristic: "is a
  member of" → "has member"; editable), **Same both ways** switch, from type
  (default this item's type) and to type (default any). Create →
  `addRelations(createRelationPair(…))` (store write — vocabulary, not item
  data, so it is immediate; say so in the handoff). `LinkTargetSearch`:
  typeahead with orb 20px + title + type plate + first list name; filter by
  `toTypes` when the relation is scoped; excludes self and existing
  pairs; Enter picks. Emits `onAdd(relation, targetId)` → host `addLink`
  (draft).
- **Tests**: create a custom relation and link in one flow; scoped relation
  filters targets; duplicate pair is refused (no-op, row flashes).
- **Handoff**: `LinkComposer.tsx` holds the relation combobox and `NewRelationForm`; `LinkTargetSearch.tsx` matches title, full name, nicknames, description, and offers "New person" when the relation points at people. Type of an item: `itemLinkTypeId(item, lists)` in `lib/item-types.ts`.

#### 6.3 Link ledger
- **Files**: `components/ItemDetail/tabs/links/LinkLedger.tsx`.
- **Do**: groups by `edge.relation` label; rows per §2. Actions:
  out/mutual → Remove (`removeLink(outLinkId)`, draft). In-only →
  **Confirm** (`addLink(edge.relation, otherId)` → becomes mutual on Save) and
  **Open {name}** (guarded `openItem`). Derived → **Pin** (addLink) and
  **Dismiss** (stores key in `Task.dismissedLinkSuggestions?: string[]`;
  add the field to `lib/types.ts` and to `TASK_FIELDS` in
  `lib/commit-item-edit.ts`). Empty state: one muted line.
- **Tests**: confirm turns an in row into mutual in the draft; remove only
  removes own link; dismiss hides a derived row and survives Save.
- **Handoff**: `Task.dismissedLinkSuggestions` added to `lib/types.ts` and `TASK_FIELDS`.

#### 6.4 Constellation view
- **Files**: `components/ItemDetail/tabs/links/LinkConstellation.tsx`,
  `lib/link-constellation-layout.ts` (+ test).
- **Layout** (pure, testable): center at (W/2, H/2). Families get angular
  sectors sized by edge count, in a fixed family order so the picture is
  stable between opens. Nodes in a sector spread on ring 1 (r = 38% of
  min(W,H)); more than ~10 in a sector → a second radius. Optional ring 2
  (second-degree, 8px faint orbs) behind a "Show their links" toggle.
- **Paint**: SVG cords under absolutely positioned orb `<img data-orb>`
  (orbs keep their photographed look, no filters). Family hues (CSS vars in
  `rich-links.css`): friend `#7dffc4` (phosphor), family `#ffb3c7`, romance
  `#ff7ab8`, work `#8ab4ff`, group `#c9a7ff`, place `#ffcf7a`, task / other
  silver `#c8ccd2`. Out: solid, arrowhead at the other end. In: amber-tinted
  `#ffcf7a` at 70% with the arrowhead at the center. Mutual: two parallel
  strands 2px apart. Derived: dotted. Relation label at the cord midpoint on
  hover / focus, and always when ≤ 6 edges.
- **Motion** (verbs only): on open, orbs ease out from the center over
  ~420ms. Press the well → stir: run `stepGravity` on the ring-1 bodies for
  ~1.2s with springs to their layout slots (reuse
  `list-icon-gravity.ts`; bounds = well size), then settle back. Grab an orb
  to fling it; it springs home. `prefersGravityReducedMotion()` → no
  motion, final positions. Pause the rAF loop when the tab is hidden
  (pattern in `willpower-gems.tsx`).
- **A11y**: each orb is a button with `aria-label="{title}, {relation},
  {direction}"`; arrow keys walk the ring; Enter selects; the ledger is the
  full-text twin.
- **Tests**: layout is deterministic for a fixed edge set; sectors don't
  overlap; reduced motion renders final positions.
- **Handoff**: Changed from the plan: incoming cords use the family color, dashed and flowing toward the center (not amber). Motion is a small spring integrator in the component (entrance, stir, grab-and-fling), not the Lists gravity stepper, because the slots are fixed. Layout: `lib/link-constellation-layout.ts` (tests).

#### 6.5 `RichLinksPanel` wired into popup for people
- **Files**: `components/ItemDetail/tabs/links/RichLinksPanel.tsx`,
  `components/ItemDetail/ItemDetailPopup.tsx` (Links tab ~961, tab key ~502),
  new `usesRichLinks(task, lists, itemTypes)` in `lib/item-types.ts` (true
  for `itemShowsPersonPipelines` or a list whose `itemTypeId` is person; 8.1
  flips it to always true).
- **Do**: panel = Constellation (top, ~260px tall in the popup) → Composer →
  Suggestions (derived rows, 7.1) → Ledger. Props: `task` (draft),
  `allTasks`, `fromTypeId`, `addLink`, `removeLink`, `writeDraft`, `openItem`
  (guarded, 0.2). Links tab key shows the edge count (phosphor count like
  Notes). Legacy `LinkPicker` + `RelatedItemsPanel` stay for non-person items
  until 8.1.
- **Tests**: popup for a person shows the rich panel; a task still shows the
  old one; adding a link then Save writes `task.links`; open linked item
  with a dirty draft prompts.
- **Handoff**: `useItemEdges(task)` is exported for the tab count. Styles: `components/ItemDetail/tabs/links/rich-links.css` (container query narrows the composer in the page rail).

### Phase 7 — Self knows everyone

#### 7.1 Self auto-populate from Relation words
- **Files**: new `lib/self-relations.ts` (+ test), `RichLinksPanel`
  (pass `derived`).
- **Do**: `derivedSelfEdges(item, all)`. On **Self**: for every person P with
  `personProfile.relation` that maps through `RELATION_WORDS`, one derived
  edge Self → P read from Self's side (e.g. sister → "is the sibling of
  Oey"; mom → "is the child of Linda"). Unknown words → a derived edge with
  relation `knows` and the word as its label ("Elijah — your *coach*"). On
  **P**: the mirror ("is Self's friend"). Derived edges are computed live,
  never stored, so editing Relation updates them. **Pin** stores a real link
  (6.3). The Relation field datalist on Details gets the `RELATION_WORDS`
  keys.
- **Tests**: words map both sides; a pinned edge replaces its derived twin;
  no Self item → no derived edges.
- **Handoff**: Done: `derivedSelfEdges(item, all, dismissed)`; unknown words read "knows · {word}". **Not done:** the Relation field datalist from `RELATION_WORDS` (part of 3.1).

### Phase 8 — Every item

#### 8.1 Rich links for every item (popup + page)
- **Files**: `lib/item-types.ts` (`usesRichLinks` → true), popup Links tab,
  page "Related" card ~885 (composer only while `isEditing`; ledger and
  constellation always), `LinkPicker.tsx` / `RelatedItemsPanel.tsx`.
- **Do**: the relation combobox for non-person items lists the built-in task
  relations first (blocks, supports, …) — behavior of existing links is
  unchanged. Once no caller imports `LinkPicker` / `RelatedItemsPanel`,
  delete them and their README rows, or keep them if another room imports
  them (`grep -rn "LinkPicker\|RelatedItemsPanel" components`).
- **Tests**: the old popup link tests ported to the new panel; belief /
  objective tests untouched and green.
- **Handoff**: Done in the same change as 6.5. `LinkPicker.tsx` and `RelatedItemsPanel.tsx` are deleted; their tests moved to `RichLinksPanel` in `ItemDetail.test.tsx`.

#### 8.2 Orb well for every item (fascia)
- **Files**: both shells' fascia, `item-detail-chrome.css`.
- **Do**: a 28px orb at the left of the CRT title (same picker as 3.1). For
  people the big Details orb stays; the fascia orb is the same value.
- **Handoff**: _(fill in)_

### Phase 9 — Docs

#### 9.1 Docs sweep + screenshots
- Update `components/ItemDetail/README.md` (guard, rich links, folder
  `links/`), `components/People/README.md` (layout, notes moved, gift popup,
  rename rule, self, relation words), `lib/README.md` (relation registry,
  `relations` on item-type-store, persist v19, `person-notes-fold`,
  `people-self`, `link-graph`). Each changed section gets `_Last mapped:
  YYYY-MM-DD_`. Mark this plan **Shipped** at the top, keep the reasoning.
- Screenshots of Details and Links for a person and a task are a gallery
  sync, not a full recapture. `BRAIN2_ONLY` for the item-detail shots the
  manifest lists (`.cursor/rules/doc-sync.mdc`).
- Run DESIGN_STYLE "Checklist before shipping UI".

---

## 5. Decisions made (do not re-litigate)

- Relations live in `item-type-store` (vocabulary next to types; already
  backed up). Not a new persist key.
- Links stay stored on the source only. Reciprocal = a second real link
  the person confirms, not an automatic mirror write onto another item.
- Self's links from the Relation field are derived, not stored, until
  pinned.
- The standing person note stays the `notes` attribute (People list
  column). Dated notes fold into `task.noteLog`.
- Gift ideas list stays tied by `giftIdeasPersonId`; its name follows the
  person only while it still has the auto name.
- Creating a relation type writes the store at once; adding, removing and
  confirming links are draft edits covered by Save and the guard.

## 6. Open questions (answer in a handoff if you hit them)

- Does the pen settings dialog stack above the item popup? (3.5)
- Does a hub / phone merge bring `personProfile.noteLog` back after v19?
  (3.3: the on-load fold covers it either way.)
- Is there a "Band" item type in the vault, or should 5.2 seed a Group
  catalog type? (Default: no new type; `member-of` targets any type.)

## 7. Handoff log

_Append one line per finished step: `YYYY-MM-DD · step · who · one-line
result`._

2026-10-16 · 0.1 · Claude · Guard core was already in the tree; verified (44 tests green).
2026-10-16 · 0.2 · Claude · Popup already guards every way out; verified.
2026-10-16 · 0.3 · Claude · Page guard + unload hook already in; leave-path grep found no global route, no `registerLeaveGuard`.
2026-10-16 · 1.1 · Claude · Person text fields isolated (`onLive` / `readDraft`); typing no longer re-renders the popup.
2026-10-16 · 2.1 · Claude · Person fields padded 32px / 10px; low-specificity `.id95` padding net; person kit classes.
2026-10-16 · 5.1 · Claude · `lib/relation-registry.ts` + `relations` on item-type-store; links read custom labels.
2026-10-16 · 4.1 · Claude · `lib/people-self.ts`: Self created once, deletion sticks.
2026-10-16 · 3.3 · Claude · Persist v19 folds person dated notes into `noteLog`; `PersonNotes` owns the person Notes tab.
2026-10-16 · 5.2 · Claude · `lib/person-relations.ts`: person seeds registered from the start, `RELATION_WORDS` / `relationWord`.
2026-10-16 · 6.1 · Claude · `lib/link-graph.ts`: `egoEdges` (out / in / mutual / derived) over the task-index backlinks, `secondRing`.
2026-10-16 · 1.2 · Claude · `detailView` keyed on type + lists; live attribute keys survive Cmd+S; person instruments memoized.
2026-10-16 · 3.1 · Claude · Person Details reads as §2: orb well, readout strip with Close lamp, 2-column grid, pens slot; file split.
2026-10-16 · 3.2 · Claude · `AddressSuggestInput` + address coords / parts in the profile; OSM pin link.
