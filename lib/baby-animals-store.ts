/**
 * lib/baby-animals-store.ts — Today's friend gallery (photographs)
 *
 * Metadata in `brain2-baby-animals-store`. Picture bytes in the friend vault
 * (`friend:<id>` / `brain2-friend-pic:<id>`), never stuffed into this JSON.
 * The worn friend stays until the next Monday or a manual change. Every
 * picture is a preapproved `animalsrcs/` pack still (seeded once, unnamed) or
 * a photograph the human uploaded — nothing is fetched. Each card is its `id`.
 * Removed friends stay dismissed by id + URL so shuffle cannot resurrect them.
 */
"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { createCogsJSONStorage } from "@/lib/persist-storage"
import { persistKey, readAliasedLocal } from "@/lib/storage-keys"
import { isAttachmentRef } from "@/lib/attachments"
import {
  COMPANION_STORAGE_KEY,
  animalById,
  localDayKey,
  localMondayKey,
  parseCompanion,
  shuffleCompanion,
} from "@/lib/baby-animals"
import type { BabyAnimalPhoto } from "@/lib/baby-animal-photos"
import {
  applyFriendPackImport,
  blockedFriendIds as galleryBlockedIds,
  catalogSpeciesKey,
  isPackCard,
  mergeSameFriendCard,
  photoDismissKeys,
  photoIsDismissed,
  reconcileFriendPhotos,
  seedFriendPackIfFresh,
  scrubFalseCatalogDismissals,
  stripDismissedPhotos,
  unionFriendKeys,
  usedPhotoSourceUrls as galleryUsedUrls,
  wearFieldsFromPhoto,
} from "@/lib/friend-gallery"
import {
  dropFriendPhoto,
  isFriendPhotoRef,
  migratePhotoUriToVault,
  persistableFriendPhotoUri,
} from "@/lib/friend-photo-vault"
import {
  clearDismissedFriendPin,
  clearWornFriendPin,
  noteFriendAssignment,
  readDismissedFriendPin,
  readWornFriendPin,
  rememberDismissedFriends,
  writeWornFriendPin,
  type FriendHistoryEntry,
} from "@/lib/baby-animal-greeting"
import { sanitizeFriendPersonality, type FriendPersonality } from "@/lib/baby-animal-personality"
import {
  endOfLocalDay,
  isBeforeDeadline,
  sanitizeFriendMissions,
  withMissionLog,
  type FriendMission,
  type FriendMissionDraft,
  type FriendMissionNote,
} from "@/lib/friend-mission"
import { grantFriendReward } from "@/lib/friend-reward"

export const BABY_ANIMALS_STORE_KEY = persistKey("baby-animals-store")

type CompanionSlice = {
  photos: BabyAnimalPhoto[]
  currentPhotoId: string | null
  animalId: string
  displayName: string
  salt: number
  day: string
  /** Local Monday YYYY-MM-DD of the week this friend was worn. Empty until first wear. */
  weekKey: string
  dismissedAnimalIds: string[]
  dismissedSourceUrls: string[]
  friendHistory: FriendHistoryEntry[]
  personalities: Record<string, FriendPersonality>
  friendMissions: FriendMission[]
}

interface BabyAnimalsState extends CompanionSlice {
  wearPhoto: (id: string, opts?: { greet?: boolean }) => void
  addAndWear: (photo: BabyAnimalPhoto) => BabyAnimalPhoto | null
  removePhoto: (id: string) => void
  renamePhoto: (id: string, displayName: string) => void
  replacePhoto: (id: string, patch: Partial<Omit<BabyAnimalPhoto, "id">>) => void
  stampWeek: (weekKey?: string) => void
  setPersonality: (animalId: string, personality: FriendPersonality) => void
  offerMission: (draft: FriendMissionDraft) => void
  noteMission: (taskId: string | null, note: FriendMissionNote, detail?: string) => void
  acceptMission: (taskId: string | null, extra?: { stepId?: string | null; stepTitle?: string }) => void
  declineMission: (taskId: string | null, reason?: string) => void
  /** Marks an accepted, still-in-time mission done and grants points. */
  completeMission: (taskId: string | null, now?: Date) => FriendMission | null
  expireDueMissions: (now?: Date) => void
  importFriendPack: () => void
  resetGallery: () => void
}

