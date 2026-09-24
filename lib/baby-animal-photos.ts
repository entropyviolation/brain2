/**
 * lib/baby-animal-photos.ts — Friend picture record + cutout bytes
 *
 * Pictures come from the preapproved `animalsrcs/` pack (`lib/friend-pack.ts`)
 * or a photograph the human uploads. Nothing is searched on the web.
 * Uploaded bytes are knocked out and stored in the friend photo vault
 * (`friend:<id>` + `cogs-friend-pic:<id>`), not in the Zustand JSON.
 */

import { blobToDataUrl, dataUrlToBlob, getAttachmentDataUrl } from "@/lib/attachments"
import { resizeImageForDoc } from "@/lib/image-resize"
import { putFriendPhoto } from "@/lib/friend-photo-vault"

export type BabyAnimalPhoto = {
  id: string
  animalId: string
  displayName: string
  query: string
  sourceUrl: string
  pageUrl?: string
  title?: string
  /** `pack` and `upload` are the live sources; the rest are legacy stored cards. */
  via: "pack" | "upload" | "openverse" | "commons" | "wikipedia"
  /** `friend:<id>` in the picture vault, else a `/friend-pack/*.png` path (or legacy `idb:` / data URL). */
  uri: string
  foundAt: string
  /** When the human last set a non-empty gallery name on this card id. */
  namedAt?: string
}

export async function durablePhotoUri(idbUri: string): Promise<string> {
  try {
    const dataUrl = await getAttachmentDataUrl(idbUri)
    if (dataUrl.startsWith("data:image")) return dataUrl
  } catch {
    /* keep the vault ref */
  }
  return idbUri
}

export async function storePhotoBytes(blob: Blob, id: string, _name: string): Promise<string> {
  let cutout = ""
  try {
    const { removeBackground } = await import("@/lib/remove-background")
    cutout = await removeBackground(blob, { subject: "photo", size: 384 })
  } catch {
    cutout = ""
  }
  const source = cutout.startsWith("data:image") ? dataUrlToBlob(cutout) : blob
  let dataUrl = cutout.startsWith("data:image") ? cutout : ""
  try {
    const resized = await resizeImageForDoc(source, { maxEdge: 384, maxBytes: 120_000, quality: 0.82 })
    if (resized.dataUrl.startsWith("data:image")) dataUrl = resized.dataUrl
  } catch {
    /* keep knockout or original */
  }
  if (!dataUrl.startsWith("data:image")) {
    dataUrl = await blobToDataUrl(source)
  }
  return putFriendPhoto(id, dataUrl)
}
