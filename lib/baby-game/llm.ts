/**
 * lib/baby-game/llm.ts — The model as a voice, never the rules (a BIMBY for the game)
 *
 * Three small jobs, each with a closed output:
 *  1. **Free talk.** You type a line to a friend. The model answers in character, and picks only from closed
 *     lists: a feeling, a trust nudge of −1..2, and which *true* fact to share (`none | wants | likes | clue`).
 *     `engine.chat` clamps the nudge, caps it per day, and writes the fact itself from the cast. A model can
 *     never invent a quest, an item, or a heart.
 *  2. **Voicing.** Everything else a friend says (hellos, small talk, story beats, quests, thanks, gift and approach reactions) is first
 *     written by the game, then, when a model is up, *re-voiced* in the friend's own words (`voiceLine`). The rewrite is
 *     thrown away if it drops any item name or runs long, so facts survive; the script is the fallback.
 *  3. **The diary.** At bedtime the companion writes one short page from what actually happened (`GameState.today`).
 * No Ollama, no reply in time, or bad JSON: the same shapes come back from a script and `by` says `scripted`.
 * Transport is the one BIM chat already uses (`lib/bim-flow/chat-models.ts`, `ollama.ts`).
 */

import { characterBrief } from "./character"
import { chatCrew } from "@/lib/bim-flow/chat-models"
import { ollamaCall, type ModelCall } from "@/lib/bim-flow/ollama"
import { CONDITION_TEXT, RESIDENTS, type Resident, temper } from "./cast"
import { act as actOf, type ChatReply, hearts, isAsleep, type GameState, hour, scriptedDiary, tasteFact, type RealTask } from "./engine"
import { isTeaching, pathBrief, PATHS } from "./dharma"
import { isTheoryLine, THEORY, theoryBrief } from "./theory"
import { ITEMS } from "./items"
import { ECONOMY_SCHEMA, economySystem, inferEconomy, parseEconomy, type EconomySpec } from "./economy"
import { lifeBrief, type LifeContext } from "./life"
import { smallTalk } from "./lines"

const FEELINGS = ["warm", "curious", "shy", "grumpy", "delighted"] as const
const REVEALS = ["none", "wants", "likes", "clue"] as const
const CHAT_TIMEOUT_MS = 25_000
const MODE_KEY = "brain2-baby-game-llm"

export function llmEnabled(): boolean {
  try {
    return localStorage.getItem(MODE_KEY) !== "off"
  } catch {
    return true
  }
}

export function setLlmEnabled(on: boolean): void {
  try {
    localStorage.setItem(MODE_KEY, on ? "on" : "off")
  } catch {
    // private window: the switch just will not stick
  }
}

/** A model bound to this device's best local model, or null when there is none or the switch is off. */
export async function gameModel(): Promise<ModelCall | null> {
  if (!llmEnabled()) return null
  try {
    const crew = await chatCrew()
    return crew ? ollamaCall(crew.main, AbortSignal.timeout(CHAT_TIMEOUT_MS)) : null
  } catch {
    return null
  }
}

const REPLY_SCHEMA = {
  type: "object",
  properties: {
    say: { type: "string", maxLength: 180 },
    feeling: { type: "string", enum: [...FEELINGS] },
    trust: { type: "integer", minimum: -1, maximum: 2 },
    reveal: { type: "string", enum: [...REVEALS] },
  },
  required: ["say", "feeling", "trust", "reveal"],
}

const TONE_VOICE = {
  gentle: "soft, slow, kind; short sentences",
  playful: "bouncy, silly, full of exclamation marks",
  direct: "blunt, brief, dry; no flourish",
  coach: "warm and encouraging, like a good coach",
} as const

function chatSystem(r: Resident, s: GameState, h: number, life?: LifeContext): string {
  const t = temper(r.id)
  return [
    `You are ${r.name}, a baby ${r.id} in Valdivia, a cozy hidden valley of forests, still lakes and farm fields. ${r.bio}`,
    `Your voice is ${TONE_VOICE[t.tone]}. You are ${t.cadence === "quiet" ? "shy and say very little" : t.cadence === "eager" ? "eager and talkative" : "friendly"}.`,
    `The Hush has silenced the Evening Song since the Orb Lamp went dark. You miss it. You are talking to the Center of The World, the newcomer. You have ${h} of 10 hearts for them.`,
    `It is ${s.weather === "rain" ? "raining" : "dry"} and about ${hour(s)}:00.`,
    "Reply in character in at most two short sentences. Never say you are an AI. Never invent items, places, or promises.",
    `trust: 2 if the Center of The World was kind, specific, and spoke in a way you like; 1 if friendly; 0 if neutral; -1 only if rude.`,
    `reveal: "wants" only if they ask what you need; "likes" if they ask what you like; "clue" if they ask how to win your trust or when to visit; otherwise "none".`,
    s.characters?.[r.id] ? characterBrief(s.characters[r.id]!) : "",
    pathBrief(r.id),
    theoryBrief(r.id),
    lifeBrief(life),
  ]
    .filter(Boolean)
    .join("\n")
}

