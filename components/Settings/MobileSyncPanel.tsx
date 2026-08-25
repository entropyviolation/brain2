/**
 * components/Settings/MobileSyncPanel.tsx — Manual mobile hub controls.
 *
 * Continuous live sync is parked while the core app is finished. A dedicated
 * semi-mobile live sync component will land after that. This panel only
 * explains the pause and keeps rare manual hub push/pull.
 */
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Smartphone } from "lucide-react"
import {
  fetchMobileSyncStatus,
  pullAndRestoreMobileSync,
  pushCurrentMobileSync,
  readMobileSyncUrl,
} from "@/lib/mobile-sync"

export function MobileSyncPanel() {
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const url = typeof window !== "undefined" ? readMobileSyncUrl() : ""

  const handlePush = async () => {
    setBusy(true)
    try {
      const result = await pushCurrentMobileSync(url)
      setStatus(`Forced push at ${result.updatedAt}.`)
    } catch (err) {
      setStatus(`Push failed: ${err instanceof Error ? err.message : "Unknown error"}`)
    } finally {
      setBusy(false)
    }
  }

  const handleStatus = async () => {
    setBusy(true)
    try {
      const result = await fetchMobileSyncStatus(url)
      setStatus(
        result.hasData
          ? `Hub OK — last snapshot ${result.exportedAt ?? result.updatedAt}`
          : "Hub OK — empty (force-push from this Mac if the phone needs data).",
      )
    } catch (err) {
      setStatus(`Status failed: ${err instanceof Error ? err.message : "Unknown error"}`)
    } finally {
      setBusy(false)
    }
  }

  const handlePull = async () => {
    const confirmed = window.confirm(
      "Manual pull replaces THIS device's data with the shared hub snapshot. Continue?",
    )
    if (!confirmed) return
    setBusy(true)
    try {
      const result = await pullAndRestoreMobileSync(url)
      setStatus(
        result.restored
          ? `Pulled ${result.stores} stores + ${result.planText} plan entries.`
          : "No snapshot on the hub yet.",
      )
    } catch (err) {
      setStatus(`Pull failed: ${err instanceof Error ? err.message : "Unknown error"}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-dashed p-4">
      <div className="flex items-center gap-2">
        <Smartphone className="h-4 w-4" />
        <h3 className="font-semibold">Phone ↔ Desktop Live Sync</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Continuous live sync is paused for now. We are getting the rest of COGS solid
        first, then a dedicated <strong>semi-mobile live sync</strong> component will
        land. Until then, phones can still use a one-tap manual pull on{" "}
        <code className="text-xs">/mobile/</code>, and the buttons below are only for
        rare hub overrides.
      </p>
      <p className="text-xs text-muted-foreground break-all">Hub: {url || "(loading…)"}</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={handleStatus}>
          Check hub
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={handlePush}>
          Force push now
        </Button>
        <Button type="button" variant="destructive" size="sm" disabled={busy} onClick={handlePull}>
          Force pull now
        </Button>
      </div>
      {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}
    </div>
  )
}
