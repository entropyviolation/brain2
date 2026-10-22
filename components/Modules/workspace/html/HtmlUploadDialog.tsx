/**
 * components/Modules/workspace/html/HtmlUploadDialog.tsx — "Upload HTML file"
 *
 * Turns any `.html` file into a workspace with one `html` view. The page may be
 * a data tool, a lesson, a game, or nothing that touches lists at all; the
 * user picks which lists it sees, if any (`HtmlViewFields`).
 */
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useModulesStore, type ModuleInstance } from "@/lib/modules-store"
import { MAX_MODULE_HTML_BYTES, useModuleHtmlStore } from "@/lib/module-html-store"
import { HtmlViewFields } from "./HtmlViewFields"
import { HtmlFilePicker } from "./HtmlFilePicker"

/** Pull a readable name from the page's `<title>`, else the file name. */
export function htmlModuleName(html: string, fileName: string): string {
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.replace(/\s+/g, " ").trim()
  return title || fileName.replace(/\.html?$/i, "") || "HTML module"
}

export function HtmlUploadDialog({
  open,
  onClose,
  onOpenWorkspace,
}: {
  open: boolean
  onClose: () => void
  onOpenWorkspace: (moduleId: string) => void
}) {
  const [file, setFile] = useState<{ name: string; html: string } | null>(null)
  const [title, setTitle] = useState("")
  const [listIds, setListIds] = useState<string[]>([])
  const [canWrite, setCanWrite] = useState(false)
  const [error, setError] = useState("")

  const reset = () => {
    setFile(null)
    setTitle("")
    setListIds([])
    setCanWrite(false)
    setError("")
  }
  const close = () => {
    reset()
    onClose()
  }

  const pick = async (f: File | undefined) => {
    setError("")
    if (!f) return
    if (!/\.html?$/i.test(f.name)) return setError("Choose an .html or .htm file.")
    if (f.size > MAX_MODULE_HTML_BYTES) {
      return setError(`That file is ${(f.size / 1048576).toFixed(1)} MB. The limit is ${MAX_MODULE_HTML_BYTES / 1048576} MB. Inline big images as links instead.`)
    }
    const html = await f.text()
    setFile({ name: f.name, html })
    setTitle((t) => t || htmlModuleName(html, f.name))
  }

  const create = () => {
    if (!file) return
    const docId = useModuleHtmlStore.getState().addDoc(file.name, file.html)
    const name = title.trim() || htmlModuleName(file.html, file.name)
    const id = `mod-${Date.now()}`
    const module: ModuleInstance = {
      id,
      type: "workspace",
      kind: "workspace",
      title: name,
      description: `Uploaded page: ${file.name}`,
      templateId: "html-upload",
      config: {},
      views: [
        {
          id: `view-${Date.now()}-html`,
          kind: "html",
          title: name,
          config: { htmlDocId: docId, htmlListIds: listIds, htmlCanWrite: canWrite && listIds.length > 0 },
        },
      ],
    }
    useModulesStore.getState().addModuleInstance(module)
    reset()
    onClose()
    onOpenWorkspace(id)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload HTML file</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="html-module-file">HTML file</Label>
            <HtmlFilePicker id="html-module-file" fileName={file?.name} onPick={(f) => void pick(f)} />
            <p className="text-xs text-muted-foreground">
              It runs in a locked frame. It cannot see the rest of Brain2 except through the lists you tick below.
            </p>
            {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
          </div>
          {file && (
            <>
              <div className="space-y-2">
                <Label>Module name</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <HtmlViewFields listIds={listIds} canWrite={canWrite} onListIds={setListIds} onCanWrite={setCanWrite} />
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button onClick={create} disabled={!file}>
            Create module
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
