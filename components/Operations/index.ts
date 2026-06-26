/**
 * components/Operations/index.ts — Operations feature barrel (Worker B)
 *
 * The integration surface for Feature 2 (Operations / directed enterprises):
 *   - `OperationWorkspace` — mount with an `operationId` from a top-level
 *     Operations entry or when opening an operation-typed item.
 *   - `upgradeTaskToOperation(taskId)` — promote an existing task; wire into the
 *     item-detail "⋯" menu.
 *   - `withOperationType()` — register the built-in `operation` type (re-exported
 *     from `lib/operation-types` for convenience).
 */
export { OperationWorkspace, default as OperationWorkspaceDefault } from "./OperationWorkspace"
export { OperationHome } from "./OperationHome"
export { PhasesPanel } from "./PhasesPanel"
export { ToDoNextRail } from "./ToDoNextRail"
export { ResourcesPanel } from "./ResourcesPanel"
export { OperationLogFeed } from "./OperationLogFeed"
export { OperationPostMortemDialog } from "./OperationPostMortemDialog"
export {
  upgradeTaskToOperation,
  createOperation,
  addPhase,
  addPart,
  addResource,
  linkChild,
  unlinkChild,
  logTime,
  setStage,
  setHomeNotes,
  setMission,
  renameOperation,
  saveOperationPostMortem,
} from "./operation-actions"

export {
  withOperationType,
  getOperationTypeDefinition,
  OPERATION_TYPE_ID,
  OPERATION_ATTR,
  OPERATION_STAGES,
  type OperationStage,
} from "@/lib/operation-types"
