/**
 * app/page.tsx — Application root page
 *
 * The single page of the app. Renders the pinned full-width mill title bar
 * (`AppHeader`: BRAIN2 caption + Nav Back/Forward + today's-friend jewel +
 * grouped press keys) and the top-level tab bar (`data-ui-name="App tabs"`:
 * Home, Lists, Docs, Scheduler, Operations, Modules, Analytics) as one stuck
 * stack (`.b2-app-pin`): the bay sits flush under the fascia and keeps the
 * desk container's width, so the keys do not grow. Each module panel
 * lazy-loads below that stack. Item detail fills the desk *below* the pin —
 * the header stays mounted, the tab keys hide, and the tab desk stays mounted
 * (hidden) so Lists can jump back in place without rebuilding its task index.
 * `CaptureDoorHost` mounts Ingest, From Notes, and Phone Notes the first time
 * that door is opened; once mounted, a listing survives closing the popup.
 * Global hotkeys: Cmd/Ctrl-K search, Cmd/Ctrl-Shift-A Quick Add, Cmd/Ctrl-Z
 * undo last Home/Tracking action. On mount, `useDayScheduleRollover` settles
 * past periods and `useProcessInboxTodo` adds today's "process inbox
 * information" To Do when the revisit Inbox has more than 100 open ideas.
 * `useReminderTick` delivers due Reminders to the Inbox and Telegram while
 * this window is open. `useSystemHomeListPins`, `usePeopleIKnowList`,
 * `useCloseGiftIdeas`, `useInstagramFollowingList`, and
 * `useInstagramFollowersList` start on idle after the desk nav mark
 * (`brain2-nav-ready`), not during first paint: the pins keep the built-in
 * singleton lists on Lists Home, People I Know and the two Instagram lists
 * are created or adopted after hydrate, and people already marked Close get
 * a Gift ideas list (a later save that turns Close on or renames the person
 * updates it). The layout effect marks `brain2-nav-ready` and sets
 * `data-nav-ready`; `brain2-desk-ready` marks when the active tab's Suspense
 * child has mounted.
 *
 * Spec: §2.2 (module hosting) and §8.2 (dashboard top bar / global quick actions).
 */
"use client"

import { useState, useCallback, lazy, Suspense, useEffect, useLayoutEffect, useRef, type ReactNode } from "react"
import { APP_NAV_KEYS, APP_TABS, applyListsNavigation, COGS_NAVIGATE_TO_LIST_EVENT, readStoredId, readStoredTab, writeStoredId, type AppTab } from "@/lib/app-navigation"
import { subscribeNavRestore } from "@/lib/screen-location"
import { returnToHabitSettings } from "@/lib/habit-list-item"
import { usePersistedTab } from "@/lib/use-persisted-tab"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useMessageIngest } from "@/hooks/useMessageIngest"
import { AppHeader } from "@/components/AppHeader"
import type { SearchSelection } from "@/components/Search/GlobalSearch"
import { CaptureDoorHost } from "@/components/capture-doors"
import { useGlobalSearchHotkey } from "@/components/Search/useGlobalSearchHotkey"
import { useTaskStore } from "@/lib/task-store"
import { useQuickCaptureHotkey } from "@/hooks/useQuickCaptureHotkey"
import { useUndoHotkey } from "@/hooks/useUndoHotkey"
import { useDayScheduleRollover } from "@/hooks/use-day-rollover"
import { useProcessInboxTodo } from "@/hooks/use-inbox-process-todo"
import { useReminderTick } from "@/hooks/use-reminder-tick"
import { useSystemHomeListPins } from "@/lib/home-system-lists"
import { usePeopleIKnowList } from "@/hooks/use-people-i-know"
import { useCloseGiftIdeas } from "@/hooks/use-close-gift-ideas"
import { useInstagramFollowersList, useInstagramFollowingList } from "@/hooks/use-instagram-lists"
import { PersistStatusBanner } from "@/components/PersistStatusBanner"
import { MachineLoading } from "@/components/machine-loading"
import { PenSettingsHost } from "@/components/Home/Tracking/pen-settings-host"
import { TagSettingsHost } from "@/components/Home/Tracking/tag-settings-host"
import { parseModulePopoutModuleId } from "@/components/Modules/workspace/module-popout"
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
const EnhancedTaskDetail = lazy(() =>
  import("@/components/ItemDetail/ItemDetailPage").then((mod) => ({ default: mod.EnhancedTaskDetail })),
)
const TaskDetailPopup = lazy(() =>
  import("@/components/ItemDetail/ItemDetailPopup").then((mod) => ({ default: mod.TaskDetailPopup })),
)
const GlobalSearch = lazy(() =>
  import("@/components/Search/GlobalSearch").then((mod) => ({ default: mod.GlobalSearch })),
)

const LoadingFallback = () => <MachineLoading />

/** Last tab stays mounted beside the one you are on, so coming back is not a fresh download. */
function rememberWarm(prev: AppTab[], next: AppTab): AppTab[] {
  if (prev[0] === next && prev.length > 0) return prev
  return [next, ...prev.filter((tab) => tab !== next)].slice(0, 2)
}

