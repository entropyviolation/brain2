/**
 * components/spreadsheet/SheetPopoutView.tsx — Standalone spreadsheet window
 *
 * Renders a single list/category's `SheetGrid` on its own — no global header or
 * app tabs — for the "Open in new window" feature. `app/page.tsx` mounts this
 * when the URL hash matches the pop-out convention (`#popout/sheet/<categoryId>`).
 * In Electron this is a real `BrowserWindow`; in the browser it's a
 * `window.open(...)` tab. The grid is bound to the same list + store as the
 * in-app view, so edits persist everywhere through `task-store`. Item clicks open
 * an inline detail view within the same window.
 */
"use client"

import { lazy, Suspense, useEffect, useMemo, useState } from "react"
import { useTaskStore } from "@/lib/task-store"
import { getItemLabel } from "@/lib/item-utils"
import { SheetGrid } from "./SheetGrid"

const EnhancedTaskDetail = lazy(() =>
  import("@/components/enhanced-task-detail").then((mod) => ({ default: mod.EnhancedTaskDetail })),
)

export function SheetPopoutView({ categoryId }: { categoryId: string }) {
  const lists = useTaskStore((s) => s.lists)
  const folders = useTaskStore((s) => s.folders)
  const allTasks = useTaskStore((s) => s.tasks)
  const category = lists.find((c) => c.id === categoryId)
  const tasks = useMemo(() => allTasks.filter((t) => t.lists?.includes(categoryId)), [allTasks, categoryId])
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  // Persisted stores hydrate synchronously, but guard one tick for safety so a
  // freshly-opened window doesn't flash "not found" before hydration completes.
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 0)
    return () => clearTimeout(t)
  }, [])

  if (!category) {
    return (
      <main className="min-h-screen bg-background">
        <div className="container mx-auto px-6 py-10">
          <p className="text-muted-foreground">
            {ready ? "This list could not be found. It may have been deleted." : "Loading list…"}
          </p>
        </div>
      </main>
    )
  }

  if (selectedTaskId) {
    return (
      <main className="min-h-screen bg-background">
        <div className="container mx-auto px-6 py-6 sm:px-8 lg:px-12">
          <Suspense fallback={<div className="py-16 text-center text-muted-foreground">Loading…</div>}>
            <EnhancedTaskDetail taskId={selectedTaskId} onBack={() => setSelectedTaskId(null)} />
          </Suspense>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="px-4 py-4 sm:px-6">
        <h1 className="text-xl font-semibold mb-3">{category.name}</h1>
        <SheetGrid
          categoryId={categoryId}
          tasks={tasks}
          onOpenItem={setSelectedTaskId}
          newItemLabel={getItemLabel(category, folders, categoryId)}
          enablePopout={false}
        />
      </div>
    </main>
  )
}
