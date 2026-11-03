/**
 * lib/baby-game/mind.ts — What a villager thinks, wants and does all day, when the player is not looking
 *
 * Every character gets a `Mind`: a plain description, beliefs, motivations, likes, dislikes, goals with progress,
 * a daily schedule (blocks of hours, each a thing to do at a place), bonds with every other friend, and one-off plans
 * made in a talk or after reading a book. A new game writes each mind from the character (`mindFromCharacter`); the
 * player can read and edit every part of it (`components/BabyGame/village.tsx`), or rewrite it from the description
 * alone (`mindFromDescription`, with the model doing it better in `chatter.ts`).
 *
 * Minds live in `GameState.minds`, apart from `characters`, because `refreshCharacters` rebuilds hand-made characters
 * from code on every load. An edited mind must survive that.
 *
 * `sim.ts` walks friends to their scheduled place (`placeFor`), `chatter.ts` lets two of them talk when they meet,
 * and `shelf.ts` lets them read from their bookshelf. All three change the mind a little.
 */

import { RESIDENTS, temper, type Resident } from "./cast"
import type { Character } from "./character"
import { PATHS } from "./dharma"
import type { Tag } from "./items"
import { ZONES, type ZoneId } from "./world"

/** Where a block of the day happens. `read` is at home, at the bookshelf. */
export type Place = "spot" | "home" | "read" | "fire" | `zone:${ZoneId}` | `friend:${string}`

/** Hours `[from, to)`; `from > to` wraps past midnight. */
export type Block = { from: number; to: number; doing: string; place: Place }

export type MindGoal = { id: string; text: string; progress: number }

/** A one-off change to today's schedule, decided in a talk or after a book. */
export type Plan = { day: number; from: number; to: number; doing: string; place: Place; why: string }

export type Mind = {
  /** A few plain sentences; the seed everything else can be rewritten from. */
  description: string
  beliefs: string[]
  motivations: string[]
  likes: string[]
  dislikes: string[]
  goals: MindGoal[]
  schedule: Block[]
  /** −10..10 toward each other friend. */
  bonds: Record<string, number>
  plans: Plan[]
  /** Who wrote it last. */
  by: "scripted" | "model" | "you"
}

export const BOND_MIN = -10
export const BOND_MAX = 10
export const BELIEFS_MAX = 8
export const GOALS_MAX = 6
export const LIST_MAX = 10

const TAG_WORDS: Record<Tag, string> = {
  sweet: "sweet things", crunchy: "crunchy snacks", watery: "water and rain", green: "green growing things", shiny: "shiny things",
  cozy: "cozy corners", musical: "music", bookish: "books and stories", fishy: "fish", soft: "soft things", earthy: "digging in the earth",
}

const TONE_MOTIVE = {
  gentle: "keep everyone around them calm and safe",
  playful: "make somebody laugh every single day",
  direct: "get things done properly, no fuss",
  coach: "help the others be their best",
} as const

/** The first act each zone opens in; a plan never sends a friend somewhere still behind a gate. */
export const ZONE_ACT: Partial<Record<ZoneId, number>> = (() => {
  const out: Partial<Record<ZoneId, number>> = { meadow: 1, farm: 1, marsh: 1 }
  for (const r of RESIDENTS) out[r.zone] = Math.min(out[r.zone] ?? 9, r.act)
  return out
})()

export const PLACE_ZONES = (Object.keys(ZONE_ACT) as ZoneId[]).filter((z) => ZONES[z])

const clampBond = (n: number) => Math.max(BOND_MIN, Math.min(BOND_MAX, Math.round(n)))

/** Hours they are awake, in order from waking. */
export function wakingHours(sleeps: [number, number]): number[] {
  const [bed, wake] = sleeps
  const out: number[] = []
  for (let h = wake; h !== bed; h = (h + 1) % 24) out.push(h)
  return out
}

export const inBlock = (b: { from: number; to: number }, hour: number) => (b.from <= b.to ? hour >= b.from && hour < b.to : hour >= b.from || hour < b.to)

/** The bond two friends start with: shared likes pull together, a liked thing the other hates pushes apart. */
export function startingBond(a: Resident, b: Resident): number {
  let n = 0
  for (const t of a.likes) if (b.likes.includes(t)) n += 2
  if (b.likes.includes(a.hates)) n -= 2
  if (a.likes.includes(b.hates)) n -= 1
  if (a.zone === b.zone) n += 1
  if (temper(a.id).tone === temper(b.id).tone) n += 1
  return clampBond(n)
}

