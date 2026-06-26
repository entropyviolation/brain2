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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Download, Upload, FileText, Database, AlertTriangle, CheckCircle, BarChart3, Trash2 } from "lucide-react"
import { useTaskStore } from "@/lib/task-store"
import { useEventStore } from "@/lib/event-store"
import { Alert, AlertDescription } from "@/components/ui/alert"

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
    link.download = `cogs-backup-${new Date().toISOString().split("T")[0]}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Import data from JSON
  const importDataFromJson = () => {
    try {
      setImportStatus("idle")
      setImportMessage("")

      if (!importData.trim()) {
        setImportStatus("error")
        setImportMessage("Please paste JSON data to import")
        return
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
    } catch (error) {
      setImportStatus("error")
      setImportMessage(`Import failed: ${error instanceof Error ? error.message : "Invalid JSON format"}`)
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl bg-gradient-to-br from-gray-900 via-gray-800 to-black border border-gray-700 shadow-2xl max-h-[90vh] overflow-y-auto backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-[#8cd4a5] via-[#b89fbf] to-[#8b7ecc] bg-clip-text text-transparent flex items-center gap-2">
            <Database className="h-6 w-6 text-[#8cd4a5]" />
            Settings & Data Management
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Manage your data, export backups, and configure your workspace
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-gray-800/50 border border-gray-700">
            <TabsTrigger
              value="overview"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#8cd4a5] data-[state=active]:to-[#9fc2a5] data-[state=active]:text-black text-gray-300"
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="export"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#b89fbf] data-[state=active]:to-[#8b7ecc] data-[state=active]:text-black text-gray-300"
            >
              <Download className="h-4 w-4 mr-2" />
              Export Data
            </TabsTrigger>
            <TabsTrigger
              value="import"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#130ead] data-[state=active]:to-[#571833] data-[state=active]:text-white text-gray-300"
            >
              <Upload className="h-4 w-4 mr-2" />
              Import Data
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <div className="space-y-6">
              <Card className="bg-gradient-to-br from-[#8cd4a5]/10 via-[#b89fbf]/10 to-[#8b7ecc]/10 border border-gray-600 shadow-lg">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2 text-gray-200">
                    <FileText className="h-5 w-5 text-[#8cd4a5]" />
                    Data Overview
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="text-center p-4 bg-gradient-to-br from-gray-800/50 to-gray-700/50 rounded-lg border border-gray-600">
                      <div className="text-2xl font-bold text-[#8cd4a5]">{dataStats.tasks}</div>
                      <div className="text-sm text-gray-400">Tasks</div>
                    </div>
                    <div className="text-center p-4 bg-gradient-to-br from-gray-800/50 to-gray-700/50 rounded-lg border border-gray-600">
                      <div className="text-2xl font-bold text-[#b89fbf]">{dataStats.lists}</div>
                      <div className="text-sm text-gray-400">Categories</div>
                    </div>
                    <div className="text-center p-4 bg-gradient-to-br from-gray-800/50 to-gray-700/50 rounded-lg border border-gray-600">
                      <div className="text-2xl font-bold text-[#8b7ecc]">{dataStats.folders}</div>
                      <div className="text-sm text-gray-400">Folders</div>
                    </div>
                    <div className="text-center p-4 bg-gradient-to-br from-gray-800/50 to-gray-700/50 rounded-lg border border-gray-600">
                      <div className="text-2xl font-bold text-[#9fc2a5]">{dataStats.events}</div>
                      <div className="text-sm text-gray-400">Events</div>
                    </div>
                    <div className="text-center p-4 bg-gradient-to-br from-gray-800/50 to-gray-700/50 rounded-lg border border-gray-600">
                      <div className="text-2xl font-bold text-[#adc29f]">{dataStats.plans}</div>
                      <div className="text-sm text-gray-400">Plans</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-[#571833]/20 to-red-900/20 border border-red-700/50 shadow-lg">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2 text-red-400">
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                    Danger Zone
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <p className="text-sm text-gray-400">
                      Clear all data including tasks, events, categories, folders, and plans. This action cannot be
                      undone.
                    </p>
                    <Button
                      variant="destructive"
                      onClick={handleClearAllData}
                      className="bg-gradient-to-r from-[#571833] to-red-600 hover:from-[#461426] hover:to-red-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Clear All Data
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="export" className="mt-6">
            <Card className="bg-gradient-to-br from-[#8cd4a5]/10 to-[#9fc2a5]/10 border border-gray-600 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-gray-200">
                  <Download className="h-5 w-5 text-[#8cd4a5]" />
                  Export Your Data
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <p className="text-sm text-gray-400 mb-4">
                    Download all your tasks, events, categories, folders, and plans as a JSON backup file. This includes
                    all day/week/month plans stored in your browser.
                  </p>

                  <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-600">
                    <h4 className="font-semibold text-gray-200 mb-2">Export includes:</h4>
                    <ul className="text-sm text-gray-400 space-y-1">
                      <li>• {dataStats.tasks} tasks with all details and scheduling</li>
                      <li>
                        • {dataStats.lists} categories and {dataStats.folders} folders
                      </li>
                      <li>• {dataStats.events} events with locations and descriptions</li>
                      <li>• {dataStats.plans} day/week/month plans</li>
                      <li>• All metadata and timestamps</li>
                    </ul>
                  </div>
                </div>

                <Button
                  onClick={exportData}
                  className="w-full bg-gradient-to-r from-[#8cd4a5] via-[#9fc2a5] to-[#adc29f] hover:from-[#7bc394] hover:via-[#8eb194] hover:to-[#9cb18e] text-black font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Backup File
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="import" className="mt-6">
            <Card className="bg-gradient-to-br from-[#130ead]/10 to-[#571833]/10 border border-gray-600 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-gray-200">
                  <Upload className="h-5 w-5 text-[#8cd4a5]" />
                  Import Data
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <p className="text-sm text-gray-400 mb-4">
                    Import data from a previously exported JSON backup file. This will replace your current data.
                  </p>

                  <Alert className="mb-4 bg-yellow-900/20 border-yellow-700/50">
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    <AlertDescription className="text-yellow-200">
                      <strong>Warning:</strong> Importing will replace all your current data. Make sure to export your
                      current data first if you want to keep it.
                    </AlertDescription>
                  </Alert>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="file-upload" className="text-sm font-semibold text-gray-200">
                      Upload Backup File
                    </Label>
                    <Input
                      id="file-upload"
                      type="file"
                      accept=".json"
                      onChange={handleFileUpload}
                      className="mt-2 bg-gray-800/50 border-gray-600 text-white file:bg-[#8cd4a5] file:text-black file:border-0 file:rounded-md file:px-3 file:py-1 file:mr-3"
                    />
                  </div>

                  <div className="text-center text-gray-500">or</div>

                  <div>
                    <Label htmlFor="json-data" className="text-sm font-semibold text-gray-200">
                      Paste JSON Data
                    </Label>
                    <Textarea
                      id="json-data"
                      value={importData}
                      onChange={(e) => setImportData(e.target.value)}
                      placeholder="Paste your exported JSON data here..."
                      rows={8}
                      className="mt-2 bg-gray-800/50 border-gray-600 text-white placeholder-gray-400 focus:border-[#8cd4a5] focus:ring-[#8cd4a5]/20 font-mono text-sm"
                    />
                  </div>

                  {importStatus !== "idle" && (
                    <Alert
                      className={
                        importStatus === "success"
                          ? "bg-green-900/20 border-green-700/50"
                          : "bg-red-900/20 border-red-700/50"
                      }
                    >
                      {importStatus === "success" ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                      )}
                      <AlertDescription className={importStatus === "success" ? "text-green-200" : "text-red-200"}>
                        {importMessage}
                      </AlertDescription>
                    </Alert>
                  )}

                  <Button
                    onClick={importDataFromJson}
                    disabled={!importData.trim()}
                    className="w-full bg-gradient-to-r from-[#130ead] via-[#571833] to-[#5f756d] hover:from-[#0f0a8a] hover:via-[#451426] hover:to-[#4d5e56] text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Import Data
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end pt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="bg-gray-800/50 border-gray-600 text-white hover:bg-gray-700/50"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
