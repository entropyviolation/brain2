/**
 * components/Lists/settings-dialog.tsx — Lists settings
 *
 * Library navigator (search, filter, double-click into a folder or list,
 * drag to reorder or file) plus import/export. Notes and ingest sits above
 * the tabs — the same doors as Settings.
 *
 * Spec: §6.4 (settings). JSON import/export should become a thin layer over the
 * app-wide export/import of §3.2.
 */
"use client"

import type React from "react"

import { useMemo, useState, useLayoutEffect } from "react"
import { useTaskStore } from "@/lib/task-store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Settings, Save, Trash2, Download, Upload, FileText, Database } from "lucide-react"
import type { Folder, List, Task } from "@/lib/types"
import { BackupRestore } from "@/components/Settings/BackupRestore"
import { downloadCategoryExport, parseCategoryExport, importCategory } from "@/lib/data/backup"
import { Dialog as ChoiceDialog, DialogContent as ChoiceDialogContent, DialogHeader as ChoiceDialogHeader, DialogTitle as ChoiceDialogTitle, DialogDescription as ChoiceDialogDescription, DialogFooter as ChoiceDialogFooter } from "@/components/ui/dialog"
import { UnsavedChangesDialog, unsavedDismissProps, useUnsavedGuard } from "@/components/ui/unsaved-changes-guard"
import { CaptureDoorButtons } from "@/components/capture-doors"
import { ListsSettingsNav } from "@/components/Lists/lists-settings-nav"
import { navSnapshot, removeNavFolder, removeNavList, type NavRef } from "@/lib/lists-navigator"
import { isRemindersList } from "@/lib/reminders"
import { isPeopleIKnowList } from "@/lib/people-i-know"
import { isInstagramPeopleList } from "@/lib/instagram-lists"
import { applyListsNavigation, requestNavigateToList } from "@/lib/app-navigation"
import "@/components/Lists/lists-settings.css"

interface NextActionsSettingsDialogProps {
  open: boolean
  onClose: () => void
}

interface ExportData {
  version: "1.0"
  exportDate: string
  lists: List[]
  tasks: Task[]
  metadata: {
    totalCategories: number
    totalTasks: number
    completedTasks: number
    activeTasks: number
  }
}

