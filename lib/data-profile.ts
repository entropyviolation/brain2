/**
 * lib/data-profile.ts — Switch Live vs Demo without mixing vaults
 *
 * Live is the default. Demo writes only `brain2-demo-*`. Switching reloads so
 * Zustand and IndexedDB reopen against the active profile. Reset Demo never
 * deletes Live keys.
 */

import { ensureDemoVault } from "@/lib/demo-vault"
import {
  type DataProfile,
  DEMO_PERSIST_PREFIX,
  readDataProfile,
  wipeDemoPhysicalKeys,
  writeDataProfile,
} from "@/lib/storage-keys"

export { readDataProfile, writeDataProfile, type DataProfile }

function wipeDemoIndexedDb(): void {
  if (typeof indexedDB === "undefined") return
  try {
    indexedDB.deleteDatabase("brain2-demo-docs")
    indexedDB.deleteDatabase("brain2-demo-attachments")
  } catch {
    /* ignore */
  }
}

function reload(): void {
  if (typeof window !== "undefined") window.location.reload()
}

/** Flip the selector, seed Demo if needed, then reload. Never touches Live keys. */
export function switchDataProfile(next: DataProfile): void {
  if (readDataProfile() === next) return
  writeDataProfile(next)
  if (next === "demo") ensureDemoVault()
  reload()
}

/** Re-seed stock Demo fiction. Live `brain2-*` / `cogs-*` keys are left alone. */
export function resetDemoProfile(): void {
  writeDataProfile("demo")
  wipeDemoPhysicalKeys()
  wipeDemoIndexedDb()
  ensureDemoVault({ force: true })
  reload()
}

export function demoKeyPrefix(): string {
  return DEMO_PERSIST_PREFIX
}
