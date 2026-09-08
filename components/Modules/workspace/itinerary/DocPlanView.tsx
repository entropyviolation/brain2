/**
 * components/Modules/workspace/itinerary/DocPlanView.tsx
 * Plan tab: Docs DocumentEditor bound to a note task.
 */
"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { DocumentEditor } from "@/components/Docs/DocumentEditor"
import { documentFont, loadDocumentBody, setDocumentBody, setDocumentFont } from "@/components/Docs/doc-actions"
import { useTaskStore } from "@/lib/task-store"
import type { ModuleView } from "@/lib/modules-store"
import "@/components/Docs/document-editor.css"

export function DocPlanView({ view, planDocId }: { view: ModuleView; planDocId?: string }) {
  const docId = view.config.docId || planDocId
  const tasks = useTaskStore((s) => s.tasks)
  const doc = docId ? tasks.find((t) => t.id === docId) : undefined

  const [draft, setDraft] = useState(doc?.body ?? "")
  const pending = useRef<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!doc) return
    if (pending.current !== null) return
    setDraft(doc.body ?? "")
    const id = doc.id
    void loadDocumentBody(id, doc.body ?? "").then((html) => {
      if (pending.current === null) setDraft(html)
    })
  }, [doc?.id])

  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
    if (!docId || pending.current === null) return
    const body = pending.current
    pending.current = null
    void setDocumentBody(docId, body)
  }, [docId])

  useEffect(() => () => flush(), [flush])

  const onChange = useCallback(
    (html: string) => {
      setDraft(html)
      pending.current = html
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(flush, 450)
    },
    [flush],
  )

  if (!docId) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        No trip plan document linked. Re-open this workspace or create a new Itinerary module.
      </p>
    )
  }
  if (!doc) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Plan document not found.</p>
  }

  return (
    <div className="h-full min-h-[420px] flex flex-col rounded border bg-background overflow-hidden">
      <DocumentEditor
        docId={doc.id}
        value={draft}
        onChange={onChange}
        onBlur={flush}
        documentFont={documentFont(doc)}
        onDocumentFontChange={(f) => setDocumentFont(doc.id, f)}
        placeholder="Write your trip plan…"
      />
    </div>
  )
}