function firstSentence(text: string): string {
  const m = text.match(/^[^.!?]+[.!?]/)
  return (m ? m[0] : text).trim()
}

/** The friend in the same act they like most: the one they visit in the afternoon. */
function closest(r: Resident, bonds: Record<string, number>): Resident | undefined {
  return RESIDENTS.filter((o) => o.id !== r.id && o.act === r.act).sort((x, y) => (bonds[y.id] ?? 0) - (bonds[x.id] ?? 0))[0]
}

/**
 * A day from their sleep hours: wake slowly at home, their spot until early afternoon, an hour out (the meadow or the
 * friend they like best), an hour reading at home, their spot again, and the evening at the fire if they are social.
 * Noon is always at their spot, so the player can find them.
 */
export function defaultSchedule(r: Resident, bonds: Record<string, number>): Block[] {
  const hours = wakingHours(r.sleeps ?? [22, 6])
  // the last waking hour is bedtime (`sim.bedtime`): they walk home on their own
  const day = hours.slice(0, -1)
  const at = (i: number) => day[Math.max(0, Math.min(day.length - 1, i))]!
  const end = (i: number) => (at(i) + 1) % 24
  const pal = closest(r, bonds)
  const n = day.length
  const outing = Math.max(2, Math.floor(n * 0.5))
  const reading = Math.min(n - 1, outing + 2)
  const evening = r.social ? Math.max(reading + 1, n - 3) : n
  const blocks: Block[] = [
    { from: at(0), to: end(0), doing: "waking up slowly", place: "home" },
    { from: end(0), to: at(outing), doing: `${r.title.toLowerCase()} things`, place: "spot" },
    pal && (bonds[pal.id] ?? 0) > 1
      ? { from: at(outing), to: end(outing), doing: `visiting ${pal.name}`, place: `friend:${pal.id}` }
      : { from: at(outing), to: end(outing), doing: r.social ? "wandering the meadow" : "a long quiet walk", place: r.social ? "zone:meadow" : `zone:${r.zone}` },
    { from: end(outing), to: at(reading), doing: `${r.title.toLowerCase()} things`, place: "spot" },
    { from: at(reading), to: end(reading), doing: "reading from the bookshelf", place: "read" },
  ]
  if (evening < n) {
    blocks.push({ from: end(reading), to: at(evening), doing: "back at it", place: "spot" })
    blocks.push({ from: at(evening), to: end(n - 1), doing: "sitting by the fire", place: "fire" })
  } else blocks.push({ from: end(reading), to: end(n - 1), doing: "winding down alone", place: "spot" })
  return blocks.filter((b) => b.from !== b.to)
}

/** The mind a hand-made character starts with. */
export function mindFromCharacter(c: Character): Mind {
  const r = RESIDENTS.find((x) => x.id === c.id)
  const path = PATHS[c.id]
  const t = temper(c.id)
  const bonds = r ? Object.fromEntries(RESIDENTS.filter((o) => o.id !== r.id).map((o) => [o.id, startingBond(r, o)])) : {}
  return {
    description: `${c.name} is a ${c.looks.marks}. ${c.personality.bio} Known as ${c.role.title.toLowerCase()}.`,
    beliefs: path ? [path.belief] : ["Tomorrow is usually kinder than today."],
    motivations: [TONE_MOTIVE[t.tone], ...(c.goals[0] ? [firstSentence(c.goals[0].text).replace(/[.!?]$/, "").toLowerCase()] : [])],
    likes: [...new Set([...c.likes.tags, c.likes.loves].map((tag) => TAG_WORDS[tag]))],
    dislikes: [TAG_WORDS[c.likes.hates], ...(c.personality.shy ? ["being rushed at"] : []), ...(c.personality.rainLover ? [] : ["getting rained on"])],
    goals: [
      ...(c.goals[0] ? [{ id: "quest", text: firstSentence(c.goals[0].text), progress: 0 }] : []),
      ...(r && closest(r, bonds) ? [{ id: "friend", text: `Get to know ${closest(r, bonds)!.name} better`, progress: 0 }] : []),
      { id: "learn", text: "Learn something new from a book", progress: 0 },
    ],
    schedule: r ? defaultSchedule(r, bonds) : [{ from: 8, to: 20, doing: "about", place: "spot" }],
    bonds,
    plans: [],
    by: "scripted",
  }
}

