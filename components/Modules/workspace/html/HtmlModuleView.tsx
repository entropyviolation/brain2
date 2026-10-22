/**
 * components/Modules/workspace/html/HtmlModuleView.tsx — `html` view body
 *
 * Runs an uploaded `.html` file in a sandboxed frame (`allow-scripts`, never
 * `allow-same-origin`, so the page cannot reach Brain2's storage or DOM) and
 * answers its `window.brain2` calls through `lib/module-html-bridge.ts`.
 * Writes go through `task-store`, the same door as every other module.
 */
"use client"

import { useCallback, useEffect, useMemo, useRef } from "react"
import type { ModuleView } from "@/lib/modules-store"
import { useModuleHtmlStore } from "@/lib/module-html-store"
import { useTaskStore } from "@/lib/task-store"
import { createListItem, withCategoryDefaults } from "@/lib/item-utils"
import {
  BridgeError,
  bridgeSnapshot,
  buildSrcDoc,
  handleBridgeCall,
  type BridgeCall,
  type BridgeItemPatch,
  type HtmlBridgeGrants,
} from "@/lib/module-html-bridge"
import type { Task } from "@/lib/types"

export function HtmlModuleView({ view, onOpenItem }: { view: ModuleView; onOpenItem?: (id: string) => void }) {
  const docId = view.config.htmlDocId
  const doc = useModuleHtmlStore((s) => (docId ? s.docs[docId] : undefined))
  const frame = useRef<HTMLIFrameElement>(null)
  const lists = useTaskStore((s) => s.lists)
  const tasks = useTaskStore((s) => s.tasks)

  const grants = useMemo<HtmlBridgeGrants>(
    () => ({ listIds: view.config.htmlListIds ?? [], canWrite: !!view.config.htmlCanWrite }),
    [view.config.htmlListIds, view.config.htmlCanWrite],
  )

  // The frame is rebuilt only when the file or its grants change, never on a
  // kv write or an item edit, so a page keeps its in-memory state.
  const html = doc?.html
  const kvAtLoad = useRef<Record<string, string>>({})
  const srcDoc = useMemo(() => {
    if (html === undefined) return ""
    kvAtLoad.current = useModuleHtmlStore.getState().docs[docId ?? ""]?.kv ?? {}
    return buildSrcDoc(html, { kv: kvAtLoad.current, grants })
  }, [html, docId, grants])

  const host = useCallback(
    () => ({
      lists: useTaskStore.getState().lists,
      tasks: useTaskStore.getState().tasks,
      createItem: (listId: string, patch: BridgeItemPatch) => {
        const store = useTaskStore.getState()
        const list = store.lists.find((l) => l.id === listId)
        const title = (patch.title ?? "").trim() || "Untitled"
        const base = withCategoryDefaults(createListItem(title, [listId]), list)
        const item = {
          ...base,
          completed: !!patch.completed,
          attributes: { ...(base.attributes ?? {}), ...(patch.attributes ?? {}) },
        }
        store.addTask(item)
        return item.id
      },
      updateItem: (task: Task, patch: BridgeItemPatch) => {
        const title = patch.title !== undefined ? patch.title : task.title
        useTaskStore.getState().updateTask({
          ...task,
          title,
          description: patch.title !== undefined ? patch.title : task.description,
          completed: patch.completed ?? task.completed,
          attributes: { ...(task.attributes ?? {}), ...(patch.attributes ?? {}) },
        })
      },
      openItem: onOpenItem,
      setKv: (key: string, value: string | null) => {
        if (docId) useModuleHtmlStore.getState().setKv(docId, key, value)
      },
    }),
    [docId, onOpenItem],
  )

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (!frame.current || e.source !== frame.current.contentWindow) return
      const d = e.data as { b2?: number; id?: number; call?: BridgeCall } | null
      if (!d || d.b2 !== 1 || typeof d.id !== "number" || !d.call) return
      const reply = (body: Record<string, unknown>) =>
        frame.current?.contentWindow?.postMessage({ b2: 1, reply: d.id, ...body }, "*")
      try {
        reply({ result: handleBridgeCall(d.call, host(), grants) })
      } catch (err) {
        reply({ error: err instanceof BridgeError ? err.message : "Bridge call failed." })
      }
    }
    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [host, grants])

  // Push fresh data whenever an attached list or its items change.
  useEffect(() => {
    if (!grants.listIds.length) return
    frame.current?.contentWindow?.postMessage(
      { b2: 1, event: "snapshot", data: bridgeSnapshot(lists, tasks, grants) },
      "*",
    )
  }, [lists, tasks, grants])

  if (!doc) {
    return <p className="text-sm text-muted-foreground py-8 text-center">The HTML file for this view is missing. Edit the view to upload it again.</p>
  }
  return (
    <iframe
      ref={frame}
      title={view.title}
      srcDoc={srcDoc}
      sandbox="allow-scripts allow-forms allow-modals allow-popups allow-downloads"
      className="w-full h-full min-h-[70vh] border-0 bg-white"
    />
  )
}