const emptyCompanion = (): CompanionSlice => {
  const picked = shuffleCompanion(undefined, () => 0.11)
  const day = typeof window === "undefined" ? "" : localDayKey(new Date())
  return {
    photos: [],
    currentPhotoId: null,
    animalId: picked.animal.id,
    displayName: "",
    salt: 0,
    day,
    weekKey: "",
    dismissedAnimalIds: [],
    dismissedSourceUrls: [],
    friendHistory: [],
    personalities: {},
    friendMissions: [],
  }
}

function thisMonday(): string {
  return typeof window === "undefined" ? "" : localMondayKey(new Date())
}

function migrateLegacyCompanion(): Partial<CompanionSlice> {
  if (typeof window === "undefined") return {}
  const today = localDayKey(new Date())
  const legacy = parseCompanion(readAliasedLocal(COMPANION_STORAGE_KEY), today)
  if (!legacy || !animalById(legacy.id)) return {}
  return {
    animalId: legacy.id,
    displayName: legacy.displayName,
    salt: legacy.salt,
    day: legacy.day,
  }
}

function vaultedPhoto(photo: BabyAnimalPhoto): BabyAnimalPhoto {
  const uri = persistableFriendPhotoUri(photo.id, photo.uri)
  const sourceUrl =
    photo.sourceUrl.startsWith("data:image") && uri !== photo.sourceUrl ? uri : photo.sourceUrl
  return uri === photo.uri && sourceUrl === photo.sourceUrl ? photo : { ...photo, uri, sourceUrl }
}

function dropIfReplaced(prevUri: string, nextUri: string) {
  if (!prevUri || prevUri === nextUri) return
  if (prevUri.startsWith("http") || prevUri.startsWith("/")) return
  void dropFriendPhoto(prevUri)
}

function persistGalleryPhotos(
  preferred: BabyAnimalPhoto[] | undefined,
  other: BabyAnimalPhoto[] | undefined,
  dismissed: readonly string[],
  urls: readonly string[],
): BabyAnimalPhoto[] {
  return seedFriendPackIfFresh(reconcileFriendPhotos(preferred, other, dismissed, urls), dismissed, urls)
}

export {
  friendIdentityKeys,
  friendIsDismissed,
  photoDismissKeys,
  photoIsDismissed,
  reconcileFriendPhotos,
  stripDismissedPhotos,
} from "@/lib/friend-gallery"

export function unionDismissedIds(...groups: Array<readonly string[] | undefined>): string[] {
  return unionFriendKeys(...groups)
}

