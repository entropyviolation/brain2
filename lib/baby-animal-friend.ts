/**
 * lib/baby-animal-friend.ts — Wear / name / swap / upload for the friend
 *
 * **Every picture comes from the preapproved
 * `animalsrcs/` pack** (`public/friend-pack/`) or from a photograph the human
 * uploads. Nothing is searched or invented on the web. Each gallery card is
 * its `id`; removed friends stay dismissed by id + URL. Auto-roll only on a
 * new Monday week, not refresh.
 */

import { animalById, localMondayKey, slugFriendId } from "@/lib/baby-animals"
import { storePhotoBytes, type BabyAnimalPhoto } from "@/lib/baby-animal-photos"
import {
  photoIsDismissed,
  unionDismissedIds,
  useBabyAnimalsStore,
} from "@/lib/baby-animals-store"
import { isPriorMonday, readDismissedFriendPin, readWornFriendPin } from "@/lib/baby-animal-greeting"

function dismissedNow(): { ids: string[]; urls: string[] } {
  const state = useBabyAnimalsStore.getState()
  return {
    ids: unionDismissedIds(state.dismissedAnimalIds, readDismissedFriendPin()),
    urls: state.dismissedSourceUrls,
  }
}

/** Seed the pack on a first-run gallery so there is always someone to wear. */
function galleryPhotos(): BabyAnimalPhoto[] {
  if (useBabyAnimalsStore.getState().photos.length === 0) {
    useBabyAnimalsStore.getState().importFriendPack()
  }
  return useBabyAnimalsStore.getState().photos
}

function wearExistingPhoto(avoidId?: string | null): BabyAnimalPhoto | null {
  const state = useBabyAnimalsStore.getState()
  if (!state.photos.length) return null
  const pool = avoidId && state.photos.length > 1 ? state.photos.filter((photo) => photo.id !== avoidId) : state.photos
  const next = pool[Math.floor(Math.random() * pool.length)]!
  state.wearPhoto(next.id)
  return next
}

/** Wear another card from the gallery. Never fetches a new creature. */
export async function rollBabyAnimalFriend(opts?: { force?: boolean }): Promise<BabyAnimalPhoto | null> {
  const photos = galleryPhotos()
  const state = useBabyAnimalsStore.getState()
  if (!opts?.force && state.currentPhotoId && photos.some((photo) => photo.id === state.currentPhotoId)) {
    return photos.find((photo) => photo.id === state.currentPhotoId) ?? null
  }
  return wearExistingPhoto(opts?.force ? state.currentPhotoId : undefined)
}

/** Keep the worn friend across refresh. Shuffle only on a new Monday, or when the user picks. */
export async function ensureWeeklyFriend(now = new Date()): Promise<BabyAnimalPhoto | null> {
  const monday = localMondayKey(now)
  galleryPhotos()
  const state = useBabyAnimalsStore.getState()
  const pin = readWornFriendPin()
  const { ids: dismissed, urls } = dismissedNow()
  const pinnedPhoto = pin ? state.photos.find((photo) => photo.id === pin.photoId) : undefined
  const pinned =
    pin && pinnedPhoto && (!pin.weekKey || pin.weekKey === monday) && !photoIsDismissed(pinnedPhoto, dismissed, urls)
      ? pinnedPhoto
      : undefined
  const candidate = pinned ?? state.photos.find((photo) => photo.id === state.currentPhotoId)
  const worn = candidate && !photoIsDismissed(candidate, dismissed, urls) ? candidate : undefined

  if (worn) {
    const storedWeek = pin?.weekKey || state.weekKey
    if (isPriorMonday(storedWeek, monday) && pin?.weekKey !== monday) {
      return rollBabyAnimalFriend({ force: true })
    }
    if (state.currentPhotoId !== worn.id) {
      state.wearPhoto(worn.id, { greet: false })
    } else if (state.weekKey !== monday) {
      state.stampWeek(monday)
    }
    return useBabyAnimalsStore.getState().photos.find((photo) => photo.id === worn.id) ?? worn
  }

  const keep = state.photos.find((photo) => !photoIsDismissed(photo, dismissed, urls))
  if (keep) {
    state.wearPhoto(keep.id, { greet: false })
    return keep
  }
  return rollBabyAnimalFriend({ force: true })
}

/**
 * Name a friend. A typed name wears the card that already has it, otherwise
 * it names the next unnamed preapproved picture — no web lookup.
 */
export async function requestBabyAnimalFriend(rawName: string): Promise<BabyAnimalPhoto> {
  const displayName = rawName.trim()
  if (!displayName) throw new Error("Type a name to request, like Tiny Cute Striped Polecat.")
  galleryPhotos()
  const state = useBabyAnimalsStore.getState()
  const slug = slugFriendId(displayName)
  const { ids: dismissed } = dismissedNow()
  if (dismissed.some((id) => id === slug)) throw new Error("You already removed that friend.")
  const existing =
    state.photos.find((photo) => slugFriendId(photo.displayName) === slug) ??
    state.photos.find((photo) => photo.animalId.toLowerCase() === slug)
  if (existing) {
    state.wearPhoto(existing.id)
    return existing
  }
  const unnamed = state.photos.filter((photo) => !photo.displayName.trim())
  if (unnamed.length === 0) {
    throw new Error("Every preapproved picture already has a name. Delete one, or upload a photograph.")
  }
  const card = unnamed[Math.floor(Math.random() * unnamed.length)]!
  state.renamePhoto(card.id, displayName)
  useBabyAnimalsStore.getState().wearPhoto(card.id)
  return useBabyAnimalsStore.getState().photos.find((photo) => photo.id === card.id) ?? card
}

export async function uploadFriendPicture(file: File, photoId?: string): Promise<BabyAnimalPhoto> {
  const state = useBabyAnimalsStore.getState()
  const existing = photoId ? state.photos.find((photo) => photo.id === photoId) : undefined
  const animal = animalById(existing?.animalId || state.animalId)
  const id = existing?.id ?? `baby_upload_${Date.now().toString(36)}`
  const uri = await storePhotoBytes(file, id, file.name || `${animal?.id ?? "friend"}.png`)
  const photo: BabyAnimalPhoto = {
    id,
    animalId: existing?.animalId || id,
    displayName: existing?.displayName ?? "",
    query: "upload",
    sourceUrl: uri,
    via: "upload",
    uri,
    foundAt: new Date().toISOString(),
  }
  if (existing) {
    state.replacePhoto(id, photo)
    if (state.currentPhotoId === id) state.wearPhoto(id)
    return { ...existing, ...photo, id }
  }
  const worn = state.addAndWear(photo)
  if (!worn) throw new Error("You already removed that friend.")
  return worn
}
