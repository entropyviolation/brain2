import type React from "react"
import type { ListDisplay } from "@/lib/lists-ui-store"
import type { Task, List, Folder } from "@/lib/types"

/** Shared drag/select/complete handlers for all list-content display modes. */
export interface ListContentTaskHandlers {
  tasks: Task[]
  onTaskSelect: (taskId: string) => void
  onCompleteTask: (taskId: string) => void
  onTaskDragStart: (e: React.DragEvent, task: Task) => void
  onDragEnd: () => void
}

export interface ListContentDefaultProps extends ListContentTaskHandlers {
  openCategory: List | null
  categories: List[]
}

export interface ListContentChecklistProps extends ListContentTaskHandlers {}

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
