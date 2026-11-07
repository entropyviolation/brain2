/**
 * lib/baby-game/engine.ts — The rules of Valdivia (pure, no clock, no storage)
 *
 * One serializable `GameState`. Every action takes a state and returns `{ s, msgs, line, ok }`; nothing here
 * touches the canvas, `Math.random`, or the real clock (a `rand` is passed in). The realtime part (walking,
 * where friends stand) lives in `sim.ts`. The loop of the game:
 *
 *   meet a friend → talk, gift, approach, favor to earn hearts → at two hearts they say what they want →
 *   turn the wanted items in → at their heart gate, and only when their secret condition holds, ask for
 *   the keepsake → the next friend wants that keepsake → the last friend of each act holds a Lamp part →
 *   place it in the Orb Lamp, which opens the next gate.
 *
 * Around that loop sits a farm: sixteen plots, six crops in four seven-day cycles, four skills that level with use,
 * a festival every seventh day, odd weather (meteor showers, morning mist), and a Starlog of everything you have found.
 */

import { createCharacters, remember, type Character } from "./character"
import { createMinds, type Mind } from "./mind"
import type { Talk } from "./chatter"
import type { Book, GoldExample, ReadStyle } from "./shelf"
import type { Study } from "./study"
import type { Letter } from "./bestie"
import { approachDistance, CONDITION_TEXT, isShy, RESIDENTS, resident, temper, type Condition, type Resident } from "./cast"
import { LESSONS, pathTalk } from "./dharma"
import { COMMONS_NOTES, offeringOf, theoryTalk } from "./theory"
import { economyOf, type EconomySpec } from "./economy"
import { approachLine, favorLine, giftLine, moodLabel, smallTalk, SPOOK_LINE, type Taste } from "./lines"
import { item, ITEMS, LAMP_PARTS, RECIPES, SHELL_IDS, type ItemDef, SHELL_KINDS, shellKindOf } from "./items"
import { MAP_W, PLOTS, unlockedAct, type NodeKind } from "./world"
import { stageOf, type TreeRec } from "./trees"
import { QUESTS, type Quest } from "./quests"
import { MINIGAMES, REWARDS, type MinigameId } from "./minigames"
import { blankPlot, CROP_BY_SEED, CROPS, cycleName, festivalOn, inSeason, isRipe, levelOf, SKILLS, type Plot, type SkillId } from "./farm"
import type { FriendTone } from "@/lib/baby-animal-personality"
import type { SlimeState } from "./slime"

export const DAY_START = 6 * 60
/** 2am: the day ends where you stand. */
export const DAY_LIMIT = 26 * 60
export const BASE_ENERGY = 100

export type Weather = "clear" | "rain" | "meteor" | "fog"

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

/**
 * The Commons: one shelf at the Stump that the whole village adds to and takes from. Friends stock it every morning
 * ("from each according to ability"); you take what you need, up to a daily share ("to each according to need").
 * `gave` and `took` are lifetime counts of things; `lastGave` is the last day you added something; `drawn` is
 * what you took today. Reciprocity between neighbours is tit for tat (`reciprocate`).
 */
export type Commons = { stock: Record<string, number>; gave: number; took: number; lastGave: number; drawn: number }

export type Errand = { id: string; who: string; item: string; qty: number; reward: number; done: boolean }

export type GameState = {
  v: 1
  day: number
  minutes: number
  weather: Weather
  energy: number
  maxEnergy: number
  /** Scrip for the Trade Corner. Only a world whose economy keeps a market remnant uses it; a gift economy never pays in it. */
  buttons: number
  /** How this world shares (`economy.ts`). Missing means the default gift commons. */
  economy?: EconomySpec
  inv: Record<string, number>
  animals: Record<string, AnimalState>
  nodes: Record<string, number>
  /** Trees changed since the world was made, by tile index (`trees.ts`). Missing means every tree is as it was scattered. */
  trees?: Record<number, TreeRec>
  /** Width of the map grid the tile indices above were made on. Missing means the 80 wide map before 2026-11-03 (`save.ts` re-keys them). */
  mapW?: number
  parts: string[]
  errands: Errand[]
  today: string[]
  diary: Array<{ day: number; text: string; by: "model" | "scripted" }>
  ended: boolean
  seen: Record<string, boolean>
  stats: { gathered: number; gifts: number; favors: number; keepsakes: number; harvests: number; ribbons: number; festivals: number; fished: number; played: number }
  /** Things made, by item id, for craft quests. */
  made: Record<string, number>
  questsDone: Record<string, true>
  /** What is weighing on the player in real life, told to the friends. Read-only toward the real app. */
  real: RealTask[]
  farm: Record<string, Plot>
  skills: Record<SkillId, number>
  /** Every item id you have ever held, for the Starlog. */
  found: Record<string, true>
  /** The shared shelf and your standing with it. */
  commons: Commons
  /** The cast, created when the game starts (`character.ts`): looks, personality, role, goals, quests, likes, home, memory. */
  characters: Record<string, Character>
  /** Each friend's inner life (`mind.ts`): description, beliefs, motivations, likes, goals, schedule, bonds, plans. Editable. */
  minds: Record<string, Mind>
  /** Talks between friends, oldest first (`chatter.ts`). */
  chatter: Talk[]
  /** Books on each friend's shelf, by friend id (`shelf.ts`). Only metadata; the words are in the attachment store. */
  shelves: Record<string, Book[]>
  /** Sittings the player corrected, kept as worked examples for the reading prompt (`shelf.ts` `GoldExample`). */
  gold?: GoldExample[]
  /** Per friend: read in their scheduled hours (default) or all the way through until stopped. */
  readStyle?: Record<string, ReadStyle>
  /** Each friend's Study notebook, sessions and manifesto (`study.ts`). Missing until they first study. */
  study?: Record<string, Study>
  /** Notes best friends left in the mailbox (`bestie.ts`), oldest first. */
  mail?: Letter[]
  /** What C has said to friends in free talk, newest last, so a best friend can know them (`bestie.ts`). */
  aboutC?: string[]
  /** Items a best friend invented as gifts (`forge.ts`), by id; `registerCustom` puts them into `ITEMS` on load. */
  custom?: Record<string, ItemDef>
  /** The slime mold, one body over the whole map with a memory (`slime.ts`). Missing until the game first ticks it. */
  slime?: SlimeState
}

