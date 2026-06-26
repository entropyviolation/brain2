/**
 * app/page.tsx — Application root page
 *
 * The single page of the app. Renders the global header (title + Cognitive State,
 * Inbox, Bulk Add, Quick Add) and the top-level tab bar (Home, Next Actions,
 * Scheduler, Analytics), lazy-loading each module panel for fast startup. When a
 * task is selected it swaps to the full-screen task detail view.
 *
 * Spec: §2.2 (module hosting) and §8.2 (dashboard top bar / global quick actions).
 */
"use client"

import { useState, useCallback, lazy, Suspense, useEffect } from "react"
import { APP_NAV_KEYS, APP_TABS, readStoredTab, writeStoredTab, type AppTab } from "@/lib/app-navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { QuickAdd } from "@/components/quick-add"
import { EnhancedBulkAdd } from "@/components/enhanced-bulk-add"
import { CognitiveState } from "@/components/cognitive-state"
import { Inbox } from "@/components/inbox"
import { EnhancedTaskDetail } from "@/components/enhanced-task-detail"
import { TaskDetailPopup } from "@/components/task-detail-popup"
import { Reviews } from "@/components/Reviews/reviews"
import { GlobalSearch, type SearchSelection } from "@/components/Search/GlobalSearch"
import { useGlobalSearchHotkey } from "@/components/Search/useGlobalSearchHotkey"
import { useTaskStore } from "@/lib/task-store"
import { writeListsNavigation, COGS_NAVIGATE_TO_LIST_EVENT } from "@/lib/app-navigation"
import { useQuickCaptureHotkey } from "@/hooks/useQuickCaptureHotkey"
import { MetricLoggerButton } from "@/components/Tracking/MetricLogger"
import { SettingsDialog } from "@/components/Settings/SettingsDialog"
import { parseModulePopoutModuleId } from "@/components/Modules/workspace/ModuleWorkspace"
import { parseSheetPopoutCategoryId } from "@/components/spreadsheet/sheet-popout"
import { initWorkflowEngine, createTaskRepositoryAdapter } from "@/lib/services/item-mutation-service"

// Lazy load components to improve initial load time
const HomeDashboard = lazy(() => import("@/components/Home/home-dashboard").then((mod) => ({ default: mod.HomeDashboard })))
const EnhancedCategoryView = lazy(() =>
  import("@/components/Lists/enhanced-list-view").then((mod) => ({ default: mod.EnhancedCategoryView })),
)
const EnhancedScheduler = lazy(() =>
  import("@/components/Scheduler/enhanced-scheduler").then((mod) => ({ default: mod.EnhancedScheduler })),
)

const EnhancedAnalytics = lazy(() =>
  import("@/components/Analytics/enhanced-analytics").then((mod) => ({ default: mod.EnhancedAnalytics })),
)
const ModulesPanel = lazy(() => import("@/components/Modules/modules-panel").then((mod) => ({ default: mod.ModulesPanel })))
const ModulePopoutView = lazy(() =>
  import("@/components/Modules/workspace/ModulePopoutView").then((mod) => ({ default: mod.ModulePopoutView })),
)
const SheetPopoutView = lazy(() =>
  import("@/components/spreadsheet/SheetPopoutView").then((mod) => ({ default: mod.SheetPopoutView })),
)
const KnowledgeGraph = lazy(() => import("@/components/Graph/KnowledgeGraph"))
const OperationsView = lazy(() =>
  import("@/components/Operations/OperationsView").then((mod) => ({ default: mod.OperationsView })),
)

// Loading fallback
const LoadingFallback = () => (
  <div className="w-full h-64 flex items-center justify-center">
    <div className="animate-pulse text-muted-foreground">Loading...</div>
  </div>
)

