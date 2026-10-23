/**
 * app/popout/page.tsx — Standalone pop-out window
 *
 * A dedicated static route (not the root app shell) so "Pop out" opens *only*
 * the current module workspace or spreadsheet. Query: `?module=<id>` or
 * `?sheet=<categoryId>`, or `?view=texts` for Analytics → Texts. Legacy hashes `#popout/module/…` and `#popout/sheet/…`
 * still work if they land on this page.
 */
"use client"

import { lazy, Suspense, useEffect, useState } from "react"
import { MachineLoading } from "@/components/machine-loading"
import { parseModulePopoutLocation } from "@/components/Modules/workspace/module-popout"
import { parseSheetPopoutLocation } from "@/components/spreadsheet/sheet-popout"

const ModulePopoutView = lazy(() =>
  import("@/components/Modules/workspace/ModulePopoutView").then((mod) => ({ default: mod.ModulePopoutView })),
)
const SheetPopoutView = lazy(() =>
  import("@/components/spreadsheet/SheetPopoutView").then((mod) => ({ default: mod.SheetPopoutView })),
)
const TextsReportView = lazy(() =>
  import("@/components/Analytics/TextsReportView").then((mod) => ({ default: mod.TextsReportView })),
)

type Route = { moduleId: string | null; sheetId: string | null; view: string | null }

function readRoute(): Route {
  if (typeof window === "undefined") return { moduleId: null, sheetId: null, view: null }
  return {
    moduleId: parseModulePopoutLocation(window.location),
    sheetId: parseSheetPopoutLocation(window.location),
    view: new URLSearchParams(window.location.search).get("view"),
  }
}

export default function PopoutPage() {
  const [route, setRoute] = useState<Route>({ moduleId: null, sheetId: null, view: null })
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const read = () => setRoute(readRoute())
    read()
    setReady(true)
    window.addEventListener("hashchange", read)
    return () => window.removeEventListener("hashchange", read)
  }, [])

  if (route.view === "texts") {
    return (
      <main className="h-screen bg-background p-3">
        <Suspense fallback={<MachineLoading label="Loading texts…" />}>
          <TextsReportView popout />
        </Suspense>
      </main>
    )
  }

  if (route.moduleId) {
    return (
      <Suspense fallback={<MachineLoading label="Loading module…" />}>
        <ModulePopoutView moduleId={route.moduleId} />
      </Suspense>
    )
  }

  if (route.sheetId) {
    return (
      <Suspense fallback={<MachineLoading label="Loading spreadsheet…" />}>
        <SheetPopoutView categoryId={route.sheetId} />
      </Suspense>
    )
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-6 py-10">
        {ready ? (
          <p className="text-muted-foreground">
            Nothing to show in this window. Close it and pop out a module again.
          </p>
        ) : (
          <MachineLoading />
        )}
      </div>
    </main>
  )
}