export type RealTask = { id: string; text: string; urgent: boolean; done: boolean; added: number; plan?: string[] }

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
  if (day % 4 === 3 || hash(day) < 18) return "rain"
  if (hash(day * 5 + 1) < 11) return "meteor"
  if (hash(day * 3 + 2) < 11) return "fog"
  return "clear"
}

export function makeErrands(day: number, act: number): Errand[] {
  const pool = RESIDENTS.filter((r) => r.act <= act)
  const things = ["berry", "acorn", "reed", "clover", "pebble", "feather", "mushroom", "shell", ...(day >= 3 ? ["glowbean", "puffroot", "spiralkale"] : [])]
  return [0, 1].map((n) => {
    const who = pool[hash(day * 7 + n * 13) % pool.length]!
    const thing = things[hash(day * 11 + n * 5) % things.length]!
    const farmed = !!CROPS[thing]
    return { id: `e${day}-${n}`, who: who.id, item: thing, qty: 1 + (hash(day + n) % 2), reward: (farmed ? 7 : 3) + (hash(day * 3 + n) % 3), done: false }
  })
}

export const blankCommons = (): Commons => ({ stock: { berry: 3, clover: 3, acorn: 2, reed: 2 }, gave: 0, took: 0, lastGave: 0, drawn: 0 })

export function newGame(): GameState {
  const s: GameState = {
    v: 1, mapW: MAP_W, day: 1, minutes: DAY_START + 30, weather: "clear", energy: BASE_ENERGY, maxEnergy: BASE_ENERGY, buttons: 0,
    inv: { berry: 2, clover: 2, "glowbean-seed": 4, gem: 3 }, animals: {}, nodes: {}, parts: [], errands: makeErrands(1, 1), today: [], diary: [],
    ended: false, seen: {}, stats: { gathered: 0, gifts: 0, favors: 0, keepsakes: 0, harvests: 0, ribbons: 0, festivals: 0, fished: 0, played: 0 },
    made: {}, questsDone: {}, real: [],
    farm: {}, skills: { farming: 0, foraging: 0, fishing: 0, crafting: 0 }, found: { berry: true, clover: true, "glowbean-seed": true, gem: true },
    commons: blankCommons(),
    characters: createCharacters(),
    minds: {},
    chatter: [],
    shelves: {},
  }
  s.minds = createMinds(s.characters)
  return s
}

export const clone = (s: GameState): GameState => structuredClone(s)
export const done = (s: GameState, msgs: Msg[], ok = true, line?: string): Result => ({ s, msgs, ok, line })
export const no = (s: GameState, text: string): Result => done(s, [{ text, tone: "bad" }], false)

export const hour = (s: GameState) => Math.floor(s.minutes / 60) % 24
export const act = (s: GameState) => unlockedAct(s.parts.length)

export function animal(s: GameState, id: string): AnimalState {
  return s.animals[id] ?? blankAnimal()
}

export const hearts = (s: GameState, id: string) => Math.floor(animal(s, id).trust / 10)

/** Full friendship: 10 hearts with a friend of the village. They call you C and write you notes (`bestie.ts`). */
export const isBestFriend = (s: GameState, id: string) => !!resident(id) && hearts(s, id) >= 10

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

export function bag(s: GameState, id: string, qty: number) {
  // "a shell" means any shell: spend the plain one first, then the named kinds
  if (id === "shell" && qty < 0) {
    let owed = -qty
    for (const sid of SHELL_IDS) {
      const take = Math.min(owed, s.inv[sid] ?? 0)
      if (!take) continue
      s.inv[sid] = s.inv[sid]! - take
      if (s.inv[sid]! <= 0) delete s.inv[sid]
      owed -= take
    }
    return
  }
  if (qty > 0) s.found[id] = true
  s.inv[id] = (s.inv[id] ?? 0) + qty
  if (s.inv[id]! <= 0) delete s.inv[id]
}

/**
 * The village says thanks. `worth` is how big the thanks is. In a gift economy it comes as gems in kind, a thing most
 * friends love to be given (`gemRate` of the worth, at least one). Only a world with a market remnant pays scrip (buttons).
 * Returns the words for the toast ("2 gems", "12 buttons"), or "" for nothing.
 */
export function payOut(n: GameState, worth: number): string {
  const t = thanksOf(n, worth)
  if (t.scrip) n.buttons += t.qty
  else if (t.qty) bag(n, "gem", t.qty)
  return thanksLabel(n, worth)
}

function thanksOf(s: GameState, worth: number): { scrip: boolean; qty: number } {
  if (worth <= 0) return { scrip: false, qty: 0 }
  const e = economyOf(s)
  if (e.rewards === "scrip" && e.market === "remnant") return { scrip: true, qty: worth }
  return { scrip: false, qty: Math.max(1, Math.round(worth * e.gemRate)) }
}

/** What `payOut` would give, in words, without giving it. For panels that show a reward ahead of time. */
export function thanksLabel(s: GameState, worth: number): string {
  const t = thanksOf(s, worth)
  if (!t.qty) return ""
  return t.scrip ? `${t.qty} buttons` : `${t.qty} ${t.qty === 1 ? "gem" : "gems"}`
}

/** Give this world another economy. A market remnant starts with a little scrip so its Trade Corner is usable. */
export function setEconomy(s: GameState, spec: EconomySpec): GameState {
  const n = clone(s)
  n.economy = spec
  if (spec.market === "remnant" && n.buttons <= 0) n.buttons = 12
  return n
}

export const have = (s: GameState, id: string) => (id === "shell" ? SHELL_IDS.reduce((n, sid) => n + (s.inv[sid] ?? 0), 0) : (s.inv[id] ?? 0))

// ─── skills and the Starlog ───────────────────────────────────────────────

export const skillLevel = (s: GameState, id: SkillId) => levelOf(s.skills[id] ?? 0)

export function addXp(n: GameState, id: SkillId, amount: number, msgs: Msg[]) {
  const before = levelOf(n.skills[id] ?? 0)
  n.skills[id] = (n.skills[id] ?? 0) + amount
  const after = levelOf(n.skills[id]!)
  if (after > before) {
    msgs.push({ text: `${SKILLS[id].name} level ${after}! ${SKILLS[id].perks[after - 2]}. (+${payOut(n, 5)})`, tone: "good" })
  }
}

