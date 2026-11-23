/**
 * lib/coach-bimby/brief.ts — The morning brief, the evening check-in and "what now?", in plain words
 *
 * Code writes every line from the snapshot (`context.ts`), so the brief is true with no model. When a model is
 * reachable, `coachReply` asks it for a short, warm coaching turn over the same snapshot; its words are never
 * filed. The coach speaks like a friend who knows your goals: one concrete next step, one question, no lecture.
 */

import type { ModelCall } from "@/lib/bim-flow/ollama"
import { aboutBlock, coachSnapshot, type CoachSnapshot } from "./context"
import type { CoachAsk } from "./read"

const bullets = (rows: string[], max: number) => rows.slice(0, max).map((r) => `• ${r}`).join("\n")
const more = (rows: string[], max: number) => (rows.length > max ? `\n…and ${rows.length - max} more` : "")

function goalLines(snap: CoachSnapshot, max = 4): string[] {
  return snap.goals.slice(0, max).map((g) => (g.progress ? `${g.title} (${g.progress})` : g.title))
}

/** The morning brief: today's To Do, reminders, what you prioritized, and one goal to keep in sight. */
export function morningBrief(now: Date = new Date(), snap: CoachSnapshot = coachSnapshot(now)): string {
  const out: string[] = [`Good morning. ${now.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}.`]
  if (snap.todo.length) out.push(`Today's To Do (${snap.todo.length}):\n${bullets(snap.todo, 6)}${more(snap.todo, 6)}`)
  else out.push("Nothing is on today's To Do yet. Send “todo today: …” or tell me your plan and I'll make a card.")
  if (snap.reminders.length) out.push(`Reminders today: ${snap.reminders.join(", ")}`)
  if (snap.focus.length) out.push(`You prioritized: ${snap.focus.join(", ")}.`)
  const goals = goalLines(snap, 3)
  if (goals.length) out.push(`Goals in sight:\n${bullets(goals, 3)}`)
  out.push(snap.todo.length ? `If you only do one thing: ${snap.todo[0]}.` : "What's the one thing that would make today a good day?")
  return out.join("\n\n")
}

/** The evening check-in: what got done, what is still open, and a question to answer. */
export function eveningCheckIn(now: Date = new Date(), snap: CoachSnapshot = coachSnapshot(now)): string {
  const out: string[] = ["Evening check-in."]
  if (snap.done.length) out.push(`Done today (${snap.done.length}):\n${bullets(snap.done, 6)}${more(snap.done, 6)}`)
  else out.push("I didn't see anything checked off today. That's okay. Tell me what you did and I'll log it.")
  if (snap.todo.length) out.push(`Still open (${snap.todo.length}):\n${bullets(snap.todo, 5)}${more(snap.todo, 5)}`)
  out.push("How did today go, and what's the one thing for tomorrow?")
  return out.join("\n\n")
}

/** "How am I doing on my goals?" in code. */
export function goalsCheck(now: Date = new Date(), snap: CoachSnapshot = coachSnapshot(now)): string {
  if (!snap.goals.length) return "You haven't told me your goals yet. Say “my goals are …” and I'll keep them and check in on them."
  const rows = snap.goals.slice(0, 8).map((g) => (g.progress ? `${g.title}: ${g.progress}${g.share !== undefined ? ` (${Math.round(g.share * 100)}%)` : ""}` : g.title))
  const behind = snap.goals.filter((g) => g.share !== undefined && g.share < 0.5).map((g) => g.title)
  return [`Your goals:\n${bullets(rows, 8)}`, behind.length ? `Furthest to go: ${behind.slice(0, 2).join(", ")}.` : "", snap.focus.length ? `Prioritized now: ${snap.focus.join(", ")}.` : ""].filter(Boolean).join("\n\n")
}

/** "What should I do now?" in code: the top open To Do, and the goal list as the why. */
export function nowNudge(now: Date = new Date(), snap: CoachSnapshot = coachSnapshot(now)): string {
  if (!snap.todo.length) {
    const g = snap.goals[0]
    return g ? `Nothing is on today's To Do. One small step toward “${g.title}” would be a good use of the next half hour. What would that step be?` : "Nothing is on today's To Do. What's on your mind to get done? Tell me and I'll put it on the list."
  }
  const next = snap.todo[0]!
  const after = snap.todo.slice(1, 3)
  return `Start with: ${next}.${after.length ? ` Then ${after.join(", then ")}.` : ""} Set a timer for 25 minutes and tell me when you start.`
}

export function codeCoach(ask: CoachAsk, now: Date = new Date()): string {
  const snap = coachSnapshot(now)
  if (ask === "morning") return morningBrief(now, snap)
  if (ask === "evening") return eveningCheckIn(now, snap)
  if (ask === "goals-check") return goalsCheck(now, snap)
  return nowNudge(now, snap)
}

const COACH_SYSTEM =
  "You are BIM, a warm, sharp life coach living inside one person's own planning app. You know them from ABOUT THEM below, which is everything they told you plus their goals and today's list. " +
  "Talk like a friend who believes in them: plain, specific, short. Use their goals and today's list by name. Give ONE concrete next step they can start in the next few minutes, prefer the most important open To Do, say which goal it serves only when the link is plain (never stretch one goal to explain another), and end with one short question. " +
  "Never invent tasks, goals, people or facts that are not in ABOUT THEM. Never use he, she, him, her, his or hers for anyone. No lists, no headings, no emoji. Two to five sentences. JSON only."
const COACH_SCHEMA = { type: "object", properties: { reply: { type: "string", maxLength: 700 } }, required: ["reply"] }

const ASK_WORDS: Record<CoachAsk, string> = {
  now: "They asked what to do right now.",
  morning: "It's their morning brief: help them pick the day's one thing.",
  evening: "It's the evening check-in: acknowledge what got done, kindly name what is still open, and ask about tomorrow.",
  "goals-check": "They asked how they are doing on their goals: be honest and encouraging, and name the goal that needs a step.",
}

/** A coaching turn from the model over the snapshot. Null when the model gave nothing usable. */
export async function coachReply(ask: CoachAsk, text: string, call: ModelCall, model: string, now: Date = new Date(), turns: { who: "you" | "bim"; text: string }[] = []): Promise<string | null> {
  const about = aboutBlock(now)
  const user = [
    `NOW: ${now.toLocaleString("en-US", { weekday: "long", hour: "numeric", minute: "2-digit" })}`,
    about ? `ABOUT THEM:\n${about}` : "ABOUT THEM: nothing yet. Invite them to tell you their goals.",
    turns.length ? `EARLIER IN THIS CHAT:\n${turns.slice(-6).map((t) => `${t.who === "you" ? "THEM" : "BIM"}: ${t.text.slice(0, 240)}`).join("\n")}` : "",
    ASK_WORDS[ask],
    `THEM: ${text}`,
  ].filter(Boolean).join("\n\n")
  const out = (await call({ model, system: COACH_SYSTEM, user, schema: COACH_SCHEMA, maxTokens: 320, temperature: 0.6 })) as { reply?: string }
  const reply = String(out?.reply ?? "").trim()
  return reply || null
}
