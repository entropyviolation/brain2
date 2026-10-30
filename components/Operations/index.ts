/**
 * components/Operations/index.ts — Operations feature barrel
 *
 * The integration surface for Operations (a graphic tool for a project):
 *   - `OperationsView` — the home board (categories, filters, presets).
 *   - `OperationWorkspace` — mount with an `operationId`; its tab strip comes
 *     from the panels that operation has switched on.
 *   - `OperationSettingsDialog` — per-operation panels / categories / identity.
 *   - `upgradeTaskToOperation(taskId)` — promote an existing task; wired into the
 *     item-detail "⋯" menu.
 *   - `withOperationType()` — register the built-in `operation` type (re-exported
 *     from `lib/operation-types` for convenience).
 */
export { OperationsView, default as OperationsViewDefault } from "./OperationsView"
export { OperationWorkspace, default as OperationWorkspaceDefault } from "./OperationWorkspace"
export { OperationHome } from "./panels/OperationHome"
export { OperationTasksPanel } from "./panels/OperationTasksPanel"
export { PhasesPanel } from "./panels/PhasesPanel"
export { ToDoNextRail } from "./ToDoNextRail"
export { ResourcesPanel } from "./panels/ResourcesPanel"
export { OperationLogFeed } from "./panels/OperationLogFeed"
export { OperationPostMortemDialog } from "./dialogs/OperationPostMortemDialog"
export { OperationSettingsDialog } from "./dialogs/OperationSettingsDialog"
export { WorkingNowControl } from "./WorkingNowControl"
export {
  OperationTimelinePanel,
  OperationLocationsPanel,
  OperationPlanDocPanel,
} from "./panels/OperationFieldPlanPanels"
export {
  upgradeTaskToOperation,
  createOperation,
  addPhase,
  addPhaseStep,
  addPart,
  addResource,
  deleteOperation,
  addOperationListTask,
  addOperationListTasks,
  linkChild,
  unlinkChild,
  logTime,
  setStage,
  setHomeNotes,
  setMission,
  setTargetDate,
  setOperationCategories,
  addOperationCategory,
  removeOperationCategory,
  setOperationPanels,
  toggleOperationPanel,
  applyOperationPreset,
  ensureTaskList,
  renameOperation,
  saveOperationPostMortem,
  setOperationTrackingTags,
  type CreateOperationOptions,
} from "./operation-actions"

export {
  withOperationType,
  getOperationTypeDefinition,
  OPERATION_TYPE_ID,
  OPERATION_ATTR,
  OPERATION_STAGES,
  OPERATION_PANELS,
  OPERATION_PANEL_IDS,
  OPERATION_PRESETS,
  DEFAULT_OPERATION_PANELS,
  resolveOperationPanels,
  getOperationCategories,
  getOperationTrackingTagIds,
  type OperationPanelId,
  type OperationPreset,
  type OperationStage,
} from "@/lib/operation-types"
export {
  collectOperationCategories,
  groupOperationsByCategory,
  filterOperationsByCategory,
  sortOperations,
  selectOperations,
  type OperationCategoryGroup,
  type OperationSortMode,
} from "@/lib/operations"
export {
  ensureOperationTaskList,
  findOperationTaskList,
  operationTaskListId,
  OPERATIONS_FOLDER_ID,
} from "@/lib/operation-lists"
