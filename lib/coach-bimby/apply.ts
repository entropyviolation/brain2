/**
 * lib/coach-bimby/apply.ts — The Coach BIMBY's lanes: write what the shapes in `read.ts` asked for
 *
 * Two entries, one per surface that needs them:
 *   `tryRemind`  a timed Reminder ("remind me at 5pm to call mom"), which texts you on Telegram when due
 *   `tryCoach`   memory of you (tell, ask, forget), the coach's switches, and coaching ("what should I do now?")
 * BIM chat runs both as lanes (`lib/ingest/bim-lanes.ts`). The always-on hub runs both on a Telegram line before the
 * executor (`telegramCoachFirst`), so they work from the phone with the app closed.
 */

import { formatReminderWhen, addReminder, REMINDER_REPEAT_OPTIONS } from "@/lib/reminders"
import type { ModelCall } from "@/lib/bim-flow/ollama"
import { codeCoach, coachReply } from "./brief"
import { useMeStore, type MeKind, type MeNote } from "./me-store"
import { forgetWords, parseAboutMe, parseCoachAsk, parseCoachPrefs, parseForget, parseMeAsk, parseTimedReminder } from "./read"

export interface CoachSaid {
  text: string
  route: string
}

/** A model for the coach's words. Absent: code writes them. */
export interface CoachModel {
  call: ModelCall
  model: string
  turns?: { who: "you" | "bim"; text: string }[]
}

// ---------------------------------------------------------------- reminders

export function tryRemind(text: string, now: Date): CoachSaid | null {
  const r = parseTimedReminder(text, now)
  if (!r) return null
  addReminder(r.what, r.when, r.repeat)
  const repeat = r.repeat === "once" ? "" : ` (${REMINDER_REPEAT_OPTIONS.find((o) => o.value === r.repeat)?.label.toLowerCase()})`
  return { text: `Okay. I'll text you ${formatReminderWhen(r.when)}${repeat}: ${r.what}.`, route: "REMIND · reminder · code" }
}

// ---------------------------------------------------------------- memory of you

const KIND_TITLE: Record<MeKind, string> = {
  who: "Who you are",
  goal: "Your goals",
  want: "What you want",
  need: "What you need",
  like: "You like",
  dislike: "You don't like",
  person: "People in your life",
  note: "Other things",
}

function listNotes(notes: MeNote[], only?: MeKind): string {
  const rows = only ? notes.filter((n) => n.kind === only) : notes
  if (!rows.length) {
    return only === "goal"
      ? "You haven't told me your goals yet. Say “my goals are …” and I'll keep them, check in on them, and bring them up when they matter."
      : "I don't know much about you yet. Tell me: “about me: …”, “remember that I …”, or “my goals are …”. I also pick things up as we talk."
  }
  const groups = (Object.keys(KIND_TITLE) as MeKind[])
    .map((k) => ({ k, rows: rows.filter((n) => n.kind === k) }))
    .filter((g) => g.rows.length)
  const body = groups.map((g) => `${KIND_TITLE[g.k]}:\n${g.rows.map((n) => `• ${n.text}${n.source === "learned" ? " (picked up)" : ""}`).join("\n")}`).join("\n\n")
  return `${body}\n\n“Forget …” drops one.`
}

function rememberLine(kind: MeKind, texts: string[]): string {
  if (kind === "goal") return texts.length > 1 ? `Got it. Your goals: ${texts.join("; ")}. I'll keep them in sight.` : `Got it. Your goal: ${texts[0]}. I'll keep it in sight.`
  return `I'll remember that: ${texts.join("; ")}.`
}

/** Memory, switches and coaching. Null leaves the line to the next lane. */
export async function tryCoach(text: string, now: Date, model?: CoachModel | null): Promise<CoachSaid | null> {
  const me = useMeStore.getState()

  const ask = parseMeAsk(text)
  if (ask) return { text: listNotes(me.notes, ask === "goals" ? "goal" : undefined), route: "ME · memory · code" }

  const forget = parseForget(text)
  if (forget) {
    const words = forgetWords(forget)
    const hit = [...me.notes].reverse().find((n) => {
      const t = n.text.toLowerCase()
      return words.length > 0 && words.filter((w) => t.includes(w)).length >= Math.ceil(words.length * 0.6)
    })
    if (hit) {
      me.removeNote(hit.id)
      return { text: `Forgotten: ${hit.text}.`, route: "ME · forget · code" }
    }
    // Not a note: leave it for the fact lane and the rest.
  }

  const about = parseAboutMe(text)
  if (about) {
    for (const t of about.texts) me.addNote({ kind: about.kind, text: t, source: "said", at: now.getTime() })
    return { text: rememberLine(about.kind, about.texts), route: "ME · remember · code" }
  }

  const prefs = parseCoachPrefs(text)
  if (prefs) {
    me.setPrefs(prefs.patch)
    return { text: prefs.said, route: "COACH · prefs · code" }
  }

  const coach = parseCoachAsk(text)
  if (coach) {
    if (model) {
      try {
        const said = await coachReply(coach, text, model.call, model.model, now, model.turns)
        if (said) return { text: said, route: `COACH · ${coach} · ${model.model.replace(/^qwen2\.5:/, "q2.5 ").replace(/-instruct$/, "")}` }
      } catch {
        /* the code brief below */
      }
    }
    return { text: codeCoach(coach, now), route: `COACH · ${coach} · code` }
  }
  return null
}

/** For the hub: a Telegram line the coach owns, answered before the executor. Null means the executor runs as before. */
export async function telegramCoachFirst(text: string, now: Date, model?: CoachModel | null): Promise<string | null> {
  const t = text.trim()
  if (!t || t.includes("\n") || /^[a-z]+:/i.test(t)) return null
  const said = tryRemind(t, now) ?? (await tryCoach(t, now, model))
  return said ? said.text : null
}
