/**
 * lib/baby-game/chatter.ts — The Village Life BIMBY: friends talking to each other, reading, and minds rewritten
 *
 * Three small jobs, each with a closed output and a script behind it, like `llm.ts`:
 *  1. **Talk.** Two friends meet (`sim.ts` queues them). `scriptedTalk` or `talkWithModel` writes a few lines between
 *     them from their minds: a goal, something they read, a shared like, a belief, the weather. The model picks only
 *     a mood (warm, easy, prickly), whether they make a plan, and whether one helped the other's goal. `applyTalk`
 *     writes it into the save: the log (`GameState.chatter`), their bonds, goal progress, a `neighbor` memory each,
 *     and the plan as a one-off block in both schedules.
 *  2. **Reading.** `readWithModel` writes a sitting at the bookshelf in the friend's voice (`shelf.ts` has the rules
 *     and the script). The quote must really be in the pages, or it is replaced by the script's.
 *  3. **A mind from a description.** `mindWithModel` turns a few sentences the player typed into beliefs,
 *     motivations, likes, dislikes and goals (`mind.ts` `mindFromDescription` is the script).
 */

import { RESIDENTS, temper, type Resident } from "./cast"
import { characterBrief, remember, type Character } from "./character"
import type { GameState } from "./engine"
import type { ModelCall } from "@/lib/bim-flow/ollama"
import { addPlan, advanceGoal, blockAt, bump, mindFromDescription, placeLabel, PLACE_ZONES, tidyMind, ZONE_ACT, type Mind, type Place } from "./mind"
import { nextSpan, pageAt, scriptedReading, type Book, type Reading } from "./shelf"
import { TILE, ZONES, zoneAt } from "./world"

export type TalkLine = { who: string; say: string }

export type Talk = {
  id: string
  day: number
  minute: number
  a: string
  b: string
  /** Zone name where they met. */
  where: string
  topic: string
  mood: "warm" | "easy" | "prickly"
  lines: TalkLine[]
  /** Plain notes of what it changed: "Bond +2", "Plan: …". */
  changed: string[]
  by: "model" | "scripted"
}

export const CHATTER_MAX = 300
const MOODS = ["warm", "easy", "prickly"] as const
const PLAN_PLACES = ["none", "fire", "spot", ...PLACE_ZONES.map((z) => `zone:${z}`)] as const

const name = (id: string) => RESIDENTS.find((r) => r.id === id)?.name ?? id
const pickOf = <T,>(xs: readonly T[], n: number): T => xs[((n % xs.length) + xs.length) % xs.length]!

export function whereOf(x: number, y: number): string {
  const z = zoneAt(Math.floor(x / TILE), Math.floor(y / TILE))
  return z ? ZONES[z].name : "the wild wood"
}

/** Their latest reading memory, if it is from today or yesterday. */
function lastRead(c: Character | undefined, day: number): string | null {
  const m = [...(c?.memory ?? [])].reverse().find((x) => x.kind === "read")
  return m && day - m.day <= 1 ? m.text.replace(/^read /, "") : null
}

const OPEN = {
  gentle: ["Oh, hello, {b}.", "{b}. It's nice to see you.", "Hi, {b}. Quiet day, isn't it?"],
  playful: ["{b}!! Hi hi hi!", "Ooh, {b}! Guess what!", "Tag! You're it, {b}! Just kidding. Hi!"],
  direct: ["{b}.", "Hey, {b}. Got a minute?", "{b}. Good, you're here."],
  coach: ["{b}! Good to see you up and about!", "Hey {b}, how's it going?", "{b}! Just the friend I wanted."],
} as const

const AGREE = {
  gentle: ["That's lovely.", "I think so too, softly.", "Mm. Yes."],
  playful: ["YES. Exactly!", "Ha! Same!", "Oh that's so good."],
  direct: ["Fair.", "Agreed.", "Makes sense."],
  coach: ["Love that!", "That's the spirit!", "Exactly right."],
} as const

const DOUBT = {
  gentle: ["I'm not sure I see it that way, but I'm listening.", "Hmm. Maybe."],
  playful: ["Nope! Wrong! Kidding. Mostly.", "Hmm, that sounds made up!"],
  direct: ["I don't buy it.", "No. I don't think so."],
  coach: ["I hear you. I'd push back a little.", "Not sure. Let's see how it goes."],
} as const

const BYE = {
  gentle: ["See you later.", "Take care, okay?"],
  playful: ["Bye bye bye!", "Race you later!"],
  direct: ["Right. See you.", "Later."],
  coach: ["Go get 'em!", "Proud of you. See you!"],
} as const

