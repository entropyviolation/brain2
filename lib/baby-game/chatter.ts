/**
 * lib/baby-game/chatter.ts — The Village Life BIMBY: friends talking to each other, reading, and minds rewritten
 *
 * Three small jobs, each with a closed output and a script behind it, like `llm.ts`:
 *  1. **Talk.** Two friends meet (`sim.ts` queues them). `talkSeed` picks what they will talk about: an idea one of
 *     them took from a book (`shelf.ts` `ideasOf`, the least-discussed first), else a belief. `talkWithModel` then
 *     plays it turn by turn (`TURNS`: bring it up, say it back and ask, explain with an example, push back, answer,
 *     land it), each turn a separate call made as that one speaker with only what they know, then one closing call
 *     for what each learned. `scriptedTalk` is the fallback. `applyTalk` writes the log (`GameState.chatter`), bonds,
 *     goal progress, a `neighbor` memory each (and what each learned), counts the idea as shared, and may adopt a
 *     belief.
 *  2. **Reading.** `readWithModel` writes a sitting at the bookshelf in the friend's voice (`shelf.ts` has the rules
 *     and the script): what the author claims, the idea explained to a younger friend, up to three named ideas, a
 *     question, and a rewritten digest of the book so far, with the player's gold examples as few-shot. The quote
 *     must really be in the pages, or it is replaced by the script's.
 *  3. **A mind from a description.** `mindWithModel` turns a few sentences the player typed into beliefs,
 *     motivations, likes, dislikes and goals (`mind.ts` `mindFromDescription` is the script).
 */

import { RESIDENTS, temper, type Resident } from "./cast"
import { characterBrief, remember, type Character } from "./character"
import type { GameState } from "./engine"
import type { ModelCall } from "@/lib/bim-flow/ollama"
import { addPlan, advanceGoal, BELIEFS_MAX, blockAt, bump, mindFromDescription, placeLabel, PLACE_ZONES, tidyMind, ZONE_ACT, type Mind, type Place } from "./mind"
import { goldShots, ideasOf, nextSpan, pageAt, scriptedReading, shareIdea, type Book, type Reading, type SittingInput } from "./shelf"
import { applyPitch, scriptedYes, studyOf } from "./study"
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
  /** What each one took from it, by friend id (deep talks). */
  learned?: Record<string, string>
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
export type TalkDraft = Omit<Talk, "id" | "changed"> & {
  plan?: { place: Place; doing: string }
  helped?: string
  /** The book idea they talked about, so it counts as shared. */
  share?: { who: string; bookId: string; name: string }
  /** Friends whose lesson is strong enough to become a belief. */
  adopt?: string[]
  /** `author` asked `reader` to read their manifesto and `yes` is what they said (`pitchWithModel`). */
  pitch?: { author: string; reader: string; yes: boolean }
}

