/**
 * lib/friend-gallery.ts — Card identity, dismiss, and persist reconcile
 *
 * One gallery card is one `photo.id`. Names live on that id only. Pack cards
 * never borrow catalog species from the letters in a user-given name. Deleted
 * cards stay gone by id + source URL; the pack is not re-injected on hydrate.
 */

import { BABY_ANIMALS, slugFriendId } from "@/lib/baby-animals"
import type { BabyAnimalPhoto } from "@/lib/baby-animal-photos"
import { mergeFriendPackPhotos } from "@/lib/friend-pack"

export const CATALOG_ANIMAL_IDS = new Set(BABY_ANIMALS.map((animal) => animal.id))

export type FriendDismissOpts = {
  ids?: readonly string[]
  urls?: readonly string[]
}

export function isPackCard(photo: Pick<BabyAnimalPhoto, "id" | "animalId" | "via">): boolean {
  return photo.via === "pack" || photo.id.startsWith("pack-") || photo.animalId.startsWith("pack-")
}

export function normalizeFriendKey(value: string | undefined): string {
  return typeof value === "string" ? value.trim().toLowerCase() : ""
}

export function sameFriendId(a: string | undefined, b: string | undefined): boolean {
  const left = normalizeFriendKey(a)
  const right = normalizeFriendKey(b)
  return Boolean(left) && left === right
}

/** Catalog request / species match. Pack ids stay exact. Never mine catalog words from a name. */
export function friendIdentityKeys(animalId: string, displayName = ""): string[] {
  const animal = normalizeFriendKey(animalId)
  if (!animal) return []
  if (animal.startsWith("pack-")) return [animal]
  const name = slugFriendId(displayName)
  return [...new Set([animal, name].filter(Boolean))]
}

export function photoDismissKeys(photo: Pick<BabyAnimalPhoto, "id" | "animalId" | "displayName" | "sourceUrl" | "via">): string[] {
  const keys = [photo.id, photo.animalId, photo.sourceUrl].map(normalizeFriendKey).filter(Boolean)
  if (!isPackCard(photo)) {
    const named = slugFriendId(photo.displayName)
    if (named) keys.push(named)
  }
  return [...new Set(keys)]
}

export function photoIsDismissed(
  photo: Pick<BabyAnimalPhoto, "id" | "animalId" | "displayName" | "sourceUrl" | "via">,
  dismissed: readonly string[],
  urls: readonly string[] = [],
): boolean {
  const keys = photoDismissKeys(photo)
  if (dismissed.some((id) => keys.some((key) => sameFriendId(id, key)))) return true
  const url = normalizeFriendKey(photo.sourceUrl)
  return Boolean(url) && urls.some((row) => sameFriendId(row, url))
}

export function friendIsDismissed(
  dismissed: readonly string[],
  animalId: string,
  displayName = "",
  photo?: Pick<BabyAnimalPhoto, "id" | "animalId" | "displayName" | "sourceUrl" | "via">,
): boolean {
  if (photo) return photoIsDismissed(photo, dismissed)
  const keys = friendIdentityKeys(animalId, displayName)
  return dismissed.some((id) => keys.some((key) => sameFriendId(id, key)))
}

function namedAt(photo: BabyAnimalPhoto): string {
  return photo.namedAt || photo.foundAt || ""
}

/** Same `id` only. A non-empty name on `preferred` always wins over a blank. */
export function mergeSameFriendCard(preferred: BabyAnimalPhoto, other: BabyAnimalPhoto): BabyAnimalPhoto {
  const preferName = preferred.displayName.trim()
  const otherName = other.displayName.trim()
  const displayName = preferName ? preferred.displayName : other.displayName
  const stamp = preferName
    ? preferred.namedAt || (otherName === preferName ? other.namedAt : undefined)
    : other.namedAt
  return {
    ...other,
    ...preferred,
    id: preferred.id,
    animalId: preferred.animalId || other.animalId,
    displayName,
    uri: preferred.uri || other.uri,
    sourceUrl: preferred.sourceUrl || other.sourceUrl,
    via: preferred.via || other.via,
    namedAt: stamp,
    foundAt: namedAt(preferred) >= namedAt(other) ? preferred.foundAt : other.foundAt,
  }
}

export function catalogSpeciesKey(photo: BabyAnimalPhoto): string | null {
  if (isPackCard(photo)) return null
  const id = normalizeFriendKey(photo.animalId)
  return CATALOG_ANIMAL_IDS.has(id) ? id : null
}

/**
 * Collapse duplicate *catalog species* rows. Pack and custom-request cards
 * never merge with each other — only exact `id`.
 */
