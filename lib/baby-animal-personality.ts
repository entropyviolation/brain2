/**
 * lib/baby-animal-personality.ts — Personality + source bias for today's friend
 *
 * Each catalog species leans toward daily habits, today's To Do, or Next
 * Actions, plus quirks (I love you, whims, title loves, bubble effects).
 * Named photographs get a tighter fit in `lib/friend-personality-fits.ts`.
 * Gallery Details writes a stored overlay. Picker: `lib/friend-suggestion.ts`.
 * Plan: `docs/FRIEND_COMPANION.md`.
 */

import { BABY_ANIMALS } from "@/lib/baby-animals"
import { FRIEND_WHIM_IDS } from "@/lib/friend-whims"
import { personalityFitFor } from "@/lib/friend-personality-fits"

export const FRIEND_CADENCE = ["quiet", "occasional", "chatty", "eager"] as const
export type FriendCadence = (typeof FRIEND_CADENCE)[number]

export const FRIEND_TONE = ["gentle", "playful", "direct", "coach"] as const
export type FriendTone = (typeof FRIEND_TONE)[number]

export const FRIEND_PUSHINESS = ["never", "nudge", "insist", "celebrate"] as const
export type FriendPushiness = (typeof FRIEND_PUSHINESS)[number]

export const FRIEND_DIALOG_EFFECTS = ["plain", "heart", "sparkle", "stamp", "whisper", "bounce"] as const
export type FriendDialogEffect = (typeof FRIEND_DIALOG_EFFECTS)[number]

export const FRIEND_SUGGESTION_KINDS = ["mission", "affection", "whim", "reunion", "empty"] as const
export type FriendSuggestionKind = (typeof FRIEND_SUGGESTION_KINDS)[number]

export type FriendWorldSource = "habit" | "todo" | "nextAction"
export type FriendSuggestionSource = FriendWorldSource | "affection" | "whim"

/**
 * Per-friend knobs. All optional on disk so old galleries stay valid.
 * Values are 0–100 unless noted. List bias keys are list/folder ids.
 */
export type FriendPersonality = {
  cadence: FriendCadence
  tone: FriendTone
  pushiness: FriendPushiness
  /** 0 = almost never unsolicited; 100 = often. */
  suggestionRate: number
  /** How strongly Next Actions weigh into picks. */
  nextActionsWeight: number
  /** listId → 0–100. Missing lists use the global default. */
  listBias: Record<string, number>
  /** 0 = tiny / none; 100 = lavish. Friend mission points use this. */
  rewardScale: number
  /** Prefer overdue / high-urgency items more as this rises. */
  urgencyBias: number
  /** Daily habits not yet done today. */
  habitWeight: number
  /** Home → To Do's day slice. */
  todoWeight: number
  /** Chance a click is just “I love you” (flavor on). */
  loveYouRate: number
  /** Chance a click is a soft whim (draw, read, walk…). */
  whimRate: number
  /** Favorite whim id from `FRIEND_WHIMS`. */
  whimId: string
  /** Title fragments this friend extra-loves (reading, walk…). */
  titleLoves: string[]
  /** Bubble chrome when they speak. */
  dialogEffect: FriendDialogEffect
  /** Quiet hours (local minutes from midnight). Empty = no quiet window. */
  quietFromMinutes?: number
  quietToMinutes?: number
}

export const DEFAULT_FRIEND_PERSONALITY: FriendPersonality = {
  cadence: "occasional",
  tone: "playful",
  pushiness: "nudge",
  suggestionRate: 40,
  nextActionsWeight: 70,
  listBias: {},
  rewardScale: 40,
  urgencyBias: 50,
  habitWeight: 28,
  todoWeight: 36,
  loveYouRate: 0,
  whimRate: 0,
  whimId: "doodle",
  titleLoves: [],
  dialogEffect: "plain",
}