/**
 * A talk with no model. The opener picks the strongest topic one of them has: something they read, a goal, a shared
 * like, a belief, or just the day. Mood follows their bond; a warm talk between good friends may make a plan.
 */
export function scriptedTalk(s: GameState, a: string, b: string, where: string, pick: number): Omit<Talk, "id" | "changed"> & { plan?: { place: Place; doing: string }; helped?: string } {
  const ra = RESIDENTS.find((r) => r.id === a)!
  const rb = RESIDENTS.find((r) => r.id === b)!
  const ma = s.minds?.[a]
  const mb = s.minds?.[b]
  const ta = temper(a).tone
  const tb = temper(b).tone
  const bond = ((ma?.bonds[b] ?? 0) + (mb?.bonds[a] ?? 0)) / 2
  const mood: Talk["mood"] = bond >= 3 || pick % 5 === 0 ? "warm" : bond <= -2 ? "prickly" : "easy"
  const sub = (t: string) => t.replace("{b}", rb.name)
  const lines: TalkLine[] = [{ who: a, say: sub(pickOf(OPEN[ta], pick)) }]
  const shared = (ma?.likes ?? []).filter((x) => mb?.likes.includes(x))
  const read = lastRead(s.characters?.[a], s.day)
  const goal = ma?.goals.find((g) => g.progress < 100)
  let topic = "the day"
  let helped: string | undefined
  const nod = mood === "prickly" ? pickOf(DOUBT[tb], pick) : pickOf(AGREE[tb], pick)
  if (read && pick % 3 !== 2) {
    const title = read.match(/"([^"]+)"/)?.[1] ?? "a book"
    const quote = read.match(/"([^"]{10,})"\s*$/)?.[1] ?? read.split(": ").slice(1).join(": ")
    topic = `reading ${title}`
    lines.push({ who: a, say: `I've been reading ${title}. One line keeps coming back: "${quote.slice(0, 110)}${quote.length > 110 ? "…" : ""}"` })
    lines.push({ who: b, say: mood === "prickly" ? `${nod} Books say a lot of things.` : `${nod} Will you lend it to me after?` })
  } else if (goal && pick % 2 === 0) {
    topic = goal.text
    lines.push({ who: a, say: `I'm still trying to: ${goal.text.replace(/[.!?]$/, "").toLowerCase()}.` })
    if (mood === "warm") {
      helped = goal.id
      lines.push({ who: b, say: `${nod} I'll keep an eye out for you. We'll get there.` })
    } else lines.push({ who: b, say: mood === "prickly" ? `${nod} Good luck with that.` : `${nod} Tell me how it goes.` })
  } else if (shared.length) {
    const like = pickOf(shared, pick)
    topic = like
    lines.push({ who: a, say: `Have you had any ${like} lately? I keep thinking about ${like}.` })
    lines.push({ who: b, say: `${pickOf(AGREE[tb], pick + 1)} ${like} is the best part of a day.` })
  } else if (ma?.beliefs[0]) {
    const belief = ma.beliefs[ma.beliefs.length - 1]!
    topic = "what they believe"
    lines.push({ who: a, say: belief.length > 140 ? `${belief.slice(0, 137)}…` : belief })
    lines.push({ who: b, say: mb?.beliefs[0] && mood !== "warm" ? `${nod} I think ${mb.beliefs[0].charAt(0).toLowerCase()}${mb.beliefs[0].slice(1, 120)}` : nod })
  } else {
    lines.push({ who: a, say: s.weather === "rain" ? "Some rain, huh?" : "Nice out today." })
    lines.push({ who: b, say: nod })
  }
  const hour = Math.floor(s.minutes / 60) % 24
  let plan: { place: Place; doing: string } | undefined
  if (mood === "warm" && bond >= 2 && hour < 20 && pick % 3 === 0) {
    plan = hour >= 16 ? { place: "fire", doing: `meeting ${rb.name} at the fire` } : { place: "zone:meadow", doing: `a walk in the meadow with ${rb.name}` }
    lines.push({ who: a, say: plan.place === "fire" ? "See you at the fire in a bit?" : "Walk in the meadow later? In an hour?" })
    lines.push({ who: b, say: pickOf(AGREE[tb], pick + 2) })
  }
  lines.push({ who: b, say: pickOf(BYE[tb], pick) })
  return { day: s.day, minute: s.minutes, a, b, where, topic, mood, lines, by: "scripted", plan, helped }
}

