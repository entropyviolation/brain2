import type React from "react"
import type { ListDisplay } from "@/lib/lists-ui-store"
import type { Task, TaskCategory, CategoryFolder } from "@/lib/types"

/** Shared drag/select/complete handlers for all list-content display modes. */
export interface ListContentTaskHandlers {
  tasks: Task[]
  onTaskSelect: (taskId: string) => void
  onCompleteTask: (taskId: string) => void
  onTaskDragStart: (e: React.DragEvent, task: Task) => void
  onDragEnd: () => void
}

export interface ListContentDefaultProps extends ListContentTaskHandlers {
  openCategory: TaskCategory | null
  categories: TaskCategory[]
}

export interface ListContentChecklistProps extends ListContentTaskHandlers {}

export interface ListContentIconsProps extends ListContentTaskHandlers {
  onIconPickerOpen: (taskId: string) => void
}

export interface ListContentDetailsProps extends ListContentTaskHandlers {
  openCategory: TaskCategory | null
  categories: TaskCategory[]
  folders: CategoryFolder[]
  openFolderAll: boolean
  currentFolder: CategoryFolder | null | undefined
}

export interface ListContentPanelProps extends ListContentTaskHandlers {
  currentDisplay: ListDisplay
  categories: TaskCategory[]
  folders: CategoryFolder[]
  openCategory: TaskCategory | null
  openFolderAll: boolean
  openSmart: boolean
  currentFolder: CategoryFolder | null | undefined
  itemLabel: string
  openIconKey: string
  folderAllUncategorizedOnly: Record<string, boolean>
  onFolderAllUncategorizedOnlyChange: (folderId: string, checked: boolean) => void
  addingTaskToTarget: string | null
  openTargetKeyValue: string
  newTaskDescription: string
  onNewTaskDescriptionChange: (value: string) => void
  onAddTask: () => void
  onCancelAddTask: () => void
  showBulkAdd: boolean
  bulkAddText: string
  onBulkAddTextChange: (value: string) => void
  onBulkAdd: () => void
  onShowBulkAdd: (show: boolean) => void
  onBulkAddCancel: () => void
  onIconPickerOpen: (taskId: string) => void
}