/** Species flavor. Every mix still has a little of the other two sources. */
export const SPECIES_PERSONALITY: Record<string, Partial<FriendPersonality>> = {
  lamb: { habitWeight: 90, todoWeight: 22, nextActionsWeight: 16, tone: "gentle", cadence: "occasional" },
  chick: { habitWeight: 86, todoWeight: 24, nextActionsWeight: 18, tone: "playful", cadence: "chatty" },
  duckling: { habitWeight: 84, todoWeight: 26, nextActionsWeight: 20, tone: "gentle", cadence: "occasional" },
  bunny: { habitWeight: 82, todoWeight: 28, nextActionsWeight: 18, tone: "playful", cadence: "eager" },
  hedgehog: { habitWeight: 88, todoWeight: 20, nextActionsWeight: 22, tone: "gentle", cadence: "quiet" },
  gosling: { habitWeight: 80, todoWeight: 30, nextActionsWeight: 22, tone: "gentle", cadence: "occasional" },
  piglet: { habitWeight: 78, todoWeight: 32, nextActionsWeight: 24, tone: "playful", cadence: "chatty" },
  puppy: { habitWeight: 24, todoWeight: 88, nextActionsWeight: 28, tone: "playful", cadence: "eager" },
  kitten: { habitWeight: 22, todoWeight: 84, nextActionsWeight: 30, tone: "playful", cadence: "chatty" },
  otter: { habitWeight: 26, todoWeight: 82, nextActionsWeight: 32, tone: "playful", cadence: "chatty" },
  capybara: { habitWeight: 30, todoWeight: 80, nextActionsWeight: 28, tone: "gentle", cadence: "occasional" },
  raccoon: { habitWeight: 20, todoWeight: 78, nextActionsWeight: 36, tone: "playful", cadence: "chatty" },
  mouse: { habitWeight: 28, todoWeight: 76, nextActionsWeight: 30, tone: "gentle", cadence: "quiet" },
  foal: { habitWeight: 32, todoWeight: 86, nextActionsWeight: 24, tone: "playful", cadence: "eager" },
  goat: { habitWeight: 34, todoWeight: 74, nextActionsWeight: 38, tone: "direct", cadence: "occasional" },
  crow: { habitWeight: 16, todoWeight: 28, nextActionsWeight: 90, tone: "direct", cadence: "occasional" },
  owl: { habitWeight: 18, todoWeight: 24, nextActionsWeight: 88, tone: "coach", cadence: "quiet" },
  fox: { habitWeight: 14, todoWeight: 32, nextActionsWeight: 86, tone: "playful", cadence: "chatty" },
  wolf: { habitWeight: 20, todoWeight: 30, nextActionsWeight: 84, tone: "coach", cadence: "occasional" },
  seal: { habitWeight: 24, todoWeight: 34, nextActionsWeight: 78, tone: "gentle", cadence: "occasional" },
  penguin: { habitWeight: 36, todoWeight: 28, nextActionsWeight: 76, tone: "direct", cadence: "occasional" },
  axolotl: { habitWeight: 22, todoWeight: 26, nextActionsWeight: 80, tone: "playful", cadence: "quiet" },
  cub: { habitWeight: 26, todoWeight: 38, nextActionsWeight: 74, tone: "playful", cadence: "eager" },
  fawn: { habitWeight: 40, todoWeight: 24, nextActionsWeight: 72, tone: "gentle", cadence: "quiet" },
  skunk: { habitWeight: 18, todoWeight: 36, nextActionsWeight: 82, tone: "direct", cadence: "occasional" },
}

