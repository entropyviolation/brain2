/**
 * lib/bim-flow/file-activity-client.ts — Load recent file events into the lab
 *
 * Reads `/api/file-activity` (the hub, read only). The first call walks the
 * home folder and can take several seconds; the hub caches it for ten minutes.
 */

import type { FileEvent } from "./file-activity"

/** Days loaded so folders and work pens can be learned from the person's own blocks. */
export const FILE_LEARN_DAYS = 60

export async function loadFileEvents(days = FILE_LEARN_DAYS): Promise<FileEvent[] | null> {
  try {
    const res = await fetch(`/api/file-activity?days=${days}`)
    if (!res.ok) return null
    return ((await res.json()) as { rows?: FileEvent[] }).rows ?? []
  } catch {
    return null
  }
}
