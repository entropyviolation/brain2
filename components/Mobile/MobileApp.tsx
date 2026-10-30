/**
 * components/Mobile/MobileApp.tsx — Sideloadable Home, Lists, Inventory, and BIM Chat shell for iOS.
 *
 * After login the shell loads the Mac vault into memory (`lib/phone-window.ts`).
 * Refresh on `MobilePullCard` fetches that window again. It does not copy the
 * file into localStorage.
 */
"use client"

import { lazy, Suspense, useEffect, useRef, useState } from "react"
import { HomeDashboard } from "@/components/Home/home-dashboard"
import { Reviews } from "@/components/Reviews/reviews"
import { Inbox } from "@/components/inbox"
import { EnhancedBulkAdd } from "@/components/enhanced-bulk-add"
import { QuickAdd } from "@/components/quick-add"
import { QuickAddWroteHost } from "@/components/quick-add-wrote"
import { NotesIngest } from "@/components/notes-ingest"
import { IphoneNotesStore } from "@/components/iphone-notes-store"
import { TaskDetailPopup } from "@/components/ItemDetail/ItemDetailPopup"
import { MobileLogin } from "@/components/Mobile/MobileLogin"
import { MobilePullCard } from "@/components/Mobile/MobilePullCard"
import { MobileLocationCard } from "@/components/Mobile/location/MobileLocationCard"
import { MobileHealthCard } from "@/components/Mobile/health/MobileHealthCard"
import { MobileNfcCard } from "@/components/Mobile/nfc/MobileNfcCard"
import { PersistStatusBanner } from "@/components/PersistStatusBanner"
import { installTouchDnD } from "@/components/Mobile/install-touch-dnd"
import { APP_NAME } from "@/lib/app-brand"
import { clearMobileSession, readMobileSession } from "@/lib/mobile-auth"
import { engagePhoneWindow, getPhoneWindowSnapshot, loadPhoneWindow, phoneWindowNote, subscribePhoneWindow } from "@/lib/phone-window"
import { OPEN_ITEM_POPUP_EVENT } from "@/lib/points-ledger-nav"
import { Button } from "@/components/ui/button"
import "@/components/Mobile/mobile.css"

const ListsPanel = lazy(() =>
  import("@/components/Lists/enhanced-list-view").then((mod) => ({ default: mod.EnhancedCategoryView })),
)

const InventoryPanel = lazy(() =>
  import("@/components/Inventory/phone/inventory-phone").then((mod) => ({ default: mod.InventoryPhoneScreen })),
)

const BimPanel = lazy(() =>
  import("@/components/Bim/phone/bim-phone").then((mod) => ({ default: mod.BimPhoneScreen })),
)

type MobileTab = "home" | "lists" | "inventory" | "bim"

function sectionName(tab: MobileTab): string {
  if (tab === "home") return "Home"
  if (tab === "lists") return "Lists"
  if (tab === "bim") return "BIM Chat"
  return "Inventory"
}

export function MobileApp() {
  engagePhoneWindow()
  const [session, setSession] = useState(() => readMobileSession())
  const [tab, setTab] = useState<MobileTab>("home")
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [windowStatus, setWindowStatus] = useState(() => getPhoneWindowSnapshot().status)
  const rootRef = useRef<HTMLDivElement>(null)
  const windowLine = phoneWindowNote(windowStatus)

  useEffect(() => subscribePhoneWindow(() => setWindowStatus(getPhoneWindowSnapshot().status)), [])

  useEffect(() => {
    if (!session) return
    let cancelled = false
    loadPhoneWindow().then(() => {
      if (!cancelled) setWindowStatus(getPhoneWindowSnapshot().status)
    })
    return () => {
      cancelled = true
    }
  }, [session])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    return installTouchDnD(root)
  }, [session])

  useEffect(() => {
    const handler = (event: Event) => {
      const id = (event as CustomEvent<{ id?: unknown }>).detail?.id
      if (typeof id === "string" && id) setSelectedTaskId(id)
    }
    window.addEventListener(OPEN_ITEM_POPUP_EVENT, handler)
    return () => window.removeEventListener(OPEN_ITEM_POPUP_EVENT, handler)
  }, [])

  if (!session) {
    return <MobileLogin onLoggedIn={() => setSession(readMobileSession())} />
  }

  return (
    <div className="cogs-mobile-app" ref={rootRef}>
      <header className="cogs-mobile-chrome">
        <div className="cogs-mobile-topbar">
          <div className="cogs-mobile-brand">
            <h1>{APP_NAME}</h1>
            <span>{sectionName(tab)}</span>
          </div>
          <div className="cogs-mobile-topbar-actions">
            <QuickAdd />
            <QuickAddWroteHost />
            <Inbox onTaskSelect={setSelectedTaskId} />
            <EnhancedBulkAdd />
            <NotesIngest />
            <IphoneNotesStore />
            <Reviews />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="m-keycap"
              onClick={() => {
                clearMobileSession()
                setSession(null)
              }}
            >
              Log out
            </Button>
          </div>
        </div>

        <nav className="cogs-mobile-main-tabs" aria-label="Mobile sections" style={{ gridTemplateColumns: "repeat(5, minmax(0, 1fr))" }}>
          <button type="button" className={tab === "home" ? "m-keycap active" : "m-keycap"} onClick={() => setTab("home")}>
            Home
          </button>
          <button type="button" className={tab === "lists" ? "m-keycap active" : "m-keycap"} onClick={() => setTab("lists")}>
            Lists
          </button>
          <button type="button" className={tab === "inventory" ? "m-keycap active" : "m-keycap"} onClick={() => setTab("inventory")}>
            Inventory
          </button>
          <button type="button" className={tab === "bim" ? "m-keycap active" : "m-keycap"} onClick={() => setTab("bim")}>
            BIM
          </button>
          <a className="m-keycap" href="/mobile/nfc/">NFC</a>
        </nav>
      </header>

      <main className="cogs-mobile-body">
        {windowLine ? (
          <p className="cogs-mobile-loading" role="status">
            {windowLine}
          </p>
        ) : null}
        <PersistStatusBanner />
        {tab === "bim" ? null : (
          <>
            <MobilePullCard />
            <MobileLocationCard />
            <MobileHealthCard />
            <MobileNfcCard />
          </>
        )}
        {tab === "bim" ? (
          <Suspense fallback={<div className="cogs-mobile-loading">Loading BIM…</div>}>
            <BimPanel />
          </Suspense>
        ) : tab === "home" ? (
          <HomeDashboard />
        ) : tab === "lists" ? (
          <Suspense fallback={<div className="cogs-mobile-loading">Loading Lists…</div>}>
            <div className="cogs-mobile-lists">
              <ListsPanel onTaskSelect={setSelectedTaskId} />
            </div>
          </Suspense>
        ) : (
          <Suspense fallback={<div className="cogs-mobile-loading">Loading Inventory…</div>}>
            <InventoryPanel />
          </Suspense>
        )}
      </main>

      <TaskDetailPopup taskId={selectedTaskId} open={!!selectedTaskId} onClose={() => setSelectedTaskId(null)} />
    </div>
  )
}
