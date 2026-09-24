/**
 * app/popout/page.tsx — Standalone pop-out window
 *
 * A dedicated static route (not the root app shell) so "Pop out" opens *only*
 * the current module workspace or spreadsheet. Query: `?module=<id>` or
 * `?sheet=<categoryId>`. Legacy hashes `#popout/module/…` and `#popout/sheet/…`
 * still work if they land on this page.
 */
"use client"

import { lazy, Suspense, useEffect, useState } from "react"
import { parseModulePopoutLocation } from "@/components/Modules/workspace/module-popout"
import { parseSheetPopoutLocation } from "@/components/spreadsheet/sheet-popout"

const ModulePopoutView = lazy(() =>
  import("@/components/Modules/workspace/ModulePopoutView").then((mod) => ({ default: mod.ModulePopoutView })),
)
const SheetPopoutView = lazy(() =>
  import("@/components/spreadsheet/SheetPopoutView").then((mod) => ({ default: mod.SheetPopoutView })),
)

function readRoute(): { moduleId: string | null; sheetId: string | null } {
  if (typeof window === "undefined") return { moduleId: null, sheetId: null }
  return {
    moduleId: parseModulePopoutLocation(window.location),
    sheetId: parseSheetPopoutLocation(window.location),
  }
}

export default function PopoutPage() {
  const [route, setRoute] = useState<{ moduleId: string | null; sheetId: string | null }>({
    moduleId: null,
    sheetId: null,
  })
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const read = () => setRoute(readRoute())
    read()
    setReady(true)
    window.addEventListener("hashchange", read)
    return () => window.removeEventListener("hashchange", read)
  }, [])

  if (route.moduleId) {
    return (
      <Suspense fallback={<p className="p-6 text-muted-foreground">Loading module…</p>}>
        <ModulePopoutView moduleId={route.moduleId} />
      </Suspense>
    )
  }

  if (route.sheetId) {
    return (
      <Suspense fallback={<p className="p-6 text-muted-foreground">Loading spreadsheet…</p>}>
        <SheetPopoutView categoryId={route.sheetId} />
      </Suspense>
    )
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-6 py-10">
        <p className="text-muted-foreground">
          {ready ? "Nothing to show in this window. Close it and pop out a module again." : "Loading…"}
        </p>
      </div>
    </main>
  )
}