export function dedupeFriendPhotos(photos: BabyAnimalPhoto[]): BabyAnimalPhoto[] {
  const byId = new Map<string, BabyAnimalPhoto>()
  const speciesOwner = new Map<string, string>()
  for (const photo of photos) {
    if (!photo?.id) continue
    const prev = byId.get(photo.id)
    if (prev) {
      byId.set(photo.id, mergeSameFriendCard(prev, photo))
      continue
    }
    const species = catalogSpeciesKey(photo)
    if (species) {
      const owner = speciesOwner.get(species)
      if (owner && owner !== photo.id) {
        const kept = byId.get(owner)
        if (kept) byId.set(owner, mergeSameFriendCard(kept, { ...photo, id: kept.id, animalId: kept.animalId }))
        continue
      }
      speciesOwner.set(species, photo.id)
    }
    byId.set(photo.id, photo)
  }
  return [...byId.values()]
}

export function stripDismissedPhotos(
  photos: BabyAnimalPhoto[],
  dismissed: readonly string[],
  urls: readonly string[] = [],
): BabyAnimalPhoto[] {
  return photos.filter((photo) => !photoIsDismissed(photo, dismissed, urls))
}

/**
 * Union two gallery snapshots by card id. `preferred` names/uris win when set.
 * Dismissed ids and source URLs never re-enter.
 */
export function reconcileFriendPhotos(
  preferred: BabyAnimalPhoto[] | undefined,
  other: BabyAnimalPhoto[] | undefined,
  dismissed: readonly string[] = [],
  urls: readonly string[] = [],
): BabyAnimalPhoto[] {
  const byId = new Map<string, BabyAnimalPhoto>()
  const add = (photo: BabyAnimalPhoto | undefined, preferExisting: boolean) => {
    if (!photo?.id || photoIsDismissed(photo, dismissed, urls)) return
    const prev = byId.get(photo.id)
    if (!prev) {
      byId.set(photo.id, photo)
      return
    }
    byId.set(photo.id, preferExisting ? mergeSameFriendCard(prev, photo) : mergeSameFriendCard(photo, prev))
  }
  for (const photo of preferred ?? []) add(photo, true)
  for (const photo of other ?? []) add(photo, true)
  return stripDismissedPhotos(dedupeFriendPhotos([...byId.values()]), dismissed, urls)
}

export function unionFriendKeys(...groups: Array<readonly string[] | undefined>): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const group of groups) {
    if (!group) continue
    for (const id of group) {
      const key = normalizeFriendKey(id)
      if (!key || seen.has(key)) continue
      seen.add(key)
      out.push(key)
    }
  }
  return out
}

export function usedPhotoSourceUrls(photos: BabyAnimalPhoto[], extra: readonly string[] = []): string[] {
  return unionFriendKeys(
    extra,
    photos.map((photo) => photo.sourceUrl),
  )
}

export function blockedFriendIds(photos: BabyAnimalPhoto[], dismissed: readonly string[]): string[] {
  return unionFriendKeys(
    dismissed,
    photos.flatMap((photo) => [photo.id, photo.animalId]),
  )
}

/** Drop catalog species keys that still have a live catalog card AND were borrowed from a pack name. */
export function scrubFalseCatalogDismissals(
  photos: BabyAnimalPhoto[],
  dismissed: readonly string[],
): string[] {
  const present = new Set(
    photos
      .filter((photo) => catalogSpeciesKey(photo))
      .map((photo) => normalizeFriendKey(photo.animalId)),
  )
  const packBorrowed = new Set<string>()
  for (const photo of photos) {
    if (!isPackCard(photo)) continue
    for (const token of slugFriendId(photo.displayName).split("-")) {
      if (CATALOG_ANIMAL_IDS.has(token)) packBorrowed.add(token)
    }
  }
  return dismissed.filter((id) => {
    const key = normalizeFriendKey(id)
    if (CATALOG_ANIMAL_IDS.has(key) && present.has(key) && packBorrowed.has(key)) return false
    return true
  })
}

/** First install only. Never fill holes after the human has deleted a pack card. */
export function seedFriendPackIfFresh(
  photos: BabyAnimalPhoto[],
  dismissed: readonly string[],
  urls: readonly string[] = [],
): BabyAnimalPhoto[] {
  const blocked = unionFriendKeys(dismissed, urls)
  const hasPackMemory =
    photos.some((photo) => isPackCard(photo)) || blocked.some((id) => id.startsWith("pack-") || id.includes("/friend-pack/"))
  if (hasPackMemory) return photos
  return mergeFriendPackPhotos(photos, { ids: dismissed, urls })
}

export function applyFriendPackImport(
  photos: BabyAnimalPhoto[],
  dismissed: readonly string[],
  urls: readonly string[] = [],
): BabyAnimalPhoto[] {
  return mergeFriendPackPhotos(photos, { ids: dismissed, urls })
}

export function wearFieldsFromPhoto(photo: BabyAnimalPhoto | undefined): {
  currentPhotoId: string | null
  animalId: string
  displayName: string
} {
  if (!photo) return { currentPhotoId: null, animalId: "", displayName: "" }
  return {
    currentPhotoId: photo.id,
    animalId: photo.animalId,
    displayName: photo.displayName,
  }
}
