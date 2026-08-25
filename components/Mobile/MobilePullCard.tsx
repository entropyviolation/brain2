/**
 * One-tap pull from the shared hub onto this phone.
 * Continuous live sync is parked; this is the current manual path after desktop
 * seeds the hub. A semi-mobile live sync component will replace this later.
 */
"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  fetchMobileSyncStatus,
  pullAndRestoreMobileSync,
  readMobileSyncUrl,
} from "@/lib/mobile-sync"

export function MobilePullCard() {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("Checking desktop hub…")
  const [hasData, setHasData] = useState(false)
  const url = readMobileSyncUrl()

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const status = await fetchMobileSyncStatus(url)
        if (cancelled) return
        setHasData(status.hasData)
        setMessage(
          status.hasData
            ? `Desktop hub ready (${status.exportedAt ?? status.updatedAt}). Pull to load it here.`
            : "Hub empty — on Mac Electron at localhost:3000 open Settings → Force push now.",
        )
      } catch {
        if (!cancelled) {
          setHasData(false)
          setMessage(`Can't reach ${url}/api/sync — on Mac run npm run dev (same Wi‑Fi).`)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [url])

  const pull = async () => {
    const ok = window.confirm(
      "Replace data on THIS phone with the desktop hub snapshot? Desktop is not changed.",
    )
    if (!ok) return
    setBusy(true)
    setMessage("Pulling…")
    try {
      const result = await pullAndRestoreMobileSync(url)
      if (!result.restored) {
        setMessage("Hub has no snapshot yet. Force push from desktop Settings first.")
        setBusy(false)
        return
      }
      setMessage(`Loaded ${result.stores} stores — reloading…`)
      window.location.reload()
    } catch (err) {
      setMessage(`Pull failed: ${err instanceof Error ? err.message : "error"}`)
      setBusy(false)
    }
  }

  return (
    <div className="cogs-mobile-pullcard">
      <div className="cogs-mobile-pullcard-row">
        <strong>Desktop data</strong>
        <span className={hasData ? "ok" : "warn"}>{busy ? "Working…" : message}</span>
      </div>
      <Button type="button" className="w-full" disabled={busy || !hasData} onClick={pull}>
        Pull desktop data onto phone
      </Button>
    </div>
  )
}
