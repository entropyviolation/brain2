# Operations — directed enterprises (Feature 2, Worker B)

An **Operation** is a *directed enterprise*: a long-running project broken into
**phases**, with a **home/notes pad**, a **work/neglect heatmap**, a running
**log**, a **to-do-next** rail, attached **resources**, and an op **post-mortem**
(Brain2 #201/#202–213/#276/#277).

An Operation is just a `Task` carrying `type: "operation"`. Its phases, parts,
and resources are *other* tasks linked through the typed relations added upfront
in `lib/links.ts`:

| Relation (operation → child) | Inverse (child → operation) | Meaning |
|------------------------------|-----------------------------|---------|
| `has-phase`                  | `phase-of`                  | a phase of the operation |
| `has-part`                   | `part-of`                   | a step/sub-task of an operation or phase |
| `has-resource`               | `resource-of`               | a reference/asset/contact |

Resolution reads **both** link directions (see `getRelatedChildren` in
`lib/operations.ts`), so a child linked either way is discovered.

## Files

| File | Role |
|------|------|
| `lib/operation-types.ts` *(lib)* | `operation` `ItemTypeDefinition` + `withOperationType()` |
| `lib/operations.ts` *(lib)* | pure helpers (hours rollup, phase completion, heatmap, to-do-next, relation resolution) |
| `OperationWorkspace.tsx` | full-screen mini-app; mount with `operationId` |
| `OperationHome.tsx` | mission, stage, progress, notes pad, work/neglect heatmap |
| `PhasesPanel.tsx` | phases + their parts, inline add/complete/detach |
| `ToDoNextRail.tsx` | ranked next-actionable tasks across the tree |
| `ResourcesPanel.tsx` | attached resource items |
| `OperationLogFeed.tsx` | time-log feed + quick "log time" form |
| `OperationPostMortemDialog.tsx` | op retrospective → `addOperationReview` |
| `operation-actions.ts` | imperative store mutations (calls `updateTask`/`addTask` + link helpers) |
| `index.ts` | integration barrel |

## Pure helpers (`lib/operations.ts`)

- `loggedMinutes` / `rollupMinutes` / `rollupHours` — hours rollup over `Task.timeLogs`.
- `getPhases` / `getParts` / `getResources` / `getOperationTaskTree` — relation resolution (both directions).
- `evaluatePhase` / `operationProgress` — phase-completion evaluation.
- `buildHeatmap` / `heatLevel` / `neglectedDays` — work/neglect heatmap cells.
- `selectToDoNext` — next-actionable selector (incomplete, dependency-satisfied, ranked).

Tested in `lib/operations.test.ts` — run `npm test -- lib/operations.test.ts`.

## Exports for integration

- `withOperationType(types)` — register the built-in `operation` type.
- `OperationWorkspace` — mount from a top-level Operations entry / list-item open.
- `upgradeTaskToOperation(taskId)` — promote an existing task; wire into the item "⋯" menu.

## Integration wiring needed (coordinator)

1. **Register the type:** call `withOperationType()` in `lib/item-types.ts`
   (built-in registry) or seed via `item-type-store`. The type ships
   `builtin: true`, so it is re-seeded on hydrate.
2. **Entry point:** add an Operations entry (top-level tab or list-item open
   target) that renders `<OperationWorkspace operationId={...} onBack={...} onOpenItem={...} />`.
3. **"⋯" menu:** wire `upgradeTaskToOperation(taskId)` into the item-detail
   overflow menu, then open the workspace for that id.
4. **Post-mortem dependency (B → G):** the post-mortem persists via the
   reviews-store `addOperationReview` action **added by Worker G**. It is called
   defensively through `saveOperationPostMortem`; if the action is missing the
   dialog shows a non-blocking notice and does not throw. No action is needed
   once G's store is present (it already defines `addOperationReview` /
   `OperationReview`).
