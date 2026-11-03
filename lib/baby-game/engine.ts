/**
 * lib/baby-game/engine.ts — The rules of Mossmere Hollow (pure, no clock, no storage)
 *
 * One serializable `GameState`. Every action takes a state and returns `{ s, msgs, line, ok }`; nothing here
 * touches the canvas, `Math.random`, or the real clock (a `rand` is passed in). The realtime part (walking,
 * where friends stand) lives in `sim.ts`. The loop of the game:
 *
 *   meet a friend → talk, gift, approach, favor to earn hearts → at two hearts they say what they want →
 *   turn the wanted items in → at their heart gate, and only when their secret condition holds, ask for
 *   the keepsake → the next friend wants that keepsake → the last friend of each act holds a Lamp part →
 *   place it in the Hollow Lamp, which opens the next gate.
 */

import { approachDistance, CONDITION_TEXT, isShy, RESIDENTS, resident, temper, type Condition, type Resident } from "./cast"
import { approachLine, favorLine, giftLine, moodLabel, smallTalk, SPOOK_LINE, type Taste } from "./lines"
import { item, ITEMS, LAMP_PARTS, RECIPES } from "./items"
import { unlockedAct, type NodeKind } from "./world"
import type { FriendTone } from "@/lib/baby-animal-personality"

export const DAY_START = 6 * 60
/** 2am: the day ends where you stand. */
export const DAY_LIMIT = 26 * 60
export const BASE_ENERGY = 100

export type Weather = "clear" | "rain"

export type AnimalState = {
  trust: number
  mood: number
  stage: "new" | "turned" | "gave"
  talked: boolean
  gifted: boolean
  approached: boolean
  favored: boolean
  chats: number
  spooked: boolean
  fed: boolean
  played: boolean
  heard: number
  cluedAt: number
}

export type Errand = { id: string; who: string; item: string; qty: number; reward: number; done: boolean }

export type GameState = {
  v: 1
  day: number
  minutes: number
  weather: Weather
  energy: number
  maxEnergy: number
  buttons: number
  inv: Record<string, number>
  animals: Record<string, AnimalState>
  nodes: Record<string, number>
  parts: string[]
  errands: Errand[]
  today: string[]
  diary: Array<{ day: number; text: string; by: "model" | "scripted" }>
  ended: boolean
  seen: Record<string, boolean>
  stats: { gathered: number; gifts: number; favors: number; keepsakes: number }
}

export type Msg = { text: string; tone: "good" | "bad" | "info" }
export type Result = { s: GameState; msgs: Msg[]; line?: string; ok: boolean }

const blankAnimal = (): AnimalState => ({
  trust: 0, mood: 0, stage: "new", talked: false, gifted: false, approached: false, favored: false, chats: 0,
  spooked: false, fed: false, played: false, heard: 0, cluedAt: 0,
})

function hash(n: number): number {
  let t = (n * 2654435761) >>> 0
  t = (t ^ (t >>> 15)) * 2246822519
  return ((t ^ (t >>> 13)) >>> 0) % 100
}

export function weatherFor(day: number): Weather {
  if (day <= 2) return "clear"
  return day % 4 === 3 || hash(day) < 18 ? "rain" : "clear"
}

export function makeErrands(day: number, act: number): Errand[] {
  const pool = RESIDENTS.filter((r) => r.act <= act)
  const things = ["berry", "acorn", "reed", "clover", "pebble", "feather", "mushroom", "shell"]
  return [0, 1].map((n) => {
    const who = pool[hash(day * 7 + n * 13) % pool.length]!
    const thing = things[hash(day * 11 + n * 5) % things.length]!
    return { id: `e${day}-${n}`, who: who.id, item: thing, qty: 1 + (hash(day + n) % 2), reward: 3 + (hash(day * 3 + n) % 3), done: false }
  })
}