export const useBabyAnimalsStore = create<BabyAnimalsState>()(
  persist(
    (set, get) => ({
      ...emptyCompanion(),

      wearPhoto: (id, opts) => {
        const state = get()
        const photo = state.photos.find((p) => p.id === id)
        if (!photo) return
        const weekKey = thisMonday() || state.weekKey
        const noted = noteFriendAssignment({
          animalId: photo.animalId,
          displayName: photo.displayName,
          previousPhotoId: state.currentPhotoId,
          nextPhotoId: photo.id,
          history: state.friendHistory,
          greet: opts?.greet !== false,
        })
        writeWornFriendPin({
          photoId: photo.id,
          animalId: photo.animalId,
          displayName: photo.displayName,
          weekKey,
        })
        set({
          currentPhotoId: photo.id,
          animalId: photo.animalId,
          displayName: photo.displayName,
          weekKey,
          day: localDayKey(new Date()),
          friendHistory: noted.history,
        })
      },

      addAndWear: (photo) => {
        const state = get()
        const dismissed = unionDismissedIds(state.dismissedAnimalIds, readDismissedFriendPin())
        if (photoIsDismissed(photo, dismissed, state.dismissedSourceUrls)) return null
        const stored = vaultedPhoto(photo)
        const species = catalogSpeciesKey(stored)
        const existing =
          state.photos.find((row) => row.id === stored.id) ??
          (species ? state.photos.find((row) => catalogSpeciesKey(row) === species) : undefined)
        const weekKey = thisMonday() || state.weekKey
        const day = localDayKey(new Date())
        if (existing) {
          const next = vaultedPhoto({
            ...mergeSameFriendCard(existing, stored),
            id: existing.id,
            animalId: existing.animalId,
            displayName: isPackCard(existing)
              ? existing.displayName.trim()
                ? existing.displayName
                : stored.displayName
              : stored.displayName.trim()
                ? stored.displayName
                : existing.displayName,
            namedAt:
              stored.displayName.trim() && !isPackCard(existing)
                ? stored.namedAt || existing.namedAt
                : existing.namedAt,
            uri: stored.uri || existing.uri,
            sourceUrl: stored.sourceUrl || existing.sourceUrl,
            via: stored.via || existing.via,
            query: stored.query || existing.query,
            pageUrl: stored.pageUrl ?? existing.pageUrl,
            title: stored.title ?? existing.title,
            foundAt: stored.foundAt || existing.foundAt,
          })
          dropIfReplaced(existing.uri, next.uri)
          const noted = noteFriendAssignment({
            animalId: next.animalId,
            displayName: next.displayName,
            previousPhotoId: state.currentPhotoId,
            nextPhotoId: existing.id,
            history: state.friendHistory,
            greet: true,
          })
          writeWornFriendPin({
            photoId: existing.id,
            animalId: next.animalId,
            displayName: next.displayName,
            weekKey,
          })
          set({
            photos: state.photos.map((row) => (row.id === existing.id ? next : row)),
            currentPhotoId: existing.id,
            animalId: next.animalId,
            displayName: next.displayName,
            weekKey,
            day,
            friendHistory: noted.history,
          })
          return next
        }
        const noted = noteFriendAssignment({
          animalId: stored.animalId,
          displayName: stored.displayName,
          previousPhotoId: state.currentPhotoId,
          nextPhotoId: stored.id,
          history: state.friendHistory,
          greet: true,
        })
        writeWornFriendPin({
          photoId: stored.id,
          animalId: stored.animalId,
          displayName: stored.displayName,
          weekKey,
        })
        set({
          photos: [...state.photos, stored],
          currentPhotoId: stored.id,
          animalId: stored.animalId,
          displayName: stored.displayName,
          weekKey,
          day,
          friendHistory: noted.history,
        })
        return stored
      },

      removePhoto: (id) => {
        const photo = get().photos.find((p) => p.id === id)
        if (photo) void dropFriendPhoto(photo.uri)
        set((state) => {
          const extra = photo ? photoDismissKeys(photo) : []
          const dismissedAnimalIds = rememberDismissedFriends(
            unionDismissedIds(state.dismissedAnimalIds, extra, readDismissedFriendPin()),
          )
          const dismissedSourceUrls = photo
            ? unionDismissedIds(state.dismissedSourceUrls, [photo.sourceUrl, photo.uri])
            : state.dismissedSourceUrls
          const photos = stripDismissedPhotos(
            state.photos.filter((row) => row.id !== id),
            dismissedAnimalIds,
            dismissedSourceUrls,
          )
          const pin = readWornFriendPin()
          if (photo && (pin?.photoId === photo.id || (pin && photoIsDismissed({ ...photo, id: pin.photoId, animalId: pin.animalId, displayName: pin.displayName }, dismissedAnimalIds, dismissedSourceUrls)))) {
            clearWornFriendPin()
          }
          const currentPhotoId =
            state.currentPhotoId && photos.some((p) => p.id === state.currentPhotoId)
              ? state.currentPhotoId
              : photos[photos.length - 1]?.id ?? null
          const next = photos.find((p) => p.id === currentPhotoId)
          if (next) {
            writeWornFriendPin({
              photoId: next.id,
              animalId: next.animalId,
              displayName: next.displayName,
              weekKey: thisMonday() || state.weekKey,
            })
          } else {
            clearWornFriendPin()
          }
          return {
            photos,
            currentPhotoId,
            dismissedAnimalIds,
            dismissedSourceUrls,
            ...(next ? { animalId: next.animalId, displayName: next.displayName } : {}),
          }
        })
      },

      renamePhoto: (id, displayName) => {
        const trimmed = displayName.trim()
        get().replacePhoto(id, {
          displayName: trimmed,
          namedAt: trimmed ? new Date().toISOString() : undefined,
        })
      },

      replacePhoto: (id, patch) => {
        const prev = get().photos.find((photo) => photo.id === id)
        if (!prev) return
        const next = vaultedPhoto({ ...prev, ...patch, id, animalId: prev.animalId })
        dropIfReplaced(prev.uri, next.uri)
        set((state) => ({
          photos: state.photos.map((photo) => (photo.id === id ? next : photo)),
          ...(state.currentPhotoId === id
            ? { displayName: next.displayName, animalId: next.animalId, weekKey: thisMonday() || state.weekKey }
            : {}),
        }))
      },

      setPersonality: (animalId, personality) => {
        const key = animalId.trim().toLowerCase()
        if (!key) return
        set((state) => ({
          personalities: { ...state.personalities, [key]: sanitizeFriendPersonality(personality) },
        }))
      },

      offerMission: (draft) => {
        set((state) => {
          const now = new Date().toISOString()
          const id = `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
          const rest = state.friendMissions.map((row) => {
            if (row.status !== "offered" || row.animalId !== draft.animalId) return row
            return {
              ...row,
              status: "declined" as const,
              declineReason: row.declineReason || "Asked for another",
              log: withMissionLog(row.log, "declined", "Asked for another", now),
            }
          })
          const next: FriendMission = {
            ...draft,
            id,
            offeredAt: now,
            status: "offered",
            stepId: null,
            stepTitle: "",
            acceptedAt: "",
            deadline: "",
            declineReason: "",
            log: withMissionLog([], "offered", draft.title, now),
          }
          return { friendMissions: [next, ...rest].slice(0, 80) }
        })
      },

      noteMission: (taskId, note, detail) => {
        if (!taskId) return
        const now = new Date().toISOString()
        set((state) => {
          let noted = false
          return {
            friendMissions: state.friendMissions.map((row) => {
              if (noted || row.taskId !== taskId || (row.status !== "offered" && row.status !== "accepted")) return row
              noted = true
              return { ...row, log: withMissionLog(row.log, note, detail, now) }
            }),
          }
        })
      },

      acceptMission: (taskId, extra) => {
        if (!taskId) return
        const now = new Date()
        const deadline = endOfLocalDay(now)
        const stepTitle = extra?.stepTitle?.trim() ?? ""
        set((state) => {
          let taken = false
          return {
            friendMissions: state.friendMissions.map((row) => {
              if (taken || row.status !== "offered" || row.taskId !== taskId) return row
              taken = true
              return {
                ...row,
                status: "accepted" as const,
                acceptedAt: now.toISOString(),
                deadline,
                stepId: extra?.stepId ?? null,
                stepTitle,
                log: withMissionLog(
                  row.log,
                  "accepted",
                  stepTitle ? `First step: ${stepTitle}. Until the end of today.` : "Until the end of today.",
                  now.toISOString(),
                ),
              }
            }),
          }
        })
      },

      declineMission: (taskId, reason) => {
        if (!taskId) return
        const why = (reason ?? "Asked for another").trim().slice(0, 400) || "Asked for another"
        const now = new Date().toISOString()
        set((state) => {
          let taken = false
          return {
            friendMissions: state.friendMissions.map((row) => {
              if (taken || row.status !== "offered" || row.taskId !== taskId) return row
              taken = true
              return {
                ...row,
                status: "declined" as const,
                declineReason: why,
                log: withMissionLog(row.log, "declined", why, now),
              }
            }),
          }
        })
      },

      expireDueMissions: (now = new Date()) => {
        set((state) => {
          let changed = false
          const friendMissions = state.friendMissions.map((row) => {
            if (row.status !== "accepted" || isBeforeDeadline(row.deadline, now)) return row
            changed = true
            return {
              ...row,
              status: "expired" as const,
              log: withMissionLog(row.log, "expired", "The day ended before it was finished.", now.toISOString()),
            }
          })
          return changed ? { friendMissions } : state
        })
      },

      completeMission: (taskId, now = new Date()) => {
        if (!taskId) return null
        const found = get().friendMissions.find((row) => row.status === "accepted" && row.taskId === taskId)
        if (!found) return null
        if (!isBeforeDeadline(found.deadline, now)) {
          get().expireDueMissions(now)
          return null
        }
        const done: FriendMission = {
          ...found,
          status: "done",
          log: withMissionLog(found.log, "done", found.stepTitle || found.title, now.toISOString()),
        }
        set((state) => ({
          friendMissions: state.friendMissions.map((row) => (row.id === found.id ? done : row)),
        }))
        if (found.points > 0) grantFriendReward(`friend-mission:${found.id}`, found.points, found.stepTitle || found.title)
        return done
      },

      stampWeek: (weekKey) => {
        const next = weekKey || thisMonday()
        const photo = get().photos.find((p) => p.id === get().currentPhotoId)
        if (photo) {
          writeWornFriendPin({
            photoId: photo.id,
            animalId: photo.animalId,
            displayName: photo.displayName,
            weekKey: next,
          })
        }
        set({ weekKey: next })
      },

      importFriendPack: () => {
        set((state) => {
          const dismissed = unionDismissedIds(state.dismissedAnimalIds, readDismissedFriendPin())
          const photos = applyFriendPackImport(state.photos, dismissed, state.dismissedSourceUrls)
          if (photos === state.photos) return state
          return { photos }
        })
      },

      resetGallery: () => {
        clearWornFriendPin()
        clearDismissedFriendPin()
        set(emptyCompanion())
      },
    }),
    {
      name: BABY_ANIMALS_STORE_KEY,
      version: 7,
      storage: createCogsJSONStorage(),
      partialize: (state) => ({
        photos: state.photos.map((photo) => {
          if (!photo.uri.startsWith("data:image")) return photo
          return {
            ...photo,
            uri: persistableFriendPhotoUri(photo.id, photo.uri),
            sourceUrl: photo.sourceUrl.startsWith("data:image")
              ? persistableFriendPhotoUri(photo.id, photo.sourceUrl)
              : photo.sourceUrl,
          }
        }),
        currentPhotoId: state.currentPhotoId,
        animalId: state.animalId,
        displayName: state.displayName,
        salt: state.salt,
        day: state.day,
        weekKey: state.weekKey,
        dismissedAnimalIds: state.dismissedAnimalIds,
        dismissedSourceUrls: state.dismissedSourceUrls,
        friendHistory: state.friendHistory,
        personalities: state.personalities,
        friendMissions: state.friendMissions,
      }),
      migrate: (persisted) => {
        const saved = persisted && typeof persisted === "object" ? (persisted as Partial<CompanionSlice>) : {}
        const dismissedAnimalIds = rememberDismissedFriends(
          scrubFalseCatalogDismissals(
            saved.photos ?? [],
            unionDismissedIds(saved.dismissedAnimalIds, readDismissedFriendPin()),
          ),
        )
        const dismissedSourceUrls = saved.dismissedSourceUrls ?? []
        const photos = persistGalleryPhotos(saved.photos, undefined, dismissedAnimalIds, dismissedSourceUrls)
        const worn = wearFieldsFromPhoto(
          photos.find((photo) => photo.id === saved.currentPhotoId) ?? photos[photos.length - 1],
        )
        const weekKey =
          typeof saved.weekKey === "string" && saved.weekKey
            ? saved.weekKey
            : worn.currentPhotoId
              ? localMondayKey(new Date())
              : ""
        const personalities: Record<string, FriendPersonality> = {}
        if (saved.personalities) {
          for (const [key, value] of Object.entries(saved.personalities)) {
            personalities[key] = sanitizeFriendPersonality(value)
          }
        }
        return {
          ...emptyCompanion(),
          ...saved,
          photos,
          ...worn,
          weekKey,
          dismissedAnimalIds,
          dismissedSourceUrls,
          friendHistory: saved.friendHistory ?? [],
          personalities,
          friendMissions: sanitizeFriendMissions(saved.friendMissions),
        }
      },
      merge: (persisted, current) => {
        const saved = persisted && typeof persisted === "object" ? (persisted as Partial<CompanionSlice>) : {}
        const legacy = saved.animalId ? {} : migrateLegacyCompanion()
        const dismissedAnimalIds = rememberDismissedFriends(
          scrubFalseCatalogDismissals(
            [...(saved.photos ?? []), ...current.photos],
            unionDismissedIds(saved.dismissedAnimalIds, current.dismissedAnimalIds, readDismissedFriendPin()),
          ),
        )
        const dismissedSourceUrls = unionDismissedIds(saved.dismissedSourceUrls, current.dismissedSourceUrls)
        const photos = persistGalleryPhotos(saved.photos, current.photos, dismissedAnimalIds, dismissedSourceUrls)
        const pin = readWornFriendPin()
        const monday = typeof window === "undefined" ? "" : localMondayKey(new Date())
        const pinned = pin ? photos.find((photo) => photo.id === pin.photoId) : undefined
        const pinOk =
          Boolean(pin && pinned && (!pin.weekKey || pin.weekKey === monday) && !photoIsDismissed(pinned, dismissedAnimalIds, dismissedSourceUrls))
        const preferredId = pinOk && pinned ? pinned.id : (saved.currentPhotoId ?? current.currentPhotoId)
        const wornPhoto = photos.find((photo) => photo.id === preferredId) ?? photos[photos.length - 1]
        const worn = wearFieldsFromPhoto(wornPhoto)
        const weekKey =
          pinOk && pin?.weekKey
            ? pin.weekKey
            : typeof saved.weekKey === "string" && saved.weekKey
              ? saved.weekKey
              : worn.currentPhotoId
                ? localMondayKey(new Date())
                : (current.weekKey ?? "")
        const personalities: Record<string, FriendPersonality> = { ...current.personalities }
        for (const [key, value] of Object.entries(saved.personalities ?? {})) {
          personalities[key] = sanitizeFriendPersonality(value)
        }
        return {
          ...current,
          ...saved,
          ...legacy,
          photos,
          ...worn,
          weekKey,
          dismissedAnimalIds,
          dismissedSourceUrls,
          friendHistory: saved.friendHistory ?? current.friendHistory ?? [],
          personalities,
          friendMissions: sanitizeFriendMissions(saved.friendMissions ?? current.friendMissions),
        }
      },
      onRehydrateStorage: () => (state) => {
        if (!state) return
        const dismissed = rememberDismissedFriends(
          scrubFalseCatalogDismissals(state.photos, unionDismissedIds(state.dismissedAnimalIds, readDismissedFriendPin())),
        )
        const photos = stripDismissedPhotos(state.photos, dismissed, state.dismissedSourceUrls)
        if (photos.length !== state.photos.length || dismissed.length !== state.dismissedAnimalIds.length) {
          const worn = wearFieldsFromPhoto(
            photos.find((photo) => photo.id === state.currentPhotoId) ?? photos[photos.length - 1],
          )
          useBabyAnimalsStore.setState({ photos, dismissedAnimalIds: dismissed, ...worn })
        }
        const live = useBabyAnimalsStore.getState()
        const pin = readWornFriendPin()
        const monday = localMondayKey(new Date())
        if (
          pin &&
          (!pin.weekKey || pin.weekKey === monday) &&
          live.photos.some((photo) => photo.id === pin.photoId) &&
          !photoIsDismissed(
            live.photos.find((photo) => photo.id === pin.photoId) ?? {
              id: pin.photoId,
              animalId: pin.animalId,
              displayName: pin.displayName,
              sourceUrl: "",
              via: pin.animalId.startsWith("pack-") ? "pack" : "openverse",
            },
            live.dismissedAnimalIds,
            live.dismissedSourceUrls,
          )
        ) {
          if (live.currentPhotoId !== pin.photoId) {
            live.wearPhoto(pin.photoId, { greet: false })
          }
        } else if (
          pin &&
          photoIsDismissed(
            live.photos.find((photo) => photo.id === pin.photoId) ?? {
              id: pin.photoId,
              animalId: pin.animalId,
              displayName: pin.displayName,
              sourceUrl: "",
              via: pin.animalId.startsWith("pack-") ? "pack" : "openverse",
            },
            live.dismissedAnimalIds,
            live.dismissedSourceUrls,
          )
        ) {
          clearWornFriendPin()
        }
        if (!live.photos.length) return
        void Promise.all(
          live.photos.map(async (photo) => {
            if (isFriendPhotoRef(photo.uri) && !photo.uri.startsWith("data:")) {
              await migratePhotoUriToVault(photo.id, photo.uri)
              return
            }
            if (!isAttachmentRef(photo.uri) && !photo.uri.startsWith("data:image")) return
            try {
              const nextUri = await migratePhotoUriToVault(photo.id, photo.uri)
              if (nextUri === photo.uri) return
              useBabyAnimalsStore.setState((current) => ({
                photos: current.photos.map((row) =>
                  row.id === photo.id
                    ? {
                        ...row,
                        uri: nextUri,
                        ...(row.via === "upload" || row.sourceUrl.startsWith("data:") ? { sourceUrl: nextUri } : {}),
                      }
                    : row,
                ),
              }))
            } catch {
              /* keep the stored ref */
            }
          }),
        )
      },
    },
  ),
)

export function usedPhotoSourceUrls(photos: BabyAnimalPhoto[], extra: readonly string[] = []): string[] {
  return galleryUsedUrls(photos, extra)
}

export function blockedFriendIds(state: Pick<CompanionSlice, "photos" | "dismissedAnimalIds">): string[] {
  const dismissed = unionDismissedIds(state.dismissedAnimalIds, readDismissedFriendPin())
  return galleryBlockedIds(state.photos, dismissed)
}
