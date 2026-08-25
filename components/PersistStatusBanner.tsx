/**
 * components/PersistStatusBanner.tsx — Visible save-failure + export nudge
 *
 * Shown whenever a Zustand persist write fails (almost always origin quota).
 * In-memory edits keep working; reload would drop them. Offers a one-click
 * full backup download and the timestamp of the last successful save.
 */
"use client"

import { useCallback, useState, useSyncExternalStore } from "react"
import { AlertTriangle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { downloadBackup } from "@/lib/data/backup"
import {
  getPersistStatus,
  subscribePersistStatus,
  type PersistStatus,
} from "@/lib/persist-storage"

export function usePersistStatus(): PersistStatus {
  return useSyncExternalStore(subscribePersistStatus, getPersistStatus, getPersistStatus)
}

export function formatLastSave(iso: string | null): string {
  if (!iso) return "never"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "never"
  return date.toLocaleString()
}

export function PersistStatusBanner() {
  const status = usePersistStatus()
  const [dismissedError, setDismissedError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [exportMessage, setExportMessage] = useState<string | null>(null)

  const handleExport = useCallback(async () => {
    setExporting(true)
    setExportMessage(null)
    try {
      await downloadBackup()
      setExportMessage("Backup downloaded. Keep that file somewhere safe.")
    } catch (e) {
      setExportMessage(e instanceof Error ? e.message : "Export failed")
    } finally {
      setExporting(false)
    }
  }, [])

  if (status.ok) return null
  if (dismissedError && dismissedError === status.error) return null

  return (
    <Alert variant="destructive" className="mb-4" role="alert">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Couldn’t save your data</AlertTitle>
      <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span>
          {status.error} Last successful save: {formatLastSave(status.lastOkAt)}.
          {exportMessage ? ` ${exportMessage}` : ""}
        </span>
        <div className="flex gap-2 shrink-0">
          <Button size="sm" onClick={() => void handleExport()} disabled={exporting}>
            {exporting ? "Exporting…" : "Download backup"}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setDismissedError(status.error)}>
            Dismiss
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  )
}