export function newGame(): GameState {
  return {
    v: 1, day: 1, minutes: DAY_START + 30, weather: "clear", energy: BASE_ENERGY, maxEnergy: BASE_ENERGY, buttons: 12,
    inv: { berry: 2, clover: 2 }, animals: {}, nodes: {}, parts: [], errands: makeErrands(1, 1), today: [], diary: [],
    ended: false, seen: {}, stats: { gathered: 0, gifts: 0, favors: 0, keepsakes: 0 },
  }
}

const clone = (s: GameState): GameState => structuredClone(s)
const done = (s: GameState, msgs: Msg[], ok = true, line?: string): Result => ({ s, msgs, ok, line })
const no = (s: GameState, text: string): Result => done(s, [{ text, tone: "bad" }], false)

export const hour = (s: GameState) => Math.floor(s.minutes / 60) % 24
export const act = (s: GameState) => unlockedAct(s.parts.length)

export function animal(s: GameState, id: string): AnimalState {
  return s.animals[id] ?? blankAnimal()
}

export const hearts = (s: GameState, id: string) => Math.floor(animal(s, id).trust / 10)

function touch(s: GameState, id: string): AnimalState {
  s.animals[id] = s.animals[id] ?? blankAnimal()
  return s.animals[id]!
}

/** Mood makes the same kindness count for more or less. */
function gain(base: number, mood: number): number {
  if (base <= 0) return base
  if (mood >= 1) return Math.ceil(base * 1.5)
  if (mood < 0) return Math.max(1, Math.floor(base / 2))
  return base
}

function addTrust(a: AnimalState, delta: number) {
  a.trust = Math.max(0, Math.min(100, a.trust + delta))
}

const setMood = (a: AnimalState, delta: number) => {
  a.mood = Math.max(-2, Math.min(2, a.mood + delta))
}

function bag(s: GameState, id: string, qty: number) {
  s.inv[id] = (s.inv[id] ?? 0) + qty
  if (s.inv[id]! <= 0) delete s.inv[id]
}

export const have = (s: GameState, id: string) => s.inv[id] ?? 0

/** Is a friend awake and out right now? Used by the UI; the sim moves them. */
export function isAsleep(r: Resident, minutes: number): boolean {
  const [from, to] = r.sleeps ?? [22, 6]
  const h = Math.floor(minutes / 60) % 24
  return from > to ? h >= from || h < to : h >= from && h < to
}

export function tasteOf(r: Resident, itemId: string): Taste {
  const tags = item(itemId).tags
  const loved = temper(r.id).love
  if (tags.includes(loved)) return "love"
  if (tags.some((t) => r.likes.includes(t))) return "like"
  if (tags.includes(r.hates)) return "hate"
  return "meh"
}

export function noteToday(s: GameState, text: string) {
  s.today = [...s.today.slice(-11), text]
}

export function spend(s: GameState, energy: number): boolean {
  if (s.energy < energy) return false
  s.energy -= energy
  return true
}

/** Time passes. Returns the state, and `collapsed` when the day ran out. */
export function advance(s: GameState, minutes: number): GameState {
  const n = clone(s)
  n.minutes = Math.min(DAY_LIMIT, n.minutes + minutes)
  return n
}

export const collapsed = (s: GameState) => s.minutes >= DAY_LIMIT

// ─── friends ──────────────────────────────────────────────────────────────

