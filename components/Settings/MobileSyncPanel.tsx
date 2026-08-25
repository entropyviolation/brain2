/**
 * components/Settings/MobileSyncPanel.tsx — Live sync status / advanced controls.
 *
 * Continuous sync runs automatically via LiveSyncHost when using `npm run dev`.
 * This panel is only for pause/resume explanation and rare manual override.
 */
"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Smartphone } from "lucide-react"
import {
  fetchMobileSyncStatus,
  pullAndRestoreMobileSync,
  pushCurrentMobileSync,
  readMobileSyncUrl,
} from "@/lib/mobile-sync"
import { isLiveSyncEnabled, setLiveSyncEnabled } from "@/lib/live-sync"

export function MobileSyncPanel() {
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [enabled, setEnabled] = useState(true)
  const url = typeof window !== "undefined" ? readMobileSyncUrl() : ""

  useEffect(() => {
    setEnabled(isLiveSyncEnabled())
  }, [])

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
          : "Hub OK — empty (edit something on desktop; it will auto-upload).",
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
        Live sync runs both ways by default (phone ↔ desktop) for Home, Lists, Inbox, and other shared
        stores. Edits upload within about a second; the other device picks them up within a few seconds.
        Empty / tiny snapshots are rejected so a blank phone cannot wipe desktop. Use the same origin:{" "}
        <code className="text-xs">http://localhost:3000</code> on Mac and{" "}
        <code className="text-xs">http://&lt;mac-ip&gt;:3000/mobile/</code> on phone.
      </p>
      <p className="text-xs text-muted-foreground break-all">Hub: {url || "(loading…)"}</p>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => {
            setLiveSyncEnabled(e.target.checked)
            setEnabled(e.target.checked)
            setStatus(e.target.checked ? "Live sync enabled — reload if status chip looks stuck." : "Live sync paused.")
          }}
        />
        Enable continuous live sync
      </label>
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
