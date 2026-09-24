/**
 * hooks/use-attachment-src.ts — Render an attachment URI in an `<img>`
 *
 * `image` / `multiimage` attributes store `idb:<id>` (`lib/attachments.ts`) so
 * picture bytes stay out of the Lists JSON. Browsers cannot load that scheme,
 * so every render site resolves it to an object URL here — and revokes it, so
 * a gallery scrolling past a hundred cards does not leak a hundred blobs.
 * A `data:` or `http(s)` value passes straight through.
 */
"use client"

import { useEffect, useState } from "react"
import { getAttachmentObjectUrl, isAttachmentRef } from "@/lib/attachments"

export function useAttachmentSrc(uri: string | undefined | null): string {
  const [src, setSrc] = useState(() => (isAttachmentRef(uri) ? "" : (uri ?? "")))

  useEffect(() => {
    if (!isAttachmentRef(uri)) {
      setSrc(uri ?? "")
      return
    }
    let objectUrl = ""
    let live = true
    void getAttachmentObjectUrl(uri as string)
      .then((url) => {
        if (!live) {
          URL.revokeObjectURL(url)
          return
        }
        objectUrl = url
        setSrc(url)
      })
      .catch(() => {
        if (live) setSrc("")
      })
    return () => {
      live = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [uri])

  return src
}

/** Same resolution for a list of URIs (a `multiimage` cell). */
export function useAttachmentSrcList(uris: string[]): string[] {
  const key = uris.join("\u0000")
  const [srcs, setSrcs] = useState<string[]>(() => uris.map((u) => (isAttachmentRef(u) ? "" : u)))

  useEffect(() => {
    let live = true
    const made: string[] = []
    void Promise.all(
      uris.map(async (uri) => {
        if (!isAttachmentRef(uri)) return uri
        try {
          const url = await getAttachmentObjectUrl(uri)
          made.push(url)
          return url
        } catch {
          return ""
        }
      }),
    ).then((next) => {
      if (!live) {
        for (const url of made) URL.revokeObjectURL(url)
        return
      }
      setSrcs(next)
    })
    return () => {
      live = false
      for (const url of made) URL.revokeObjectURL(url)
    }
    // `key` is the identity of this URI list; `uris` is a fresh array each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return srcs
}