function validReply(raw: unknown): ChatReply | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  const say = typeof o.say === "string" ? o.say.trim().slice(0, 220) : ""
  if (!say) return null
  const reveal = REVEALS.includes(o.reveal as (typeof REVEALS)[number]) ? (o.reveal as ChatReply["reveal"]) : "none"
  const trust = typeof o.trust === "number" && Number.isFinite(o.trust) ? Math.max(-1, Math.min(2, Math.round(o.trust))) : 0
  return { say, trust, reveal, by: "model" }
}

const FRIENDLY = /\b(thank|thanks|love|like|friend|please|sorry|proud|nice|cute|sweet|lovely|care|kind|help)\b/i
const RUDE = /\b(stupid|dumb|hate|ugly|shut up|go away|useless)\b/i
const ASK_WANT = /\b(want|need|wish|looking for|help)\b/i
const ASK_LIKE = /\b(like|love|favou?rite|enjoy)\b/i
const ASK_CLUE = /\b(when|how|trust|best time|secret)\b/i

/** The no-model reply: same shape, keyword-shaped. */
export function scriptedReply(r: Resident, s: GameState, line: string, pick: number): ChatReply {
  const t = temper(r.id)
  const trust = RUDE.test(line) ? -1 : FRIENDLY.test(line) || line.toLowerCase().includes(r.name.toLowerCase()) ? 1 : 0
  const reveal: ChatReply["reveal"] = ASK_WANT.test(line) ? "wants" : ASK_CLUE.test(line) ? "clue" : ASK_LIKE.test(line) ? "likes" : "none"
  const base = smallTalk(t.tone, 0, s.weather, hour(s), pick)
  const say = reveal === "wants" ? r.quest : reveal === "clue" ? r.clue : reveal === "likes" ? `${tasteFact(r)}` : base
  return { say, trust, reveal, by: "scripted" }
}

/** One typed line to one friend. Never throws. */
export async function askAnimal(r: Resident, s: GameState, line: string, call: ModelCall | null, pick: number, life?: LifeContext): Promise<ChatReply> {
  const h = hearts(s, r.id)
  if (!call) return scriptedReply(r, s, line, pick)
  try {
    const raw = await call({ system: chatSystem(r, s, h, life), user: `The Center of The World says: "${line.slice(0, 240)}"`, schema: REPLY_SCHEMA, maxTokens: 160 })
    const reply = validReply(raw)
    if (reply) return reply
  } catch {
    // fall through to the script
  }
  return scriptedReply(r, s, line, pick)
}

/** What a scripted line is, for the voicing prompt. */
export function lineKind(r: Resident, line: string): string {
  if (line === r.hello) return "a first hello to a stranger"
  if (r.story.includes(line)) return "a story from your own past, told because you now trust them"
  if (line === r.quest) return "asking for what you need"
  if (line === r.clue) return "hinting at when and how they could win your trust"
  if (line === r.thanks) return "thanking them for bringing what you asked for"
  if (line === r.give) return "handing over your keepsake"
  if (isTheoryLine(r.id, line)) return "sharing a thought from your own politics about sharing and fairness; keep the named idea and any person or text it mentions"
  if (isTeaching(r.id, line)) return "sharing a thought from your own outlook; keep the named idea and any person or text it mentions"
  return "a little everyday talk"
}

const VOICE_SCHEMA = {
  type: "object",
  properties: { say: { type: "string", maxLength: 260 } },
  required: ["say"],
}

/** Every item name the script mentions, so a rewrite can be checked for dropping one. */
export function itemNamesIn(text: string): string[] {
  const low = text.toLowerCase()
  return Object.values(ITEMS).map((d) => d.name).filter((n) => low.includes(n.toLowerCase()))
}

/** A rewrite is kept only if it says everything the script did: every item name, every number, and not much more. */
export function keepsFacts(script: string, rewrite: string): boolean {
  const low = rewrite.toLowerCase()
  if (!rewrite.trim() || rewrite.length > script.length * 2.2 + 60) return false
  if (!itemNamesIn(script).every((n) => low.includes(n.toLowerCase()))) return false
  return (script.match(/\d+/g) ?? []).every((d) => rewrite.includes(d))
}

