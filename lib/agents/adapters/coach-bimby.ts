/**
 * lib/agents/adapters/coach-bimby.ts — The Coach BIMBY, seen as a Blueprint
 *
 * Memory of you, timed Reminders, coaching in chat, and the morning brief and evening check-in on Telegram.
 * Code: `lib/coach-bimby/`. It runs in BIM chat (the `remind` and `coach` lanes), on a Telegram line before the
 * executor, and on the hub's minute tick.
 */

import type { Blueprint, NamedPipeline, PipelineStage } from "../blueprint"

export const COACH_BIMBY_ID = "coach-bimby"

export const COACH_BIMBY_STAGES: PipelineStage[] = [
  { id: "read", label: "Read", cost: "code", does: "Reads “remind me at 5pm to …”, “about me: …”, “my goals are …”, “what do you know about me?”, “forget …”, the brief switches and “what should I do now?”." },
  { id: "know", label: "Know", cost: "code", does: "Gathers what you told BIM, your goals and priorities, today's To Do and today's reminders (`context.ts`)." },
  { id: "say", label: "Coach", cost: "local-model", does: "The main model writes one concrete next step and one question over what it knows; with no model, code writes the brief." },
  { id: "learn", label: "Learn", cost: "local-model", does: "After a chat line is answered, the small model keeps lasting facts about you the line states (`learn.ts`)." },
]

export const COACH_BIMBY_PIPELINES: NamedPipeline[] = [
  { id: "coach-chat", name: "Remember you and coach you", does: "Keeps who you are and what you want, and answers “what now?” from it, in BIM chat and on Telegram.", status: "built", stages: COACH_BIMBY_STAGES },
  { id: "coach-texts", name: "Morning brief and evening check-in", does: "Texts today's To Do, reminders and goals in the morning, and what got done in the evening, from the always-on hub.", status: "built", stages: [COACH_BIMBY_STAGES[1]!] },
]

export function coachBimbyBlueprint(): Blueprint {
  return {
    id: COACH_BIMBY_ID,
    name: "Coach BIMBY",
    owner: "house",
    rev: "1",
    purpose: "Remembers who you are, your goals and what you need to get done, reminds you on Telegram, and coaches you toward the next step.",
    senses: ["message"],
    memory: { reads: ["semantic"], writes: ["semantic"] },
    tools: [],
    skills: [],
    models: { ladders: {}, pinned: {}, localOnly: true },
    limits: {},
    door: { proposes: [], surface: "bim-chat" },
    checks: [],
    mind: { kind: "pipeline", stages: COACH_BIMBY_STAGES, pipelines: COACH_BIMBY_PIPELINES },
  }
}