export function talk(s: GameState, id: string, pick: number): Result {
  const r = resident(id)
  if (!r) return no(s, "Nobody there.")
  const n = clone(s)
  const a = touch(n, id)
  const t = temper(id)
  const before = Math.floor(a.trust / 10)
  if (!a.talked) {
    a.talked = true
    const eager = t.cadence === "eager" || t.cadence === "chatty"
    addTrust(a, gain(eager ? 4 : 3, a.mood))
    noteToday(n, `Talked with ${r.name}.`)
  }
  const h = Math.floor(a.trust / 10)
  const msgs: Msg[] = []
  if (h > before) msgs.push({ text: `${r.name}: ${h} heart${h === 1 ? "" : "s"}`, tone: "good" })
  // First time speaking: the hello. At two hearts: the want. At four: the clue. At three, six, nine: a story.
  if (!n.seen[`${id}:hello`]) {
    n.seen[`${id}:hello`] = true
    return done(n, msgs, true, r.hello)
  }
  const storyAt = [3, 6, 9]
  if (a.heard < 3 && h >= storyAt[a.heard]!) {
    const line = r.story[a.heard]!
    a.heard += 1
    return done(n, [...msgs, { text: `A story from ${r.name}.`, tone: "info" }], true, line)
  }
  if (h >= 4 && a.cluedAt === 0) {
    a.cluedAt = n.day
    return done(n, [...msgs, { text: `${r.name} gave you a clue.`, tone: "info" }], true, r.clue)
  }
  if (h >= 2 && a.stage === "new") return done(n, msgs, true, r.quest)
  if (a.stage === "turned" && h < r.gate) return done(n, msgs, true, `I'm grateful. Truly. Come back as we get closer. (${r.gate} hearts)`)
  if (a.stage === "turned") return done(n, msgs, true, "I think I'm ready. Ask me.")
  if (a.stage === "gave") return done(n, msgs, true, smallTalk(t.tone, a.mood, n.weather, hour(n), pick + 1))
  return done(n, msgs, true, smallTalk(t.tone, a.mood, n.weather, hour(n), pick))
}

export function gift(s: GameState, id: string, itemId: string): Result {
  const r = resident(id)
  const def = ITEMS[itemId]
  if (!r || !def) return no(s, "Nothing to give.")
  if (def.kind === "keepsake" || def.kind === "part") return no(s, "That one is too special to give away.")
  if (have(s, itemId) < 1) return no(s, "You don't have that.")
  const a0 = animal(s, id)
  if (a0.gifted) return no(s, `${r.name} already got a gift today.`)
  const n = clone(s)
  const a = touch(n, id)
  const taste = tasteOf(r, itemId)
  const delta = { love: 8, like: 4, meh: 1, hate: -3 }[taste]
  addTrust(a, delta > 0 ? gain(delta, a.mood) : delta)
  setMood(a, taste === "love" ? 1 : taste === "hate" ? -1 : 0)
  a.gifted = true
  a.fed = taste === "love" || taste === "like"
  bag(n, itemId, -1)
  n.stats.gifts += 1
  noteToday(n, `Gave ${r.name} ${def.name} (${taste}).`)
  return done(n, [{ text: `${r.name} ${taste === "love" ? "loved" : taste === "like" ? "liked" : taste === "hate" ? "disliked" : "accepted"} ${def.name}.`, tone: taste === "hate" ? "bad" : "good" }], true, giftLine(taste, temper(id).tone))
}

export function approach(s: GameState, id: string, tone: FriendTone): Result {
  const r = resident(id)
  if (!r) return no(s, "Nobody there.")
  if (animal(s, id).approached) return no(s, `${r.name} has had enough approaches for today.`)
  const n = clone(s)
  const a = touch(n, id)
  const d = approachDistance(temper(id).tone, tone)
  addTrust(a, d === 0 ? gain(5, a.mood) : d === 1 ? 2 : -2)
  setMood(a, d === 0 ? 1 : d === 2 ? -1 : 0)
  a.approached = true
  noteToday(n, `Tried a ${tone} approach with ${r.name} (${d === 0 ? "it landed" : d === 1 ? "so-so" : "it didn't"}).`)
  return done(n, [{ text: d === 0 ? `${r.name} lit up.` : d === 1 ? `${r.name} shrugged, kindly.` : `${r.name} winced.`, tone: d === 2 ? "bad" : "good" }], true, approachLine(d, temper(id).tone))
}

