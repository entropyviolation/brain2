/**
 * components/Modules/workspace/package-app/PackageAppView.tsx — `package-app` view
 *
 * Runs a downloaded package folder in a sandboxed frame. The sandbox flags
 * match an uploaded HTML page (`allow-scripts`, never `allow-same-origin`).
 * `window.brain2` is the bridge from `lib/module-html-bridge.ts`. This view
 * builds a wider grant for the lists the package bound. It does not change
 * the grants the `html` view passes to `handleBridgeCall`.
 *
 * House cleaning, the trip, Film DNA, and GradSearch do not use this view.
 */
"use client"

import { useCallback, useEffect, useMemo, useRef } from "react"
import type { ModuleView } from "@/lib/modules-store"
import { useModulePackageAppStore } from "@/lib/module-package-app-store"
import { useTaskStore } from "@/lib/task-store"
import { createListItem, withCategoryDefaults } from "@/lib/item-utils"
import {
  BridgeError,
  bridgeSnapshot,
  handleBridgeCall,
  type BridgeCall,
  type BridgeItemPatch,
} from "@/lib/module-html-bridge"
import { buildPackageSrcDoc, packageAppGrants } from "@/lib/module-package-app"
import type { Task } from "@/lib/types"

export function PackageAppView({ view, onOpenItem }: { view: ModuleView; onOpenItem?: (id: string) => void }) {
  const appId = view.config.packageAppId
  const app = useModulePackageAppStore((s) => (appId ? s.apps[appId] : undefined))
  const frame = useRef<HTMLIFrameElement>(null)
  const lists = useTaskStore((s) => s.lists)
  const tasks = useTaskStore((s) => s.tasks)

  const grants = useMemo(() => packageAppGrants(view.config), [view.config])

  const html = app?.html
  const css = app?.css
  const js = app?.js
  const assets = app?.assets
  const kvAtLoad = useRef<Record<string, string>>({})
  const frameDoc = useMemo(() => {
    if (html === undefined) return null
    kvAtLoad.current = useModulePackageAppStore.getState().apps[appId ?? ""]?.kv ?? {}
    return buildPackageSrcDoc(
      { html, css, js, assets },
      { kv: kvAtLoad.current, grants },
    )
  }, [html, css, js, assets, appId, grants])

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
        if (appId) useModulePackageAppStore.getState().setKv(appId, key, value)
      },
    }),
    [appId, onOpenItem],
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

  useEffect(() => {
    if (!grants.listIds.length) return
    frame.current?.contentWindow?.postMessage(
      { b2: 1, event: "snapshot", data: bridgeSnapshot(lists, tasks, grants) },
      "*",
    )
  }, [lists, tasks, grants])

  if (!app || !frameDoc) {
    return <p className="text-sm text-muted-foreground py-8 text-center">The folder for this package is missing.</p>
  }
  return (
    <iframe
      ref={frame}
      title={view.title}
      srcDoc={frameDoc.srcDoc}
      sandbox={frameDoc.sandbox}
      className="w-full h-full min-h-[70vh] border-0 bg-white"
    />
  )
}
