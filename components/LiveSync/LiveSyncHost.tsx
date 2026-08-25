/**
 * components/LiveSync/LiveSyncHost.tsx — Always-on mutual sync status + engine.
 */
"use client"

import { useEffect, useState } from "react"
import { isLiveSyncEnabled, setLiveSyncEnabled, startLiveSync, type LiveSyncStatus } from "@/lib/live-sync"

export function LiveSyncHost({ compact = false }: { compact?: boolean }) {
  const [status, setStatus] = useState<LiveSyncStatus | null>(null)
  const [enabled, setEnabled] = useState(true)

  useEffect(() => {
    const on = isLiveSyncEnabled()
    setEnabled(on)
    if (!on) {
      setStatus({
        state: "offline",
        message: "Live sync paused",
        url: "",
        lastRemoteAt: null,
      })
      return
    }
    return startLiveSync(setStatus)
  }, [enabled])

  const color =
    status?.state === "synced"
      ? "#0a7a32"
      : status?.state === "syncing" || status?.state === "starting"
        ? "#0b57a4"
        : status?.state === "error"
          ? "#a35b00"
          : "#8b0000"

  const label =
    status?.state === "synced"
      ? "Live sync"
      : status?.state === "syncing" || status?.state === "starting"
        ? "Syncing…"
        : status?.state === "error"
          ? "Sync blocked"
          : "Sync off"

  return (
    <div
      className={compact ? "cogs-live-sync cogs-live-sync-compact" : "cogs-live-sync"}
      title={status ? `${status.message}\n${status.url}` : "Live sync"}
    >
      <span className="cogs-live-sync-dot" style={{ background: color }} />
      <span className="cogs-live-sync-text">{label}</span>
      {!compact ? (
        <button
          type="button"
          className="cogs-live-sync-toggle"
          onClick={() => {
            const next = !enabled
            setLiveSyncEnabled(next)
            setEnabled(next)
          }}
        >
          {enabled ? "Pause" : "Resume"}
        </button>
      ) : null}
    </div>
  )
}