/** Every character's mind for a new game. */
export function createMinds(cast: Record<string, Character>): Record<string, Mind> {
  return Object.fromEntries(Object.values(cast).map((c) => [c.id, mindFromCharacter(c)]))
}

const isList = (x: unknown): x is string[] => Array.isArray(x) && x.every((v) => typeof v === "string")

/** Is this saved mind whole enough to keep? */
export function validMind(m: unknown): m is Mind {
  const x = m as Mind
  return !!x && typeof x.description === "string" && isList(x.beliefs) && isList(x.motivations) && isList(x.likes) && isList(x.dislikes)
    && Array.isArray(x.goals) && Array.isArray(x.schedule) && typeof x.bonds === "object" && x.bonds !== null
}

/** A loaded save's minds: each saved one kept (edits stay), missing or broken ones written fresh. */
export function refreshMinds(saved: Record<string, Mind> | undefined, cast: Record<string, Character>): Record<string, Mind> {
  const out: Record<string, Mind> = {}
  for (const c of Object.values(cast)) {
    const m = saved?.[c.id]
    out[c.id] = validMind(m) ? { ...m, plans: Array.isArray(m.plans) ? m.plans : [], by: m.by ?? "you" } : mindFromCharacter(c)
  }
  return out
}

/** What they mean to be doing at this hour: today's plan first, then the schedule. */
export function blockAt(m: Mind | undefined, day: number, hour: number): (Block & { plan?: Plan }) | null {
  if (!m) return null
  const plan = m.plans.find((p) => p.day === day && inBlock(p, hour))
  if (plan) return { ...plan, plan }
  return m.schedule.find((b) => inBlock(b, hour)) ?? null
}

export function placeLabel(p: Place): string {
  if (p === "spot") return "their usual spot"
  if (p === "home") return "home"
  if (p === "read") return "home, at the bookshelf"
  if (p === "fire") return "the campfire"
  if (p.startsWith("zone:")) return ZONES[p.slice(5) as ZoneId]?.name ?? p.slice(5)
  const r = RESIDENTS.find((x) => x.id === p.slice(7))
  return r ? `${r.name}'s spot` : "a friend's spot"
}

/** The places a schedule can name, for an editor's dropdown. */
export function placeOptions(selfId: string): Array<{ value: Place; label: string }> {
  return [
    ...(["spot", "home", "read", "fire"] as const).map((p) => ({ value: p as Place, label: placeLabel(p) })),
    ...PLACE_ZONES.map((z) => ({ value: `zone:${z}` as Place, label: ZONES[z].name })),
    ...RESIDENTS.filter((r) => r.id !== selfId).map((r) => ({ value: `friend:${r.id}` as Place, label: `Visit ${r.name}` })),
  ]
}

export function isPlace(x: unknown): x is Place {
  if (typeof x !== "string") return false
  if (["spot", "home", "read", "fire"].includes(x)) return true
  if (x.startsWith("zone:")) return x.slice(5) in ZONES
  if (x.startsWith("friend:")) return RESIDENTS.some((r) => r.id === x.slice(7))
  return false
}

/** Clean an edited or generated mind: trimmed lists, capped lengths, hours in range, bonds clamped. */
export function tidyMind(m: Mind): Mind {
  const list = (xs: string[], max = LIST_MAX) => [...new Set(xs.map((x) => x.trim()).filter(Boolean))].slice(0, max)
  const hour = (h: number) => ((Math.round(Number(h) || 0) % 24) + 24) % 24
  return {
    ...m,
    description: m.description.trim().slice(0, 1200),
    beliefs: list(m.beliefs, BELIEFS_MAX),
    motivations: list(m.motivations),
    likes: list(m.likes),
    dislikes: list(m.dislikes),
    goals: m.goals.filter((g) => g.text.trim()).slice(0, GOALS_MAX).map((g, i) => ({ id: g.id || `g${i}`, text: g.text.trim().slice(0, 160), progress: Math.max(0, Math.min(100, Math.round(g.progress) || 0)) })),
    schedule: m.schedule.filter((b) => isPlace(b.place)).map((b) => ({ from: hour(b.from), to: hour(b.to), doing: (b.doing || "").trim().slice(0, 60) || "about", place: b.place })).filter((b) => b.from !== b.to),
    bonds: Object.fromEntries(Object.entries(m.bonds).map(([k, v]) => [k, clampBond(v)])),
    plans: m.plans.filter((p) => isPlace(p.place)).slice(-6),
  }
}

