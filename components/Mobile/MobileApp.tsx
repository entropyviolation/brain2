/**
 * components/Mobile/MobileApp.tsx — Sideloadable Home + Lists shell for iOS.
 *
 * Continuous live sync is parked while the core app is finished. Use
 * `MobilePullCard` for a one-tap manual pull. A dedicated semi-mobile live
 * sync component will land after those surfaces are solid.
 */
"use client"

import { lazy, Suspense, useEffect, useRef, useState } from "react"
import { HomeDashboard } from "@/components/Home/home-dashboard"
import { Reviews } from "@/components/Reviews/reviews"
import { Inbox } from "@/components/inbox"
import { EnhancedBulkAdd } from "@/components/enhanced-bulk-add"
import { NotesIngest } from "@/components/notes-ingest"
import { TaskDetailPopup } from "@/components/ItemDetail/ItemDetailPopup"
import { MobileLogin } from "@/components/Mobile/MobileLogin"
import { MobilePullCard } from "@/components/Mobile/MobilePullCard"
import { PersistStatusBanner } from "@/components/PersistStatusBanner"
import { installTouchDnD } from "@/components/Mobile/install-touch-dnd"
import { clearMobileSession, readMobileSession } from "@/lib/mobile-auth"
import { Button } from "@/components/ui/button"
import "@/components/Mobile/mobile.css"

const ListsPanel = lazy(() =>
  import("@/components/Lists/enhanced-list-view").then((mod) => ({ default: mod.EnhancedCategoryView })),
)

type MobileTab = "home" | "lists"

export function MobileApp() {
  const [session, setSession] = useState(() => readMobileSession())
  const [tab, setTab] = useState<MobileTab>("home")
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    return installTouchDnD(root)
  }, [session])

  if (!session) {
    return <MobileLogin onLoggedIn={() => setSession(readMobileSession())} />
  }

  return (
    <div className="cogs-mobile-app" ref={rootRef}>
      <header className="cogs-mobile-chrome">
        <div className="cogs-mobile-topbar">
          <div className="cogs-mobile-brand">
            <h1>COGS</h1>
            <span>{tab === "home" ? "Home" : "Lists"}</span>
          </div>
          <div className="cogs-mobile-topbar-actions">
            <Inbox onTaskSelect={setSelectedTaskId} />
            <EnhancedBulkAdd />
            <NotesIngest />
            <Reviews />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                clearMobileSession()
                setSession(null)
              }}
            >
              Log out
            </Button>
          </div>
        </div>

        <nav className="cogs-mobile-main-tabs" aria-label="Mobile sections">
          <button type="button" className={tab === "home" ? "active" : undefined} onClick={() => setTab("home")}>
            Home
          </button>
          <button type="button" className={tab === "lists" ? "active" : undefined} onClick={() => setTab("lists")}>
            Lists
          </button>
        </nav>
      </header>

      <main className="cogs-mobile-body">
        <PersistStatusBanner />
        <MobilePullCard />
        {tab === "home" ? (
          <HomeDashboard />
        ) : (
          <Suspense fallback={<div className="cogs-mobile-loading">Loading Lists…</div>}>
            <div className="cogs-mobile-lists">
              <ListsPanel onTaskSelect={setSelectedTaskId} />
            </div>
          </Suspense>
        )}
      </main>

      <TaskDetailPopup taskId={selectedTaskId} open={!!selectedTaskId} onClose={() => setSelectedTaskId(null)} />
    </div>
  )
}
