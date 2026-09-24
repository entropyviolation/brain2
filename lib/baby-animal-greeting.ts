/**
 * lib/baby-animal-greeting.ts — Worn-friend pin, dismiss pin, reunion lines
 *
 * `brain2-friend-worn` pins the selected friend so a refresh (or a stale hub
 * overlay) cannot swap baby bunny for someone else mid-week. Unnamed pack
 * cards still pin (empty `displayName` is allowed). `brain2-friend-dismissed`
 * pins removed creatures so a hub snapshot cannot resurrect Small Foal.
 * Historical `cogs-friend-worn` / `cogs-friend-dismissed` are copied, never deleted.
 * History records which creatures have already visited. Reunion lines fire only
 * when a known friend is assigned again — never on first meeting, never on refresh.
 */

import { persistKey, readAliasedLocal, removeAliasedLocal, writeAliasedLocal } from "@/lib/storage-keys"

export const WORN_FRIEND_PIN_KEY = persistKey("friend-worn")

export type WornFriendPin = {
  photoId: string
  animalId: string
  displayName: string
  weekKey: string
}

export type FriendHistoryEntry = {
  animalId: string
  displayName: string
  firstSeenAt: string
  lastAssignedAt: string
  wearCount: number
}

export const REUNION_LINES = [
  "Hi again!",
  "Hey there, remember me?",
  "Look who it is!",
  "Miss me?",
] as const

export function pickReunionLine(displayName: string, random = Math.random): string {
  const name = displayName.trim()
  const pool = name ? [...REUNION_LINES, `Hi again, ${name}!`] : [...REUNION_LINES]
  return pool[Math.floor(random() * pool.length)] ?? "Hi again!"
}

let pendingReunion: string | null = null

export function queueReunionLine(displayName: string, random = Math.random): string {
  pendingReunion = pickReunionLine(displayName, random)
  return pendingReunion
}

export function consumeReunionLine(): string | null {
  const line = pendingReunion
  pendingReunion = null
  return line
}

export function clearReunionLine(): void {
  pendingReunion = null
}

export function noteFriendAssignment(opts: {
  animalId: string
  displayName: string
  previousPhotoId: string | null
  nextPhotoId: string
  history: FriendHistoryEntry[]
  greet: boolean
  now?: Date
}): { history: FriendHistoryEntry[]; greeted: boolean } {
  const now = (opts.now ?? new Date()).toISOString()
  const known = opts.history.some((row) => row.animalId === opts.animalId)
  const changed = opts.previousPhotoId !== opts.nextPhotoId
  const greeted = Boolean(opts.greet && changed && known)
  if (greeted) queueReunionLine(opts.displayName)
  const prev = opts.history.find((row) => row.animalId === opts.animalId)
  return {
    history: [
      ...opts.history.filter((row) => row.animalId !== opts.animalId),
      {
        animalId: opts.animalId,
        displayName: opts.displayName,
        firstSeenAt: prev?.firstSeenAt ?? now,
        lastAssignedAt: now,
        wearCount: (prev?.wearCount ?? 0) + 1,
      },
    ],
    greeted,
  }
}

export function readWornFriendPin(): WornFriendPin | null {
  if (typeof window === "undefined") return null
  try {
    const raw = readAliasedLocal(WORN_FRIEND_PIN_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<WornFriendPin>
    if (!parsed.photoId || !parsed.animalId) return null
    return {
      photoId: parsed.photoId,
      animalId: parsed.animalId,
      displayName: typeof parsed.displayName === "string" ? parsed.displayName : "",
      weekKey: typeof parsed.weekKey === "string" ? parsed.weekKey : "",
    }
  } catch {
    return null
  }
}

export function writeWornFriendPin(pin: WornFriendPin): void {
  if (typeof window === "undefined") return
  try {
    writeAliasedLocal(WORN_FRIEND_PIN_KEY, JSON.stringify(pin))
  } catch {
    /* quota */
  }
}

export function clearWornFriendPin(): void {
  if (typeof window === "undefined") return
  try {
    removeAliasedLocal(WORN_FRIEND_PIN_KEY)
  } catch {
    /* ignore */
  }
}

/** True when `weekKey` is a Monday strictly before `monday`. Empty means "this week". */
export function isPriorMonday(weekKey: string, monday: string): boolean {
  return Boolean(weekKey) && weekKey < monday
}

export const DISMISSED_FRIEND_PIN_KEY = persistKey("friend-dismissed")

export function readDismissedFriendPin(): string[] {
  if (typeof window === "undefined") return []
  try {
    const raw = readAliasedLocal(DISMISSED_FRIEND_PIN_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return [...new Set(parsed.map((id) => (typeof id === "string" ? id.trim().toLowerCase() : "")).filter(Boolean))]
  } catch {
    return []
  }
}

export function rememberDismissedFriends(ids: readonly string[]): string[] {
  const next = [
    ...new Set(
      [...readDismissedFriendPin(), ...ids]
        .map((id) => id.trim().toLowerCase())
        .filter(Boolean),
    ),
  ]
  if (typeof window !== "undefined") {
    try {
      writeAliasedLocal(DISMISSED_FRIEND_PIN_KEY, JSON.stringify(next))
    } catch {
      /* quota — in-memory union still returned */
    }
  }
  return next
}

export function clearDismissedFriendPin(): void {
  if (typeof window === "undefined") return
  try {
    removeAliasedLocal(DISMISSED_FRIEND_PIN_KEY)
  } catch {
    /* ignore */
  }
}