const WORDS: Array<[RegExp, keyof typeof TAG_WORDS]> = [
  [/sweet|jam|honey|cake|sugar/i, "sweet"], [/crunch|nut|acorn/i, "crunchy"], [/water|rain|puddle|swim|pond|lake/i, "watery"],
  [/plant|garden|leaf|green|grow/i, "green"], [/shiny|sparkl|glitter|gem|treasure/i, "shiny"], [/cozy|warm|blanket|nap/i, "cozy"],
  [/music|song|sing|tune/i, "musical"], [/book|read|story|stories|library|poem/i, "bookish"], [/fish/i, "fishy"],
  [/soft|fluff|pillow/i, "soft"], [/dig|dirt|mud|earth|fossil/i, "earthy"],
]

/**
 * Rewrite a mind from its description alone, without a model: likes from the words it uses, beliefs and motivations
 * from sentences that sound like them, a schedule that leans social or solitary. Bonds and plans are kept.
 */
export function mindFromDescription(c: Character, prev: Mind, description: string): Mind {
  const r = RESIDENTS.find((x) => x.id === c.id)
  const sentences = description.split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter(Boolean)
  const likes = new Set<string>()
  const dislikes = new Set<string>()
  for (const s of sentences) {
    const neg = /hate|dislike|afraid|can't stand|scared|avoid|never/i.test(s)
    for (const [re, tag] of WORDS) if (re.test(s)) (neg ? dislikes : likes).add(TAG_WORDS[tag])
  }
  const beliefs = sentences.filter((s) => /believe|think|know|always|everything|nothing|life|world|should/i.test(s))
  const motivations = sentences.filter((s) => /want|wish|hope|dream|trying|need|goal|wants/i.test(s)).map((s) => s.replace(/[.!?]$/, ""))
  const social = /friend|together|party|talk|chat|social|crowd|everyone/i.test(description) ? true : /alone|quiet|shy|solitary|hermit/i.test(description) ? false : !!r?.social
  const schedule = r ? defaultSchedule({ ...r, social }, prev.bonds) : prev.schedule
  return tidyMind({
    ...prev,
    description,
    beliefs: beliefs.length ? beliefs : prev.beliefs,
    motivations: motivations.length ? motivations : prev.motivations,
    likes: likes.size ? [...likes] : prev.likes,
    dislikes: dislikes.size ? [...dislikes] : prev.dislikes,
    goals: motivations.length ? motivations.slice(0, 3).map((t, i) => ({ id: `d${i}`, text: t, progress: 0 })).concat(prev.goals.filter((g) => g.id === "quest")) : prev.goals,
    schedule,
    by: "scripted",
  })
}

/** Nudge a bond both ways, in place, on minds already cloned. */
export function bump(minds: Record<string, Mind>, a: string, b: string, by: number) {
  if (minds[a]) minds[a] = { ...minds[a]!, bonds: { ...minds[a]!.bonds, [b]: clampBond((minds[a]!.bonds[b] ?? 0) + by) } }
  if (minds[b]) minds[b] = { ...minds[b]!, bonds: { ...minds[b]!.bonds, [a]: clampBond((minds[b]!.bonds[a] ?? 0) + by) } }
}

/** Move a goal forward, in place. Returns true if this finished it. */
export function advanceGoal(minds: Record<string, Mind>, id: string, goalId: string, by: number): boolean {
  const m = minds[id]
  const g = m?.goals.find((x) => x.id === goalId)
  if (!m || !g || g.progress >= 100) return false
  const next = Math.min(100, g.progress + by)
  minds[id] = { ...m, goals: m.goals.map((x) => (x.id === goalId ? { ...x, progress: next } : x)) }
  return next >= 100
}

/** Add a one-off plan for today, in place, replacing any plan that overlaps it. */
export function addPlan(minds: Record<string, Mind>, id: string, plan: Plan) {
  const m = minds[id]
  if (!m) return
  minds[id] = { ...m, plans: [...m.plans.filter((p) => p.day >= plan.day && !(p.day === plan.day && (inBlock(p, plan.from) || inBlock(plan, p.from)))), plan].slice(-6) }
}
