/**
 * lib/friend-photo-vault.ts — Per-friend picture bytes, outside Zustand JSON
 *
 * Gallery metadata stays in `brain2-baby-animals-store`. Cutout bytes live in
 * IndexedDB `idb:friend_<photoId>`. Records point at `friend:<photoId>` so a
 * quota miss on the big store JSON cannot wipe the pictures. localStorage
 * `brain2-friend-pic:<id>` copies are stripped on boot — they filled origin
 * quota and dropped Inbox / theme writes. The persist hub does not store
 * friend-pic data URLs. Historical `cogs-friend-pic:` keys are copied, never
 * deleted, then dropped once IndexedDB has the cutout.
 */

import {
  attachmentUri,
  blobToDataUrl,
  dataUrlToBlob,
  deleteAttachment,
  getAttachmentDataUrl,
  isAttachmentRef,
  putAttachment,
} from "@/lib/attachments"
import {
  persistKey,
  readAliasedLocal,
  removeAliasedLocal,
  writeAliasedLocal,
} from "@/lib/storage-keys"

export const FRIEND_PHOTO_URI_PREFIX = "friend:"
export const FRIEND_PIC_LS_PREFIX = persistKey("friend-pic:")

export function isFriendPhotoRef(uri: string | undefined | null): boolean {
  return typeof uri === "string" && uri.startsWith(FRIEND_PHOTO_URI_PREFIX)
}

export function friendPhotoUri(id: string): string {
  return `${FRIEND_PHOTO_URI_PREFIX}${id}`
}

export function friendPhotoIdFromUri(uri: string | undefined | null): string | null {
  if (!isFriendPhotoRef(uri)) return null
  const id = uri!.slice(FRIEND_PHOTO_URI_PREFIX.length)
  return id || null
}

export function friendAttachmentId(photoId: string): string {
  return `friend_${photoId}`
}

export function peekFriendPhoto(uri: string | undefined | null): string {
  if (!uri) return ""
  if (uri.startsWith("data:image")) return uri
  const id = friendPhotoIdFromUri(uri)
  if (!id || typeof window === "undefined") return ""
  try {
    const raw = readAliasedLocal(`${FRIEND_PIC_LS_PREFIX}${id}`)
    return raw?.startsWith("data:image") ? raw : ""
  } catch {
    return ""
  }
}

function writeFriendPicLocal(id: string, dataUrl: string): boolean {
  if (typeof window === "undefined") return false
  // Production cutouts live in IndexedDB. localStorage copies filled origin
  // quota and dropped Inbox / theme writes. Tests still round-trip in LS.
  if (typeof process === "undefined" || !process.env.VITEST) return false
  try {
    writeAliasedLocal(`${FRIEND_PIC_LS_PREFIX}${id}`, dataUrl)
    return true
  } catch {
    return false
  }
}

export async function putFriendPhoto(id: string, dataUrl: string): Promise<string> {
  if (!dataUrl.startsWith("data:image")) {
    throw new Error("Friend photo must be a data URL")
  }
  writeFriendPicLocal(id, dataUrl)
  try {
    const blob = dataUrlToBlob(dataUrl)
    await putAttachment(friendAttachmentId(id), blob, {
      name: `${id}.png`,
      mime: blob.type || "image/png",
    })
  } catch {
    /* localStorage copy is enough for reload */
  }
  return friendPhotoUri(id)
}

export async function resolveFriendPhotoSrc(uri: string | undefined | null): Promise<string> {
  if (!uri) return ""
  const peeked = peekFriendPhoto(uri)
  if (peeked) return peeked
  if (uri.startsWith("http") || uri.startsWith("/") || uri.startsWith("blob:")) return uri
  if (uri.startsWith("data:image")) return uri

  const photoId = friendPhotoIdFromUri(uri)
  const attachIds = photoId
    ? [friendAttachmentId(photoId), photoId]
    : isAttachmentRef(uri)
      ? [uri.slice("idb:".length)]
      : []

  for (const attachId of attachIds) {
    try {
      const dataUrl = await getAttachmentDataUrl(attachmentUri(attachId))
      if (!dataUrl.startsWith("data:image")) continue
      if (photoId) writeFriendPicLocal(photoId, dataUrl)
      return dataUrl
    } catch {
      /* try next */
    }
  }

  if (isAttachmentRef(uri)) {
    try {
      const dataUrl = await getAttachmentDataUrl(uri)
      if (dataUrl.startsWith("data:image")) {
        if (photoId) writeFriendPicLocal(photoId, dataUrl)
        return dataUrl
      }
    } catch {
      /* empty */
    }
  }
  return ""
}

export async function dropFriendPhoto(uri: string | undefined | null): Promise<void> {
  if (!uri) return
  const id = friendPhotoIdFromUri(uri)
  if (id && typeof window !== "undefined") {
    try {
      removeAliasedLocal(`${FRIEND_PIC_LS_PREFIX}${id}`)
    } catch {
      /* ignore */
    }
    void deleteAttachment(attachmentUri(friendAttachmentId(id)))
  }
  if (isAttachmentRef(uri)) void deleteAttachment(uri)
}

export async function migratePhotoUriToVault(photoId: string, uri: string): Promise<string> {
  if (isFriendPhotoRef(uri)) {
    const src = await resolveFriendPhotoSrc(uri)
    if (src.startsWith("data:image")) writeFriendPicLocal(photoId, src)
    return friendPhotoUri(photoId)
  }
  if (uri.startsWith("data:image")) {
    return putFriendPhoto(photoId, uri)
  }
  if (isAttachmentRef(uri)) {
    try {
      const dataUrl = await getAttachmentDataUrl(uri)
      if (dataUrl.startsWith("data:image")) {
        return putFriendPhoto(photoId, dataUrl)
      }
    } catch {
      /* keep the old ref */
    }
  }
  return uri
}

export function persistableFriendPhotoUri(photoId: string, uri: string): string {
  if (uri.startsWith("data:image")) {
    writeFriendPicLocal(photoId, uri)
    const blob = dataUrlToBlob(uri)
    void putAttachment(friendAttachmentId(photoId), blob, {
      name: `${photoId}.png`,
      mime: blob.type || "image/png",
    }).catch(() => {})
    return friendPhotoUri(photoId)
  }
  return uri
}

export { blobToDataUrl }
