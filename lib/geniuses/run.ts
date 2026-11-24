/**
 * lib/geniuses/run.ts — Build the exact prompts, ask the model, check, fall back
 *
 * Three jobs, each one model call per genius: talk back (one turn of an argument about an assignment), a council ask,
 * and a council answer after hearing the others. Every result carries the exact system and user text that was sent and
 * the model's raw JSON, so the lab can show them. The model only phrases; code picks the task, checks the JSON and
 * writes nothing. Model calls go through `lib/bim-flow/` (read-only imports).
 */

import { escalate, type Hop } from "@/lib/bim-flow/crew"
import type { ModelCall } from "@/lib/bim-flow/ollama"
import { animalById } from "@/lib/baby-animals"
import { personalityFor, type FriendPersonality } from "@/lib/baby-animal-personality"
import { memoryLines, recall, type MemoryCaps } from "./memory"
import { ASK_SCHEMA, COUNCIL_REPLY_SCHEMA, fillPrompt, promptFor, VOICE_SCHEMA, type PromptOverrides, type PromptPair } from "./prompts"
import { areaLines, readArea, type AreaRead, type AreaVault } from "./read"
import { checkAsk, checkCouncilReply, checkReply, MAX_TURNS, scriptedReply, type Checked } from "./reply"
import type { CouncilAsk, CouncilMeeting, CouncilReply, Genius, GeniusReply, GeniusTalk, TalkLine } from "./types"

export type GeniusContext = {
  genius: Genius
  animal: string
  tone: string
  pushiness: string
  read: AreaRead
  memory: string
}

export function geniusContext(input: {
  genius: Genius
  vault: AreaVault
  personalities?: Record<string, FriendPersonality>
  talks: GeniusTalk[]
  meetings: CouncilMeeting[]
  names: Record<string, string>
  exceptTalkId?: string
  caps?: MemoryCaps
}): GeniusContext {
  const g = input.genius
  const p = personalityFor(input.personalities, g.animalId, g.name)
  return {
    genius: g,
    animal: animalById(g.animalId)?.young ?? (g.animalId || "animal"),
    tone: p.tone,
    pushiness: p.pushiness,
    read: readArea(g, input.vault),
    memory: memoryLines(g, recall(g, input.talks, input.meetings, input.caps, input.exceptTalkId), input.names),
  }
}

const baseSlots = (c: GeniusContext) => ({
  name: c.genius.name,
  animal: c.animal,
  area: c.genius.area,
  charter: c.genius.charter,
  tone: c.tone,
  pushiness: c.pushiness,
  memory: c.memory,
  areaRead: areaLines(c.read),
})

const fill = (pair: PromptPair, slots: Record<string, string | number>): PromptPair => ({ system: fillPrompt(pair.system, slots), user: fillPrompt(pair.user, slots) })

export const threadLines = (lines: TalkLine[], name: string): string =>
  lines.length ? lines.map((l) => `${l.who === "you" ? "THEM" : name.toUpperCase()}: ${l.text}`).join("\n") : "(nothing yet: you just offered it)"

/** The turn number this reply would be: one per thing they have said, counting the one being answered. */
export const turnOf = (lines: TalkLine[]): number => lines.filter((l) => l.who === "you").length + 1

export function voicePrompt(c: GeniusContext, talk: Pick<GeniusTalk, "task" | "lines">, said: string, overrides?: PromptOverrides, maxTurns = MAX_TURNS): PromptPair {
  const turn = Math.min(turnOf(talk.lines), maxTurns)
  return fill(promptFor("voice", overrides), {
    ...baseSlots(c),
    task: talk.task,
    thread: threadLines(talk.lines, c.genius.name),
    said: said.trim(),
    turn,
    maxTurns,
    lastTurn: turn >= maxTurns ? " It is the last one: you must concede or reschedule." : "",
  })
}

export function askPrompt(c: GeniusContext, topic: string, overrides?: PromptOverrides): PromptPair {
  return fill(promptFor("councilAsk", overrides), { ...baseSlots(c), topic })
}

export function councilReplyPrompt(c: GeniusContext, topic: string, asks: CouncilAsk[], names: Record<string, string>, overrides?: PromptOverrides): PromptPair {
  const mine = asks.find((a) => a.geniusId === c.genius.id)
  const others = asks.filter((a) => a.geniusId !== c.genius.id)
  return fill(promptFor("councilReply", overrides), {
    ...baseSlots(c),
    topic,
    myAsk: mine ? `${mine.ask}${mine.why ? ` (${mine.why})` : ""}` : "(you made none)",
    otherAsks: others.length ? others.map((a) => `- ${names[a.geniusId] ?? a.geniusId}: ${a.ask}${a.why ? ` (${a.why})` : ""}`).join("\n") : "(none)",
  })
}

