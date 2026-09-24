/**
 * components/use-attachment-src.ts — Resolve friend: / idb: / http / data URIs for <img>
 */
"use client"

import { useEffect, useState } from "react"
import { getAttachmentObjectUrl } from "@/lib/attachments"
import { isFriendPhotoRef, peekFriendPhoto, resolveFriendPhotoSrc } from "@/lib/friend-photo-vault"

export function useAttachmentSrc(uri: string | undefined | null, fallback = ""): string {
  const immediate =
    uri && (uri.startsWith("data:") || uri.startsWith("http") || uri.startsWith("blob:") || uri.startsWith("/"))
      ? uri
      : peekFriendPhoto(uri) ||
        (fallback.startsWith("data:") || fallback.startsWith("http") || fallback.startsWith("/") ? fallback : "")
  const [src, setSrc] = useState(immediate)

  useEffect(() => {
    if (!uri) {
      setSrc(fallback.startsWith("http") || fallback.startsWith("data:") || fallback.startsWith("/") ? fallback : "")
      return
    }
    if (uri.startsWith("data:") || uri.startsWith("http") || uri.startsWith("blob:") || uri.startsWith("/")) {
      setSrc(uri)
      return
    }
    const peeked = peekFriendPhoto(uri)
    if (peeked) {
      setSrc(peeked)
      return
    }
    let objectUrl = ""
    let cancelled = false
    const load = isFriendPhotoRef(uri)
      ? resolveFriendPhotoSrc(uri)
      : getAttachmentObjectUrl(uri)
    void load.then((url) => {
      if (cancelled) {
        if (url.startsWith("blob:")) URL.revokeObjectURL(url)
        return
      }
      if (url) {
        objectUrl = url
        setSrc(url)
        return
      }
      if (fallback.startsWith("http") || fallback.startsWith("data:") || fallback.startsWith("/")) {
        setSrc(fallback)
      }
    })
    return () => {
      cancelled = true
      if (objectUrl.startsWith("blob:")) URL.revokeObjectURL(objectUrl)
    }
  }, [uri, fallback])

  return src
}
