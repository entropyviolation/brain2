/**
 * lib/friend-pack.ts — Preapproved gallery pictures from `animalsrcs/`
 *
 * Bytes live in `public/friend-pack/`. Gallery cards start unnamed so the
 * human can name every friend. Studio plates are knocked out at process time.
 */

import { FRIEND_PACK } from "@/lib/friend-pack-manifest"
import type { BabyAnimalPhoto } from "@/lib/baby-animal-photos"

export const FRIEND_PACK_PUBLIC = "/friend-pack"

export const FRIEND_PACK_UNNAMED = ""

export function friendPackSrc(file: string): string {
  return `${FRIEND_PACK_PUBLIC}/${file}`
}

export function friendPackPhoto(entry: (typeof FRIEND_PACK)[number]): BabyAnimalPhoto {
  const src = friendPackSrc(entry.file)
  return {
    id: entry.id,
    animalId: entry.id,
    displayName: FRIEND_PACK_UNNAMED,
    query: "friend-pack",
    sourceUrl: src,
    via: "pack",
    uri: src,
    foundAt: "2026-09-21T12:00:00.000Z",
  }
}

export type FriendPackMergeOpts = {
  ids?: readonly string[]
  urls?: readonly string[]
}

function packKey(value: string): string {
  return value.trim().toLowerCase()
}

export function missingFriendPackPhotos(
  photos: BabyAnimalPhoto[],
  opts: FriendPackMergeOpts = {},
): BabyAnimalPhoto[] {
  const have = new Set(photos.map((photo) => photo.id))
  const dismissed = new Set((opts.ids ?? []).map(packKey).filter(Boolean))
  const urls = new Set((opts.urls ?? []).map(packKey).filter(Boolean))
  return FRIEND_PACK.filter((entry) => {
    const src = friendPackSrc(entry.file)
    if (have.has(entry.id)) return false
    if (dismissed.has(packKey(entry.id))) return false
    if (urls.has(packKey(src))) return false
    return true
  }).map(friendPackPhoto)
}

export function mergeFriendPackPhotos(
  photos: BabyAnimalPhoto[],
  opts: FriendPackMergeOpts = {},
): BabyAnimalPhoto[] {
  const extra = missingFriendPackPhotos(photos, opts)
  return extra.length ? [...photos, ...extra] : photos
}

export function sortGalleryPhotos(photos: BabyAnimalPhoto[]): BabyAnimalPhoto[] {
  return [...photos].sort((a, b) => {
    const aNamed = a.displayName.trim() ? 1 : 0
    const bNamed = b.displayName.trim() ? 1 : 0
    if (aNamed !== bNamed) return aNamed - bNamed
    return a.id.localeCompare(b.id)
  })
}
