/**
 * components/Home/Plan/settings-dialog.tsx — Plan settings
 *
 * Settings dialog for the Plan/calendar (data management and view preferences).
 *
 * Spec: §6.4 / §7.
 */
"use client"

import type React from "react"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { backupDownloadName } from "@/lib/app-brand"
import { useTaskStore } from "@/lib/task-store"
import { useEventStore } from "@/lib/event-store"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { UnsavedChangesDialog, unsavedDismissProps, useUnsavedGuard } from "@/components/ui/unsaved-changes-guard"

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { tasks, lists: categories, folders, setTasks, setLists, setFolders, clearAllData } = useTaskStore()
  const { events, setEvents } = useEventStore()
  const [importData, setImportData] = useState("")
  const [importStatus, setImportStatus] = useState<"idle" | "success" | "error">("idle")
  const [importMessage, setImportMessage] = useState("")

  // Get all plan data from localStorage
  const getAllPlanData = () => {
    const planData: Record<string, string> = {}

    // Get all localStorage keys that contain plan data
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && (key.startsWith("dayPlan-") || key.startsWith("weekPlan-") || key.startsWith("monthPlan-"))) {
        const value = localStorage.getItem(key)
        if (value) {
          planData[key] = value
        }
      }
    }

    return planData
  }

  // Export all data as JSON
  const exportData = () => {
    const exportObject = {
      version: "1.0",
      exportDate: new Date().toISOString(),
      data: {
        tasks,
        categories,
        folders,
        events,
        plans: getAllPlanData(),
      },
    }

    const dataStr = JSON.stringify(exportObject, null, 2)
    const dataBlob = new Blob([dataStr], { type: "application/json" })
    const url = URL.createObjectURL(dataBlob)

    const link = document.createElement("a")
    link.href = url
    link.download = backupDownloadName("backup", new Date().toISOString().split("T")[0])
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Import data from JSON
  const importDataFromJson = (): boolean => {
    try {
      setImportStatus("idle")
      setImportMessage("")

      if (!importData.trim()) {
        setImportStatus("error")
        setImportMessage("Please paste JSON data to import")
        return false
      }

      const parsedData = JSON.parse(importData)

      // Validate the structure
      if (!parsedData.data) {
        throw new Error("Invalid backup file format")
      }

      const {
        tasks: importedTasks,
        lists: importedCategories,
        folders: importedFolders,
        events: importedEvents,
        plans: importedPlans,
      } = parsedData.data

      // Import tasks
      if (importedTasks && Array.isArray(importedTasks)) {
        setTasks(importedTasks)
      }

      // Import categories
      if (importedCategories && Array.isArray(importedCategories)) {
        setLists(importedCategories)
      }

      // Import folders
      if (importedFolders && Array.isArray(importedFolders)) {
        setFolders(importedFolders)
      }

      // Import events
      if (importedEvents && Array.isArray(importedEvents)) {
        setEvents(importedEvents)
      }

      // Import plans to localStorage
      if (importedPlans && typeof importedPlans === "object") {
        Object.entries(importedPlans).forEach(([key, value]) => {
          if (typeof value === "string") {
            localStorage.setItem(key, value)
          }
        })
      }

      setImportStatus("success")
      setImportMessage(
        `Successfully imported ${importedTasks?.length || 0} tasks, ${importedCategories?.length || 0} categories, ${importedEvents?.length || 0} events, and ${Object.keys(importedPlans || {}).length} plans`,
      )
      setImportData("")
      return true
    } catch (error) {
      setImportStatus("error")
      setImportMessage(`Import failed: ${error instanceof Error ? error.message : "Invalid JSON format"}`)
      return false
    }
  }

  // Handle file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const content = e.target?.result as string
        setImportData(content)
      }
      reader.readAsText(file)
    }
  }

  // Clear all data
  const handleClearAllData = () => {
    if (window.confirm("Are you sure you want to clear ALL data? This action cannot be undone.")) {
      // Clear task store data
      clearAllData()

      // Clear event store data
      setEvents([])

      // Clear all plan data from localStorage
      const keysToRemove: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && (key.startsWith("dayPlan-") || key.startsWith("weekPlan-") || key.startsWith("monthPlan-"))) {
          keysToRemove.push(key)
        }
      }
      keysToRemove.forEach((key) => localStorage.removeItem(key))

      setImportStatus("success")
      setImportMessage("All data has been cleared")
    }
  }

  const dataStats = {
    tasks: tasks.length,
    lists: categories.length,
    folders: folders.length,
    events: events.length,
    plans: Object.keys(getAllPlanData()).length,
  }

  const isDirty = importData.trim() !== ""
  const persistImport = () => {
    if (!importData.trim()) return false
    return importDataFromJson()
  }

  const guard = useUnsavedGuard({
    open,
    onOpenChange,
    isDirty,
    onSave: persistImport,
    onDiscard: () => {
      setImportData("")
      setImportStatus("idle")
      setImportMessage("")
    },
  })

  return (
    <>
    <Dialog open={open} onOpenChange={guard.handleOpenChange}>
      <DialogContent className="plan95-dialog plan95-dialog-lg max-h-[90vh]" hideClose {...unsavedDismissProps(guard.requestClose)}>
        <DialogHeader className="plan95-dialog-caption">
          <DialogTitle>Settings & Data Management</DialogTitle>
          <button type="button" className="plan95-title-btn" aria-label="Close" onClick={guard.requestClose}>
            ×
          </button>
        </DialogHeader>
        <div className="plan95-dialog-body">
        <p>Manage your data, export backups, and configure your workspace</p>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="export">Export Data</TabsTrigger>
            <TabsTrigger value="import">Import Data</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Data Overview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="plan-stat-row">
                    <div className="plan-stat">
                      <strong>{dataStats.tasks}</strong>
                      <div>Tasks</div>
                    </div>
                    <div className="plan-stat">
                      <strong>{dataStats.lists}</strong>
                      <div>Categories</div>
                    </div>
                    <div className="plan-stat">
                      <strong>{dataStats.folders}</strong>
                      <div>Folders</div>
                    </div>
                    <div className="plan-stat">
                      <strong>{dataStats.events}</strong>
                      <div>Events</div>
                    </div>
                    <div className="plan-stat">
                      <strong>{dataStats.plans}</strong>
                      <div>Plans</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="plan-danger">
                <h4>Danger Zone</h4>
                <p>
                  Clear all data including tasks, events, categories, folders, and plans. This action cannot be undone.
                </p>
                <Button variant="outline" onClick={handleClearAllData}>
                  Clear All Data
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="export" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Export Your Data</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>
                  Download all your tasks, events, categories, folders, and plans as a JSON backup file. This includes
                  all day/week/month plans stored in your browser.
                </p>
                <div className="plan-danger">
                  <h4>Export includes:</h4>
                  <ul>
                    <li>{dataStats.tasks} tasks with all details and scheduling</li>
                    <li>
                      {dataStats.lists} categories and {dataStats.folders} folders
                    </li>
                    <li>{dataStats.events} events with locations and descriptions</li>
                    <li>{dataStats.plans} day/week/month plans</li>
                    <li>All metadata and timestamps</li>
                  </ul>
                </div>
                <Button onClick={exportData}>Download Backup File</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="import" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Import Data</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>Import data from a previously exported JSON backup file. This will replace your current data.</p>
                <Alert>
                  <AlertDescription>
                    <strong>Warning:</strong> Importing will replace all your current data. Make sure to export your
                    current data first if you want to keep it.
                  </AlertDescription>
                </Alert>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="file-upload">Upload Backup File</Label>
                    <Input id="file-upload" type="file" accept=".json" onChange={handleFileUpload} className="mt-2" />
                  </div>
                  <div className="text-center">or</div>
                  <div>
                    <Label htmlFor="json-data">Paste JSON Data</Label>
                    <Textarea
                      id="json-data"
                      value={importData}
                      onChange={(e) => setImportData(e.target.value)}
                      placeholder="Paste your exported JSON data here..."
                      rows={8}
                      className="mt-2 font-mono text-sm"
                    />
                  </div>
                  {importStatus !== "idle" && (
                    <Alert>
                      <AlertDescription>{importMessage}</AlertDescription>
                    </Alert>
                  )}
                  <Button onClick={importDataFromJson} disabled={!importData.trim()}>
                    Import Data
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="plan95-dialog-actions">
          <button type="button" data-default="true" onClick={guard.requestClose}>
            OK
          </button>
        </div>
        </div>
      </DialogContent>
    </Dialog>
    <UnsavedChangesDialog {...guard.prompt} />
    </>
  )
}
