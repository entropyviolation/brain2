/**
 * lib/link-bimby/peek.ts — Ask this Mac to read a link (`GET /api/link-peek`)
 *
 * The route lives on the dev and prod servers (`scripts/link-peek-api.mjs`).
 * Null when the server is not there (static export, phone) or the page did not answer.
 */

import type { LinkPeek } from "./types"

/** `watch` also fetches the video for speech and on-screen text (slow the first time; cached on the Mac). */
/** `batch` (Guess all): the Mac never uses the Instagram sign-in for it (`scripts/reel-watch.mjs`). */
export async function peekLink(url: string, opts: { watch?: boolean; batch?: boolean; signal?: AbortSignal } = {}): Promise<LinkPeek | null> {
  try {
    const q = `url=${encodeURIComponent(url)}${opts.watch ? "&watch=1" : ""}${opts.batch ? "&batch=1" : ""}`
    const res = await fetch(`/api/link-peek?${q}`, { signal: opts.signal, headers: { Accept: "application/json" } })
    if (!res.ok) return null
    const j = (await res.json()) as Partial<LinkPeek> & {
      ok?: boolean
      watch?: { watched?: boolean; transcript?: string; onScreen?: string; uploader?: string; error?: string }
    }
    const w = j.watch
    if (!j.ok) return null
    return {
      title: String(j.title ?? ""),
      description: String(j.description ?? ""),
      author: String(j.author ?? ""),
      site: String(j.site ?? ""),
      ...(j.image ? { image: String(j.image) } : {}),
      ...(j.keywords ? { keywords: String(j.keywords) } : {}),
      ...(w?.watched ? { watched: true, transcript: String(w.transcript ?? ""), onScreen: String(w.onScreen ?? "") } : {}),
      ...(w && !w.watched && w.error ? { watchError: String(w.error) } : {}),
    }
  } catch {
    return null
  }
}