/**
 * Re-voice a scripted line in this friend's own words. `kind` says what is happening ("a story from them", "thanking you for
 * the items", "reacting to a gift"). Returns null when there is no model, it fails, or it changes the facts: keep the script.
 */
export async function voiceLine(r: Resident, s: GameState, script: string, kind: string, call: ModelCall | null, life?: LifeContext): Promise<string | null> {
  if (!call || !script.trim()) return null
  try {
    const raw = (await call({
      system: [
        chatSystem(r, s, hearts(s, r.id), life),
        `Rewrite the line below in your own voice, as ${kind}. Keep every fact: every item name, number, time and condition must stay exactly as written. Add no new promises, places, or items. At most two short sentences.`,
      ].join("\n"),
      user: `Line: "${script.slice(0, 400)}"`,
      schema: VOICE_SCHEMA,
      maxTokens: 160,
    })) as { say?: unknown }
    const out = typeof raw?.say === "string" ? raw.say.trim().replace(/^"|"$/g, "") : ""
    return keepsFacts(script, out) ? out.slice(0, 280) : null
  } catch {
    return null
  }
}

const DIARY_SCHEMA = {
  type: "object",
  properties: { entry: { type: "string", maxLength: 320 } },
  required: ["entry"],
}

/** The companion's page for tonight, from what really happened. */
export async function writeDiary(s: GameState, companion: string, tone: keyof typeof TONE_VOICE, call: ModelCall | null, life?: LifeContext): Promise<{ text: string; by: "model" | "scripted" }> {
  const script = { text: scriptedDiary(s, companion), by: "scripted" as const }
  if (!call || !s.today.length) return script
  try {
    const raw = (await call({
      system: [
        `You are ${companion}, a baby animal who follows the Center of The World around Valdivia and keeps a tiny diary.`,
        `Voice: ${TONE_VOICE[tone]}. Write one diary page of two or three short sentences about the day, using only the events listed. Do not invent events, names, or items.`,
        lifeBrief(life),
      ]
        .filter(Boolean)
        .join("\n"),
      user: `Day ${s.day}. Events:\n${s.today.map((x) => `- ${x}`).join("\n")}`,
      schema: DIARY_SCHEMA,
      maxTokens: 220,
    })) as { entry?: unknown }
    const text = typeof raw?.entry === "string" ? raw.entry.trim() : ""
    return text ? { text: text.slice(0, 360), by: "model" } : script
  } catch {
    return script
  }
}

// ─── the council: friends banding together over something real ───────────

export type CouncilLine = { who: string; name: string; say: string; by: "model" | "scripted" }
export type CouncilReply = { lines: CouncilLine[]; plan?: string[] }

/** Friends awake and in reach, closest first. */
export function councilMembers(s: GameState): Resident[] {
  return RESIDENTS.filter((r) => r.act <= actOf(s) && !isAsleep(r, s.minutes)).sort((a, b) => hearts(s, b.id) - hearts(s, a.id)).slice(0, 6)
}

const COUNCIL_LINES: Record<keyof typeof TONE_VOICE, string[]> = {
  gentle: ["That sounds heavy. Let's hold one small piece of it together.", "You don't have to do all of it today. Just the next soft step."],
  playful: ["Okay okay okay! Quest time! Tiny steps! Silly victory dance after!", "We believe in you SO LOUDLY."],
  direct: ["Pick the first step. Do it. Then the next.", "Ten minutes. Timer on. Go."],
  coach: ["You've done harder things. Start with two minutes and see.", "We're right here. Small steps, big day."],
}

export const SCRIPTED_PLAN = ["Take three slow breaths, then open it and just look at it.", "Do one small piece with your whole attention, and nothing else.", "When it's moving, rest your hands and tell us."]

/** The no-model council: the closest friends each say something in their tone, and a plain three-step plan. */
export function scriptedCouncil(s: GameState, task: RealTask | null, pick: number): CouncilReply {
  const members = councilMembers(s).slice(0, 3)
  const lines = members.map((r, i) => {
    const pool = COUNCIL_LINES[temper(r.id).tone]
    // The first friend speaks from their own outlook (`dharma.ts`); the others keep to their tone.
    const say = i === 0 && PATHS[r.id] ? PATHS[r.id]!.counsel : i === 1 && THEORY[r.id] ? THEORY[r.id]!.counsel : pool[(pick + i) % pool.length]!
    return { who: r.id, name: r.name, say, by: "scripted" as const }
  })
  if (task) lines.unshift({ who: members[0]?.id ?? "", name: members[0]?.name ?? "Everyone", say: `About "${task.text}": we're on it with you.`, by: "scripted" })
  return { lines: lines.slice(0, 4), plan: task ? SCRIPTED_PLAN : undefined }
}