export const STARLOG_STEP = 5
export const starlogTotal = () => Object.keys(ITEMS).length
export const starlogCount = (s: GameState) => Object.keys(s.found).length

/** Every fifth thing you discover pays out once. Called wherever a new item can arrive. */
export function sweepLog(n: GameState, msgs: Msg[]) {
  for (let k = STARLOG_STEP; k <= starlogCount(n); k += STARLOG_STEP) {
    if (n.seen[`log${k}`]) continue
    n.seen[`log${k}`] = true
    msgs.push({ text: `Starlog: ${k} things found! (+${payOut(n, 8)})`, tone: "good" })
  }
}

/** Is a friend awake and out right now? Used by the UI; the sim moves them. */
export function isAsleep(r: Resident, minutes: number): boolean {
  const [from, to] = r.sleeps ?? [22, 6]
  const h = Math.floor(minutes / 60) % 24
  return from > to ? h >= from || h < to : h >= from && h < to
}

/** How a friend takes a gift. Every baby animal loves a gem; everything else goes by tags. */
export function tasteOf(r: Resident, itemId: string): Taste {
  if (itemId === "gem") return "love"
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
    remember(n.characters, id, n.day, "met", "met the Center of The World")
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
  // One everyday remark in three is the friend's own outlook (`dharma.ts`), once you know them and they are not cranky.
  // They alternate between the Eastern idea (`dharma.ts`) and the commons idea (`theory.ts`).
  const outlook = a.mood >= 0 && h >= 1 && pick % 3 === 2
  const k = Math.floor(pick / 3)
  const remark = () => (k % 2 === 0 ? pathTalk(id, k / 2) : theoryTalk(id, (k - 1) / 2))
  if (a.stage === "gave") return done(n, msgs, true, outlook ? remark() : smallTalk(t.tone, a.mood, n.weather, hour(n), pick + 1))
  return done(n, msgs, true, outlook ? remark() : smallTalk(t.tone, a.mood, n.weather, hour(n), pick))
}

/** Knocking at a friend's home. Changes no rule; the friend remembers the first knock each day. */
export function knock(s: GameState, id: string): GameState {
  const key = `knock:${id}:${s.day}`
  if (s.seen[key] || !s.characters?.[id]) return s
  const n = clone(s)
  n.seen[key] = true
  remember(n.characters, id, n.day, "visit", `heard the Center of The World knock at ${n.characters[id]!.home.name}`)
  return n
}

/** A hoard of gems this size wins a friend outright: trust goes straight to full. */
export const GEM_HOARD = 100