export default function Home() {
  const [activeTab, setActiveTab] = useState<AppTab>(() => readStoredTab(APP_NAV_KEYS.appTab, APP_TABS, "home"))
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [searchSelectedId, setSearchSelectedId] = useState<string | null>(null)
  const { open: searchOpen, setOpen: setSearchOpen } = useGlobalSearchHotkey()
  const capture = useQuickCaptureHotkey()
  const [popoutModuleId, setPopoutModuleId] = useState<string | null>(null)
  const [popoutSheetCategoryId, setPopoutSheetCategoryId] = useState<string | null>(null)
  // Bumped to force the Lists view to remount and re-read navigation when the
  // user jumps to a folder/list from global search while it's already open.
  const [listsNavKey, setListsNavKey] = useState(0)
  const folders = useTaskStore((s) => s.folders)

  // Install the workflow engine once on client mount so authored workflows run
  // on real item mutations. Idempotent + client-only (safe for static export).
  useEffect(() => {
    initWorkflowEngine({ adapter: createTaskRepositoryAdapter() })
  }, [])

  // Detect the pop-out route (`#popout/module/<id>`) and keep it in sync with
  // hash navigation, so a popped-out window renders just the module workspace.
  useEffect(() => {
    const read = () => {
      setPopoutModuleId(parseModulePopoutModuleId(window.location.hash))
      setPopoutSheetCategoryId(parseSheetPopoutCategoryId(window.location.hash))
    }
    read()
    window.addEventListener("hashchange", read)
    return () => window.removeEventListener("hashchange", read)
  }, [])

  useEffect(() => {
    writeStoredTab(APP_NAV_KEYS.appTab, activeTab)
  }, [activeTab])

  // Item detail (and other surfaces) can request a jump to a specific list.
  useEffect(() => {
    const handler = () => {
      setActiveTab("categories")
      setListsNavKey((k) => k + 1)
      setSelectedTaskId(null)
      setSearchSelectedId(null)
    }
    window.addEventListener(COGS_NAVIGATE_TO_LIST_EVENT, handler)
    return () => window.removeEventListener(COGS_NAVIGATE_TO_LIST_EVENT, handler)
  }, [])

  const handleTabChange = useCallback((value: string) => {
    setActiveTab(value as AppTab)
    setSelectedTaskId(null) // Clear task selection when changing tabs
  }, [])

  const handleTaskSelect = useCallback((taskId: string) => {
    setSelectedTaskId(taskId)
  }, [])

  const handleBackToList = useCallback(() => {
    setSelectedTaskId(null)
  }, [])

  // Global search (Cmd-K) routes the chosen result to the right destination:
  // items open in the compact detail popup overlaying the current screen (the
  // same way clicking an item in a list does); folders/lists jump to the Lists
  // view focused on that folder/list.
  const handleSearchSelect = useCallback(
    (selection: SearchSelection) => {
      if (selection.kind === "item") {
        setSearchSelectedId(selection.id)
        return
      }
      if (selection.kind === "folder") {
        writeListsNavigation({ location: selection.id, openTarget: null })
      } else {
        const parent = folders.find((f) => f.listIds.includes(selection.id))
        writeListsNavigation({
          location: parent?.id ?? "home",
          openTarget: { type: "category", id: selection.id },
        })
      }
      setActiveTab("categories")
      setListsNavKey((k) => k + 1)
    },
    [folders]
  )

  // Pop-out window: render only the standalone module workspace (no app shell).
  if (popoutModuleId) {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <ModulePopoutView moduleId={popoutModuleId} />
      </Suspense>
    )
  }

  // Pop-out window: render only a list's standalone spreadsheet (no app shell).
  if (popoutSheetCategoryId) {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <SheetPopoutView categoryId={popoutSheetCategoryId} />
      </Suspense>
    )
  }

  // If a task is selected, show the task detail view
  if (selectedTaskId) {
    return (
      <>
        <main className="min-h-screen bg-background">
          <div className="container mx-auto px-6 py-6 sm:px-8 lg:px-12">
            <EnhancedTaskDetail taskId={selectedTaskId} onBack={handleBackToList} />
          </div>
        </main>
        <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} onSelect={handleSearchSelect} />
        <TaskDetailPopup
          taskId={searchSelectedId ?? ""}
          open={!!searchSelectedId}
          onClose={() => setSearchSelectedId(null)}
        />
      </>
    )
  }

  return (
    <>
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-6 py-6 sm:px-8 lg:px-12">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">COGS</h1>
          <div className="flex items-center gap-4">
            <Reviews />
            <SettingsDialog />
            <CognitiveState />
            <Inbox onTaskSelect={handleTaskSelect} />
            <MetricLoggerButton />
            <EnhancedBulkAdd />
            <QuickAdd open={capture.open} onOpenChange={capture.setOpen} />
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="home">Home</TabsTrigger>
            <TabsTrigger value="categories">Lists</TabsTrigger>
            <TabsTrigger value="scheduler">Scheduler</TabsTrigger>
            <TabsTrigger value="operations">Operations</TabsTrigger>
            <TabsTrigger value="modules">Modules</TabsTrigger>
            <TabsTrigger value="graph">Graph</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <Suspense fallback={<LoadingFallback />}>
            {activeTab === "home" && (
              <TabsContent value="home">
                <HomeDashboard />
              </TabsContent>
            )}

            {activeTab === "categories" && (
              <TabsContent value="categories">
                <EnhancedCategoryView key={listsNavKey} onTaskSelect={handleTaskSelect} />
              </TabsContent>
            )}

            {activeTab === "scheduler" && (
              <TabsContent value="scheduler">
                <EnhancedScheduler />
              </TabsContent>
            )}

            {activeTab === "operations" && (
              <TabsContent value="operations">
                <OperationsView onTaskSelect={handleTaskSelect} />
              </TabsContent>
            )}

            {activeTab === "modules" && (
              <TabsContent value="modules">
                <ModulesPanel onTaskSelect={handleTaskSelect} />
              </TabsContent>
            )}

            {activeTab === "graph" && (
              <TabsContent value="graph">
                <KnowledgeGraph />
              </TabsContent>
            )}

            {activeTab === "analytics" && (
              <TabsContent value="analytics">
                <EnhancedAnalytics />
              </TabsContent>
            )}

          </Suspense>
        </Tabs>
      </div>
    </main>
    <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} onSelect={handleSearchSelect} />
    <TaskDetailPopup
      taskId={searchSelectedId ?? ""}
      open={!!searchSelectedId}
      onClose={() => setSearchSelectedId(null)}
    />
    </>
  )
}
