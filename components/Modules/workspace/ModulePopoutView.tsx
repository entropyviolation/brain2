/**
 * components/Modules/workspace/ModulePopoutView.tsx — Standalone module window
 *
 * Renders a single module workspace on its own — no global header or app tabs —
 * for the "Pop out" feature. `app/page.tsx` mounts this when the URL hash matches
 * the pop-out convention (`#popout/module/<id>`). In Electron this is a real
 * `BrowserWindow`; in the browser it's a `window.open(...)` tab. Item clicks open
 * an inline detail view within the same window.
 */
"use client"

import { lazy, Suspense, useEffect, useState } from "react"
import { useModulesStore } from "@/lib/modules-store"
import { ModuleWorkspace } from "./ModuleWorkspace"

const EnhancedTaskDetail = lazy(() =>
  import("@/components/enhanced-task-detail").then((mod) => ({ default: mod.EnhancedTaskDetail })),
)

export function ModulePopoutView({ moduleId }: { moduleId: string }) {
  const module = useModulesStore((s) => s.modules.find((m) => m.id === moduleId))
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  // Persisted stores hydrate synchronously, but guard one tick for safety so a
  // freshly-opened window doesn't flash "not found" before hydration completes.
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 0)
    return () => clearTimeout(t)
  }, [])

  if (!module) {
    return (
      <main className="min-h-screen bg-background">
        <div className="container mx-auto px-6 py-10">
          <p className="text-muted-foreground">
            {ready ? "This module could not be found. It may have been deleted." : "Loading module…"}
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-6 py-6 sm:px-8 lg:px-12">
        {selectedTaskId ? (
          <Suspense fallback={<div className="py-16 text-center text-muted-foreground">Loading…</div>}>
            <EnhancedTaskDetail taskId={selectedTaskId} onBack={() => setSelectedTaskId(null)} />
          </Suspense>
        ) : (
          <ModuleWorkspace
            module={module}
            popout
            onBack={() => {
              if (typeof window !== "undefined") window.close()
            }}
            onOpenItem={setSelectedTaskId}
          />
        )}
      </div>
    </main>
  )
}
