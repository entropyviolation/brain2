/**
 * lib/module-package-app-store.ts — Folder for a `package-app` view
 *
 * A new package's screen is a folder: one html entry, plus css, js, and
 * assets. That folder is the module's code, so it lives here and not on
 * `module.config`. The view keeps `packageAppId`.
 *
 * This is not the uploaded-HTML store. That one stays a single `.html` file
 * under `brain2-module-html`. This vault's key is `brain2-module-package-app`.
 *
 * `kv` is the page's own small memory, the same job as on an `html` doc.
 * Records belong in Items and travel through `lib/module-html-bridge.ts`.
 */
"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { createCogsJSONStorage } from "@/lib/persist-storage"
import { persistKey } from "@/lib/storage-keys"
import { normalizePackagePath, type PackageAppFolder } from "@/lib/module-package-app"
import { registerPhoneWindowStore } from "@/lib/phone-window"

/** Whole folder, counted as UTF-8 bytes. The origin quota is shared. */
export const MAX_PACKAGE_APP_BYTES = 6 * 1024 * 1024

export const PACKAGE_APP_PERSIST_NAME = "module-package-app"

export interface PackageAppRecord {
  id: string
  name: string
  html: string
  css: Record<string, string>
  js: Record<string, string>
  /** Path → data URL, or text for svg / txt / json / csv. */
  assets: Record<string, string>
  kv: Record<string, string>
  savedAt: string
}

interface PackageAppState {
  apps: Record<string, PackageAppRecord>
  addApp: (folder: PackageAppFolder) => string
  replaceApp: (id: string, folder: PackageAppFolder) => void
  setKv: (id: string, key: string, value: string | null) => void
  removeApp: (id: string) => void
}

export class PackageAppError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "PackageAppError"
  }
}

let counter = 0
function nextId(): string {
  counter += 1
  return `pkgapp-${Date.now().toString(36)}-${counter.toString(36)}`
}

function isPlainMap(value: unknown): value is Record<string, string> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function takeFiles(files: Record<string, string> | undefined, label: string, seen: Set<string>): Record<string, string> {
  if (files == null) return {}
  if (!isPlainMap(files)) throw new PackageAppError(`${label} must be a map of paths`)
  const out: Record<string, string> = {}
  for (const [raw, value] of Object.entries(files)) {
    if (typeof value !== "string") throw new PackageAppError(`${label} "${raw}" must be text`)
    const path = normalizePackagePath(raw)
    if (!path) throw new PackageAppError(`${label} path "${raw}" is not inside the package folder`)
    if (seen.has(path)) throw new PackageAppError(`"${path}" is listed more than once`)
    seen.add(path)
    out[path] = value
  }
  return out
}

export function packageFolderBytes(folder: Pick<PackageAppRecord, "html" | "css" | "js" | "assets">): number {
  const encode = (text: string) => new TextEncoder().encode(text).length
  let total = encode(folder.html)
  for (const map of [folder.css, folder.js, folder.assets]) {
    for (const [path, value] of Object.entries(map)) total += encode(path) + encode(value)
  }
  return total
}

function compileFolder(folder: PackageAppFolder): Omit<PackageAppRecord, "id" | "kv" | "savedAt"> {
  if (typeof folder.html !== "string" || folder.html.trim() === "") {
    throw new PackageAppError("A package folder needs an html file")
  }
  const seen = new Set<string>()
  const css = takeFiles(folder.css, "css", seen)
  const js = takeFiles(folder.js, "js", seen)
  const assets = takeFiles(folder.assets, "assets", seen)
  const name = (folder.name ?? "Package").trim().slice(0, 200) || "Package"
  const compiled = { name, html: folder.html, css, js, assets }
  if (packageFolderBytes(compiled) > MAX_PACKAGE_APP_BYTES) {
    throw new PackageAppError(`The folder is over ${MAX_PACKAGE_APP_BYTES / 1048576} MB.`)
  }
  return compiled
}

export const useModulePackageAppStore = create<PackageAppState>()(
  persist(
    (set) => ({
      apps: {},
      addApp: (folder) => {
        const compiled = compileFolder(folder)
        const id = nextId()
        const record: PackageAppRecord = { id, ...compiled, kv: {}, savedAt: new Date().toISOString() }
        set((s) => ({ apps: { ...s.apps, [id]: record } }))
        return id
      },
      replaceApp: (id, folder) => {
        const compiled = compileFolder(folder)
        set((s) => {
          const prev = s.apps[id]
          if (!prev) return s
          return { apps: { ...s.apps, [id]: { ...prev, ...compiled, savedAt: new Date().toISOString() } } }
        })
      },
      setKv: (id, key, value) =>
        set((s) => {
          const prev = s.apps[id]
          if (!prev) return s
          const kv = { ...prev.kv }
          if (value === null) delete kv[key]
          else kv[key] = value
          return { apps: { ...s.apps, [id]: { ...prev, kv } } }
        }),
      removeApp: (id) =>
        set((s) => {
          if (!s.apps[id]) return s
          const apps = { ...s.apps }
          delete apps[id]
          return { apps }
        }),
    }),
    { name: persistKey(PACKAGE_APP_PERSIST_NAME), version: 1, storage: createCogsJSONStorage() },
  ),
)

registerPhoneWindowStore(useModulePackageAppStore)
