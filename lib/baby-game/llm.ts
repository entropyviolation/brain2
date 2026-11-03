/**
 * lib/baby-game/llm.ts — The model as a voice, never the rules (a BIMBY for the game)
 *
 * Two small jobs, each with a closed output:
 *  1. **Free talk.** You type a line to a friend. The model answers in character, and picks only from closed
 *     lists: a feeling, a trust nudge of −1..2, and which *true* fact to share (`none | wants | likes | clue`).
 *     `engine.chat` clamps the nudge, caps it per day, and writes the fact itself from the cast. A model can
 *     never invent a quest, an item, or a heart.
 *  2. **The diary.** At bedtime the companion writes one short page from what actually happened (`GameState.today`).
 * No Ollama, no reply in time, or bad JSON: the same shapes come back from a script and `by` says `scripted`.
 * Transport is the one BIM chat already uses (`lib/bim-flow/chat-models.ts`, `ollama.ts`).
 */

import { chatCrew } from "@/lib/bim-flow/chat-models"
import { ollamaCall, type ModelCall } from "@/lib/bim-flow/ollama"
import { CONDITION_TEXT, type Resident, temper } from "./cast"
import { type ChatReply, hearts, type GameState, hour, scriptedDiary, tasteFact } from "./engine"
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

function chatSystem(r: Resident, s: GameState, h: number): string {
  const t = temper(r.id)
  return [
    `You are ${r.name}, a baby ${r.id} in Mossmere Hollow, a cozy farm village. ${r.bio}`,
    `Your voice is ${TONE_VOICE[t.tone]}. You are ${t.cadence === "quiet" ? "shy and say very little" : t.cadence === "eager" ? "eager and talkative" : "friendly"}.`,
    `The Hush has silenced the Evening Song since the Hollow Lamp went dark. You miss it. You are talking to the Nestkeeper, the newcomer. You have ${h} of 10 hearts for them.`,
    `It is ${s.weather === "rain" ? "raining" : "dry"} and about ${hour(s)}:00.`,
    "Reply in character in at most two short sentences. Never say you are an AI. Never invent items, places, or promises.",
    `trust: 2 if the Nestkeeper was kind, specific, and spoke in a way you like; 1 if friendly; 0 if neutral; -1 only if rude.`,
    `reveal: "wants" only if they ask what you need; "likes" if they ask what you like; "clue" if they ask how to win your trust or when to visit; otherwise "none".`,
  ].join("\n")
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
export async function askAnimal(r: Resident, s: GameState, line: string, call: ModelCall | null, pick: number): Promise<ChatReply> {
  const h = hearts(s, r.id)
  if (!call) return scriptedReply(r, s, line, pick)
  try {
    const raw = await call({ system: chatSystem(r, s, h), user: `The Nestkeeper says: "${line.slice(0, 240)}"`, schema: REPLY_SCHEMA, maxTokens: 160 })
    const reply = validReply(raw)
    if (reply) return reply
  } catch {
    // fall through to the script
  }
  return scriptedReply(r, s, line, pick)
}

const DIARY_SCHEMA = {
  type: "object",
  properties: { entry: { type: "string", maxLength: 320 } },
  required: ["entry"],
}

/** The companion's page for tonight, from what really happened. */
export async function writeDiary(s: GameState, companion: string, tone: keyof typeof TONE_VOICE, call: ModelCall | null): Promise<{ text: string; by: "model" | "scripted" }> {
  const script = { text: scriptedDiary(s, companion), by: "scripted" as const }
  if (!call || !s.today.length) return script
  try {
    const raw = (await call({
      system: [
        `You are ${companion}, a baby animal who follows the Nestkeeper around Mossmere Hollow and keeps a tiny diary.`,
        `Voice: ${TONE_VOICE[tone]}. Write one diary page of two or three short sentences about the day, using only the events listed. Do not invent events, names, or items.`,
      ].join("\n"),
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

export { CONDITION_TEXT }
