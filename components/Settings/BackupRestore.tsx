/**
 * components/Settings/BackupRestore.tsx — Full app backup & selective restore
 *
 * Thin UI over `lib/data/backup.ts`. Export is one JSON file of every saved
 * store, plan log, attachment, doc, and other durable key for this profile,
 * including split storage copies, bare plan drafts, and edits still only in
 * memory because the last disk write failed.
 * Restore previews those parts, then the user picks merge vs replace. Confirm
 * is a Win95 OK/Cancel strip — not a red Delete.
 * If `data/recovery-backups/` exists on the dev hub, those snapshots list here
 * as a read-only source (load + restore; the folder is never written from here).
 *
 * Spec: §3.2 (one-click export/import).
 */
"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Database, DownloadCloud, UploadCloud } from "lucide-react"
import {
  downloadBackup,
  listRecoveryBackups,
  loadRecoveryBackup,
  parseBackup,
  previewBackup,
  restoreBackup,
  type Backup,
  type BackupPreview,
  type RecoveryBackupInfo,
  type RestoreMode,
} from "@/lib/data/backup"
import { formatLastSave, usePersistStatus } from "@/components/PersistStatusBanner"

type PendingRestore = {
  backup: Backup
  preview: BackupPreview
  source: string
}

function formatWhen(iso: string | null): string {
  if (!iso) return "unknown date"
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString()
}

