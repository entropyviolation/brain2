/**
 * components/Modules/workspace/ModulePackageInstallDialog.tsx — "Install package"
 *
 * Reads a JSON file the user picks. Create-only and `nativeTemplate` files call
 * `installModulePackage`. A `policy: "bind"` slot is scored first. `"ask"`,
 * `"none"`, or a refusal stays on this screen with the candidate lists and
 * installs nothing. A thrown parser or installer error stays here too.
 * On success the parent closes the builder and opens the new workspace.
 */
"use client"

import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useTaskStore } from "@/lib/task-store"
import { installReviewedPackage, type PackageBindBlock } from "./module-package-install"

export function ModulePackageInstallDialog({
  open,
  onClose,
  onInstalled,
}: {
  open: boolean
  onClose: () => void
  onInstalled: (moduleId: string) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState("")
  const [blocks, setBlocks] = useState<PackageBindBlock[]>([])
  const [busy, setBusy] = useState(false)

  const reset = () => {
    setFile(null)
    setError("")
    setBlocks([])
    setBusy(false)
  }
  const close = () => {
    if (busy) return
    reset()
    onClose()
  }

  const pick = (f: File | undefined) => {
    setError("")
    setBlocks([])
    if (!f) return
    if (!/\.json$/i.test(f.name)) {
      setFile(null)
      setError("Choose a .json file.")
      return
    }
    setFile(f)
  }

  const install = async () => {
    if (!file || busy) return
    setBusy(true)
    setError("")
    setBlocks([])
    try {
      const text = await file.text()
      const result = installReviewedPackage(text, useTaskStore.getState().lists)
      if (Array.isArray(result)) {
        setBlocks(result)
        setBusy(false)
        return
      }
      reset()
      onInstalled(result)
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "That package could not be installed.")
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="mod95-dialog sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Install package</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="module-package-file">Package file</Label>
          <div className="flex items-center gap-3 min-w-0">
            <input
              ref={input}
              id="module-package-file"
              type="file"
              accept=".json,application/json"
              className="sr-only"
              onChange={(e) => {
                pick(e.target.files?.[0])
                e.target.value = ""
              }}
            />
            <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()} disabled={busy}>
              {file ? "Choose another" : "Choose file"}
            </Button>
            <span className="truncate text-sm text-muted-foreground">{file?.name ?? "No file chosen"}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            A create-only file makes new lists. A bind uses one list you already have when that list is a clear match.
          </p>
          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
          {blocks.length > 0 && (
            <div role="alert" className="space-y-2 text-xs text-destructive">
              <p>Nothing was installed. Each bind needs one list that covers every attribute on its own.</p>
              {blocks.map((block, index) => (
                <div key={`${block.role}-${index}`}>
                  <p className="font-medium text-foreground">{block.slotName}</p>
                  {block.candidates.length > 0 ? (
                    <ul className="mt-1 list-disc pl-4 text-foreground">
                      {block.candidates.map((candidate) => (
                        <li key={candidate.listId}>{candidate.name}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted-foreground">No overlapping list.</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void install()} disabled={!file || busy}>
            Install
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