export function scriptedTalk(s: GameState, a: string, b: string, where: string, pick: number): TalkDraft {
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
  const seed = talkSeed(s, a, b, pick)
  if (seed && seed.kind === "book" && seed.opener === a && pick % 3 !== 2) {
    topic = `${seed.idea.name} (${seed.book})`
    lines.push({ who: a, say: `In "${seed.book}" there's this idea, ${seed.idea.name}: ${seed.idea.gist}` })
    lines.push({ who: b, say: mood === "prickly" ? `${nod} But is that really so? What would it look like in the valley?` : `${nod} What would that look like here in the valley, though?` })
  } else if (read && pick % 3 !== 2) {
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
export function applyTalk(s0: GameState, t: TalkDraft): GameState {
  const s = t.share ? shareIdea(s0, t.share.who, t.share.bookId, t.share.name) : structuredClone(s0)
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
  for (const [me, you] of [[t.a, t.b], [t.b, t.a]] as const) {
    const text = t.learned?.[me]
    if (!text) continue
    remember(s.characters, me, s.day, "neighbor", `learned from ${name(you)}: ${text}`)
    const m = s.minds[me]
    if (m && t.adopt?.includes(me) && !m.beliefs.includes(text)) {
      s.minds[me] = { ...m, beliefs: [...m.beliefs, text].slice(-BELIEFS_MAX) }
      changed.push(`${name(me)} now believes: ${text}`)
    }
  }
  const asked = t.pitch ? applyPitch(s, t.pitch) : s
  if (asked !== s) {
    changed.push(t.pitch!.yes ? `${name(t.pitch!.reader)} will read ${name(t.pitch!.author)}'s manifesto` : `${name(t.pitch!.reader)} did not take the manifesto`)
    s.shelves = asked.shelves
    s.study = asked.study
    s.characters = asked.characters
  }
  const talk: Talk = { id: `${s.day}-${s.minutes}-${t.a}-${t.b}`, day: t.day, minute: t.minute, a: t.a, b: t.b, where: t.where, topic: t.topic, mood: t.mood, lines: t.lines, changed, by: t.by, ...(t.learned ? { learned: t.learned } : {}) }
  s.chatter = [...(s.chatter ?? []), talk].slice(-CHATTER_MAX)
  return s
}

const PITCH_SCHEMA = { type: "object", properties: { say: { type: "string", maxLength: 280 } }, required: ["say"] }
const REPLY_SCHEMA = { type: "object", properties: { say: { type: "string", maxLength: 280 }, yes: { type: "boolean" } }, required: ["say", "yes"] }

/** Asking a friend to read the manifesto, with no model: the author's pitch, the answer by temper, a thank you or a shrug. */
export function scriptedPitch(s: GameState, author: string, reader: string, where: string, pick: number): TalkDraft {
  const m = studyOf(s, author).manifesto!
  const ta = temper(author).tone
  const tr = temper(reader).tone
  const yes = scriptedYes(s, reader, author, pick)
  const lines: TalkLine[] = [
    { who: author, say: pickOf(OPEN[ta], pick).replace("{b}", name(reader)) },
    { who: author, say: `I'm writing a manifesto on ${m.topic}. It's called "${m.title}". ${m.thesis ? clipLine(m.thesis, 150) : ""} Would you read it?` },
    { who: reader, say: yes ? `${pickOf(AGREE[tr], pick)} Yes, put it on my shelf.` : `${pickOf(DOUBT[tr], pick)} Not now. Ask me another day.` },
    { who: author, say: yes ? "Thank you. Tell me where I'm wrong." : "That's fair. I'll ask again." },
  ]
  return { day: s.day, minute: s.minutes, a: author, b: reader, where, topic: `manifesto: ${m.title}`, mood: yes ? "warm" : "easy", lines, by: "scripted", pitch: { author, reader, yes } }
}

const clipLine = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1)}…` : t)

/**
 * The author, urged to share, asks a friend to read their manifesto (three calls: the ask, the answer in the
 * friend's own voice with a yes or no, the author's reply). A yes puts a copy on the friend's shelf (`applyTalk`).
 * The script when there is no model or it fails. Never throws.
 */
export async function pitchWithModel(s: GameState, author: string, reader: string, where: string, call: ModelCall | null, pick: number): Promise<TalkDraft> {
  const script = scriptedPitch(s, author, reader, where, pick)
  if (!call) return script
  const m = studyOf(s, author).manifesto!
  const R = (id: string) => RESIDENTS.find((r) => r.id === id)!
  const outline = m.outline.map((x) => x.title).join("; ")
  const lines: TalkLine[] = []
  const common = (me: string, you: string) => [`You are ${R(me).name}, in Valdivia, talking with ${R(you).name} at ${where}.`, who(R(me), s.characters?.[me], s.minds?.[me], s, you)]
  try {
    const ask = (await call({
      system: [
        ...common(author, reader),
        `You have been studying for a long time and are writing a manifesto, "${m.title}", on ${m.topic}. Your thesis: ${m.thesis ?? m.topic}. Its parts: ${outline}.`,
        "You are excited and want others to read it. Tell them what it is about, the claim you most want tested, and ask them to read it. One to three sentences, under 260 characters, in your own voice.",
      ].join("\n\n"),
      user: "Say it.",
      schema: PITCH_SCHEMA,
      maxTokens: 150,
      temperature: 0.8,
    })) as Record<string, unknown> | null
    const first = typeof ask?.say === "string" ? ask.say.trim().slice(0, 300) : ""
    if (!first) return script
    lines.push({ who: author, say: first })
    const reply = (await call({
      system: [
        ...common(reader, author),
        `${R(author).name} said: "${first}"`,
        `Decide as yourself whether you really want to read their manifesto "${m.title}" now. Say yes only if you would; say no kindly if you are busy, not curious about it, or do not much like them. Say it in one to three sentences, under 260 characters, and set "yes" to match what you said.`,
      ].join("\n\n"),
      user: "Answer them.",
      schema: REPLY_SCHEMA,
      maxTokens: 150,
      temperature: 0.8,
    })) as Record<string, unknown> | null
    const say = typeof reply?.say === "string" ? reply.say.trim().slice(0, 300) : ""
    if (!say || typeof reply?.yes !== "boolean") return script
    lines.push({ who: reader, say })
    const yes = reply.yes
    const close = (await call({
      system: [...common(author, reader), `${R(reader).name} answered: "${say}"`, yes ? "They will read it. Respond warmly and say what you hope they will push back on." : "They are not taking it now. Respond graciously.", "One sentence, under 200 characters."].join("\n\n"),
      user: "Reply.",
      schema: PITCH_SCHEMA,
      maxTokens: 100,
      temperature: 0.8,
    })) as Record<string, unknown> | null
    const end = typeof close?.say === "string" ? close.say.trim().slice(0, 240) : ""
    if (end) lines.push({ who: author, say: end })
    return { ...script, lines, by: "model", mood: yes ? "warm" : "easy", pitch: { author, reader, yes } }
  } catch {
    return lines.length >= 2 ? { ...script, lines, by: "model", pitch: undefined } : script
  }
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

export type TalkSeed = {
  /** Who brings it up, and who answers. */
  opener: string
  other: string
  kind: "book" | "belief"
  book: string
  bookId: string
  idea: { name: string; gist: string }
  /** What the opener has understood of the whole book so far. */
  digest?: string
}

const bookWords = (t: string) => new Set(t.toLowerCase().match(/[a-z]{4,}/g) ?? [])

/**
 * What two friends will talk about. An idea one of them took from a book, the least-discussed first (the one who has
 * talked about theirs less brings it up); with no books, the newest belief of whoever has one. Null when neither has
 * anything to say, and the talk is small talk.
 */
export function talkSeed(s: GameState, a: string, b: string, pick: number): TalkSeed | null {
  const ia = ideasOf(s, a)[0]
  const ib = ideasOf(s, b)[0]
  const useA = ia && (!ib || ia.shared < ib.shared || (ia.shared === ib.shared && pick % 2 === 0))
  const lead = useA ? ia : ib
  if (lead) {
    const opener = useA ? a : b
    const book = s.shelves?.[opener]?.find((x) => x.id === lead.bookId)
    return { opener, other: opener === a ? b : a, kind: "book", book: lead.book, bookId: lead.bookId, idea: { name: lead.name, gist: lead.gist }, digest: book?.digest }
  }
  const belief = (who: string) => s.minds?.[who]?.beliefs.slice(-1)[0]
  const opener = belief(a) && (pick % 2 === 0 || !belief(b)) ? a : belief(b) ? b : null
  if (!opener) return null
  return { opener, other: opener === a ? b : a, kind: "belief", book: "", bookId: "", idea: { name: "what I believe", gist: belief(opener)! } }
}

/** The responder's own idea closest to the seed's, if they read something that touches it. */
function relatedIdea(s: GameState, who: string, seed: TalkSeed): { name: string; gist: string; book: string; digest?: string } | null {
  const want = bookWords(`${seed.idea.name} ${seed.idea.gist}`)
  let best: { n: number; i: ReturnType<typeof ideasOf>[number] } | null = null
  for (const i of ideasOf(s, who)) {
    const n = [...bookWords(`${i.name} ${i.gist}`)].filter((w) => want.has(w)).length
    if (!best || n > best.n) best = { n, i }
  }
  if (!best) return null
  const book = s.shelves?.[who]?.find((x) => x.id === best!.i.bookId)
  return { name: best.i.name, gist: best.i.gist, book: best.i.book, digest: book?.digest }
}

/** The moves of a talk, in order. `o` is whoever brought the idea up, `r` the one answering. */
export const TURNS: Array<{ by: "o" | "r"; act: string }> = [
  { by: "o", act: "Bring up the idea in your own words. Name the book and the idea the way the author does, say what it claims, and why it grabbed you. No greeting." },
  { by: "r", act: "Say back what you understood in your own words, then ask ONE real question that would test it: a how, a why, or a what-if." },
  { by: "o", act: "Answer the question. Explain it with a concrete picture or example from life in the valley, and be honest about the part you are unsure of." },
  { by: "r", act: "Push back or build on it. Disagree with one specific part and say why, or connect it to something you believe or have read yourself (name it)." },
  { by: "o", act: "Take the objection seriously: concede what is fair, or hold your ground with a reason. Then turn it into a question for them." },
  { by: "r", act: "Land it. Say what you now think differently, or the one thing you will try or look at because of this. Be specific. Do not say goodbye." },
]

const TURN_SCHEMA = { type: "object", properties: { say: { type: "string", maxLength: 280 } }, required: ["say"] }

const CLOSE_SCHEMA = (a: string, b: string) => ({
  type: "object",
  properties: {
    mood: { type: "string", enum: [...MOODS] },
    topic: { type: "string", maxLength: 60 },
    learned: { type: "array", minItems: 2, maxItems: 2, items: { type: "object", properties: { who: { type: "string", enum: [a, b] }, text: { type: "string", maxLength: 170 }, adopt: { type: "boolean" } }, required: ["who", "text", "adopt"] } },
  },
  required: ["mood", "topic", "learned"],
})

function who(r: Resident, c: Character | undefined, m: Mind | undefined, s: GameState, other: string): string {
  return [
    `${r.name} (id "${r.id}"), a baby ${r.id}. Voice: ${temper(r.id).tone}, ${temper(r.id).cadence}.`,
    c ? characterBrief(c, 4) : "",
    mindBrief(m, s),
    `Feeling toward ${name(other)}: ${m?.bonds[other] ?? 0} on a scale of -10 to 10.`,
  ].filter(Boolean).join("\n")
}

/**
 * A talk played turn by turn, each line a separate call made as that one speaker, who knows only what they know (their
 * mind, and for the book idea their own digest and ideas), so they cannot simply agree with each other. A closing call
 * writes what each learned. The script when there is no model or it fails at the first turn; a talk that breaks later
 * simply ends where it got to. Never throws.
 */
export async function talkWithModel(s: GameState, a: string, b: string, where: string, call: ModelCall | null, pick: number): Promise<TalkDraft> {
  const script = scriptedTalk(s, a, b, where, pick)
  const seed = talkSeed(s, a, b, pick)
  if (!call || !seed) return script
  const hour = Math.floor(s.minutes / 60) % 24
  const R = (id: string) => RESIDENTS.find((r) => r.id === id)!
  const O = seed.opener
  const T = seed.other
  const lines: TalkLine[] = []
  const related = relatedIdea(s, T, seed)
  const knows = (id: string) => {
    if (seed.kind === "belief") return id === O ? `The thing you want to talk about is something you believe: ${seed.idea.gist}` : "You have not heard this before."
    if (id === O) return `You read "${seed.book}". What you have understood of it so far: ${seed.digest ?? "you are early in it"}\nThe idea you want to talk about: ${seed.idea.name}: ${seed.idea.gist}`
    return related
      ? `You have not read "${seed.book}". But you read "${related.book}", which touches it: ${related.name}: ${related.gist}${related.digest ? `\nYour understanding of that book: ${related.digest}` : ""}`
      : `You have not read "${seed.book}" and know nothing of it beyond what ${name(O)} says.`
  }
  try {
    for (const turn of TURNS) {
      const me = turn.by === "o" ? O : T
      const you = me === O ? T : O
      const raw = (await call({
        system: [
          `You are ${R(me).name}, in Valdivia, a cozy hidden valley, talking with ${R(you).name} at ${where}. It is about ${hour}:00 and ${s.weather === "rain" ? "raining" : "dry"}.`,
          who(R(me), s.characters?.[me], s.minds?.[me], s, you),
          knows(me),
          lines.length ? `So far:\n${lines.map((l) => `${name(l.who)}: ${l.say}`).join("\n")}` : "You are starting the conversation.",
          `Your move: ${turn.act}`,
          "Say one to three sentences, under 260 characters, in your own voice. Give real content: use the idea's own words, an actual argument or example, a specific question. No pleasantries, no repeating what was already said, no summarising the whole talk. Never invent a book or a quote. Never mention being an AI.",
        ].join("\n\n"),
        user: `Say your line, ${R(me).name}.`,
        schema: TURN_SCHEMA,
        maxTokens: 150,
        temperature: 0.8,
      })) as Record<string, unknown> | null
      const say = typeof raw?.say === "string" ? raw.say.trim().slice(0, 300) : ""
      if (!say) break
      lines.push({ who: me, say })
    }
    if (lines.length < 2) return script
    const closed = (await call({
      system: [
        `Two baby animals, ${R(O).name} and ${R(T).name}, just talked about ${seed.kind === "book" ? `an idea from "${seed.book}"` : "something one of them believes"}:`,
        lines.map((l) => `${name(l.who)}: ${l.say}`).join("\n"),
        "For each of them write one sentence, in their own first-person voice, of what they now take away: a changed view, a new distinction, or a question they will keep. Set adopt true only if it truly changed how they see things.",
        "mood: how it went, warm, easy or prickly.",
      ].join("\n\n"),
      user: "What did each of them learn?",
      schema: CLOSE_SCHEMA(O, T),
      maxTokens: 260,
      temperature: 0.4,
    })) as Record<string, unknown> | null
    const learned: Record<string, string> = {}
    const adopt: string[] = []
    for (const l of Array.isArray(closed?.learned) ? (closed!.learned as Array<Record<string, unknown>>) : []) {
      if ((l.who === O || l.who === T) && typeof l.text === "string" && l.text.trim()) {
        learned[l.who as string] = l.text.trim().slice(0, 180)
        if (l.adopt === true) adopt.push(l.who as string)
      }
    }
    return {
      ...script,
      a: O,
      b: T,
      topic: seed.kind === "book" ? `${seed.idea.name} (${seed.book})` : typeof closed?.topic === "string" && closed.topic.trim() ? closed.topic.trim().slice(0, 60) : "what they believe",
      mood: MOODS.includes(closed?.mood as Talk["mood"]) ? (closed!.mood as Talk["mood"]) : "warm",
      lines,
      by: "model",
      plan: undefined,
      helped: undefined,
      learned: Object.keys(learned).length ? learned : undefined,
      adopt,
      share: seed.kind === "book" ? { who: O, bookId: seed.bookId, name: seed.idea.name } : undefined,
    }
  } catch {
    return lines.length >= 2 ? { ...script, a: O, b: T, lines, by: "model", plan: undefined, helped: undefined, share: seed.kind === "book" ? { who: O, bookId: seed.bookId, name: seed.idea.name } : undefined } : script
  }
}

const FEELINGS = ["moved", "thoughtful", "puzzled", "delighted", "unsettled", "sleepy"] as const
const READ_PLACES = ["none", "home", "fire", "spot", ...PLACE_ZONES.map((z) => `zone:${z}`)] as const

const READ_SCHEMA = {
  type: "object",
  properties: {
    takeaway: { type: "string", maxLength: 340 },
    explain: { type: "string", maxLength: 300 },
    ideas: { type: "array", maxItems: 3, items: { type: "object", properties: { name: { type: "string", maxLength: 40 }, gist: { type: "string", maxLength: 170 } }, required: ["name", "gist"] } },
    question: { type: "string", maxLength: 170 },
    quote: { type: "string", maxLength: 200 },
    feeling: { type: "string", enum: [...FEELINGS] },
    belief: { type: "string", maxLength: 160 },
    goal: { type: "string", maxLength: 120 },
    plan: { type: "string", enum: [...READ_PLACES] },
    planDoing: { type: "string", maxLength: 60 },
    digest: { type: "string", maxLength: 600 },
  },
  required: ["takeaway", "explain", "ideas", "question", "quote", "feeling", "belief", "goal", "plan", "digest"],
}

type Sitting = SittingInput

const shotJson = (g: ReturnType<typeof goldShots>[number]["gold"]) => JSON.stringify({ takeaway: g.takeaway, explain: g.explain ?? "", ideas: g.ideas ?? [], question: g.question ?? "", quote: g.quote })

/**
 * A sitting at the bookshelf in the friend's own voice; the script when the model is missing or misquotes. Never throws.
 * They read with what they already understood of the book (its digest and ideas), say what the author claims before
 * what they feel about it, name ideas with the author's words, keep a question, and rewrite the digest. A player's
 * gold example, if there is one, goes in as the standard to meet.
 */
export async function readWithModel(s: GameState, id: string, book: Book, text: string, act: number, call: ModelCall | null): Promise<Sitting> {
  const script = scriptedReading(s, id, book, text, act)
  if (!call) return script
  const r = RESIDENTS.find((x) => x.id === id)!
  const span = nextSpan(book, text)
  const passage = text.slice(span.from, span.to)
  const shots = goldShots(s, id, 1)
  try {
    const raw = (await call({
      system: [
        `You are ${r.name}, a baby ${r.id} in Valdivia, sitting at the bookshelf in your home reading "${book.title}", pages ${pageAt(book, span.from)} to ${pageAt(book, span.to - 1)}.`,
        characterBrief(s.characters[id]!, 3),
        mindBrief(s.minds?.[id], s),
        book.digest ? `What you have understood of the book so far: ${book.digest}` : "You are at the start of this book.",
        (book.ideas ?? []).length ? `Ideas you already hold from it: ${(book.ideas ?? []).slice(-5).map((i) => `${i.name} (${i.gist})`).join("; ")}.` : "",
        "Read like a student who wants to really understand, not like a fan.",
        "takeaway: two or three sentences in your own voice. FIRST what the author is actually claiming or showing in these pages (use their terms; be specific), THEN what you make of it and why it matters to your own life. Never just say a line stayed with you.",
        "explain: how you would explain the main idea to a younger friend, using a picture from valley life.",
        "ideas: up to three distinct ideas or terms from THESE pages, each a short name (the author's own word where there is one) and a one-sentence plain gist. Empty if none.",
        "question: one real question these pages leave you with, something you could not answer yet or want to ask a friend.",
        "quote: a short phrase copied exactly from the pages.",
        "belief: a belief this changed or gave you, in your words, or an empty string. goal: a small new goal it gave you, or an empty string.",
        "plan: where it makes you want to go next hour, or none; planDoing says what you'll do there.",
        "digest: your updated understanding of the whole book so far, in under 90 words, folding in these pages.",
        "Be honest: if the pages are dull or confusing, say what confused you in character. Never mention being an AI.",
        ...shots.map((g) => `--- An example the player approved (pages from "${g.book}") ---\n"""${g.passage}"""\nGood answer: ${shotJson(g.gold)}${g.note ? `\nThe earlier attempt went wrong because: ${g.note}` : ""}`),
      ].filter(Boolean).join("\n"),
      user: `The pages:\n"""\n${passage}\n"""`,
      schema: READ_SCHEMA,
      maxTokens: 800,
      temperature: 0.3,
    })) as Record<string, unknown> | null
    const takeaway = typeof raw?.takeaway === "string" ? raw.takeaway.trim().slice(0, 360) : ""
    if (!takeaway) return script
    const norm = (t: string) => t.toLowerCase().replace(/\s+/g, " ")
    const q = typeof raw!.quote === "string" ? raw!.quote.trim().replace(/^["“]|["”]$/g, "") : ""
    const quote = q.length >= 6 && norm(passage).includes(norm(q)) ? q : script.quote
    const place = typeof raw!.plan === "string" && raw!.plan !== "none" && (READ_PLACES as readonly string[]).includes(raw!.plan) ? (raw!.plan as Place) : null
    const reachable = place && (!place.startsWith("zone:") || (ZONE_ACT[place.slice(5) as keyof typeof ZONE_ACT] ?? 9) <= act)
    const str = (k: string, max: number) => (typeof raw![k] === "string" ? (raw![k] as string).trim().slice(0, max) : "")
    const ideas = (Array.isArray(raw!.ideas) ? (raw!.ideas as Array<Record<string, unknown>>) : [])
      .filter((i) => typeof i.name === "string" && typeof i.gist === "string" && i.name.trim() && i.gist.trim())
      .map((i) => ({ name: (i.name as string).trim().slice(0, 40), gist: (i.gist as string).trim().slice(0, 170) }))
      .slice(0, 3)
    return {
      ...script,
      takeaway,
      quote,
      feeling: FEELINGS.includes(raw!.feeling as (typeof FEELINGS)[number]) ? (raw!.feeling as string) : script.feeling,
      explain: str("explain", 300) || undefined,
      question: str("question", 170) || undefined,
      ideas: ideas.length ? ideas : undefined,
      digest: str("digest", 600) || undefined,
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

/** Plain keyword fallback: the species line, then what they hold, love and want, as sentences. */
function describeFromMind(c: Character, m: Mind): string {
  const first = (xs: string[], n: number) => xs.slice(0, n).map((x) => x.trim().replace(/[.!?]+$/, "")).filter(Boolean)
  const parts = [`${c.name} is a baby ${c.looks.species}.`]
  const b = first(m.beliefs, 2)
  if (b.length) parts.push(`Believes ${b.map((x) => x.charAt(0).toLowerCase() + x.slice(1)).join("; ")}.`)
  const mo = first(m.motivations, 2)
  if (mo.length) parts.push(`Driven by ${mo.join(" and ")}.`)
  const l = first(m.likes, 3)
  if (l.length) parts.push(`Likes ${l.join(", ")}.`)
  const d = first(m.dislikes, 2)
  if (d.length) parts.push(`Dislikes ${d.join(" and ")}.`)
  return parts.join(" ")
}

/** A description written from the rest of the mind (the reverse of `mindWithModel`); keyword sentences when the model is missing. Never throws. */
export async function describeWithModel(c: Character, m: Mind, call: ModelCall | null): Promise<string> {
  const script = describeFromMind(c, m)
  if (!call) return script
  try {
    const raw = (await call({
      system: [
        `You write a short description of a baby animal villager from their inner life. They are ${c.name}, a baby ${c.looks.species}.`,
        "Write three or four plain sentences, third person, that a reader could rebuild the beliefs, motivations, likes, dislikes and goals from.",
        "Stay true to what is given. Never invent quests or items.",
      ].join("\n"),
      user: JSON.stringify({ beliefs: m.beliefs, motivations: m.motivations, likes: m.likes, dislikes: m.dislikes, goals: m.goals.map((g) => g.text), current: m.description }).slice(0, 2400),
      schema: { type: "object", properties: { description: { type: "string", maxLength: 600 } }, required: ["description"] },
      maxTokens: 300,
    })) as Record<string, unknown> | null
    const d = typeof raw?.description === "string" ? raw.description.trim() : ""
    return d || script
  } catch {
    return script
  }
}

export type { Reading }
