/**
 * components/Settings/BackupRestore.tsx — Full app backup & restore UI
 *
 * Thin UI over `lib/data/backup.ts`: exports the *entire* app (every persisted
 * store + free-text plans) to a single JSON file, and restores it. Restore is a
 * full replace, so it asks for confirmation before overwriting.
 *
 * Spec: §3.2 (one-click export/import).
 */
"use client"

import type React from "react"
import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Database, DownloadCloud, UploadCloud } from "lucide-react"
import { downloadBackup, parseBackup, restoreBackup } from "@/lib/data/backup"

export function BackupRestore() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<{ kind: "ok" | "error"; message: string } | null>(null)

  const handleExport = () => {
    try {
      downloadBackup()
      setStatus({ kind: "ok", message: "✅ Full backup downloaded." })
    } catch (e) {
      setStatus({ kind: "error", message: `❌ Export failed: ${e instanceof Error ? e.message : "Unknown error"}` })
    }
  }

  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const backup = parseBackup(e.target?.result as string)
        const confirmed =
          typeof window === "undefined" ||
          window.confirm(
            "Restoring will REPLACE all current data (tasks, lists, habits, goals, reviews, modules, plans, settings) with the backup. Continue?",
          )
        if (!confirmed) return
        const result = await restoreBackup(backup)
        setStatus({
          kind: "ok",
          message: `✅ Restored ${result.stores} data stores and ${result.planText} plan entries.`,
        })
      } catch (err) {
        setStatus({
          kind: "error",
          message: `❌ Restore failed: ${err instanceof Error ? err.message : "Invalid backup file"}`,
        })
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = ""
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className="space-y-3 rounded-lg border border-dashed p-4">
      <div className="flex items-center gap-2">
        <Database className="h-4 w-4" />
        <h3 className="font-semibold">Full App Backup</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Back up <strong>everything</strong> — tasks, lists, habits, goals, reviews, modules, time tracking, plans, and
        settings — to a single file, or restore from one. Restoring replaces all current data.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button onClick={handleExport} variant="outline" className="flex-1">
          <DownloadCloud className="mr-2 h-4 w-4" />
          Export Full Backup
        </Button>
        <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="flex-1">
          <UploadCloud className="mr-2 h-4 w-4" />
          Restore From Backup
        </Button>
      </div>
      <input ref={fileInputRef} type="file" accept=".json" onChange={handleFile} className="hidden" />
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