/** Give the whole hoard at once (`GEM_HOARD` gems). It ignores the once-a-day gift and fills the bond. */
export function giftGemHoard(s: GameState, id: string): Result {
  const r = resident(id)
  if (!r) return no(s, "Nobody there.")
  if (have(s, "gem") < GEM_HOARD) return no(s, `A hoard is ${GEM_HOARD} gems.`)
  const n = clone(s)
  const a = touch(n, id)
  a.trust = 100
  setMood(a, 2)
  a.fed = true
  bag(n, "gem", -GEM_HOARD)
  n.stats.gifts += 1
  noteToday(n, `Gave ${r.name} a hoard of ${GEM_HOARD} gems. Bonded for life.`)
  remember(n.characters, id, n.day, "gift", `was given ${GEM_HOARD} gems at once and was overcome`)
  return done(n, [{ text: `${r.name} is yours, heart and all. ❤️`, tone: "good" }], true, giftLine("love", temper(id).tone))
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
  remember(n.characters, id, n.day, "gift", `was given ${def.name} and ${taste === "meh" ? "accepted it" : `${taste}d it`}`)
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
  if (!r || !isShy(id) || animal(s, id).spooked || s.weather === "fog") return done(s, [], false)
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
export function chat(s: GameState, id: string, reply: ChatReply, told?: string): Result {
  const r = resident(id)
  if (!r) return no(s, "Nobody there.")
  const n = clone(s)
  const a = touch(n, id)
  const msgs: Msg[] = []
  a.chats += 1
  remember(n.characters, id, n.day, "chat", `said "${reply.say.slice(0, 90)}"`)
  if (told && told.trim().length >= 12) {
    const t = told.trim().replace(/\s+/g, " ").slice(0, 140)
    remember(n.characters, id, n.day, "told", `C said: "${t}"`)
    if (isBestFriend(s, id)) n.aboutC = [...(n.aboutC ?? []), `${r.name} heard: "${t}"`].slice(-30)
  }
  if (isBestFriend(s, id) && reply.say.includes("?")) remember(n.characters, id, n.day, "asked", `asked C: ${reply.say.slice(reply.say.lastIndexOf(".") + 1).trim().slice(0, 140) || reply.say.slice(0, 140)}`)
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
  remember(n.characters, id, n.day, "wish", `was brought ${r.wants.map((w) => item(w).name).join(" and ")}, what they wished for`)
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
    case "dry": return s.weather !== "rain"
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
  remember(n.characters, id, n.day, "keepsake", `trusted the Center of The World with ${item(r.gives).name}`)
  return done(n, [{ text: `Received: ${item(r.gives).name}!`, tone: "good" }], true, r.give)
}

// ─── the world ────────────────────────────────────────────────────────────

const YIELD: Record<Exclude<NodeKind, "dig" | "fish">, [string, number, number]> = {
  berry: ["berry", 2, 3], acorn: ["acorn", 1, 2], reed: ["reed", 2, 2], clover: ["clover", 2, 3],
  pebble: ["pebble", 1, 2], feather: ["feather", 1, 1], mushroom: ["mushroom", 1, 2], shell: ["shell", 1, 1],
}

export const gatherCost = (s: GameState) => [3, 2, 2, 1, 1][skillLevel(s, "foraging") - 1] ?? 1
export const fishCost = (s: GameState) => [6, 5, 5, 4, 4][skillLevel(s, "fishing") - 1] ?? 4
export const tillCost = (s: GameState) => (skillLevel(s, "farming") >= 4 ? 0 : 2)
export const plantCost = (s: GameState) => (skillLevel(s, "farming") >= 4 ? 0 : 1)
export const waterCost = (s: GameState) => (skillLevel(s, "farming") >= 2 ? 0 : 1)

export const chopCost = () => 3

/** Fell the mature tree on tile `idx`: 2 to 3 wood, now and then an acorn, and a stump that sprouts again in two nights. The caller checked a tree stands there. */
export function chop(s: GameState, idx: number, rand: () => number): Result {
  if (stageOf(s.trees?.[idx], s.day) !== "mature") return no(s, "That one is still growing.")
  if (s.energy < chopCost()) return no(s, "Too tired to swing.")
  const n = clone(s)
  n.energy -= chopCost()
  n.trees = { ...(n.trees ?? {}), [idx]: { k: "cut", t: n.day } }
  const wood = 2 + (rand() < 0.5 ? 1 : 0)
  bag(n, "wood", wood)
  n.stats.gathered += wood
  const msgs: Msg[] = [{ text: `+${wood} Wood`, tone: "good" }, { text: "Timber! A stump is left. It will sprout again.", tone: "info" }]
  if (rand() < 0.3) {
    bag(n, "acorn", 1)
    msgs.push({ text: "+1 Acorn", tone: "good" })
  }
  addXp(n, "foraging", 1, msgs)
  return done(n, msgs)
}

/** Dig out the stump on tile `idx`. The tile stays open ground until a seed from a neighbour lands. */
export function clearStump(s: GameState, idx: number): Result {
  if (stageOf(s.trees?.[idx], s.day) !== "stump") return no(s, "No stump here.")
  if (s.energy < 1) return no(s, "Too tired to dig.")
  const n = clone(s)
  n.energy -= 1
  n.trees = { ...(n.trees ?? {}), [idx]: { k: "bare", t: n.day } }
  bag(n, "wood", 1)
  n.stats.gathered += 1
  return done(n, [{ text: "+1 Wood", tone: "good" }, { text: "The stump is out. Open ground.", tone: "info" }])
}

export function nodeReady(s: GameState, nodeId: string): boolean {
  return s.nodes[nodeId] !== s.day
}

/** `rand` is 0..1. `bonus` is the companion's chance of one extra. */
export function gather(s: GameState, nodeId: string, kind: NodeKind, rand: () => number, bonus = 0): Result {
  if (kind === "fish") return no(s, "That needs a rod, a steady hand, and a good eye.")
  if (!nodeReady(s, nodeId)) return no(s, "Picked clean. It will grow back tomorrow.")
  const cost = gatherCost(s)
  if (s.energy < cost) return no(s, "Too tired to gather.")
  const n = clone(s)
  n.energy -= cost
  n.nodes[nodeId] = n.day
  let got: [string, number]
  if (kind === "dig") {
    const roll = rand()
    got = roll < 0.5 ? ["button", 1] : roll < 0.75 ? ["pebble", 1] : roll < 0.92 ? ["mushroom", 1] : ["acorn", 1]
    if (got[0] === "button" && rand() < 0.3) got[1] = 2
    if (n.weather === "meteor" && rand() < 0.4) got = ["starshard", 1]
  } else {
    const [id, lo, hi] = YIELD[kind]
    got = [kind === "shell" ? `shell-${shellKindOf(nodeId)}` : id, lo + Math.floor(rand() * (hi - lo + 1))]
  }
  const lvl = skillLevel(s, "foraging")
  if (rand() < bonus + (lvl >= 5 ? 0.5 : lvl >= 3 ? 0.25 : 0)) got[1] += 1
  if (n.weather === "fog" && got[0] === "mushroom") got[1] += 1
  bag(n, got[0], got[1])
  n.stats.gathered += got[1]
  const msgs: Msg[] = [{ text: `+${got[1]} ${item(got[0]).name}`, tone: "good" }]
  addXp(n, "foraging", 1, msgs)
  sweepLog(n, msgs)
  return done(n, msgs)
}

export function fish(s: GameState, nodeId: string, grade: 0 | 1 | 2, rand: () => number): Result {
  if (!nodeReady(s, nodeId)) return no(s, "The fish have gone elsewhere today.")
  const cost = fishCost(s)
  if (s.energy < cost) return no(s, "Too tired to fish.")
  const n = clone(s)
  n.energy -= cost
  n.nodes[nodeId] = n.day
  if (grade === 0) return done(n, [{ text: "It got away.", tone: "info" }])
  const lvl = skillLevel(s, "fishing")
  const catches: Array<[string, number]> = [["fish", grade === 2 ? 2 : 1]]
  if (lvl >= 2 && rand() < 1 / 3) catches[0]![1] += 1
  if (grade === 2 && rand() < (lvl >= 4 ? 0.7 : 0.4)) catches.push([`shell-${Object.keys(SHELL_KINDS)[Math.floor(rand() * Object.keys(SHELL_KINDS).length)]}`, 1])
  for (const [id, q] of catches) bag(n, id, q)
  n.stats.gathered += catches.reduce((sum, [, q]) => sum + q, 0)
  n.stats.fished += 1
  const msgs: Msg[] = [{ text: catches.map(([id, q]) => `+${q} ${item(id).name}`).join(", "), tone: "good" }]
  addXp(n, "fishing", grade === 2 ? 3 : 2, msgs)
  sweepLog(n, msgs)
  return done(n, msgs)
}

export function canCraft(s: GameState, id: string): boolean {
  const recipe = ITEMS[id]?.recipe
  return !!recipe && Object.entries(recipe).every(([m, q]) => have(s, m) >= q)
}

/** `rand` decides the crafting skill's double-yield; the default never doubles, so tests stay plain. */
export function craft(s: GameState, id: string, rand: () => number = () => 1): Result {
  const def = ITEMS[id]
  if (!def?.recipe) return no(s, "No recipe for that.")
  if (!canCraft(s, id)) return no(s, "Missing something.")
  const n = clone(s)
  const lvl = skillLevel(s, "crafting")
  const entries = Object.entries(def.recipe)
  entries.forEach(([m, q], i) => bag(n, m, -(i === 0 && lvl >= 4 && q >= 2 ? q - 1 : q)))
  const twice = rand() < (lvl >= 5 ? 0.5 : lvl >= 3 ? 1 / 3 : lvl >= 2 ? 0.2 : 0)
  bag(n, id, twice ? 2 : 1)
  n.made[id] = (n.made[id] ?? 0) + (twice ? 2 : 1)
  noteToday(n, `Crafted ${def.name}.`)
  const msgs: Msg[] = [{ text: twice ? `Made two ${def.name}! A lucky pair.` : `Made ${def.name}.`, tone: "good" }]
  addXp(n, "crafting", 2, msgs)
  sweepLog(n, msgs)
  return done(n, msgs)
}

export const RESTORE: Record<string, number> = { berry: 8, jam: 28, pie: 42, glowbean: 6, moonmelon: 14, stew: 36, sorbet: 30, crisps: 20 }

export function eat(s: GameState, id: string): Result {
  const gives = RESTORE[id]
  if (!gives || have(s, id) < 1) return no(s, "Not food.")
  if (s.energy >= s.maxEnergy) return no(s, "You're full of energy already.")
  const n = clone(s)
  bag(n, id, -1)
  n.energy = Math.min(n.maxEnergy, n.energy + gives)
  return done(n, [{ text: `Ate ${item(id).name}. +${gives} energy.`, tone: "good" }])
}

/** The Stump only stocks seeds that can be planted today; everything else is always there. */
export const stocked = (def: { kind: string; id: string }, day: number) => {
  if (def.kind !== "seed") return def.kind === "material"
  const crop = CROP_BY_SEED[def.id]
  return !!crop && inSeason(crop, day)
}

/** The Trade Corner of the Stump: the small market that is left. Buy raw materials at twice their value. The Commons shelf is free. */
export function buy(s: GameState, id: string): Result {
  if (economyOf(s).market === "none") return no(s, "Nothing is for sale here. Take what you need from the shelf.")
  const def = ITEMS[id]
  if (!def || (def.kind !== "material" && def.kind !== "seed")) return no(s, "The Stump only sells raw things and seeds.")
  if (!stocked(def, s.day)) return no(s, `${def.name} aren't on the Stump until their cycle.`)
  const price = def.value * 2
  if (s.buttons < price) return no(s, `Needs ${price} buttons.`)
  const n = clone(s)
  n.buttons -= price
  bag(n, id, 1)
  return done(n, [{ text: `Bought ${def.name} (−${price}). The shelf would have given it free.`, tone: "info" }])
}

/** A festival day pays half again. */
export const sellPrice = (id: string, day = 1) => {
  const base = ITEMS[id]?.sellFor ?? Math.floor((ITEMS[id]?.value ?? 0) / 3)
  return Math.max(1, festivalOn(day) ? Math.round(base * 1.5) : base)
}

export function sell(s: GameState, id: string): Result {
  if (economyOf(s).market === "none") return no(s, "Nobody buys here. Leave it on the shelf and it is everyone's.")
  const def = ITEMS[id]
  if (!def || def.kind === "keepsake" || def.kind === "part") return no(s, "The Stump won't take that.")
  if (have(s, id) < 1) return no(s, "You don't have that.")
  const n = clone(s)
  bag(n, id, -1)
  n.buttons += sellPrice(id, s.day)
  n.commons.stock[id] = (n.commons.stock[id] ?? 0) + 1
  return done(n, [{ text: `Sold ${def.name} (+${sellPrice(id, s.day)}). It goes on the Commons shelf.`, tone: "info" }])
}

// ─── the Commons ──────────────────────────────────────────────────────────

export const STANDINGS = [
  { at: 0, name: "Newcomer" },
  { at: 4, name: "Neighbor" },
  { at: 12, name: "Comrade" },
  { at: 25, name: "Elder of the Commons" },
] as const
/** If you have taken this many more things than you gave and have not given since yesterday, the friends mirror you. */
export const FREE_RIDE_GAP = 8
export const DRAW_BASE = 3

export function standing(s: GameState): (typeof STANDINGS)[number] {
  return [...STANDINGS].reverse().find((t) => s.commons.gave >= t.at)!
}

/** Tit for tat, with forgiveness: the friends mirror a long run of only taking until you give once. */
export function freeRiding(s: GameState): boolean {
  const gap = economyOf(s).shelf.mirrorGap
  return gap !== null && s.commons.took - s.commons.gave > gap && s.commons.lastGave < s.day - 1
}

/** Things you may take today: a base share, more as you give, a little more when you are worn out; one if you only ever take. */
export function drawLimit(s: GameState): number {
  if (freeRiding(s)) return 1
  const { shelf } = economyOf(s)
  const rank = STANDINGS.indexOf(standing(s))
  return shelf.share + (shelf.standing ? (rank >= 1 ? 1 : 0) + (rank >= 3 ? 1 : 0) : 0) + (s.energy < 30 ? shelf.need : 0)
}

export const shelfCount = (s: GameState) => Object.values(s.commons.stock).reduce((a, b) => a + b, 0)

const commonable = (id: string) => {
  const k = ITEMS[id]?.kind
  return k === "material" || k === "seed" || k === "crop" || k === "trinket"
}

/** Put something on the shared shelf. Nobody pays you; the first gift of the day is heard around the village. */
export function contribute(s: GameState, id: string): Result {
  if (!commonable(id)) return no(s, "The shelf takes only things that can be shared.")
  if (have(s, id) < 1) return no(s, "You don't have that.")
  const n = clone(s)
  bag(n, id, -1)
  n.commons.stock[id] = (n.commons.stock[id] ?? 0) + 1
  const first = n.commons.gave === 0
  const before = standing(n).name
  n.commons.gave += 1
  n.commons.lastGave = n.day
  const msgs: Msg[] = [{ text: `Left ${item(id).name} on the Commons shelf.`, tone: "good" }]
  if (first) msgs.push({ text: `${COMMONS_NOTES.first_give.idea}: ${COMMONS_NOTES.first_give.note}`, tone: "info" })
  if (!n.seen[`cg${n.day}`]) {
    n.seen[`cg${n.day}`] = true
    // a giveaway festival makes the day's first gift count twice
    const lift = festivalOn(n.day) && economyOf(n).festival === "giveaway" ? 2 : 1
    for (const [fid, a] of Object.entries(n.animals)) if (resident(fid) && a.trust >= 10) addTrust(a, lift)
    msgs.push({ text: `The village noticed. +${lift} trust with everyone who knows you.`, tone: "good" })
  }
  const after = standing(n).name
  if (after !== before) msgs.push({ text: `Your standing in the Commons: ${after}.`, tone: "good" })
  noteToday(n, `Left ${item(id).name} on the Commons shelf.`)
  return done(n, msgs)
}

/** Take what you need. Free, up to today's share; seeds only in their own cycle. */
export function take(s: GameState, id: string): Result {
  const def = ITEMS[id]
  if (!def || !commonable(id)) return no(s, "That isn't on the shelf.")
  if ((s.commons.stock[id] ?? 0) < 1) return no(s, `No ${def.name} left on the shelf.`)
  if (def.kind === "seed" && !stocked(def, s.day)) return no(s, `${def.name} aren't ready until their cycle.`)
  const limit = drawLimit(s)
  if (s.commons.drawn >= limit) return no(s, freeRiding(s) ? "The shelf is mirroring you: leave something and it opens again." : `You've taken your share for today (${limit}). Leave some for tomorrow.`)
  const n = clone(s)
  n.commons.stock[id]! -= 1
  if (n.commons.stock[id]! <= 0) delete n.commons.stock[id]
  const first = n.commons.took === 0
  n.commons.took += 1
  n.commons.drawn += 1
  bag(n, id, 1)
  const msgs: Msg[] = [{ text: `Took ${def.name} from the Commons.`, tone: "good" }]
  if (first) msgs.push({ text: `${COMMONS_NOTES.first_take.idea}: ${COMMONS_NOTES.first_take.note}`, tone: "info" })
  sweepLog(n, msgs)
  noteToday(n, `Took ${def.name} from the Commons.`)
  return done(n, msgs)
}

/** Morning at the Commons: reciprocity first, then the friends stock the shelf. Returns the first lines of the new day's notes. */
function commonsMorning(n: GameState): string[] {
  const notes: string[] = []
  const prev = n.day - 1
  const mirror = freeRiding(n)
  // Tit for tat: a gift you gave comes back in kind, unless you have been only taking, in which case they mirror it. Never grudging for long.
  for (const [id, a] of Object.entries(n.animals)) {
    const r = resident(id)
    const back = offeringOf(id)
    if (!r || !back || a.trust < 10) continue
    if (a.gifted) {
      if (mirror) {
        notes.push(`${r.name} did not return your gift. You have taken a lot from the shelf and given little.`)
        continue
      }
      bag(n, back, 1)
      notes.push(`${r.name} returned the favor: ${item(back).name}.`)
    }
    if (mirror && a.trust >= 20) a.mood = Math.max(-2, a.mood - 1)
  }
  if (mirror) notes.push(COMMONS_NOTES.free_rider.note)
  else if (notes.length) notes.push(COMMONS_NOTES.returned.note)
  // From each according to ability: every friend you know adds their thing; deeper friends add two. A festival eve doubles it.
  const econ = economyOf(n)
  const feast = !!festivalOn(prev) && econ.festival === "feast"
  let added = 0
  for (const [id, a] of Object.entries(n.animals)) {
    const give = offeringOf(id)
    if (!resident(id) || !give || a.trust < 10) continue
    const qty = econ.offerings * (a.trust >= 50 ? 2 : 1) * (feast ? 2 : 1)
    if (qty <= 0) continue
    n.commons.stock[give] = (n.commons.stock[give] ?? 0) + qty
    added += qty
  }
  // The Seed Library: one seed that suits today's cycle, from nobody in particular.
  const seeds = Object.values(CROPS).filter((c) => inSeason(c, n.day))
  if (seeds.length) {
    const sd = seeds[hash(n.day * 17) % seeds.length]!.seed
    n.commons.stock[sd] = (n.commons.stock[sd] ?? 0) + 1
  }
  n.commons.drawn = 0
  if (added) notes.push(feast ? `${COMMONS_NOTES.feast.note} (${added} things on the shelf.)` : `The friends stocked the Commons shelf (${added}).`)
  return notes.slice(-12)
}

/** Mutual aid is not wages: half the errand's worth comes back as thanks (`payOut`), the rest in kind. */
export const errandButtons = (e: Errand) => Math.ceil(e.reward / 2)

export function deliverErrand(s: GameState, errandId: string): Result {
  const e = s.errands.find((x) => x.id === errandId)
  if (!e || e.done) return no(s, "Nothing to deliver.")
  if (have(s, e.item) < e.qty) return no(s, `You need ${e.qty} ${item(e.item).name}.`)
  const r = resident(e.who)!
  const n = clone(s)
  bag(n, e.item, -e.qty)
  const pay = payOut(n, errandButtons(e))
  n.errands = n.errands.map((x) => (x.id === errandId ? { ...x, done: true } : x))
  addTrust(touch(n, e.who), 4)
  const back = offeringOf(e.who)
  if (back) bag(n, back, 1)
  noteToday(n, `Ran an errand for ${r.name}.`)
  return done(n, [{ text: `${r.name} says thanks and gives back${back ? ` ${item(back).name}` : " a little"}. +${pay}, +4 trust.`, tone: "good" }])
}

export function placePart(s: GameState, partId: string): Result {
  if (!(LAMP_PARTS as readonly string[]).includes(partId) || have(s, partId) < 1) return no(s, "You have no Lamp part to place.")
  const n = clone(s)
  bag(n, partId, -1)
  n.parts.push(partId)
  noteToday(n, `Set ${item(partId).name} in the Orb Lamp.`)
  const msgs: Msg[] = [{ text: `${item(partId).name} fits. The lamp hums.`, tone: "good" }]
  if (n.parts.length >= LAMP_PARTS.length) {
    n.ended = true
    msgs.push({ text: "The Orb Lamp is whole.", tone: "good" })
  } else {
    msgs.push({ text: `A gate opens: act ${unlockedAct(n.parts.length)}.`, tone: "info" })
  }
  return done(n, msgs)
}

/** Sleep: a new day. `power` is 0..1, how much energy comes back (less if you collapsed). */
export function sleep(s: GameState, power: number, bond: { level: number; routine: boolean }): GameState {
  const n = clone(s)
  const rained = s.weather === "rain"
  for (const p of Object.values(n.farm)) {
    if (p.crop && !isRipe(p) && (p.watered || rained)) p.grown += 1
    p.watered = false
  }
  if (festivalOn(s.day)) {
    n.stats.festivals += 1
    for (const [id, a] of Object.entries(n.animals)) if (Math.floor(a.trust / 10) >= 3 && resident(id)) addTrust(a, 2)
  }
  n.day += 1
  n.minutes = DAY_START
  n.weather = weatherFor(n.day)
  if (n.weather === "rain") for (const p of Object.values(n.farm)) if (p.crop) p.watered = true
  n.maxEnergy = BASE_ENERGY + Math.min(24, 4 * Math.max(0, bond.level - 1))
  n.energy = Math.min(n.maxEnergy, Math.round(n.maxEnergy * power) + (bond.routine ? 15 : 0))
  // the friend you came with leaves a little thanks by your pillow
  payOut(n, bond.level)
  const morning = commonsMorning(n)
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
  n.today = morning
  return n
}

// ─── the farm ─────────────────────────────────────────────────────────────

const plotOf = (s: GameState, id: string): Plot => s.farm[id] ?? blankPlot()
const isPlot = (id: string) => PLOTS.some((p) => p.id === id)

export function till(s: GameState, plotId: string): Result {
  if (!isPlot(plotId)) return no(s, "Nothing to till there.")
  if (plotOf(s, plotId).tilled) return no(s, "Already tilled.")
  const cost = tillCost(s)
  if (s.energy < cost) return no(s, "Too tired to dig.")
  const n = clone(s)
  n.energy -= cost
  n.farm[plotId] = { ...blankPlot(), tilled: true }
  const msgs: Msg[] = [{ text: "Tilled. The soil smells like cinnamon.", tone: "info" }]
  addXp(n, "farming", 1, msgs)
  return done(n, msgs)
}

export function plant(s: GameState, plotId: string, seedId: string): Result {
  const p = plotOf(s, plotId)
  const crop = CROP_BY_SEED[seedId]
  if (!isPlot(plotId) || !crop) return no(s, "Nothing to plant.")
  if (!p.tilled) return no(s, "Till the soil first.")
  if (p.crop) return no(s, "Something is already growing here.")
  if (have(s, seedId) < 1) return no(s, "You have no such seeds.")
  if (!inSeason(crop, s.day)) return no(s, `${item(crop.id).name} grows in ${crop.cycles.map((c) => cycleName(c * 7 + 1)).join(" and ")}. This is ${cycleName(s.day)}.`)
  const cost = plantCost(s)
  if (s.energy < cost) return no(s, "Too tired to plant.")
  const n = clone(s)
  n.energy -= cost
  bag(n, seedId, -1)
  n.farm[plotId] = { tilled: true, crop: crop.id, grown: 0, watered: n.weather === "rain" }
  const msgs: Msg[] = [{ text: `Planted ${item(crop.id).name}. ${crop.days} nights to go.`, tone: "good" }]
  addXp(n, "farming", 1, msgs)
  return done(n, msgs)
}

export function water(s: GameState, plotId: string): Result {
  const p = plotOf(s, plotId)
  if (!p.crop) return no(s, "Nothing is growing here.")
  if (isRipe(p)) return no(s, "Ready to harvest. No more water needed.")
  if (p.watered) return no(s, "Already watered.")
  const cost = waterCost(s)
  if (s.energy < cost) return no(s, "Too tired to water.")
  const n = clone(s)
  n.energy -= cost
  n.farm[plotId] = { ...p, watered: true }
  return done(n, [{ text: "Watered. It wiggles.", tone: "info" }])
}

/** Water every thirsty plant you have the energy for. */
export function waterAll(s: GameState): Result {
  const thirsty = PLOTS.filter((pl) => {
    const p = s.farm[pl.id]
    return p?.crop && !isRipe(p) && !p.watered
  })
  if (!thirsty.length) return no(s, "Nothing needs water.")
  const cost = waterCost(s)
  const n = clone(s)
  let count = 0
  for (const pl of thirsty) {
    if (n.energy < cost) break
    n.energy -= cost
    n.farm[pl.id]!.watered = true
    count += 1
  }
  if (!count) return no(s, "Too tired to water.")
  return done(n, [{ text: `Watered ${count} plant${count === 1 ? "" : "s"}.`, tone: "info" }])
}

export function harvest(s: GameState, plotId: string, rand: () => number): Result {
  const p = plotOf(s, plotId)
  if (!p.crop || !isRipe(p)) return no(s, "Not ready yet.")
  const crop = CROPS[p.crop]!
  const n = clone(s)
  const lvl = skillLevel(s, "farming")
  const extra = rand() < (lvl >= 5 ? 0.5 : lvl >= 3 ? 0.25 : 0) + (s.seen[`scarecrow${s.day}`] ? 0.25 : 0) ? 1 : 0
  const got = crop.yield + extra
  bag(n, crop.id, got)
  n.farm[plotId] = { ...blankPlot(), tilled: true }
  n.stats.harvests += got
  noteToday(n, `Harvested ${got} ${item(crop.id).name}.`)
  const msgs: Msg[] = [{ text: `+${got} ${item(crop.id).name}${extra ? " (a bonus one!)" : ""}`, tone: "good" }]
  addXp(n, "farming", 3, msgs)
  sweepLog(n, msgs)
  return done(n, msgs)
}

export const ripeCount = (s: GameState) => Object.values(s.farm).filter(isRipe).length

/** Hand in a dish or a crop at the festival. One entry per festival. */
export function enterFestival(s: GameState, itemId: string): Result {
  const fest = festivalOn(s.day)
  const def = ITEMS[itemId]
  if (!fest) return no(s, "There is no festival today.")
  if (s.seen[`entry${s.day}`]) return no(s, "You've already entered today.")
  if (!def || (def.kind !== "trinket" && def.kind !== "crop")) return no(s, "The judges want something you made or grew.")
  if (have(s, itemId) < 1) return no(s, "You don't have that.")
  const n = clone(s)
  bag(n, itemId, -1)
  n.seen[`entry${s.day}`] = true
  const worth = sellPrice(itemId)
  const reward = payOut(n, Math.max(8, worth * 3))
  n.stats.ribbons += 1
  noteToday(n, `Entered ${def.name} in the ${fest.name}.`)
  const place = worth >= 14 ? "First place!" : worth >= 8 ? "Second place!" : "A ribbon for trying, and for the snack."
  return done(n, [{ text: `${place} ${def.name} wins ${reward} and a ribbon.`, tone: "good" }])
}

// ─── mini games ───────────────────────────────────────────────────────────

/** Why a mini game can't start right now, or null. */
export function minigameBlock(s: GameState, game: MinigameId): string | null {
  const def = MINIGAMES[game]
  if (def.nightOnly && !(hour(s) >= 19 || hour(s) < 5)) return "The fireflies only come out after dark."
  if (s.energy < def.cost) return "Too tired to play."
  return null
}

/** Pay out a finished mini game. The prize comes once a day per game; playing again is just for fun. */
export function playMinigame(s: GameState, game: MinigameId, grade: 0 | 1 | 2, rand: () => number = () => 1): Result {
  const blocked = minigameBlock(s, game)
  if (blocked) return no(s, blocked)
  const def = MINIGAMES[game]
  const n = clone(s)
  n.energy -= def.cost
  const stamp = `mg:${game}:${s.day}`
  if (grade > 0) n.stats.played += 1
  if (grade === 0) return done(n, [{ text: `${def.name}: not this time. Try again!`, tone: "info" }])
  if (n.seen[stamp]) return done(n, [{ text: `${def.name}: lovely, but today's prize is already yours.`, tone: "info" }])
  n.seen[stamp] = true
  const prize = REWARDS[game][grade]!
  const thanks = payOut(n, prize.buttons)
  const msgs: Msg[] = []
  if (prize.item) {
    bag(n, prize.item[0], prize.item[1])
    msgs.push({ text: `${grade === 2 ? "Wonderful!" : "Nice!"} +${prize.item[1]} ${item(prize.item[0]).name}${thanks ? `, +${thanks}` : ""}.`, tone: "good" })
  }
  if (grade === 2 && rand() < 0.3) {
    bag(n, "starshard", 1)
    msgs.push({ text: "And a Star Shard fell out of it.", tone: "good" })
  }
  noteToday(n, `Played ${def.name} (${grade === 2 ? "perfectly" : "well"}).`)
  sweepLog(n, msgs)
  return done(n, msgs)
}

// ─── quests ───────────────────────────────────────────────────────────────

export type QuestProgress = { have: number; need: number; label: string; ready: boolean }

export function questProgress(s: GameState, q: Quest): QuestProgress {
  const o = q.objective
  const cap = (have: number, need: number, label: string): QuestProgress => ({ have: Math.min(have, need), need, label, ready: have >= need })
  switch (o.kind) {
    case "bring": return cap(have(s, o.item), o.qty, `${item(o.item).name}`)
    case "hearts": return cap(hearts(s, o.id), o.n, `hearts with ${resident(o.id)?.name ?? o.id}`)
    case "craft": return cap(s.made[o.item] ?? 0, 1, `make ${item(o.item).name}`)
    case "harvest": return cap(s.stats.harvests, o.n, "harvests")
    case "fish": return cap(s.stats.fished, o.n, "fish caught")
    case "play": return cap(s.stats.played, o.n, "mini games played")
    case "favors": return cap(s.stats.favors, o.n, "favors done")
  }
}

/** Quests whose giver is in reach and trusts you, in the cast's order. */
export function visibleQuests(s: GameState): Quest[] {
  return QUESTS.filter((q) => {
    const r = resident(q.giver)
    return !!r && r.act <= act(s) && hearts(s, q.giver) >= 2
  })
}

export function claimQuest(s: GameState, id: string): Result {
  const q = QUESTS.find((x) => x.id === id)
  if (!q) return no(s, "No such quest.")
  if (s.questsDone[id]) return no(s, "Already done.")
  const p = questProgress(s, q)
  if (!p.ready) return no(s, `Not yet: ${p.have}/${p.need} ${p.label}.`)
  const n = clone(s)
  if (q.objective.kind === "bring") bag(n, q.objective.item, -q.objective.qty)
  n.questsDone[id] = true
  const thanks = payOut(n, q.reward.buttons)
  for (const [it, qty] of q.reward.items ?? []) bag(n, it, qty)
  if (q.trust) addTrust(touch(n, q.giver), q.trust)
  noteToday(n, `Finished "${q.title}" for ${resident(q.giver)?.name}.`)
  remember(n.characters, q.giver, n.day, "quest", `saw "${q.title}" finished`)
  const msgs: Msg[] = [{ text: `Quest done: ${q.title} (+${thanks}).`, tone: "good" }]
  const lesson = LESSONS[id]
  if (lesson) msgs.push({ text: `${lesson.idea}: ${lesson.lesson}`, tone: "info" })
  sweepLog(n, msgs)
  return done(n, msgs, true, q.thanks)
}

// ─── real life, told to the friends ───────────────────────────────────────

export const REAL_MAX = 8

export function addRealTask(s: GameState, text: string, urgent: boolean): Result {
  const clean = text.trim().replace(/\s+/g, " ").slice(0, 140)
  if (!clean) return no(s, "Tell them what is on your mind first.")
  if (s.real.filter((t) => !t.done).length >= REAL_MAX) return no(s, "That's plenty for the friends to hold. Finish one first.")
  const n = clone(s)
  n.real.push({ id: `r${s.day}-${s.real.length}-${clean.length}`, text: clean, urgent, done: false, added: s.day })
  noteToday(n, `Told the friends about something real: "${clean}".`)
  return done(n, [{ text: urgent ? "The friends take it seriously. They head for the fire." : "The friends make a note.", tone: "info" }])
}

export function setRealPlan(s: GameState, id: string, plan: string[]): GameState {
  const n = clone(s)
  const t = n.real.find((x) => x.id === id)
  if (t) t.plan = plan.slice(0, 4).map((p) => p.slice(0, 120))
  return n
}

/** Done in real life, marked here. Everyone who knows you cheers: a little trust, some gems, a spot in the diary. */
export function completeRealTask(s: GameState, id: string): Result {
  const t = s.real.find((x) => x.id === id)
  if (!t || t.done) return no(s, "Nothing to finish there.")
  const n = clone(s)
  n.real = n.real.map((x) => (x.id === id ? { ...x, done: true, urgent: false } : x))
  const reward = payOut(n, t.urgent ? 18 : 10)
  for (const [rid, a] of Object.entries(n.animals)) if (resident(rid)) addTrust(a, 2)
  noteToday(n, `The real thing got done: "${t.text}". Everyone cheered.`)
  return done(n, [{ text: `Done in real life! The whole village cheers. (+${reward}, +2 trust everywhere)`, tone: "good" }])
}

export function dropRealTask(s: GameState, id: string): GameState {
  const n = clone(s)
  n.real = n.real.filter((x) => x.id !== id)
  return n
}

export const urgentCount = (s: GameState) => s.real.filter((t) => !t.done && t.urgent).length

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