export function BackupRestore() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<{ kind: "ok" | "error"; message: string } | null>(null)
  const [pending, setPending] = useState<PendingRestore | null>(null)
  const [selectedStores, setSelectedStores] = useState<string[]>([])
  const [includePlanText, setIncludePlanText] = useState(false)
  const [includeAttachments, setIncludeAttachments] = useState(false)
  const [includeDocs, setIncludeDocs] = useState(false)
  const [includeExtras, setIncludeExtras] = useState(false)
  const [mode, setMode] = useState<RestoreMode>("replace")
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [recovery, setRecovery] = useState<{ exists: boolean; backups: RecoveryBackupInfo[] }>({
    exists: false,
    backups: [],
  })
  const persist = usePersistStatus()

  useEffect(() => {
    let cancelled = false
    void listRecoveryBackups().then((listing) => {
      if (!cancelled) setRecovery(listing)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const openPreview = (backup: Backup, source: string) => {
    const preview = previewBackup(backup)
    setPending({ backup, preview, source })
    setSelectedStores(preview.stores.filter((s) => s.present).map((s) => s.key))
    setIncludePlanText(preview.planText.present)
    setIncludeAttachments(preview.attachments.present)
    setIncludeDocs(preview.docs.present)
    setIncludeExtras(preview.extras.present)
    setMode("replace")
    setConfirming(false)
    setStatus(null)
  }

  const handleExport = async () => {
    try {
      await downloadBackup()
      setStatus({ kind: "ok", message: "✅ Full backup downloaded." })
    } catch (e) {
      setStatus({ kind: "error", message: `❌ Export failed: ${e instanceof Error ? e.message : "Unknown error"}` })
    }
  }

  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        openPreview(parseBackup(reader.result as string), file.name)
      } catch (err) {
        setStatus({
          kind: "error",
          message: `❌ Restore failed: ${err instanceof Error ? err.message : "Invalid backup file"}`,
        })
        setPending(null)
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = ""
      }
    }
    reader.readAsText(file)
  }

  const handleRecovery = async (name: string) => {
    try {
      const backup = await loadRecoveryBackup(name)
      openPreview(backup, name)
    } catch (err) {
      setStatus({
        kind: "error",
        message: `❌ Could not read recovery snapshot: ${err instanceof Error ? err.message : "Unknown error"}`,
      })
    }
  }

  const toggleStore = (key: string) => {
    setSelectedStores((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
  }

  const chosenCount =
    selectedStores.length +
    (includePlanText ? 1 : 0) +
    (includeAttachments ? 1 : 0) +
    (includeDocs ? 1 : 0) +
    (includeExtras ? 1 : 0)

  const handleRestore = async () => {
    if (!pending || chosenCount === 0) return
    setBusy(true)
    try {
      const result = await restoreBackup(pending.backup, {
        storeKeys: selectedStores,
        planText: includePlanText,
        attachments: includeAttachments,
        docs: includeDocs,
        extras: includeExtras,
        mode,
      })
      setStatus({
        kind: "ok",
        message: `✅ Restored ${result.stores} data stores, ${result.planText} plan entries, and ${result.extras} other saved keys (${mode}).`,
      })
      setPending(null)
      setConfirming(false)
    } catch (err) {
      setStatus({
        kind: "error",
        message: `❌ Restore failed: ${err instanceof Error ? err.message : "Invalid backup file"}`,
      })
    } finally {
      setBusy(false)
    }
  }

  const presentStores = pending?.preview.stores.filter((s) => s.present) ?? []

  return (
    <div className="space-y-3 rounded-lg border border-dashed p-4">
      <div className="flex items-center gap-2">
        <Database className="h-4 w-4" />
        <h3 className="font-semibold">Full App Backup</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Back up <strong>everything</strong> this profile has saved — lists, habits, goals, tracking, plans,
        attachments, docs, item history, home layout, friend pins, module notes, and the other saved keys — to a
        single file. Restore previews which parts are in the file so you can replace or merge only the ones you pick.
      </p>
      <p className="text-xs text-muted-foreground">Last successful save: {formatLastSave(persist.lastOkAt)}</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button onClick={() => void handleExport()} variant="outline" className="flex-1">
          <DownloadCloud className="mr-2 h-4 w-4" />
          Export Full Backup
        </Button>
        <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="flex-1">
          <UploadCloud className="mr-2 h-4 w-4" />
          Restore From Backup
        </Button>
      </div>
      <input ref={fileInputRef} type="file" accept=".json" onChange={handleFile} className="hidden" />

      {recovery.exists && (
        <div className="space-y-2 border border-dashed p-3">
          <p className="text-sm font-medium">Recovery snapshots</p>
          <p className="text-xs text-muted-foreground">
            Read-only copies in <code>data/recovery-backups/</code>. Load one to preview, then restore the stores you
            choose.
          </p>
          {recovery.backups.length === 0 ? (
            <p className="text-xs text-muted-foreground">Folder is empty — no snapshots yet.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {recovery.backups.map((row) => (
                <li key={row.name} className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {row.name}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {formatWhen(row.exportedAt)} · {row.storeKeys.length} stores
                    </span>
                  </span>
                  <Button type="button" variant="outline" size="sm" onClick={() => void handleRecovery(row.name)}>
                    Preview
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {pending && (
        <div className="space-y-3 border border-dashed p-3">
          <p className="text-sm font-medium">Preview — {pending.source}</p>
          <p className="text-xs text-muted-foreground">Exported {formatWhen(pending.preview.exportedAt)}</p>
          <fieldset className="space-y-1">
            <legend className="text-xs text-muted-foreground">Stores in this file</legend>
            {presentStores.map((store) => (
              <label key={store.key} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selectedStores.includes(store.key)}
                  onChange={() => toggleStore(store.key)}
                />
                {store.label}
              </label>
            ))}
            {pending.preview.planText.present && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={includePlanText} onChange={() => setIncludePlanText((v) => !v)} />
                Free-text plans ({pending.preview.planText.keys})
              </label>
            )}
            {pending.preview.attachments.present && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={includeAttachments}
                  onChange={() => setIncludeAttachments((v) => !v)}
                />
                Attachments ({pending.preview.attachments.count})
              </label>
            )}
            {pending.preview.docs.present && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={includeDocs} onChange={() => setIncludeDocs((v) => !v)} />
                Docs ({pending.preview.docs.count})
              </label>
            )}
            {pending.preview.extras.present && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={includeExtras} onChange={() => setIncludeExtras((v) => !v)} />
                Other saved data ({pending.preview.extras.keys})
              </label>
            )}
          </fieldset>
          <fieldset className="space-y-1">
            <legend className="text-xs text-muted-foreground">How to write chosen stores</legend>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="restore-mode" checked={mode === "replace"} onChange={() => setMode("replace")} />
              Replace — overwrite the chosen stores from the file
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="restore-mode" checked={mode === "merge"} onChange={() => setMode("merge")} />
              Merge — keep live ids; add records the file has that you do not
            </label>
          </fieldset>
          {!confirming ? (
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setPending(null)}>
                Cancel
              </Button>
              <Button type="button" disabled={chosenCount === 0} onClick={() => setConfirming(true)}>
                Review restore
              </Button>
            </div>
          ) : (
            <div className="space-y-2 border border-dashed p-3">
              <p className="text-sm">
                {mode === "replace" ? "Replace" : "Merge"} {chosenCount} chosen part{chosenCount === 1 ? "" : "s"} from{" "}
                {pending.source}? Unchecked stores stay as they are.
              </p>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" disabled={busy} onClick={() => setConfirming(false)}>
                  Cancel
                </Button>
                <Button type="button" disabled={busy} onClick={() => void handleRestore()}>
                  Restore
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {status && (
        <div
          className={`rounded p-2 text-sm ${
            status.kind === "ok"
              ? "border border-green-200 bg-green-50 text-green-700"
              : "border border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {status.message}
        </div>
      )}
    </div>
  )
}