export type ModelRun = {
  call: ModelCall | null
  /** Models to try, in order. Empty = script only. */
  ladder: string[]
  temperature?: number
  maxTokens?: number
}

export type Sent<T> = {
  system: string
  user: string
  /** The model's last JSON, as it came back. Undefined when no model was asked. */
  raw?: unknown
  hops: Hop[]
  value: T
  by: "model" | "script"
  /** Why the script answered instead, when it did. */
  why?: string
}

async function ask<T>(prompt: PromptPair, run: ModelRun, schema: Record<string, unknown>, check: (raw: unknown) => Checked<T>, script: () => T): Promise<Sent<T>> {
  if (!run.call || !run.ladder.length) return { ...prompt, hops: [], value: script(), by: "script", why: "model off" }
  const { out, hops } = await escalate<unknown>(
    run.call,
    run.ladder,
    { system: prompt.system, user: prompt.user, schema, maxTokens: run.maxTokens ?? 300, temperature: run.temperature ?? 0.4 },
    (o) => {
      const c = check(o)
      return c.ok ? null : c.why
    },
  )
  if (out === null) return { ...prompt, hops, value: script(), by: "script", why: hops.at(-1)?.why ?? "model down" }
  const c = check(out)
  return c.ok ? { ...prompt, raw: out, hops, value: c.value, by: "model" } : { ...prompt, raw: out, hops, value: script(), by: "script", why: c.why }
}

/** One talk-back turn. The prompt may be edited by hand first (the lab passes `prompt`). */
export function speak(input: { context: GeniusContext; talk: Pick<GeniusTalk, "task" | "lines">; said: string; run: ModelRun; prompt?: PromptPair; overrides?: PromptOverrides; maxTurns?: number }): Promise<Sent<GeniusReply>> {
  const max = input.maxTurns ?? MAX_TURNS
  const turn = Math.min(turnOf(input.talk.lines), max)
  const prompt = input.prompt ?? voicePrompt(input.context, input.talk, input.said, input.overrides, max)
  return ask(prompt, input.run, VOICE_SCHEMA, (raw) => checkReply(raw, turn, max), () => scriptedReply({ turn, said: input.said, task: input.talk.task, maxTurns: max }))
}

/** The scripted council ask: the top open step, or an open habit, or the charter. */
export function scriptedAsk(c: GeniusContext): CouncilAsk {
  const r = c.read
  const top = r.open[0]?.title ?? r.habitsOpen[0]
  const why = r.stalledDays !== null && r.stalledDays > 0 ? `Nothing in ${c.genius.area.toLowerCase()} was done for ${r.stalledDays} days.` : c.genius.charter
  return { geniusId: c.genius.id, ask: top ? `Give some of it to “${top}”.` : `Give a little of it to ${c.genius.area.toLowerCase()}.`, why, by: "script" }
}

export function councilAsk(input: { context: GeniusContext; topic: string; run: ModelRun; prompt?: PromptPair; overrides?: PromptOverrides }): Promise<Sent<CouncilAsk>> {
  const prompt = input.prompt ?? askPrompt(input.context, input.topic, input.overrides)
  return ask(prompt, input.run, ASK_SCHEMA, (raw) => checkAsk(raw, input.context.genius.id), () => scriptedAsk(input.context))
}

export function councilAnswer(input: { context: GeniusContext; topic: string; asks: CouncilAsk[]; names: Record<string, string>; run: ModelRun; prompt?: PromptPair; overrides?: PromptOverrides }): Promise<Sent<CouncilReply>> {
  const prompt = input.prompt ?? councilReplyPrompt(input.context, input.topic, input.asks, input.names, input.overrides)
  const nameToId = Object.fromEntries(Object.entries(input.names).map(([id, name]) => [name.toLowerCase(), id]))
  return ask(prompt, input.run, COUNCIL_REPLY_SCHEMA, (raw) => checkCouncilReply(raw, input.context.genius.id, nameToId), () => ({
    geniusId: input.context.genius.id,
    line: "I have said my piece. Your call.",
    yieldsTo: null,
    by: "script" as const,
  }))
}