/** Write a talk into the save: the log, bonds, goal progress, memories, a shared plan. Pure. */
export function applyTalk(s0: GameState, t: Omit<Talk, "id" | "changed"> & { plan?: { place: Place; doing: string }; helped?: string }): GameState {
  const s = structuredClone(s0)
  const changed: string[] = []
  const delta = t.mood === "warm" ? 2 : t.mood === "easy" ? 1 : -1
  bump(s.minds, t.a, t.b, delta)
  changed.push(`Bond ${delta > 0 ? "+" : ""}${delta}`)
  if (t.helped && advanceGoal(s.minds, t.a, t.helped, 20)) changed.push(`${name(t.a)} finished a goal`)
  else if (t.helped) changed.push(`${name(t.a)}'s goal +20%`)
  for (const [me, you] of [[t.a, t.b], [t.b, t.a]] as const) {
    const m = s.minds[me]
    const g = m?.goals.find((x) => x.id === "friend" && x.text.includes(name(you)))
    if (g && t.mood !== "prickly") advanceGoal(s.minds, me, "friend", t.mood === "warm" ? 15 : 8)
  }
  const hour = Math.floor(s.minutes / 60) % 24
  if (t.plan && t.plan.place !== ("none" as string)) {
    const plan = { day: s.day, from: (hour + 1) % 24, to: (hour + 2) % 24, doing: t.plan.doing, place: t.plan.place, why: `planned with ${name(t.b)}` }
    addPlan(s.minds, t.a, plan)
    addPlan(s.minds, t.b, { ...plan, why: `planned with ${name(t.a)}`, doing: t.plan.doing.replace(name(t.b), name(t.a)) })
    changed.push(`Plan at ${plan.from}:00: ${t.plan.doing}`)
  }
  const gist = t.topic === "the day" ? "the weather" : t.topic
  remember(s.characters, t.a, s.day, "neighbor", `talked with ${name(t.b)} about ${gist} (${t.mood})`)
  remember(s.characters, t.b, s.day, "neighbor", `talked with ${name(t.a)} about ${gist} (${t.mood})`)
  const talk: Talk = { id: `${s.day}-${s.minutes}-${t.a}-${t.b}`, day: t.day, minute: t.minute, a: t.a, b: t.b, where: t.where, topic: t.topic, mood: t.mood, lines: t.lines, changed, by: t.by }
  s.chatter = [...(s.chatter ?? []), talk].slice(-CHATTER_MAX)
  return s
}

/** The paragraph a model gets about one friend's inner life. */
export function mindBrief(m: Mind | undefined, s: GameState): string {
  if (!m) return ""
  const now = blockAt(m, s.day, Math.floor(s.minutes / 60) % 24)
  return [
    `About you: ${m.description}`,
    m.beliefs.length ? `You believe: ${m.beliefs.join(" / ")}` : "",
    m.motivations.length ? `What drives you: ${m.motivations.join("; ")}.` : "",
    m.likes.length ? `You like ${m.likes.join(", ")}; you dislike ${m.dislikes.join(", ") || "little"}.` : "",
    m.goals.length ? `Your goals: ${m.goals.map((g) => `${g.text} (${g.progress}%)`).join("; ")}.` : "",
    now ? `Right now you are meant to be ${now.doing} at ${placeLabel(now.place)}.` : "",
  ].filter(Boolean).join("\n")
}

const TALK_SCHEMA = (a: string, b: string) => ({
  type: "object",
  properties: {
    topic: { type: "string", maxLength: 60 },
    mood: { type: "string", enum: [...MOODS] },
    lines: { type: "array", minItems: 2, maxItems: 6, items: { type: "object", properties: { who: { type: "string", enum: [a, b] }, say: { type: "string", maxLength: 200 } }, required: ["who", "say"] } },
    plan: { type: "string", enum: [...PLAN_PLACES] },
    planDoing: { type: "string", maxLength: 60 },
    helped: { type: "boolean" },
  },
  required: ["topic", "mood", "lines", "plan", "helped"],
})

function who(r: Resident, c: Character | undefined, m: Mind | undefined, s: GameState, other: string): string {
  return [
    `${r.name} (id "${r.id}"), a baby ${r.id}. Voice: ${temper(r.id).tone}, ${temper(r.id).cadence}.`,
    c ? characterBrief(c, 5) : "",
    mindBrief(m, s),
    `Feeling toward ${name(other)}: ${m?.bonds[other] ?? 0} on a scale of -10 to 10.`,
  ].filter(Boolean).join("\n")
}