/** `grade` 0 missed, 1 good, 2 perfect. */
export function favor(s: GameState, id: string, grade: 0 | 1 | 2): Result {
  const r = resident(id)
  if (!r) return no(s, "Nobody there.")
  if (animal(s, id).favored) return no(s, `${r.name} is all favored out today.`)
  if (s.energy < 8) return no(s, "You're too tired for that.")
  const n = clone(s)
  const a = touch(n, id)
  n.energy -= 8
  addTrust(a, gain([0, 3, 6][grade]!, a.mood))
  if (grade > 0) a.played = true
  a.favored = true
  if (grade === 2) setMood(a, 1)
  n.stats.favors += 1
  noteToday(n, `Did a favor with ${r.name}: ${temper(id).whim.toLowerCase()} (${["missed", "good", "perfect"][grade]}).`)
  return done(n, [{ text: grade ? `${r.name} had a great time.` : "That one slipped.", tone: grade ? "good" : "info" }], true, favorLine(grade))
}

/** Running within a few tiles of a shy friend. */
export function spook(s: GameState, id: string): Result {
  const r = resident(id)
  if (!r || !isShy(id) || animal(s, id).spooked) return done(s, [], false)
  const n = clone(s)
  const a = touch(n, id)
  a.spooked = true
  setMood(a, -1)
  addTrust(a, -1)
  noteToday(n, `Startled ${r.name} by running.`)
  return done(n, [{ text: `${r.name} jumped! Walk, don't run.`, tone: "bad" }], true, SPOOK_LINE)
}

export type ChatReply = { say: string; trust: number; reveal: "none" | "wants" | "likes" | "clue"; by: "model" | "scripted" }

/** A friend's tastes as one plain sentence. Always written by the game, never by a model. */
export function tasteFact(r: Resident): string {
  const love = temper(r.id).love
  const also = r.likes.filter((t) => t !== love)
  return `They love ${love} things${also.length ? `, like ${also.join(" and ")} ones too` : ""}, and can't stand ${r.hates} ones.`
}

export const CHAT_TRUST_PER_DAY = 3

/**
 * Apply a typed chat line. A model (or the script) only chooses the words, a small trust nudge, and *which* true
 * fact to share; the facts themselves come from the cast, and the nudge is clamped and capped per day.
 */
export function chat(s: GameState, id: string, reply: ChatReply): Result {
  const r = resident(id)
  if (!r) return no(s, "Nobody there.")
  const n = clone(s)
  const a = touch(n, id)
  const msgs: Msg[] = []
  a.chats += 1
  const delta = a.chats <= CHAT_TRUST_PER_DAY ? Math.max(-1, Math.min(2, Math.round(reply.trust))) : 0
  const before = Math.floor(a.trust / 10)
  addTrust(a, delta > 0 ? gain(delta, a.mood) : delta)
  const h = Math.floor(a.trust / 10)
  if (h > before) msgs.push({ text: `${r.name}: ${h} heart${h === 1 ? "" : "s"}`, tone: "good" })
  if (reply.reveal === "wants" && h >= 2 && a.stage === "new") msgs.push({ text: `${r.name} wants: ${r.wants.map((w) => item(w).name).join(" + ")}.`, tone: "info" })
  if (reply.reveal === "likes") msgs.push({ text: tasteFact(r), tone: "info" })
  if (reply.reveal === "clue" && h >= 4) {
    if (!a.cluedAt) a.cluedAt = n.day
    msgs.push({ text: `Clue: ${CONDITION_TEXT[r.condition]}.`, tone: "info" })
  }
  if (a.chats <= 1) noteToday(n, `Chatted with ${r.name} (${reply.by === "model" ? "free talk" : "short talk"}).`)
  return done(n, msgs, true, reply.say)
}

export function wantsMet(s: GameState, r: Resident): boolean {
  return r.wants.every((w) => have(s, w) >= 1)
}

