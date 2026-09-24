/**
 * app/page.tsx — Application root page
 *
 * The single page of the app. Renders the pinned full-width mill title bar
 * (`AppHeader`: BRAIN2 caption + today's-friend jewel + grouped press keys)
 * and the top-level tab bar (`data-ui-name="App tabs"`: Home, Lists, Docs,
 * Scheduler, Operations, Modules, Analytics), lazy-loading each module panel.
 * Item detail fills the desk *below* the pin bar — the header stays mounted.
 * Global hotkeys: Cmd/Ctrl-K search, Cmd/Ctrl-Shift-K quick capture,
 * Cmd/Ctrl-Z undo last Home/Tracking action.
 *
 * Spec: §2.2 (module hosting) and §8.2 (dashboard top bar / global quick actions).
 */
"use client"

import { useState, useCallback, lazy, Suspense, useEffect } from "react"
import { APP_NAV_KEYS, APP_TABS, writeListsNavigation, COGS_NAVIGATE_TO_LIST_EVENT, readStoredId, writeStoredId, type AppTab } from "@/lib/app-navigation"
import { usePersistedTab } from "@/lib/use-persisted-tab"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useMessageIngest } from "@/hooks/useMessageIngest"
import { EnhancedTaskDetail } from "@/components/ItemDetail/ItemDetailPage"
import { TaskDetailPopup } from "@/components/ItemDetail/ItemDetailPopup"
import { AppHeader } from "@/components/AppHeader"
import { GlobalSearch, type SearchSelection } from "@/components/Search/GlobalSearch"
import { useGlobalSearchHotkey } from "@/components/Search/useGlobalSearchHotkey"
import { useTaskStore } from "@/lib/task-store"
import { useQuickCaptureHotkey } from "@/hooks/useQuickCaptureHotkey"
import { useUndoHotkey } from "@/hooks/useUndoHotkey"
import { PersistStatusBanner } from "@/components/PersistStatusBanner"
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
const OperationsView = lazy(() =>
  import("@/components/Operations/OperationsView").then((mod) => ({ default: mod.OperationsView })),
)
const DocsPanel = lazy(() => import("@/components/Docs/DocsPanel").then((mod) => ({ default: mod.DocsPanel })))

// Loading fallback
const LoadingFallback = () => (
  <div className="w-full h-64 flex items-center justify-center">
    <div className="animate-pulse text-muted-foreground">Loading...</div>
  </div>
)

export default function Home() {
  const [activeTab, setActiveTab] = usePersistedTab(APP_NAV_KEYS.appTab, APP_TABS, "home")
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(() => readStoredId(APP_NAV_KEYS.appItemId))
  const [searchSelectedId, setSearchSelectedId] = useState<string | null>(null)
  const { open: searchOpen, setOpen: setSearchOpen } = useGlobalSearchHotkey()
  const capture = useQuickCaptureHotkey()
  useUndoHotkey()
  useMessageIngest()
  const [popoutModuleId, setPopoutModuleId] = useState<string | null>(null)
  const [popoutSheetCategoryId, setPopoutSheetCategoryId] = useState<string | null>(null)
  // Bumped to force the Lists view to remount and re-read navigation when the
  // user jumps to a folder/list from global search while it's already open.
  const [listsNavKey, setListsNavKey] = useState(0)
  const folders = useTaskStore((s) => s.folders)
  const tasks = useTaskStore((s) => s.tasks)

  useEffect(() => {
    writeStoredId(APP_NAV_KEYS.appItemId, selectedTaskId)
  }, [selectedTaskId])

  // Install the workflow engine once on client mount so authored workflows run
  // on real item mutations. Idempotent + client-only (safe for static export).
  useEffect(() => {
    initWorkflowEngine({ adapter: createTaskRepositoryAdapter() })
    void import("@/lib/doc-hydrate").then((mod) => mod.hydrateDocumentsFromIdb())
  }, [])

  useEffect(() => {
    if (!selectedTaskId) return
    if (!useTaskStore.persist.hasHydrated()) return
    if (tasks.some((t) => t.id === selectedTaskId)) return
    setSelectedTaskId(null)
  }, [selectedTaskId, tasks])

  // Detect a leftover hash pop-out on the *root* page (`#popout/module/<id>`).
  // New pop-outs use `/popout/?module=` (see `app/popout/page.tsx`); this is a
  // fallback so an old bookmark still skips the app shell when the hash survives.

  useEffect(() => {
    const read = () => {
      setPopoutModuleId(parseModulePopoutModuleId(window.location.hash))
      setPopoutSheetCategoryId(parseSheetPopoutCategoryId(window.location.hash))
    }
    read()
    window.addEventListener("hashchange", read)
    return () => window.removeEventListener("hashchange", read)
  }, [])

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

  // Pop-out window (legacy hash on `/`): render only the standalone module.
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

  return (
    <>
    <main className="min-h-screen bg-background">
      <AppHeader
        onTaskSelect={handleTaskSelect}
        captureOpen={capture.open}
        onCaptureOpenChange={capture.setOpen}
      />
      <div className="container mx-auto px-6 py-6 sm:px-8 lg:px-12">
        <PersistStatusBanner />
        {selectedTaskId ? (
          <EnhancedTaskDetail taskId={selectedTaskId} onBack={handleBackToList} />
        ) : (
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList
            className="flex w-full"
            data-ui-name="App tabs"
            data-ui-docs="components/README.md"
            data-ui-docs-anchor="top-level-tabs-from-apppagetsx"
          >
            <TabsTrigger value="home">Home</TabsTrigger>
            <TabsTrigger value="categories">Lists</TabsTrigger>
            <TabsTrigger value="docs">Docs</TabsTrigger>
            <TabsTrigger value="scheduler">Scheduler</TabsTrigger>
            <TabsTrigger value="operations">Operations</TabsTrigger>
            <TabsTrigger value="modules">Modules</TabsTrigger>
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

            {activeTab === "docs" && (
              <TabsContent value="docs">
                <DocsPanel />
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

            {activeTab === "analytics" && (
              <TabsContent value="analytics">
                <EnhancedAnalytics />
              </TabsContent>
            )}

          </Suspense>
        </Tabs>
        )}
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