/** Sibling of the lazy panel inside the same Suspense, so this commits only after that panel resolves — not while the fallback is showing. */
function DeskReadyMark() {
  useEffect(() => {
    performance.mark("brain2-desk-ready")
  }, [])
  return null
}

/** Built-in list seeds. Mounted after idle so these effects do not write the vault during first paint. */
function IdleVaultSeeds() {
  useSystemHomeListPins()
  usePeopleIKnowList()
  useCloseGiftIdeas()
  useInstagramFollowingList()
  useInstagramFollowersList()
  return null
}

function DeskTab({
  tab,
  active,
  children,
}: {
  tab: AppTab
  active: boolean
  children: ReactNode
}) {
  return (
    <TabsContent
      value={tab}
      forceMount
      className={active ? undefined : "hidden"}
      hidden={active ? undefined : true}
      aria-hidden={active ? undefined : true}
    >
      <Suspense fallback={active ? <LoadingFallback /> : null}>
        {children}
        {active ? <DeskReadyMark /> : null}
      </Suspense>
    </TabsContent>
  )
}

export default function Home() {
  const [activeTab, setActiveTab] = usePersistedTab(APP_NAV_KEYS.appTab, APP_TABS, "home", "hydrate")
  const [warm, setWarm] = useState<AppTab[]>([])
  const opened = useRef(false)
  const [vaultSeedsReady, setVaultSeedsReady] = useState(false)
  useLayoutEffect(() => {
    const stored = readStoredTab(APP_NAV_KEYS.appTab, APP_TABS, "home")
    setWarm((prev) => rememberWarm(prev, opened.current ? activeTab : stored))
    opened.current = true
    document.documentElement.dataset.navReady = "1"
    performance.mark("brain2-nav-ready")
  }, [activeTab])
  // Nav-ready is a layout effect, so it has already run before this schedules idle.
  useEffect(() => {
    const run = () => setVaultSeedsReady(true)
    if (typeof requestIdleCallback === "function") {
      const id = requestIdleCallback(run, { timeout: 1500 })
      return () => cancelIdleCallback(id)
    }
    const id = window.setTimeout(run, 1)
    return () => window.clearTimeout(id)
  }, [])
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(() => readStoredId(APP_NAV_KEYS.appItemId))
  const [searchSelectedId, setSearchSelectedId] = useState<string | null>(null)
  const { open: searchOpen, setOpen: setSearchOpen } = useGlobalSearchHotkey()
  const capture = useQuickCaptureHotkey()
  useUndoHotkey()
  useMessageIngest()
  useDayScheduleRollover()
  useProcessInboxTodo()
  useReminderTick()
  const [popoutModuleId, setPopoutModuleId] = useState<string | null>(null)
  const [popoutSheetCategoryId, setPopoutSheetCategoryId] = useState<string | null>(null)
  const selectedMissing = useTaskStore((s) => {
    if (!selectedTaskId) return false
    if (!useTaskStore.persist.hasHydrated()) return false
    return !s.tasks.some((t) => t.id === selectedTaskId)
  })

  useEffect(() => {
    writeStoredId(APP_NAV_KEYS.appItemId, selectedTaskId)
  }, [selectedTaskId])

  // Screen history Back/Forward rewrites appItemId; keep the desk in sync.
  useEffect(() => {
    return subscribeNavRestore(() => {
      setSelectedTaskId(readStoredId(APP_NAV_KEYS.appItemId))
    })
  }, [])

  // Install the workflow engine once on client mount so authored workflows run
  // on real item mutations. Idempotent + client-only (safe for static export).
  useEffect(() => {
    initWorkflowEngine({ adapter: createTaskRepositoryAdapter() })
    void import("@/lib/doc-hydrate").then((mod) => mod.hydrateDocumentsFromIdb())
  }, [])

  useEffect(() => {
    if (selectedMissing) setSelectedTaskId(null)
  }, [selectedMissing])

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
  // Lists navigation is already written + applied in place by the event source;
  // the shell only switches tab and clears overlays — never remount Lists.
  useEffect(() => {
    const handler = () => {
      setActiveTab("categories")
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
    if (returnToHabitSettings()) {
      setSelectedTaskId(null)
      return
    }
    setSelectedTaskId(null)
  }, [])

  // Global search (Cmd-K) routes the chosen result to the right destination:
  // items open in the compact detail popup overlaying the current screen (the
  // same way clicking an item in a list does); folders/lists jump to the Lists
  // view focused on that folder/list (in-place nav — no Lists remount).
  const handleSearchSelect = useCallback(
    (selection: SearchSelection) => {
      if (selection.kind === "item") {
        setSearchSelectedId(selection.id)
        return
      }
      if (selection.kind === "folder") {
        applyListsNavigation({ location: selection.id, openTarget: null })
      } else {
        const folders = useTaskStore.getState().folders
        const parent = folders.find((f) => f.listIds.includes(selection.id))
        applyListsNavigation({
          location: parent?.id ?? "home",
          openTarget: { type: "category", id: selection.id },
        })
      }
      setActiveTab("categories")
    },
    [],
  )

  const vaultSeeds = vaultSeedsReady ? <IdleVaultSeeds /> : null

  // Pop-out window (legacy hash on `/`): render only the standalone module.
  if (popoutModuleId) {
    return (
      <>
        {vaultSeeds}
        <Suspense fallback={<LoadingFallback />}>
          <ModulePopoutView moduleId={popoutModuleId} />
        </Suspense>
      </>
    )
  }

  // Pop-out window: render only a list's standalone spreadsheet (no app shell).
  if (popoutSheetCategoryId) {
    return (
      <>
        {vaultSeeds}
        <Suspense fallback={<LoadingFallback />}>
          <SheetPopoutView categoryId={popoutSheetCategoryId} />
        </Suspense>
      </>
    )
  }

  return (
    <>
    {vaultSeeds}
    <PenSettingsHost />
    <TagSettingsHost />
    <main className="min-h-screen bg-background">
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        {/* Header and the tab bay share one sticky stack. The bay uses the
            same container inset as the desk, so the keys stay the width they
            already are. Item detail hides the bay; the header stays. */}
        <div className="b2-app-pin">
          <AppHeader
            onTaskSelect={handleTaskSelect}
            captureOpen={capture.open}
            onCaptureOpenChange={capture.setOpen}
            captureSeed={capture.seed}
            onOpenSearch={() => setSearchOpen(true)}
          />
          <div
            className={selectedTaskId ? "hidden" : "container mx-auto px-6 sm:px-8 lg:px-12"}
            hidden={selectedTaskId ? true : undefined}
            aria-hidden={selectedTaskId ? true : undefined}
          >
            <TabsList
              className="flex w-full"
              data-ui-name="App tabs"
              data-ui-docs="components/README.md"
              data-ui-docs-anchor="top-level-tabs-from-apppagetsx"
            >
              <TabsTrigger value="home" data-tab="home">Home</TabsTrigger>
              <TabsTrigger value="categories" data-tab="categories">Lists</TabsTrigger>
              <TabsTrigger value="docs" data-tab="docs">Docs</TabsTrigger>
              <TabsTrigger value="scheduler" data-tab="scheduler">Scheduler</TabsTrigger>
              <TabsTrigger value="operations" data-tab="operations">Operations</TabsTrigger>
              <TabsTrigger value="modules" data-tab="modules">Modules</TabsTrigger>
              <TabsTrigger value="analytics" data-tab="analytics">Analytics</TabsTrigger>
            </TabsList>
          </div>
        </div>
      <div className={`container mx-auto px-6 sm:px-8 lg:px-12 ${selectedTaskId ? "py-6" : "pb-6"}`}>
        <PersistStatusBanner />
        {/* Keep the desk mounted under full-page item detail so Lists (and its
            task index) stay warm — jumping to a list from a chip must not rebuild
            the vault from a cold remount. */}
        {selectedTaskId ? (
          <Suspense fallback={<LoadingFallback />}>
            <EnhancedTaskDetail taskId={selectedTaskId} onBack={handleBackToList} />
          </Suspense>
        ) : null}
        <div
          className={selectedTaskId ? "hidden" : undefined}
          aria-hidden={selectedTaskId ? true : undefined}
          data-testid="app-desk"
        >
            {warm.includes("home") && (
              <DeskTab tab="home" active={activeTab === "home"}>
                <HomeDashboard />
              </DeskTab>
            )}
            {warm.includes("categories") && (
              <DeskTab tab="categories" active={activeTab === "categories"}>
                <EnhancedCategoryView onTaskSelect={handleTaskSelect} />
              </DeskTab>
            )}
            {warm.includes("docs") && (
              <DeskTab tab="docs" active={activeTab === "docs"}>
                <DocsPanel />
              </DeskTab>
            )}
            {warm.includes("scheduler") && (
              <DeskTab tab="scheduler" active={activeTab === "scheduler"}>
                <EnhancedScheduler />
              </DeskTab>
            )}
            {warm.includes("operations") && (
              <DeskTab tab="operations" active={activeTab === "operations"}>
                <OperationsView onTaskSelect={handleTaskSelect} />
              </DeskTab>
            )}
            {warm.includes("modules") && (
              <DeskTab tab="modules" active={activeTab === "modules"}>
                <ModulesPanel onTaskSelect={handleTaskSelect} />
              </DeskTab>
            )}
            {warm.includes("analytics") && (
              <DeskTab tab="analytics" active={activeTab === "analytics"}>
                <EnhancedAnalytics />
              </DeskTab>
            )}
        </div>
      </div>
      </Tabs>
    </main>
    <CaptureDoorHost />
    {searchOpen ? (
      <Suspense fallback={null}>
        <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} onSelect={handleSearchSelect} />
      </Suspense>
    ) : null}
    {searchSelectedId ? (
      <Suspense fallback={null}>
        <TaskDetailPopup
          taskId={searchSelectedId}
          open
          onClose={() => setSearchSelectedId(null)}
        />
      </Suspense>
    ) : null}
    </>
  )
}