export function turnIn(s: GameState, id: string): Result {
  const r = resident(id)
  if (!r) return no(s, "Nobody there.")
  const a0 = animal(s, id)
  if (a0.stage !== "new") return no(s, `${r.name} already has what they asked for.`)
  if (hearts(s, id) < 2) return no(s, `${r.name} doesn't trust you enough to ask yet. (2 hearts)`)
  if (!wantsMet(s, r)) return no(s, `You still need: ${r.wants.filter((w) => !have(s, w)).map((w) => item(w).name).join(", ")}.`)
  const n = clone(s)
  const a = touch(n, id)
  for (const w of r.wants) bag(n, w, -1)
  a.stage = "turned"
  addTrust(a, 10)
  setMood(a, 1)
  noteToday(n, `Brought ${r.name} what they wanted.`)
  return done(n, [{ text: `${r.name} got ${r.wants.map((w) => item(w).name).join(" and ")}.`, tone: "good" }], true, r.thanks)
}

/** Why asking for the keepsake would not work yet. Empty means it would. */
export function askBlocks(s: GameState, id: string, ctx: { crowd: number }): string[] {
  const r = resident(id)
  if (!r) return ["Nobody there."]
  const a = animal(s, id)
  const out: string[] = []
  if (a.stage === "new") out.push(hearts(s, id) < 2 ? "They don't trust you enough to ask for anything yet." : "They are waiting for what they asked for.")
  else if (a.stage === "gave") out.push("You already have their keepsake.")
  if (a.stage === "turned" && hearts(s, id) < r.gate) out.push(`Needs ${r.gate} hearts.`)
  if (a.stage === "turned" && !conditionMet(s, r.condition, a, ctx)) out.push(a.cluedAt ? `Today isn't right: ${CONDITION_TEXT[r.condition]}.` : "Something about today isn't right for them. (Talk more to learn what.)")
  return out
}

export function conditionMet(s: GameState, c: Condition, a: AnimalState, ctx: { crowd: number }): boolean {
  switch (c) {
    case "none": return true
    case "morning": return s.minutes < 12 * 60
    case "evening": return s.minutes >= 18 * 60
    case "rain": return s.weather === "rain"
    case "dry": return s.weather === "clear"
    case "sneak": return !a.spooked
    case "alone": return ctx.crowd === 0
    case "fed": return a.fed
    case "played": return a.played
  }
}

export function ask(s: GameState, id: string, ctx: { crowd: number }): Result {
  const r = resident(id)
  if (!r) return no(s, "Nobody there.")
  const blocks = askBlocks(s, id, ctx)
  if (blocks.length) return no(s, blocks[0]!)
  const n = clone(s)
  const a = touch(n, id)
  a.stage = "gave"
  addTrust(a, 5)
  bag(n, r.gives, 1)
  n.stats.keepsakes += 1
  noteToday(n, `${r.name} gave me ${item(r.gives).name}.`)
  return done(n, [{ text: `Received: ${item(r.gives).name}!`, tone: "good" }], true, r.give)
}

// ─── the world ────────────────────────────────────────────────────────────

const YIELD: Record<Exclude<NodeKind, "dig" | "fish">, [string, number, number]> = {
  berry: ["berry", 2, 3], acorn: ["acorn", 1, 2], reed: ["reed", 2, 2], clover: ["clover", 2, 3],
  pebble: ["pebble", 1, 2], feather: ["feather", 1, 1], mushroom: ["mushroom", 1, 2], shell: ["shell", 1, 1],
}

export const GATHER_COST = 3
export const FISH_COST = 6

export function nodeReady(s: GameState, nodeId: string): boolean {
  return s.nodes[nodeId] !== s.day
}

/** `rand` is 0..1. `bonus` is the companion's chance of one extra. */
export function gather(s: GameState, nodeId: string, kind: NodeKind, rand: () => number, bonus = 0): Result {
  if (kind === "fish") return no(s, "That needs a rod, a steady hand, and a good eye.")
  if (!nodeReady(s, nodeId)) return no(s, "Picked clean. It will grow back tomorrow.")
  if (s.energy < GATHER_COST) return no(s, "Too tired to gather.")
  const n = clone(s)
  n.energy -= GATHER_COST
  n.nodes[nodeId] = n.day
  let got: [string, number]
  if (kind === "dig") {
    const roll = rand()
    got = roll < 0.5 ? ["button", 1] : roll < 0.75 ? ["pebble", 1] : roll < 0.92 ? ["mushroom", 1] : ["acorn", 1]
    if (got[0] === "button" && rand() < 0.3) got[1] = 2
  } else {
    const [id, lo, hi] = YIELD[kind]
    got = [id, lo + Math.floor(rand() * (hi - lo + 1))]
  }
  if (rand() < bonus) got[1] += 1
  bag(n, got[0], got[1])
  n.stats.gathered += got[1]
  return done(n, [{ text: `+${got[1]} ${item(got[0]).name}`, tone: "good" }])
}

