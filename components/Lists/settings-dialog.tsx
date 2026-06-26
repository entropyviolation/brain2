/**
 * components/NextActions/settings-dialog.tsx — Next Actions settings
 *
 * Category settings: reorder lists, manage folders, and import/export
 * category + task data as JSON.
 *
 * Spec: §6.4 (settings). JSON import/export should become a thin layer over the
 * app-wide export/import of §3.2.
 */
"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useTaskStore } from "@/lib/task-store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { GripVertical, Settings, Save, Trash2, Download, Upload, FileText, Database } from "lucide-react"
import type { List, Task } from "@/lib/types"
import { BackupRestore } from "@/components/Settings/BackupRestore"
import { downloadCategoryExport, parseCategoryExport, importCategory } from "@/lib/data/backup"
import { Dialog as ChoiceDialog, DialogContent as ChoiceDialogContent, DialogHeader as ChoiceDialogHeader, DialogTitle as ChoiceDialogTitle, DialogDescription as ChoiceDialogDescription, DialogFooter as ChoiceDialogFooter } from "@/components/ui/dialog"

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
  const tasks = useTaskStore((state) => state.tasks)
  const updateList = useTaskStore((state) => state.updateList)
  const deleteList = useTaskStore((state) => state.deleteList)
  const addList = useTaskStore((state) => state.addList)
  const addTask = useTaskStore((state) => state.addTask)
  const setTasks = useTaskStore((state) => state.setTasks)
  const setLists = useTaskStore((state) => state.setLists)
  const clearAllData = useTaskStore((state) => state.clearAllData)

  const [localCategories, setLocalCategories] = useState<List[]>([])
  const [draggedCategory, setDraggedCategory] = useState<string | null>(null)
  const [importStatus, setImportStatus] = useState<string>("")
  const [pendingImport, setPendingImport] = useState<ExportData | null>(null)
  const [showImportChoice, setShowImportChoice] = useState(false)
  const [exportCategoryId, setExportCategoryId] = useState<string>("")

  useEffect(() => {
    setLocalCategories([...lists].sort((a, b) => (a.order || 0) - (b.order || 0)))
  }, [lists])

  const handleDragStart = (e: React.DragEvent, categoryId: string) => {
    setDraggedCategory(categoryId)
    e.dataTransfer.effectAllowed = "move"
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
  }

  const handleDrop = (e: React.DragEvent, targetCategoryId: string) => {
    e.preventDefault()
    if (!draggedCategory || draggedCategory === targetCategoryId) return

    const draggedIndex = localCategories.findIndex((c) => c.id === draggedCategory)
    const targetIndex = localCategories.findIndex((c) => c.id === targetCategoryId)

    if (draggedIndex === -1 || targetIndex === -1) return

    const newCategories = [...localCategories]
    const [draggedItem] = newCategories.splice(draggedIndex, 1)
    newCategories.splice(targetIndex, 0, draggedItem)

    setLocalCategories(newCategories)
    setDraggedCategory(null)
  }

  const handleDeleteCategory = (categoryId: string) => {
    if (confirm("Are you sure you want to delete this list? This action cannot be undone.")) {
      deleteList(categoryId)
      setLocalCategories(localCategories.filter((c) => c.id !== categoryId))
    }
  }

  const saveOrder = () => {
    localCategories.forEach((category, index) => {
      updateList({ ...category, order: index })
    })
    onClose()
  }

  const exportData = () => {
    const completedTasks = tasks.filter((task) => task.completed)
    const activeTasks = tasks.filter((task) => !task.completed)

    const exportData: ExportData = {
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

    const dataStr = JSON.stringify(exportData, null, 2)
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

  // Per-category export: a single list + its sublists + member tasks (HM4).
  const handleExportCategory = () => {
    const id = exportCategoryId || lists[0]?.id
    if (!id) return
    const cat = lists.find((c) => c.id === id)
    downloadCategoryExport(id)
    setImportStatus(`✅ Exported list "${cat?.name ?? id}" (with sublists) as JSON.`)
    setTimeout(() => setImportStatus(""), 3000)
  }

  // Per-category import: merges a category subtree export back into the store.
  const handleImportCategory = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = parseCategoryExport(e.target?.result as string)
        const result = importCategory(data, "merge")
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

        // Validate the imported data structure
        if (!importedData.lists || !importedData.tasks) {
          throw new Error("Invalid file format: missing lists or tasks")
        }

        // Convert date strings back to Date objects
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

    // Reset the input
    event.target.value = ""
  }

  // Handle user choice for import
  const handleImportChoice = (mode: "add" | "replace") => {
    if (!pendingImport) return
    if (mode === "replace") {
      setLists(pendingImport.lists)
      setTasks(pendingImport.tasks)
      setImportStatus(
        `✅ Successfully imported ${pendingImport.lists.length} lists and ${pendingImport.tasks.length} tasks! (Replaced)`
      )
    } else {
      // Merge: add only new lists/tasks by id
      const existingCategoryIds = new Set(lists.map((c) => c.id))
      const existingTaskIds = new Set(tasks.map((t) => t.id))
      const mergedCategories = [
        ...lists,
        ...pendingImport.lists.filter((c) => !existingCategoryIds.has(c.id)),
      ]
      const mergedTasks = [
        ...tasks,
        ...pendingImport.tasks.filter((t) => !existingTaskIds.has(t.id)),
      ]
      setLists(mergedCategories)
      setTasks(mergedTasks)
      setImportStatus(
        `✅ Successfully imported ${pendingImport.lists.length} lists and ${pendingImport.tasks.length} tasks! (Added)`
      )
    }
    setShowImportChoice(false)
    setPendingImport(null)
    setTimeout(() => setImportStatus(""), 5000)
  }

  const completedTasks = tasks.filter((task) => task.completed)
  const activeTasks = tasks.filter((task) => !task.completed)

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Lists Settings
          </DialogTitle>
          <DialogDescription>Manage your lists and import/export your data.</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="lists" className="flex-1 overflow-hidden">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="lists">Lists</TabsTrigger>
            <TabsTrigger value="data">Import/Export</TabsTrigger>
          </TabsList>

          <TabsContent value="lists" className="flex-1 overflow-hidden">
            <div className="space-y-4 h-full">
              <div className="text-sm text-muted-foreground">
                Drag and drop to reorder lists. Click the trash icon to delete a list.
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
                {localCategories.map((category, index) => (
                  <div
                    key={category.id}
                    className={`flex items-center gap-3 p-3 border rounded-lg cursor-move transition-all duration-200 ${
                      draggedCategory === category.id ? "opacity-50 scale-95" : "hover:bg-muted/50"
                    }`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, category.id)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, category.id)}
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: category.color }} />
                    <span className="flex-1 font-medium">{category.name}</span>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">#{index + 1}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive hover:text-destructive focus-ring"
                        onClick={() => handleDeleteCategory(category.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="outline" onClick={onClose} className="focus-ring">
                  Cancel
                </Button>
                <Button onClick={saveOrder} className="focus-ring">
                  <Save className="h-4 w-4 mr-2" />
                  Save Order
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="data" className="flex-1 overflow-y-auto mt-2 pr-1">
            <div className="space-y-6 pb-4">
              {/* Data Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{lists.length}</div>
                  <div className="text-xs text-muted-foreground">Lists</div>
                </div>
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{tasks.length}</div>
                  <div className="text-xs text-muted-foreground">Total Tasks</div>
                </div>
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold text-emerald-600">{completedTasks.length}</div>
                  <div className="text-xs text-muted-foreground">Completed</div>
                </div>
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">{activeTasks.length}</div>
                  <div className="text-xs text-muted-foreground">Active</div>
                </div>
              </div>

              {/* Full app backup/restore (all stores + plans) */}
              <BackupRestore />

              {/* Export Section (lists + tasks only) */}
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

              {/* Per-category export / import (single list + its sublists) */}
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

              {/* Import Section */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  <h3 className="font-semibold">Import Data</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Import lists and tasks from a previously exported JSON file. This will let you choose whether to add or replace your current data.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="import-file" className="sr-only">
                    Choose file to import
                  </Label>
                  <Input
                    id="import-file"
                    type="file"
                    accept=".json"
                    onChange={handleImport}
                    className="cursor-pointer"
                  />
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

              {/* Import Choice Dialog */}
              <ChoiceDialog open={showImportChoice} onOpenChange={(open) => { setShowImportChoice(open); if (!open) setPendingImport(null) }}>
                <ChoiceDialogContent>
                  <ChoiceDialogHeader>
                    <ChoiceDialogTitle>How would you like to import your data?</ChoiceDialogTitle>
                    <ChoiceDialogDescription>
                      You can <b>add</b> the imported lists and tasks to your existing data (no duplicates by ID), or <b>replace</b> all current lists and tasks with the imported data.
                    </ChoiceDialogDescription>
                  </ChoiceDialogHeader>
                  <div className="flex flex-col gap-4 mt-4">
                    <Button onClick={() => handleImportChoice("add")} variant="outline">
                      Add to existing (merge, no duplicates)
                    </Button>
                    <Button onClick={() => handleImportChoice("replace")} variant="destructive">
                      Replace all current data
                    </Button>
                  </div>
                  <ChoiceDialogFooter>
                    <Button variant="ghost" onClick={() => { setShowImportChoice(false); setPendingImport(null) }}>
                      Cancel
                    </Button>
                  </ChoiceDialogFooter>
                </ChoiceDialogContent>
              </ChoiceDialog>

              {/* Warning */}
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <Database className="h-4 w-4 text-yellow-600 mt-0.5" />
                  <div className="text-sm">
                    <div className="font-medium text-yellow-800">Important</div>
                    <div className="text-yellow-700">
                      Importing data will replace all current lists and tasks. Make sure to export your current
                      data first if you want to keep it.
                    </div>
                  </div>
                </div>
              </div>

              {/* Clear All Data Button */}
              <div className="pt-2">
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={() => {
                    if (confirm("Are you sure you want to clear ALL lists and tasks? This cannot be undone.")) {
                      clearAllData()
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
      </DialogContent>
    </Dialog>
  )
}
