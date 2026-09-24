/**
 * lib/ingest/media-album.ts — Collapse Telegram media_group_id bursts
 *
 * An album arrives as several messages ~300ms apart. One journal PDF / one
 * receipt OCR pass should see every page.
 */

export interface Albumish {
  text: string
  mediaGroupId?: string
  attachments?: unknown[]
}

export class MediaAlbumBuffer<T extends Albumish> {
  private groups = new Map<string, { items: T[]; timer: ReturnType<typeof setTimeout> | null }>()

  constructor(
    private readonly flush: (merged: T) => void,
    private readonly delayMs = 1100,
  ) {}

  push(item: T) {
    const gid = item.mediaGroupId
    if (!gid) {
      this.flush(item)
      return
    }
    const row = this.groups.get(gid) ?? { items: [], timer: null }
    row.items.push(item)
    if (row.timer) clearTimeout(row.timer)
    row.timer = setTimeout(() => {
      this.groups.delete(gid)
      this.flush(mergeAlbum(row.items))
    }, this.delayMs)
    this.groups.set(gid, row)
  }

  dispose() {
    for (const row of this.groups.values()) {
      if (row.timer) clearTimeout(row.timer)
      if (row.items.length) this.flush(mergeAlbum(row.items))
    }
    this.groups.clear()
  }
}

export function mergeAlbum<T extends Albumish>(items: T[]): T {
  const first = items[0]
  if (!first || items.length === 1) return first
  const text = items.map((row) => row.text).find((value) => String(value || "").trim()) || first.text
  const attachments = items.flatMap((row) => row.attachments || [])
  return { ...first, text, attachments }
}