export function NextActionsSettingsDialog({ open, onClose }: NextActionsSettingsDialogProps) {
  const lists = useTaskStore((state) => state.lists)
  const folders = useTaskStore((state) => state.folders)
  const tasks = useTaskStore((state) => state.tasks)
  const deleteList = useTaskStore((state) => state.deleteList)
  const deleteFolder = useTaskStore((state) => state.deleteFolder)
  const setTasks = useTaskStore((state) => state.setTasks)
  const setLists = useTaskStore((state) => state.setLists)
  const setFolders = useTaskStore((state) => state.setFolders)
  const clearAllData = useTaskStore((state) => state.clearAllData)

  const [localLists, setLocalLists] = useState<List[]>([])
  const [localFolders, setLocalFolders] = useState<Folder[]>([])
  const [importStatus, setImportStatus] = useState<string>("")
  const [pendingImport, setPendingImport] = useState<ExportData | null>(null)
  const [showImportChoice, setShowImportChoice] = useState(false)
  const [exportCategoryId, setExportCategoryId] = useState<string>("")

  useLayoutEffect(() => {
    if (!open) return
    const state = useTaskStore.getState()
    setLocalLists(state.lists)
    setLocalFolders(state.folders)
  }, [open])

  const itemCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const task of tasks) {
      for (const id of task.lists ?? []) counts.set(id, (counts.get(id) ?? 0) + 1)
    }
    return counts
  }, [tasks])

  const handleDeleteList = (id: string) => {
    const list = localLists.find((row) => row.id === id)
    if (list && (isRemindersList(list) || isPeopleIKnowList(list) || isInstagramPeopleList(list))) return
    const name = list?.name ?? "this list"
    if (!confirm(`Delete “${name}”? This cannot be undone.`)) return
    const next = removeNavList(localLists, localFolders, id)
    setLocalLists(next.lists)
    setLocalFolders(next.folders)
    deleteList(id)
  }

  const handleDeleteFolder = (id: string) => {
    const name = localFolders.find((folder) => folder.id === id)?.name ?? "this folder"
    if (!confirm(`Delete folder “${name}”? Lists inside stay in the library.`)) return
    setLocalFolders(removeNavFolder(localFolders, id))
    deleteFolder(id)
  }

  const saveArrangement = () => {
    setLists(localLists)
    setFolders(localFolders)
    onClose()
  }

  const exportData = () => {
    const completedTasks = tasks.filter((task) => task.completed)
    const activeTasks = tasks.filter((task) => !task.completed)

    const exported: ExportData = {
      version: "1.0",
      exportDate: new Date().toISOString(),
      lists: lists,
      tasks: tasks,
      metadata: {
        totalCategories: lists.length,
        totalTasks: tasks.length,
        completedTasks: completedTasks.length,
        activeTasks: activeTasks.length,
      },
    }

    const dataStr = JSON.stringify(exported, null, 2)
    const dataBlob = new Blob([dataStr], { type: "application/json" })
    const url = URL.createObjectURL(dataBlob)

    const link = document.createElement("a")
    link.href = url
    link.download = `lists-backup-${new Date().toISOString().split("T")[0]}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    setImportStatus(`✅ Exported ${lists.length} lists and ${tasks.length} tasks successfully!`)
    setTimeout(() => setImportStatus(""), 3000)
  }

  const handleExportCategory = () => {
    const id = exportCategoryId || lists[0]?.id
    if (!id) return
    const cat = lists.find((c) => c.id === id)
    downloadCategoryExport(id)
    setImportStatus(`✅ Exported list "${cat?.name ?? id}" (with sublists) as JSON.`)
    setTimeout(() => setImportStatus(""), 3000)
  }

  const rememberVault = () => {
    const state = useTaskStore.getState()
    setLocalLists(state.lists)
    setLocalFolders(state.folders)
  }

  const handleImportCategory = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = parseCategoryExport(e.target?.result as string)
        const result = importCategory(data, "merge")
        rememberVault()
        setImportStatus(`✅ Imported ${result.lists} list(s) and ${result.tasks} task(s).`)
      } catch (error) {
        setImportStatus(`❌ Error importing list: ${error instanceof Error ? error.message : "Unknown error"}`)
      }
      setTimeout(() => setImportStatus(""), 5000)
    }
    reader.readAsText(file)
    event.target.value = ""
  }

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const importedData = JSON.parse(e.target?.result as string) as ExportData

        if (!importedData.lists || !importedData.tasks) {
          throw new Error("Invalid file format: missing lists or tasks")
        }

        const processedCategories = importedData.lists.map((category) => ({
          ...category,
          createdAt: new Date(category.createdAt),
        }))

        const processedTasks = importedData.tasks.map((task) => ({
          ...task,
          createdAt: new Date(task.createdAt),
          scheduledDate: task.scheduledDate ? new Date(task.scheduledDate) : undefined,
          deadline: task.deadline ? new Date(task.deadline) : undefined,
        }))

        setPendingImport({ ...importedData, lists: processedCategories, tasks: processedTasks })
        setShowImportChoice(true)
      } catch (error) {
        console.error("Import error:", error)
        setImportStatus(`❌ Error importing data: ${error instanceof Error ? error.message : "Unknown error"}`)
        setTimeout(() => setImportStatus(""), 5000)
      }
    }
    reader.readAsText(file)
    event.target.value = ""
  }

  const handleImportChoice = (mode: "add" | "replace") => {
    if (!pendingImport) return
    if (mode === "replace") {
      setLists(pendingImport.lists)
      setTasks(pendingImport.tasks)
      setLocalLists(pendingImport.lists)
      setImportStatus(
        `✅ Successfully imported ${pendingImport.lists.length} lists and ${pendingImport.tasks.length} tasks! (Replaced)`,
      )
    } else {
      const existingCategoryIds = new Set(lists.map((c) => c.id))
      const existingTaskIds = new Set(tasks.map((t) => t.id))
      const mergedCategories = [...lists, ...pendingImport.lists.filter((c) => !existingCategoryIds.has(c.id))]
      const mergedTasks = [...tasks, ...pendingImport.tasks.filter((t) => !existingTaskIds.has(t.id))]
      setLists(mergedCategories)
      setTasks(mergedTasks)
      setLocalLists(mergedCategories)
      setImportStatus(
        `✅ Successfully imported ${pendingImport.lists.length} lists and ${pendingImport.tasks.length} tasks! (Added)`,
      )
    }
    setShowImportChoice(false)
    setPendingImport(null)
    setTimeout(() => setImportStatus(""), 5000)
  }

  const completedTasks = open ? tasks.filter((task) => task.completed) : []
  const activeTasks = open ? tasks.filter((task) => !task.completed) : []
  const isDirty = open && (navSnapshot(localLists, localFolders) !== navSnapshot(lists, folders) || Boolean(pendingImport))

  const openInLists = (ref: NavRef) => {
    if (isDirty) {
      setLists(localLists)
      setFolders(localFolders)
    }
    if (ref.kind === "folder") applyListsNavigation({ location: ref.id, openTarget: null })
    else requestNavigateToList(ref.id, isDirty ? localFolders : folders)
    onClose()
  }

  const guard = useUnsavedGuard({
    open,
    onOpenChange: (next) => {
      if (!next) onClose()
    },
    isDirty,
    onSave: saveArrangement,
    onDiscard: () => {
      setLocalLists(lists)
      setLocalFolders(folders)
      setPendingImport(null)
    },
  })

  return (
    <>
    <Dialog open={open} onOpenChange={guard.handleOpenChange}>
      <DialogContent
        className="set95 set95-dialog lst-set !flex h-[90vh] max-h-[90vh] w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl"
        data-ui-name="Lists settings"
        data-ui-docs="components/Lists/README.md"
        {...unsavedDismissProps(guard.requestClose)}
      >
        <DialogHeader className="set-caption">
          <div className="set-caption-mark">
            <span className="set-power-lamp" aria-hidden />
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Lists Settings
            </DialogTitle>
          </div>
          <DialogDescription className="set-caption-lead">
            Arrange the library, then import or export lists and tasks.
          </DialogDescription>
        </DialogHeader>

        <div className="lst-set-main">
          <div className="lst-capture">
            <CaptureDoorButtons />
          </div>

          <Tabs defaultValue="lists" className="lst-tabs">
            <TabsList>
              <TabsTrigger value="lists">Lists</TabsTrigger>
              <TabsTrigger value="data">Import/Export</TabsTrigger>
            </TabsList>

            <TabsContent value="lists">
              <ListsSettingsNav
                lists={localLists}
                folders={localFolders}
                itemCounts={itemCounts}
                onChange={(nextLists, nextFolders) => {
                  setLocalLists(nextLists)
                  setLocalFolders(nextFolders)
                }}
                onDeleteList={handleDeleteList}
                onDeleteFolder={handleDeleteFolder}
                onOpenInLists={openInLists}
              />
              <div className="lst-nav-foot">
                <Button variant="outline" onClick={guard.requestClose} className="focus-ring">
                  Cancel
                </Button>
                <Button onClick={saveArrangement} className="focus-ring">
                  <Save className="h-4 w-4 mr-2" />
                  Save arrangement
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="data" className="lst-tab-scroll" data-testid="lists-import">
              <div className="lst-import">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div className="lst-stat">
                    <b>{lists.length}</b>
                    <span>Lists</span>
                  </div>
                  <div className="lst-stat">
                    <b>{tasks.length}</b>
                    <span>Total Tasks</span>
                  </div>
                  <div className="lst-stat">
                    <b>{completedTasks.length}</b>
                    <span>Completed</span>
                  </div>
                  <div className="lst-stat">
                    <b>{activeTasks.length}</b>
                    <span>Active</span>
                  </div>
                </div>

                <BackupRestore />

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Download className="h-4 w-4" />
                    <h3 className="font-semibold">Export Lists &amp; Tasks</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Download just your lists and tasks as a JSON file for backup or transfer.
                  </p>
                  <Button onClick={exportData} className="w-full" variant="outline">
                    <FileText className="h-4 w-4 mr-2" />
                    Export Lists &amp; Tasks
                  </Button>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Download className="h-4 w-4" />
                    <h3 className="font-semibold">Export / Import a Single List</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Export one list together with its sublists and tasks, or import such a file (merged by ID).
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <select
                      className="flex-1 rounded-md border bg-background px-2 py-1 text-sm"
                      value={exportCategoryId || lists[0]?.id || ""}
                      onChange={(e) => setExportCategoryId(e.target.value)}
                    >
                      {lists.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <Button onClick={handleExportCategory} variant="outline" disabled={lists.length === 0}>
                      <FileText className="h-4 w-4 mr-2" />
                      Export List
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="import-category-file" className="sr-only">
                      Choose a list export to import
                    </Label>
                    <Input
                      id="import-category-file"
                      type="file"
                      accept=".json"
                      onChange={handleImportCategory}
                      className="cursor-pointer"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Upload className="h-4 w-4" />
                    <h3 className="font-semibold">Import Data</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Import lists and tasks from a previously exported JSON file. You choose whether to add them or replace what you have.
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="import-file" className="sr-only">
                      Choose file to import
                    </Label>
                    <Input id="import-file" type="file" accept=".json" onChange={handleImport} className="cursor-pointer" />
                    {importStatus && (
                      <div
                        className={`text-sm p-2 rounded ${
                          importStatus.startsWith("✅")
                            ? "bg-green-50 text-green-700 border border-green-200"
                            : "bg-red-50 text-red-700 border border-red-200"
                        }`}
                      >
                        {importStatus}
                      </div>
                    )}
                  </div>
                </div>

                <ChoiceDialog
                  open={showImportChoice}
                  onOpenChange={(next) => {
                    setShowImportChoice(next)
                    if (!next) setPendingImport(null)
                  }}
                >
                  <ChoiceDialogContent className="set95 set95-dialog">
                    <ChoiceDialogHeader className="set-caption">
                      <div className="set-caption-mark">
                        <span className="set-power-lamp" aria-hidden />
                        <ChoiceDialogTitle>How would you like to import your data?</ChoiceDialogTitle>
                      </div>
                      <ChoiceDialogDescription className="set-caption-lead">
                        You can add the imported lists and tasks to your existing data (no duplicates by ID), or replace all current lists and tasks with the imported data.
                      </ChoiceDialogDescription>
                    </ChoiceDialogHeader>
                    <div className="flex flex-col gap-3 p-3">
                      <Button onClick={() => handleImportChoice("add")} variant="outline">
                        Add to existing (merge, no duplicates)
                      </Button>
                      <Button onClick={() => handleImportChoice("replace")} variant="destructive">
                        Replace all current data
                      </Button>
                      <ChoiceDialogFooter>
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setShowImportChoice(false)
                            setPendingImport(null)
                          }}
                        >
                          Cancel
                        </Button>
                      </ChoiceDialogFooter>
                    </div>
                  </ChoiceDialogContent>
                </ChoiceDialog>

                <div className="lst-note">
                  <div className="flex items-start gap-2">
                    <Database className="h-4 w-4 mt-0.5" />
                    <div>
                      <div className="font-medium">Before you replace</div>
                      <div>
                        Replace swaps out every current list and task. Export a copy first if you still want this library.
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={() => {
                      if (confirm("Are you sure you want to clear ALL lists and tasks? This cannot be undone.")) {
                        clearAllData()
                        setLocalLists([])
                        setLocalFolders([])
                        setImportStatus("✅ All data cleared!")
                        setTimeout(() => setImportStatus(""), 3000)
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear All Data
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
    <UnsavedChangesDialog {...guard.prompt} />
    </>
  )
}
