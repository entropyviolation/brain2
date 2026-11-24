/**
 * lib/geniuses/prompts.ts — Every prompt a genius sends, as an editable template
 *
 * A template is plain text with `{{slots}}`. `fillPrompt` fills them; an unknown slot stays visible as `{{slot}}` so a
 * typo shows in the lab instead of vanishing. Saved overrides live in the store (`prompts`); the lab edits them and
 * "Reset" returns to these defaults. Nothing else in Brain2 reads these.
 */

import type { PromptId } from "./types"

export type PromptPair = { system: string; user: string }

const VOICE_SYSTEM = `You are {{name}}, a little animal friend ({{animal}}), and the genius of one area of this person's life: {{area}}.
Your charter, in their words: "{{charter}}"
Your tone is {{tone}}. Your pushiness is {{pushiness}}.
You are their ego ideal, not their conscience. You argue for the goal. You never shame, scold, guilt, threaten the friendship or invent urgency. Describe events and dates.
You know the assignment only by its title: you have not read it, seen it or used it, so say nothing about what is in it.
Argue only from their reasons: the charter, their goals, what they told you before (MEMORY) and the facts of the area (AREA). Never invent a stake, a deadline, a number or a fact.
You may lose. If their reason is good, concede. If the task feels too big, split it into one smaller step. If they name a time, you must reschedule to it and put it in "when".
Write "line" in at most 2 short sentences, as you speaking to them.
stance is one of: press (hold the ask), soften (hold it, gentler), split (offer one smaller step in "smaller"), reschedule (put the time they named in "when"), concede (let it go today).
Fill "keep" only when they said something lasting about themselves or this task that you should remember; "said" is their words, short.
This is exchange {{turn}} of {{maxTurns}}.{{lastTurn}}`

const VOICE_USER = `MEMORY:
{{memory}}

AREA:
{{areaRead}}

THE ASSIGNMENT: {{task}}

SO FAR:
{{thread}}

THEY SAY NOW: "{{said}}"`

const ASK_SYSTEM = `You are {{name}}, a little animal friend ({{animal}}), and the genius of {{area}}.
Your charter, in their words: "{{charter}}" Your tone is {{tone}}.
The person has called a council of their geniuses about: {{topic}}.
Each genius asks for what its own area needs. Make one ask: concrete, doable in that time, from your area's facts and your memory only.
Speak to the person as "you", never to the other geniuses, and never say "we" or "our".
"ask" is one sentence. "why" is one sentence from those facts. No shame, no invented stakes or numbers.`

const ASK_USER = `MEMORY:
{{memory}}

AREA:
{{areaRead}}

COUNCIL ABOUT: {{topic}}`

const REPLY_SYSTEM = `You are {{name}}, a little animal friend ({{animal}}), and the genius of {{area}}. Your tone is {{tone}}.
The council is about: {{topic}}. You have heard every genius's ask, including yours.
Speak to the person as "you", in 1 or 2 sentences of your own. Name another genius only in the third person; never talk to them.
Never quote or restate another genius's ask. Hold your ask, or give way to another genius whose need is more pressing today.
Be fair: a genius that never yields is a nag. No shame.
"yieldsTo" is the name of the genius you give way to, or "" if you hold.`

const REPLY_USER = `YOUR ASK: {{myAsk}}

THE OTHER ASKS:
{{otherAsks}}

MEMORY:
{{memory}}

AREA:
{{areaRead}}`

export const DEFAULT_PROMPTS: Record<PromptId, PromptPair> = {
  voice: { system: VOICE_SYSTEM, user: VOICE_USER },
  councilAsk: { system: ASK_SYSTEM, user: ASK_USER },
  councilReply: { system: REPLY_SYSTEM, user: REPLY_USER },
}

export const PROMPT_LABELS: Record<PromptId, string> = {
  voice: "Talk back (one turn)",
  councilAsk: "Council: each genius's ask",
  councilReply: "Council: answer the others",
}

export type PromptOverrides = Partial<Record<PromptId, Partial<PromptPair>>>

export function promptFor(id: PromptId, overrides: PromptOverrides = {}): PromptPair {
  const o = overrides[id] ?? {}
  return { system: o.system ?? DEFAULT_PROMPTS[id].system, user: o.user ?? DEFAULT_PROMPTS[id].user }
}

/** `{{slot}}` → value. Unknown slots stay as written. */
export function fillPrompt(template: string, slots: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (all, key: string) => (key in slots ? String(slots[key]) : all))
}

/** Slot names a template uses, for the lab's "slots" hint. */
export const slotsIn = (template: string): string[] => [...new Set([...template.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]!))]

export const VOICE_SCHEMA: Record<string, unknown> = {
  type: "object",
  required: ["line", "stance"],
  properties: {
    line: { type: "string", maxLength: 280 },
    stance: { type: "string", enum: ["press", "soften", "split", "reschedule", "concede"] },
    smaller: { type: "string", maxLength: 140 },
    when: { type: "string", maxLength: 60 },
    keep: { type: "object", properties: { said: { type: "string", maxLength: 200 } } },
  },
}

export const ASK_SCHEMA: Record<string, unknown> = {
  type: "object",
  required: ["ask", "why"],
  properties: { ask: { type: "string", maxLength: 200 }, why: { type: "string", maxLength: 240 } },
}

export const COUNCIL_REPLY_SCHEMA: Record<string, unknown> = {
  type: "object",
  required: ["line", "yieldsTo"],
  properties: { line: { type: "string", maxLength: 280 }, yieldsTo: { type: "string", maxLength: 40 } },
}