/** Extra voice: affection, whims, loved titles, bubble effects. */
export const SPECIES_FLAVOR: Record<string, Partial<FriendPersonality>> = {
  lamb: { loveYouRate: 8, whimRate: 8, whimId: "stretch", dialogEffect: "whisper", titleLoves: ["stretch", "walk"] },
  chick: { loveYouRate: 14, whimRate: 16, whimId: "doodle", dialogEffect: "bounce", titleLoves: ["play"] },
  duckling: { loveYouRate: 10, whimRate: 10, whimId: "splash", dialogEffect: "whisper", titleLoves: ["bath", "swim"] },
  bunny: { loveYouRate: 16, whimRate: 14, whimId: "hop", dialogEffect: "heart", titleLoves: ["hop", "garden"] },
  hedgehog: { loveYouRate: 6, whimRate: 8, whimId: "curl", dialogEffect: "whisper", titleLoves: ["brush", "quiet"] },
  gosling: { loveYouRate: 8, whimRate: 10, whimId: "walk", dialogEffect: "stamp", titleLoves: ["walk"] },
  piglet: { loveYouRate: 18, whimRate: 12, whimId: "nibble", dialogEffect: "bounce", titleLoves: ["eat", "cook"] },
  puppy: { loveYouRate: 22, whimRate: 10, whimId: "walk", dialogEffect: "heart", titleLoves: ["walk", "play"] },
  kitten: { loveYouRate: 20, whimRate: 18, whimId: "doodle", dialogEffect: "sparkle", titleLoves: ["play", "yarn"] },
  otter: { loveYouRate: 16, whimRate: 20, whimId: "splash", dialogEffect: "bounce", titleLoves: ["play", "water"] },
  capybara: { loveYouRate: 14, whimRate: 8, whimId: "soak", dialogEffect: "whisper", titleLoves: ["rest", "soak"] },
  raccoon: { loveYouRate: 8, whimRate: 22, whimId: "shiny", dialogEffect: "sparkle", titleLoves: ["sort", "clean"] },
  mouse: { loveYouRate: 10, whimRate: 12, whimId: "nibble", dialogEffect: "whisper", titleLoves: ["read", "write"] },
  foal: { loveYouRate: 12, whimRate: 10, whimId: "hop", dialogEffect: "bounce", titleLoves: ["run", "ride"] },
  goat: { loveYouRate: 6, whimRate: 14, whimId: "stretch", dialogEffect: "stamp", titleLoves: ["climb"] },
  crow: { loveYouRate: 4, whimRate: 8, whimId: "shiny", dialogEffect: "stamp", titleLoves: ["file", "write"] },
  owl: { loveYouRate: 6, whimRate: 10, whimId: "read", dialogEffect: "whisper", titleLoves: ["read", "book", "study"] },
  fox: { loveYouRate: 10, whimRate: 16, whimId: "doodle", dialogEffect: "sparkle", titleLoves: ["plan"] },
  wolf: { loveYouRate: 8, whimRate: 6, whimId: "walk", dialogEffect: "stamp", titleLoves: ["pack", "team"] },
  seal: { loveYouRate: 16, whimRate: 10, whimId: "splash", dialogEffect: "heart", titleLoves: ["rest"] },
  penguin: { loveYouRate: 10, whimRate: 8, whimId: "walk", dialogEffect: "stamp", titleLoves: ["order"] },
  axolotl: { loveYouRate: 12, whimRate: 14, whimId: "soak", dialogEffect: "sparkle", titleLoves: ["rest"] },
  cub: { loveYouRate: 18, whimRate: 12, whimId: "hop", dialogEffect: "bounce", titleLoves: ["play"] },
  fawn: { loveYouRate: 10, whimRate: 8, whimId: "curl", dialogEffect: "whisper", titleLoves: ["walk", "quiet"] },
  skunk: { loveYouRate: 8, whimRate: 10, whimId: "shiny", dialogEffect: "stamp", titleLoves: ["clean"] },
}

export function clampPersonalityScore(value: unknown, fallback: number): number {
  const n = typeof value === "number" && Number.isFinite(value) ? value : fallback
  return Math.max(0, Math.min(100, Math.round(n)))
}

export function personalityRecordKey(animalId: string, displayName = ""): string {
  const fromName = displayName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
  const fromId = animalId.trim().toLowerCase()
  return fromId || fromName || "friend"
}

function catalogTokens(animalId: string, displayName: string): string[] {
  const catalog = new Set(BABY_ANIMALS.map((animal) => animal.id))
  const slug = personalityRecordKey(animalId, displayName)
  const tokens = [animalId.trim().toLowerCase(), slug, ...slug.split("-")]
  return [...new Set(tokens.filter((token) => catalog.has(token)))]
}

export function speciesPersonality(animalId: string, displayName = ""): FriendPersonality {
  for (const token of catalogTokens(animalId, displayName)) {
    const bias = SPECIES_PERSONALITY[token]
    const flavor = SPECIES_FLAVOR[token]
    if (bias || flavor) return sanitizeFriendPersonality({ ...bias, ...flavor }, DEFAULT_FRIEND_PERSONALITY)
  }
  return DEFAULT_FRIEND_PERSONALITY
}