export function fish(s: GameState, nodeId: string, grade: 0 | 1 | 2, rand: () => number): Result {
  if (!nodeReady(s, nodeId)) return no(s, "The fish have gone elsewhere today.")
  if (s.energy < FISH_COST) return no(s, "Too tired to fish.")
  const n = clone(s)
  n.energy -= FISH_COST
  n.nodes[nodeId] = n.day
  if (grade === 0) return done(n, [{ text: "It got away.", tone: "info" }])
  const catches: Array<[string, number]> = [["fish", grade === 2 ? 2 : 1]]
  if (grade === 2 && rand() < 0.4) catches.push(["shell", 1])
  for (const [id, q] of catches) bag(n, id, q)
  n.stats.gathered += catches.reduce((sum, [, q]) => sum + q, 0)
  return done(n, [{ text: catches.map(([id, q]) => `+${q} ${item(id).name}`).join(", "), tone: "good" }])
}

export function canCraft(s: GameState, id: string): boolean {
  const recipe = ITEMS[id]?.recipe
  return !!recipe && Object.entries(recipe).every(([m, q]) => have(s, m) >= q)
}

export function craft(s: GameState, id: string): Result {
  const def = ITEMS[id]
  if (!def?.recipe) return no(s, "No recipe for that.")
  if (!canCraft(s, id)) return no(s, "Missing something.")
  const n = clone(s)
  for (const [m, q] of Object.entries(def.recipe)) bag(n, m, -q)
  bag(n, id, 1)
  noteToday(n, `Crafted ${def.name}.`)
  return done(n, [{ text: `Made ${def.name}.`, tone: "good" }])
}

export const RESTORE: Record<string, number> = { berry: 8, jam: 28, pie: 42 }

export function eat(s: GameState, id: string): Result {
  const gives = RESTORE[id]
  if (!gives || have(s, id) < 1) return no(s, "Not food.")
  if (s.energy >= s.maxEnergy) return no(s, "You're full of energy already.")
  const n = clone(s)
  bag(n, id, -1)
  n.energy = Math.min(n.maxEnergy, n.energy + gives)
  return done(n, [{ text: `Ate ${item(id).name}. +${gives} energy.`, tone: "good" }])
}

/** The Trade Stump. Buy raw materials at twice their value, sell anything loose at a third. */
export function buy(s: GameState, id: string): Result {
  const def = ITEMS[id]
  if (!def || def.kind !== "material") return no(s, "The Stump only sells raw things.")
  const price = def.value * 2
  if (s.buttons < price) return no(s, `Needs ${price} buttons.`)
  const n = clone(s)
  n.buttons -= price
  bag(n, id, 1)
  return done(n, [{ text: `Bought ${def.name} (−${price}).`, tone: "info" }])
}

export const sellPrice = (id: string) => Math.max(1, Math.floor((ITEMS[id]?.value ?? 0) / 3))

export function sell(s: GameState, id: string): Result {
  const def = ITEMS[id]
  if (!def || def.kind === "keepsake" || def.kind === "part") return no(s, "The Stump won't take that.")
  if (have(s, id) < 1) return no(s, "You don't have that.")
  const n = clone(s)
  bag(n, id, -1)
  n.buttons += sellPrice(id)
  return done(n, [{ text: `Sold ${def.name} (+${sellPrice(id)}).`, tone: "info" }])
}

