/**
 * lib/geniuses/pool.ts — Which genius is speaking, and what it asks for (pure)
 *
 * A genius speaks in the header when the worn friend card is its face (`geniusForFace`). It picks only from its own
 * area: the friend's usual pool (open habits, today's To Do, Next Actions) cut to its bindings, then, if that is empty,
 * any open step in the area. A task declined in the last seven days weighs less. An empty area is a real answer: it
 * says what it would like to see, and offers nothing made up. The model never chooses the task.
 */

import { personalityFor, type FriendPersonality } from "@/lib/baby-animal-personality"
import { friendSuggestionLine } from "@/lib/friend-copy"
import type { FriendMission } from "@/lib/friend-mission"
import { friendRewardPoints } from "@/lib/friend-reward"
import { collectFriendCandidates, scoreFriendCandidate, type FriendCandidate, type FriendSuggestion, type FriendSuggestionContext } from "@/lib/friend-suggestion"
import type { Folder, Task } from "@/lib/types"
import { areaItemIds, readArea, type AreaVault } from "./read"
import type { Genius } from "./types"

const WEEK = 7 * 86_400_000
/** A task you declined this week is this much less likely. */
export const DECLINED_WEIGHT = 0.25

/** The active genius whose face is this card, if any. */
export function geniusForFace(geniuses: Genius[], animalId: string): Genius | null {
  if (!animalId) return null
  return geniuses.find((g) => g.status === "active" && g.animalId === animalId) ?? null
}

/** True when a friend candidate is inside the genius's area. Habit candidates are `habit:<id>`. */
export function inArea(g: Genius, candidate: Pick<FriendCandidate, "id">, itemIds: ReadonlySet<string>): boolean {
  if (candidate.id.startsWith("habit:")) return g.bindings.habitIds.includes(candidate.id.slice("habit:".length))
  return itemIds.has(candidate.id)
}

export function declinedThisWeek(log: FriendMission[], taskId: string, now: Date): boolean {
  return log.some((m) => m.taskId === taskId && m.status === "declined" && m.declineReason !== "Asked for another" && now.getTime() - Date.parse(m.offeredAt) < WEEK)
}

/** In-area candidates: the friend's pool first; open area steps only when that is empty. */
export function geniusCandidates(g: Genius, tasks: Task[], folders: Folder[], vault: AreaVault, ctx: FriendSuggestionContext = {}): FriendCandidate[] {
  const ids = areaItemIds(g, tasks)
  const pool = collectFriendCandidates(tasks, folders, ctx).filter((c) => inArea(g, c, ids))
  if (pool.length) return pool
  return readArea(g, { ...vault, tasks }).open.map((o) => {
    const t = tasks.find((x) => x.id === o.id)
    return { id: o.id, source: "nextAction" as const, title: o.title, urgency: o.urgency, importance: o.importance, overdueDays: 0, listIds: t?.lists ?? [] }
  })
}

export type GeniusPickInput = {
  genius: Genius
  tasks: Task[]
  folders: Folder[]
  vault: AreaVault
  log: FriendMission[]
  personalities?: Record<string, FriendPersonality>
  /** The face card's name, for the personality fit. */
  faceName?: string
  lastId?: string | null
  rng?: () => number
  ctx?: FriendSuggestionContext
}

/** One assignment from the genius's area, shaped like the friend's suggestion so the bubble and sheet take it as is. */
export function geniusPick(input: GeniusPickInput): FriendSuggestion {
  const { genius: g, rng = Math.random } = input
  const now = input.ctx?.now ?? input.vault.now ?? new Date()
  const personality = input.ctx?.personality ?? personalityFor(input.personalities, g.animalId, input.faceName ?? "")
  const ctx = { ...input.ctx, personality, now, habits: input.vault.habits, weeklyData: input.vault.weeklyData, habitExemptions: input.vault.habitExemptions }
  const all = geniusCandidates(g, input.tasks, input.folders, input.vault, ctx)
  const area = g.area.trim() || "this area"
  if (!all.length) {
    const line = readArea(g, { ...input.vault, tasks: input.tasks }).unbound
      ? `I am not tied to any list, goal or habit yet. Bind me to ${area.toLowerCase()} in my Genius page.`
      : `There is no open step in ${area.toLowerCase()}. Want to add one?`
    return { taskId: null, line, source: null, kind: "empty", title: "No step in my area", blurb: g.charter, effect: personality.dialogEffect, rewardPoints: 0 }
  }
  const pool = input.lastId && all.length > 1 ? all.filter((c) => c.id !== input.lastId) : all
  const focus = { ids: ctx.focusTaskIds, multiplier: ctx.focusMultiplier }
  const weight = (c: FriendCandidate) => Math.max(1, scoreFriendCandidate(c, personality, focus)) * (declinedThisWeek(input.log, c.id, now) ? DECLINED_WEIGHT : 1)
  const ranked = [...pool].sort((a, b) => weight(b) - weight(a) || a.id.localeCompare(b.id))
  const total = ranked.reduce((sum, c) => sum + weight(c), 0)
  let dart = rng() * total
  let picked = ranked[0]!
  for (const c of ranked) {
    dart -= weight(c)
    if (dart <= 0) {
      picked = c
      break
    }
  }
  return {
    taskId: picked.id,
    line: friendSuggestionLine(personality.tone, picked.source, picked.title, rng),
    source: picked.source,
    kind: "mission",
    title: picked.title,
    blurb: `${picked.title} is in ${area.toLowerCase()}. ${g.charter}`.trim(),
    effect: personality.dialogEffect,
    rewardPoints: friendRewardPoints(personality.rewardScale),
  }
}