/** Species preset, then a name/picture fit, then any stored overlay. */
export function personalityFor(
  map: Record<string, FriendPersonality> | undefined,
  animalId: string,
  displayName = "",
): FriendPersonality {
  const species = speciesPersonality(animalId, displayName)
  const fit = personalityFitFor(animalId, displayName)
  const base = fit ? sanitizeFriendPersonality(fit, species) : species
  if (!map) return base
  const keys = [animalId.trim().toLowerCase(), personalityRecordKey(animalId, displayName)].filter(Boolean)
  for (const key of keys) {
    if (map[key]) return sanitizeFriendPersonality(map[key], base)
  }
  return base
}

export function sourceWeight(personality: FriendPersonality, source: FriendWorldSource): number {
  if (source === "habit") return personality.habitWeight
  if (source === "todo") return personality.todoWeight
  return personality.nextActionsWeight
}

export function titleLoveBoost(title: string, loves: string[]): number {
  if (!loves.length) return 0
  const hay = title.toLowerCase()
  return loves.some((word) => word && hay.includes(word)) ? 80 : 0
}

export function sanitizeFriendPersonality(raw: unknown, fallback: FriendPersonality = DEFAULT_FRIEND_PERSONALITY): FriendPersonality {
  const rec = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
  const cadence = FRIEND_CADENCE.includes(rec.cadence as FriendCadence)
    ? (rec.cadence as FriendCadence)
    : fallback.cadence
  const tone = FRIEND_TONE.includes(rec.tone as FriendTone) ? (rec.tone as FriendTone) : fallback.tone
  const pushiness = FRIEND_PUSHINESS.includes(rec.pushiness as FriendPushiness)
    ? (rec.pushiness as FriendPushiness)
    : fallback.pushiness
  const listBias: Record<string, number> = { ...fallback.listBias }
  if (rec.listBias && typeof rec.listBias === "object" && !Array.isArray(rec.listBias)) {
    for (const [key, value] of Object.entries(rec.listBias as Record<string, unknown>)) {
      if (!key.trim()) continue
      listBias[key] = clampPersonalityScore(value, 50)
    }
  }
  const titleLoves = sanitizeTitleLoves(rec.titleLoves, fallback.titleLoves)
  const whimRaw = typeof rec.whimId === "string" ? rec.whimId.trim().toLowerCase() : fallback.whimId
  const whimId = FRIEND_WHIM_IDS.includes(whimRaw) ? whimRaw : fallback.whimId
  const dialogEffect = FRIEND_DIALOG_EFFECTS.includes(rec.dialogEffect as FriendDialogEffect)
    ? (rec.dialogEffect as FriendDialogEffect)
    : fallback.dialogEffect
  return {
    cadence,
    tone,
    pushiness,
    suggestionRate: clampPersonalityScore(rec.suggestionRate, fallback.suggestionRate),
    nextActionsWeight: clampPersonalityScore(rec.nextActionsWeight, fallback.nextActionsWeight),
    listBias,
    rewardScale: clampPersonalityScore(rec.rewardScale, fallback.rewardScale),
    urgencyBias: clampPersonalityScore(rec.urgencyBias, fallback.urgencyBias),
    habitWeight: clampPersonalityScore(rec.habitWeight, fallback.habitWeight),
    todoWeight: clampPersonalityScore(rec.todoWeight, fallback.todoWeight),
    loveYouRate: clampPersonalityScore(rec.loveYouRate, fallback.loveYouRate),
    whimRate: clampPersonalityScore(rec.whimRate, fallback.whimRate),
    whimId,
    titleLoves,
    dialogEffect,
    quietFromMinutes: typeof rec.quietFromMinutes === "number" ? rec.quietFromMinutes : fallback.quietFromMinutes,
    quietToMinutes: typeof rec.quietToMinutes === "number" ? rec.quietToMinutes : fallback.quietToMinutes,
  }
}

function sanitizeTitleLoves(raw: unknown, fallback: string[]): string[] {
  const src = Array.isArray(raw) ? raw : fallback
  const out: string[] = []
  for (const value of src) {
    if (typeof value !== "string") continue
    const word = value.trim().toLowerCase().replace(/[^a-z0-9 ]+/g, "").slice(0, 24)
    if (word.length < 2 || out.includes(word)) continue
    out.push(word)
    if (out.length >= 12) break
  }
  return out
}
