/**
 * lib/app-brand.ts — Product name for the living application.
 *
 * Chrome (header cabinet caption, window title, mobile brand) is
 * **BRAIN2**. Prose is one word **Brain2**. Persist keys are **`brain2-*`**.
 * Historical **`cogs-*`** keys are a lossless alias (`lib/storage-keys.ts`):
 * copy on first read, dual-write, never delete the old vault.
 */
/** All-caps mark for the header, window title, and other chrome. */
export const APP_NAME = "BRAIN2"

/** One-word name in sentences and docs. */
export const APP_NAME_PROSE = "Brain2"

/** Backup / export envelope id written on new files. */
export const APP_ID = "brain2" as const

/** Older backups and list exports used this envelope id. */
export const APP_ID_LEGACY = "cogs" as const

export type AppId = typeof APP_ID | typeof APP_ID_LEGACY

export function isAppId(value: unknown): value is AppId {
  return value === APP_ID || value === APP_ID_LEGACY
}

export function backupDownloadName(kind: "backup" | "category", suffix: string): string {
  return `brain2-${kind}-${suffix}.json`
}
