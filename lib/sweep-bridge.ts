/**
 * lib/sweep-bridge.ts — Renderer bridge for Sweep
 *
 * `window.desktop.sweep` exists in the Electron app (`electron/preload.js`,
 * `electron/sweep.js`). The browser build has no bridge; Sweep says the scan
 * lives in the desktop app.
 */
import type { SweepCategoryId } from "@/lib/sweep-rules"

export interface SweepGroup {
  id: string
  categoryId: SweepCategoryId
  label: string
  path: string
  bytes: number
  fileCount: number
  checked: boolean
  permanent: boolean
  partial?: boolean
}

export interface SweepScanResult {
  ok: boolean
  cancelled?: boolean
  scanId?: string
  groups?: SweepGroup[]
  truncated?: boolean
  error?: string
}

export interface SweepDuplicateFile {
  path: string
  name: string
  size: number
  mtimeMs: number
  hash: string
}

export interface SweepDuplicateGroup {
  hash: string
  size: number
  keepPath: string
  files: SweepDuplicateFile[]
}

export interface SweepDuplicatesResult {
  ok: boolean
  cancelled?: boolean
  resultId?: string
  groups?: SweepDuplicateGroup[]
  truncated?: boolean
  refusedRoots?: string[]
  error?: string
}

export interface SweepCleanResult {
  ok: boolean
  removed: string[]
  skipped: string[]
  error?: string
}

export interface SweepProgress {
  jobId: string
  mode: "scan" | "duplicates"
  folder: string
  bytes: number
}

export interface SweepBridge {
  defaults: () => Promise<{ roots: string[] }>
  scan: () => Promise<SweepScanResult>
  cancel: () => void
  clean: (req: { scanId: string; paths: string[]; confirmPermanent?: boolean }) => Promise<SweepCleanResult>
  duplicates: (roots: string[]) => Promise<SweepDuplicatesResult>
  cleanDuplicates: (req: { resultId: string; paths: string[] }) => Promise<SweepCleanResult>
  textHead: (filePath: string) => Promise<string>
  onProgress: (cb: (progress: SweepProgress) => void) => () => void
}

export function getSweepBridge(): SweepBridge | null {
  if (typeof window === "undefined") return null
  const desktop = (window as unknown as {
    desktop?: { isElectron?: boolean; platform?: string; sweep?: SweepBridge }
  }).desktop
  if (!desktop?.isElectron || !desktop.sweep) return null
  if (desktop.platform && desktop.platform !== "darwin") return null
  return desktop.sweep
}
