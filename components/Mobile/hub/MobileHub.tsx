/**
 * components/Mobile/hub/MobileHub.tsx — Phone page that watches every phone link
 *
 * One list of rows (Mac data, hub, unsent edits, location, Health, NFC, app
 * install) with a tone and a fix for each, then the same cards that control
 * them. `lib/mobile/hub-checks.ts` words the rows. The hub ping runs here.
 */
"use client"

import { useCallback, useEffect, useState } from "react"
import { MobileLogin } from "@/components/Mobile/MobileLogin"
import { MobilePullCard } from "@/components/Mobile/MobilePullCard"
import { MobileLocationCard } from "@/components/Mobile/location/MobileLocationCard"
import { MobileHealthCard } from "@/components/Mobile/health/MobileHealthCard"
import { MobileNfcCard } from "@/components/Mobile/nfc/MobileNfcCard"
import { Button } from "@/components/ui/button"
import { readMobileSession } from "@/lib/mobile-auth"
import { fetchMobileSyncStatus, loadBundledHubUrl, readMobileSyncUrl } from "@/lib/mobile-sync"
import { getLocationStatus, isLocationPluginAvailable, type LocationStatus } from "@/lib/mobile/location-bridge"
import { isHealthPluginAvailable } from "@/lib/mobile/health-bridge"
import { isNfcPluginAvailable } from "@/lib/mobile/nfc-bridge"
import { readNfcHub } from "@/lib/mobile/nfc-scan"
import { hubRows, hubSummary, type HubInput } from "@/lib/mobile/hub-checks"
import {
  engagePhoneWindow,
  getPhoneWindowReport,
  getPhoneWindowSnapshot,
  loadPhoneWindow,
  subscribePhoneWindow,
} from "@/lib/phone-window"
import "@/components/Mobile/mobile.css"
import "./mobile-hub.css"

const PING_MS = 6000
const OFF_LOCATION: LocationStatus = { available: false, permission: "unknown", recording: false, configured: false, queued: 0, dropped: 0 }

function reason(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

async function pingHub(url: string): Promise<HubInput["ping"]> {
  try {
    const status = await Promise.race([
      fetchMobileSyncStatus(url),
      new Promise<never>((_, no) => window.setTimeout(() => no(new Error("no answer in 6 s")), PING_MS)),
    ])
    return { ok: true, hasData: status.hasData }
  } catch (err) {
    return { ok: false, reason: reason(err) }
  }
}

export function MobileHubScreen() {
  const [session, setSession] = useState(false)
  const [booted, setBooted] = useState(false)

  useEffect(() => {
    setSession(!!readMobileSession())
    setBooted(true)
  }, [])

  if (!booted) return <div className="cogs-mobile-app" />
  if (!session) return <MobileLogin onLoggedIn={() => setSession(!!readMobileSession())} />
  return <MobileHub />
}

export function MobileHub() {
  const [snap, setSnap] = useState(getPhoneWindowSnapshot)
  const [input, setInput] = useState<Omit<HubInput, "windowStatus" | "windowDetail" | "now"> | null>(null)
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  const gather = useCallback(async () => {
    const hub = (await loadBundledHubUrl()) ?? readMobileSyncUrl()
    const report = await getPhoneWindowReport()
    const onPhone = isLocationPluginAvailable() || isHealthPluginAvailable() || isNfcPluginAvailable()
    setInput({
      hubUrl: report.hubUrl || hub,
      ping: null,
      loadedAt: report.loadedAt,
      outbox: report.outbox,
      onPhone,
      location: isLocationPluginAvailable() ? await getLocationStatus() : OFF_LOCATION,
      healthAvailable: isHealthPluginAvailable(),
      nfcAvailable: isNfcPluginAvailable(),
      nfcConfigured: !!readNfcHub(window.localStorage),
    })
    const ping = await pingHub(report.hubUrl || hub)
    setInput((prev) => (prev ? { ...prev, ping } : prev))
    setNow(Date.now())
  }, [])

  useEffect(() => {
    engagePhoneWindow()
    const off = subscribePhoneWindow(() => setSnap(getPhoneWindowSnapshot()))
    void loadPhoneWindow().then(() => gather())
    return off
  }, [gather])

  // The window settling changes the rows; a new status re-reads the outbox and plugins.
  useEffect(() => {
    if (snap.status === "live" || snap.status === "offline" || snap.status === "stale") void gather()
  }, [snap.status, gather])

  useEffect(() => {
    const id = window.setInterval(() => void gather(), 15000)
    return () => window.clearInterval(id)
  }, [gather])

  const recheck = async () => {
    setBusy(true)
    try {
      await loadPhoneWindow()
      await gather()
    } finally {
      setBusy(false)
    }
  }

  const rows = input ? hubRows({ ...input, windowStatus: snap.status, windowDetail: snap.detail, now }) : []
  const summary = hubSummary(rows)

  return (
    <div className="cogs-mobile-app mobile-hub" data-ui-name="Mobile hub" data-ui-docs="components/Mobile/README.md">
      <header className="cogs-mobile-chrome">
        <div className="cogs-mobile-topbar">
          <div className="cogs-mobile-brand">
            <h1>Mobile hub</h1>
            <span>Phone links</span>
          </div>
          <div className="cogs-mobile-topbar-actions">
            <a className="m-keycap" href="/">Desk</a>
            <a className="m-keycap" href="/mobile/">Home</a>
          </div>
        </div>
        <p className="cogs-mobile-window-line mobile-hub-summary" role="status" data-tone={summary.tone}>
          {input ? summary.line : "Checking…"}
        </p>
      </header>

      <main className="cogs-mobile-body">
        <ul className="mobile-hub-rows" aria-label="Phone link status">
          {rows.map((row) => (
            <li key={row.id} className="mobile-hub-row" data-tone={row.tone}>
              <span className="mobile-hub-dot" aria-hidden="true" />
              <div>
                <strong>{row.label}</strong>
                <span>{row.line}</span>
                {row.fix ? <em>{row.fix}</em> : null}
              </div>
            </li>
          ))}
        </ul>
        <Button type="button" className="m-keycap w-full" disabled={busy} onClick={() => void recheck()}>
          {busy ? "Checking…" : "Reload and check all"}
        </Button>
        <MobilePullCard />
        <MobileLocationCard />
        <MobileHealthCard />
        <MobileNfcCard />
      </main>
    </div>
  )
}