const COUNCIL_SCHEMA = (ids: string[]) => ({
  type: "object",
  properties: {
    lines: {
      type: "array",
      maxItems: 3,
      items: { type: "object", properties: { who: { type: "string", enum: ids }, say: { type: "string", maxLength: 200 } }, required: ["who", "say"] },
    },
    plan: { type: "array", maxItems: 3, items: { type: "string", maxLength: 110 } },
  },
  required: ["lines", "plan"],
})

/**
 * The friends talk it over in plain text. `task` is something real the player told them; `line` is what the player just said
 * (may be empty). The model only chooses who speaks (from the awake friends), what they say, and up to three tiny steps.
 */
export async function councilTalk(s: GameState, task: RealTask | null, line: string, call: ModelCall | null, pick: number, life?: LifeContext): Promise<CouncilReply> {
  const members = councilMembers(s)
  if (!call || !members.length) return scriptedCouncil(s, task, pick)
  try {
    const raw = (await call({
      system: [
        "You are a group of baby animal friends in Valdivia who care about the Center of The World, their person. They have told you about something real in their life.",
        `The friends: ${members.map((r) => `${r.name} (a baby ${r.id}; voice: ${TONE_VOICE[temper(r.id).tone]}${PATHS[r.id] ? `; outlook: ${PATHS[r.id]!.idea}, ${PATHS[r.id]!.school}` : ""})`).join("; ")}.`,
        "Reply as up to three of the friends, each in their own voice, one or two short sentences, in plain text. Be kind, specific, and small: help them start, never lecture, never shame. You cannot do the task for them. Also give up to three tiny concrete steps (each under 110 characters) for the real task, shaped by calm attention: one thing at a time, a breath first. A friend may lightly draw on their own outlook, but never lecture or quote scripture you are unsure of.",
        lifeBrief(life),
      ]
        .filter(Boolean)
        .join("\n"),
      user: [task ? `The real task: "${task.text}"${task.urgent ? " (urgent)" : ""}.` : "No particular task right now.", line ? `The Center of The World says: "${line.slice(0, 240)}"` : "The Center of The World just sat down by the fire."].join("\n"),
      schema: COUNCIL_SCHEMA(members.map((r) => r.id)),
      maxTokens: 360,
    })) as { lines?: Array<{ who?: unknown; say?: unknown }>; plan?: unknown }
    const lines: CouncilLine[] = []
    for (const l of raw.lines ?? []) {
      const r = members.find((m) => m.id === l.who)
      const say = typeof l.say === "string" ? l.say.trim().slice(0, 220) : ""
      if (r && say && lines.length < 3) lines.push({ who: r.id, name: r.name, say, by: "model" })
    }
    if (!lines.length) return scriptedCouncil(s, task, pick)
    const plan = Array.isArray(raw.plan) ? raw.plan.filter((x): x is string => typeof x === "string" && !!x.trim()).slice(0, 3) : []
    return { lines, plan: task ? (plan.length ? plan : SCRIPTED_PLAN) : undefined }
  } catch {
    return scriptedCouncil(s, task, pick)
  }
}

export { CONDITION_TEXT }

/**
 * A world's economy from the player's own words. The model fills the closed `EconomySpec` shape, leaning toward gift and
 * socialist economies (`economySystem`); whatever it returns is clamped by `parseEconomy`. No model, or a bad answer:
 * the keyword reading (`inferEconomy`). Never throws.
 */
export async function generateEconomy(prompt: string, call: ModelCall | null): Promise<{ spec: EconomySpec; by: "model" | "scripted" }> {
  const guess = inferEconomy(prompt)
  if (!call || !prompt.trim()) return { spec: guess, by: "scripted" }
  try {
    const raw = await call({ system: economySystem(), user: `The player describes their world: "${prompt.slice(0, 600)}"`, schema: ECONOMY_SCHEMA, maxTokens: 700 })
    if (raw && typeof raw === "object" && "name" in raw) return { spec: parseEconomy({ ...(raw as object), id: `${guess.id.replace(/-custom$/, "")}-gen` }, guess), by: "model" }
  } catch {
    // fall through to the keyword reading
  }
  return { spec: guess, by: "scripted" }
}
