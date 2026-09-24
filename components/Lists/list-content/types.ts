import type React from "react"
import type { ListDisplay } from "@/lib/lists-ui-store"
import type { Task, List, Folder, ChecklistCheckboxVar } from "@/lib/types"

/** Shared drag/select/complete handlers for all list-content display modes. */
export interface ListContentTaskHandlers {
  tasks: Task[]
  onTaskSelect: (taskId: string) => void
  onCompleteTask: (taskId: string) => void
  onMissedOpportunity?: (taskId: string) => void
  onTaskDragStart: (e: React.DragEvent, task: Task) => void
  onDragEnd: () => void
  selectMode?: boolean
  selectedTaskIds?: string[]
  onToggleTaskSelect?: (taskId: string) => void
}

export interface ListContentDefaultProps extends ListContentTaskHandlers {
  openCategory: List | null
  categories: List[]
}

export interface ListContentChecklistProps extends ListContentTaskHandlers {
  /** Extra checklist ticks; undefined = Completed only. */
  checkboxVars?: ChecklistCheckboxVar[]
}

export interface ListContentIconsProps extends ListContentTaskHandlers {
  onIconPickerOpen: (taskId: string) => void
}

export interface ListContentDetailsProps extends ListContentTaskHandlers {
  openCategory: List | null
  categories: List[]
  folders: Folder[]
  openFolderAll: boolean
  currentFolder: Folder | null | undefined
}

export interface ListContentPanelProps extends ListContentTaskHandlers {
  currentDisplay: ListDisplay
  categories: List[]
  folders: Folder[]
  openCategory: List | null
  openFolderAll: boolean
  openSmart: boolean
  currentFolder: Folder | null | undefined
  /** Global All Items (All \ All Items), not a per-folder All list. */
  isRootAll?: boolean
  itemLabel: string
  openIconKey: string
  folderAllUncategorizedOnly: Record<string, boolean>
  onFolderAllUncategorizedOnlyChange: (folderId: string, checked: boolean) => void
  /** List ids hidden in this folder's All Items view (empty = all shown). */
  folderAllHiddenListIds: Record<string, string[]>
  folderAllHideUncategorized?: Record<string, boolean>
  /** Folder ids hidden in the global All Items view (empty = all shown). Checkboxes live in the inspector. */
  globalAllHiddenFolderIds?: string[]
  globalAllUncategorizedOnly?: boolean
  onGlobalAllUncategorizedOnlyChange?: (checked: boolean) => void
  globalAllHideUncategorized?: boolean
  addingTaskToTarget: string | null
  openTargetKeyValue: string
  onAddTask: (description: string) => void
  onCancelAddTask: () => void
  onShowAddTask: () => void
  showBulkAdd: boolean
  onBulkAdd: (text: string) => void
  onShowBulkAdd: (show: boolean) => void
  onBulkAddCancel: () => void
  onIconPickerOpen: (taskId: string) => void
  /** Hide Add / Bulk add on period To Do smart lists. Archive lists are real lists. */
  allowAdd?: boolean
}