/** A talk written by the model; the script when there is none or it answers badly. Never throws. */
export async function talkWithModel(s: GameState, a: string, b: string, where: string, call: ModelCall | null, pick: number): Promise<ReturnType<typeof scriptedTalk>> {
  const script = scriptedTalk(s, a, b, where, pick)
  if (!call) return script
  const ra = RESIDENTS.find((r) => r.id === a)!
  const rb = RESIDENTS.find((r) => r.id === b)!
  const hour = Math.floor(s.minutes / 60) % 24
  try {
    const raw = (await call({
      system: [
        "You write a tiny overheard conversation between two baby animals in Valdivia, a cozy hidden valley. Nobody else is there.",
        `They just bumped into each other at ${where}. It is about ${hour}:00 and ${s.weather === "rain" ? "raining" : "dry"}.`,
        "Each speaks in their own voice, from what they believe, want, like and remember. Talk about something real to them: a goal, something they read, each other, the day. Keep every line short. 3 to 6 lines, alternating.",
        "mood: how it went. plan: a place they agree to meet next hour, or none. helped: true only if the second one offered real help with the first one's goal.",
        "Never invent items, quests, or new characters. Never mention being an AI.",
        `--- First speaker ---\n${who(ra, s.characters?.[a], s.minds?.[a], s, b)}`,
        `--- Second speaker ---\n${who(rb, s.characters?.[b], s.minds?.[b], s, a)}`,
      ].join("\n"),
      user: `Write what ${ra.name} and ${rb.name} say.`,
      schema: TALK_SCHEMA(a, b),
      maxTokens: 420,
    })) as Record<string, unknown> | null
    const lines = Array.isArray(raw?.lines)
      ? (raw!.lines as Array<Record<string, unknown>>).filter((l) => (l.who === a || l.who === b) && typeof l.say === "string" && l.say.trim()).map((l) => ({ who: l.who as string, say: (l.say as string).trim().slice(0, 220) })).slice(0, 6)
      : []
    if (lines.length < 2) return script
    const mood = MOODS.includes(raw!.mood as Talk["mood"]) ? (raw!.mood as Talk["mood"]) : script.mood
    const planPlace = typeof raw!.plan === "string" && raw!.plan !== "none" && (PLAN_PLACES as readonly string[]).includes(raw!.plan) ? (raw!.plan as Place) : null
    const reachable = planPlace && (!planPlace.startsWith("zone:") || (ZONE_ACT[planPlace.slice(5) as keyof typeof ZONE_ACT] ?? 9) <= Math.min(ra.act, rb.act) + 1)
    const doing = typeof raw!.planDoing === "string" && raw!.planDoing.trim() ? raw!.planDoing.trim().slice(0, 60) : planPlace ? `meeting ${rb.name} at ${placeLabel(planPlace)}` : ""
    const goal = s.minds?.[a]?.goals.find((g) => g.progress < 100)
    return {
      ...script,
      topic: typeof raw!.topic === "string" && raw!.topic.trim() ? raw!.topic.trim().slice(0, 60) : script.topic,
      mood,
      lines,
      by: "model",
      plan: reachable && hour < 21 ? { place: planPlace!, doing } : undefined,
      helped: raw!.helped === true && goal ? goal.id : undefined,
    }
  } catch {
    return script
  }
}

const FEELINGS = ["moved", "thoughtful", "puzzled", "delighted", "unsettled", "sleepy"] as const
const READ_PLACES = ["none", "home", "fire", "spot", ...PLACE_ZONES.map((z) => `zone:${z}`)] as const

const READ_SCHEMA = {
  type: "object",
  properties: {
    takeaway: { type: "string", maxLength: 240 },
    quote: { type: "string", maxLength: 200 },
    feeling: { type: "string", enum: [...FEELINGS] },
    belief: { type: "string", maxLength: 160 },
    goal: { type: "string", maxLength: 120 },
    plan: { type: "string", enum: [...READ_PLACES] },
    planDoing: { type: "string", maxLength: 60 },
  },
  required: ["takeaway", "quote", "feeling", "belief", "goal", "plan"],
}

type Sitting = ReturnType<typeof scriptedReading>

