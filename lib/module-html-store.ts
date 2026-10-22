/**
 * lib/module-html-store.ts — Uploaded HTML apps for `html` module views
 *
 * An `html` view runs one uploaded `.html` file in a sandboxed frame. The file
 * is the module's *code*, like a view component, so it lives here and not on
 * `module.config`. The view config keeps only `htmlDocId` plus bindings.
 *
 * `kv` is the page's own small key/value memory (preferences, a score, the
 * lesson it was on). It is what the frame's `localStorage` shim and
 * `brain2.storage` write to. Records belong in Items; reach them through the
 * bridge (`lib/module-html-bridge.ts`).
 *
 * Storage: localStorage via zustand `persist`, its own key so a large page does
 * not rewrite the modules blob on every edit.
 */
"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { createCogsJSONStorage } from "@/lib/persist-storage"
import { persistKey } from "@/lib/storage-keys"

export interface ModuleHtmlDoc {
  id: string
  /** Original file name, shown in the view editor. */
  name: string
  html: string
  /** Page-owned key/value memory (strings only, like Web Storage). */
  kv: Record<string, string>
  uploadedAt: string
}

/** Largest file the upload accepts. The origin quota is shared with everything else. */
export const MAX_MODULE_HTML_BYTES = 2 * 1024 * 1024

interface ModuleHtmlState {
  docs: Record<string, ModuleHtmlDoc>
  addDoc: (name: string, html: string) => string
  replaceDoc: (id: string, name: string, html: string) => void
  setKv: (id: string, key: string, value: string | null) => void
  removeDoc: (id: string) => void
}

let counter = 0
function nextId(): string {
  counter += 1
  return `html-${Date.now().toString(36)}-${counter.toString(36)}`
}

export const useModuleHtmlStore = create<ModuleHtmlState>()(
  persist(
    (set) => ({
      docs: {},
      addDoc: (name, html) => {
        const id = nextId()
        set((s) => ({
          docs: { ...s.docs, [id]: { id, name, html, kv: {}, uploadedAt: new Date().toISOString() } },
        }))
        return id
      },
      replaceDoc: (id, name, html) =>
        set((s) => {
          const prev = s.docs[id]
          if (!prev) return s
          return { docs: { ...s.docs, [id]: { ...prev, name, html, uploadedAt: new Date().toISOString() } } }
        }),
      setKv: (id, key, value) =>
        set((s) => {
          const prev = s.docs[id]
          if (!prev) return s
          const kv = { ...prev.kv }
          if (value === null) delete kv[key]
          else kv[key] = value
          return { docs: { ...s.docs, [id]: { ...prev, kv } } }
        }),
      removeDoc: (id) =>
        set((s) => {
          if (!s.docs[id]) return s
          const docs = { ...s.docs }
          delete docs[id]
          return { docs }
        }),
    }),
    { name: persistKey("module-html"), version: 1, storage: createCogsJSONStorage() },
  ),
)