export function deliverErrand(s: GameState, errandId: string): Result {
  const e = s.errands.find((x) => x.id === errandId)
  if (!e || e.done) return no(s, "Nothing to deliver.")
  if (have(s, e.item) < e.qty) return no(s, `You need ${e.qty} ${item(e.item).name}.`)
  const r = resident(e.who)!
  const n = clone(s)
  bag(n, e.item, -e.qty)
  n.buttons += e.reward
  n.errands = n.errands.map((x) => (x.id === errandId ? { ...x, done: true } : x))
  addTrust(touch(n, e.who), 4)
  noteToday(n, `Ran an errand for ${r.name}.`)
  return done(n, [{ text: `${r.name} says thanks. +${e.reward} buttons, +4 trust.`, tone: "good" }])
}

export function placePart(s: GameState, partId: string): Result {
  if (!(LAMP_PARTS as readonly string[]).includes(partId) || have(s, partId) < 1) return no(s, "You have no Lamp part to place.")
  const n = clone(s)
  bag(n, partId, -1)
  n.parts.push(partId)
  noteToday(n, `Set ${item(partId).name} in the Hollow Lamp.`)
  const msgs: Msg[] = [{ text: `${item(partId).name} fits. The lamp hums.`, tone: "good" }]
  if (n.parts.length >= LAMP_PARTS.length) {
    n.ended = true
    msgs.push({ text: "The Hollow Lamp is whole.", tone: "good" })
  } else {
    msgs.push({ text: `A gate opens: act ${unlockedAct(n.parts.length)}.`, tone: "info" })
  }
  return done(n, msgs)
}

/** Sleep: a new day. `power` is 0..1, how much energy comes back (less if you collapsed). */
export function sleep(s: GameState, power: number, bond: { level: number; routine: boolean }): GameState {
  const n = clone(s)
  n.day += 1
  n.minutes = DAY_START
  n.weather = weatherFor(n.day)
  n.maxEnergy = BASE_ENERGY + Math.min(24, 4 * Math.max(0, bond.level - 1))
  n.energy = Math.min(n.maxEnergy, Math.round(n.maxEnergy * power) + (bond.routine ? 15 : 0))
  n.buttons += bond.level
  for (const id of Object.keys(n.animals)) {
    const a = n.animals[id]!
    const t = temper(id)
    // An eager or chatty friend you did not talk to is a little lonely. A calm night lifts the rest toward steady.
    if (!a.talked && (t.cadence === "eager" || t.cadence === "chatty") && a.trust > 0) a.mood = Math.max(-2, a.mood - 1)
    else if (a.mood > 0) a.mood -= 1
    else if (a.mood < 0) a.mood += 1
    a.talked = a.gifted = a.approached = a.favored = a.spooked = a.fed = a.played = false
    a.chats = 0
  }
  n.errands = makeErrands(n.day, unlockedAct(n.parts.length))
  n.today = []
  return n
}

/** Recording the diary line the UI wrote (model or scripted). */
export function addDiary(s: GameState, text: string, by: "model" | "scripted"): GameState {
  const n = clone(s)
  n.diary = [...n.diary, { day: s.day, text, by }].slice(-60)
  return n
}

export function scriptedDiary(s: GameState, companion: string): string {
  const facts = s.today.length ? s.today.slice(-4).join(" ") : "A quiet day. Nothing to report but the grass."
  return `Day ${s.day}. ${companion} says: ${facts}`
}

/** Friends who could be asked for a keepsake right now (for the "nose" perk and the board). */
export function readyToAsk(s: GameState, ctx: { crowd: number }): string[] {
  return RESIDENTS.filter((r) => r.act <= act(s) && animal(s, r.id).stage === "turned" && askBlocks(s, r.id, ctx).length === 0).map((r) => r.id)
}

/** Friends who could take what you are carrying as their want. */
export function readyToTurnIn(s: GameState): string[] {
  return RESIDENTS.filter((r) => r.act <= act(s) && animal(s, r.id).stage === "new" && hearts(s, r.id) >= 2 && wantsMet(s, r)).map((r) => r.id)
}

export { moodLabel, RECIPES }