/** A sitting at the bookshelf in the friend's own voice; the script when the model is missing or misquotes. Never throws. */
export async function readWithModel(s: GameState, id: string, book: Book, text: string, act: number, call: ModelCall | null): Promise<Sitting> {
  const script = scriptedReading(s, id, book, text, act)
  if (!call) return script
  const r = RESIDENTS.find((x) => x.id === id)!
  const span = nextSpan(book, text)
  const passage = text.slice(span.from, span.to)
  try {
    const raw = (await call({
      system: [
        `You are ${r.name}, a baby ${r.id} in Valdivia, sitting at the bookshelf in your home reading "${book.title}", pages ${pageAt(book, span.from)} to ${pageAt(book, span.to - 1)}.`,
        characterBrief(s.characters[id]!, 4),
        mindBrief(s.minds?.[id], s),
        "takeaway: one or two short sentences in your own voice about what stayed with you, and why it matters to you.",
        "quote: a short phrase copied exactly from the pages.",
        "belief: a belief this changed or gave you, in your words, or an empty string. goal: a small new goal it gave you, or an empty string.",
        "plan: where it makes you want to go next hour, or none; planDoing says what you'll do there.",
        "Be honest: if the pages are dull or confusing, say so in character. Never mention being an AI.",
      ].join("\n"),
      user: `The pages:\n"""\n${passage}\n"""`,
      schema: READ_SCHEMA,
      maxTokens: 360,
    })) as Record<string, unknown> | null
    const takeaway = typeof raw?.takeaway === "string" ? raw.takeaway.trim().slice(0, 260) : ""
    if (!takeaway) return script
    const norm = (t: string) => t.toLowerCase().replace(/\s+/g, " ")
    const q = typeof raw!.quote === "string" ? raw!.quote.trim().replace(/^["“]|["”]$/g, "") : ""
    const quote = q.length >= 6 && norm(passage).includes(norm(q)) ? q : script.quote
    const place = typeof raw!.plan === "string" && raw!.plan !== "none" && (READ_PLACES as readonly string[]).includes(raw!.plan) ? (raw!.plan as Place) : null
    const reachable = place && (!place.startsWith("zone:") || (ZONE_ACT[place.slice(5) as keyof typeof ZONE_ACT] ?? 9) <= act)
    const str = (k: string, max: number) => (typeof raw![k] === "string" ? (raw![k] as string).trim().slice(0, max) : "")
    return {
      ...script,
      takeaway,
      quote,
      feeling: FEELINGS.includes(raw!.feeling as (typeof FEELINGS)[number]) ? (raw!.feeling as string) : script.feeling,
      belief: str("belief", 160) || undefined,
      goal: str("goal", 120) || undefined,
      plan: reachable ? { place: place!, doing: str("planDoing", 60) || `go to ${placeLabel(place!)}` } : undefined,
      by: "model",
    }
  } catch {
    return script
  }
}

const MIND_SCHEMA = {
  type: "object",
  properties: {
    beliefs: { type: "array", maxItems: 5, items: { type: "string", maxLength: 160 } },
    motivations: { type: "array", maxItems: 4, items: { type: "string", maxLength: 120 } },
    likes: { type: "array", maxItems: 6, items: { type: "string", maxLength: 40 } },
    dislikes: { type: "array", maxItems: 5, items: { type: "string", maxLength: 40 } },
    goals: { type: "array", maxItems: 4, items: { type: "string", maxLength: 120 } },
    social: { type: "boolean" },
  },
  required: ["beliefs", "motivations", "likes", "dislikes", "goals", "social"],
}

/** A mind rewritten from the player's description; the keyword script when the model is missing. Never throws. */
export async function mindWithModel(c: Character, prev: Mind, description: string, call: ModelCall | null): Promise<Mind> {
  const script = mindFromDescription(c, prev, description)
  if (!call) return script
  try {
    const raw = (await call({
      system: [
        `You turn a short description of a baby animal villager into their inner life. They are ${c.name}, a baby ${c.looks.species}.`,
        "beliefs: what they hold true, each a short sentence in their voice. motivations: what drives them. likes and dislikes: short noun phrases.",
        "goals: small concrete things they are trying to do in the valley. social: true if they seek company.",
        "Stay true to the description. Never invent quests or items.",
      ].join("\n"),
      user: description.slice(0, 1200),
      schema: MIND_SCHEMA,
      maxTokens: 500,
    })) as Record<string, unknown> | null
    const list = (k: string) => (Array.isArray(raw?.[k]) ? (raw![k] as unknown[]).filter((x): x is string => typeof x === "string" && !!x.trim()) : [])
    if (!list("beliefs").length && !list("likes").length) return script
    return tidyMind({
      ...script,
      beliefs: list("beliefs").length ? list("beliefs") : script.beliefs,
      motivations: list("motivations").length ? list("motivations") : script.motivations,
      likes: list("likes").length ? list("likes") : script.likes,
      dislikes: list("dislikes").length ? list("dislikes") : script.dislikes,
      goals: list("goals").length ? [...list("goals").map((t, i) => ({ id: `d${i}`, text: t, progress: 0 })), ...prev.goals.filter((g) => g.id === "quest")] : script.goals,
      by: "model",
    })
  } catch {
    return script
  }
}

export type { Reading }
