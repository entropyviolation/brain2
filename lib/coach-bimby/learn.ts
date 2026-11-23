/**
 * lib/coach-bimby/learn.ts — BIM learns about you from what you say, quietly
 *
 * After a chat line is answered, a line that speaks of you ("I", "my") and is long enough is put to the small
 * model once: is there anything lasting about this person here (who they are, a goal, a want, a need, a like,
 * a dislike, someone in their life)? Moods, plans for today and one-off events are not lasting and are dropped.
 * What comes back is kept as a `learned` note (`me-store.ts`), shown in “what do you know about me?” and
 * removable with “forget …”. Only a fact the line itself states is kept: a note must share words with the line.
 */

import type { ModelCall } from "@/lib/bim-flow/ollama"
import { ME_KINDS, useMeStore, type MeKind, type MeNote } from "./me-store"
import { kindOf } from "./read"

const LEARN_SYSTEM =
  "You read one chat line a person sent to their own assistant and pull out LASTING facts about that person: who they are (job, age, where they live, identity), " +
  "a goal, a want, a need, a like, a dislike, or a person in their life and who that person is to them. " +
  "NOT lasting, never return: moods and feelings right now, what they are doing today, a single plan or errand, a purchase, small talk. " +
  "Write each fact as a short first-person sentence using only words from the line. Never add a detail the line does not say. " +
  "Most lines have none: return an empty list. At most three. JSON only."
const LEARN_SCHEMA = {
  type: "object",
  properties: {
    facts: {
      type: "array",
      maxItems: 3,
      items: { type: "object", properties: { kind: { type: "string", enum: [...ME_KINDS] }, text: { type: "string", maxLength: 160 } }, required: ["kind", "text"] },
    },
  },
  required: ["facts"],
}

const SELF = /\b(i|i'm|im|i've|ive|i'd|my|mine|myself)\b/i
const STOP = new Set(["i", "im", "my", "me", "the", "a", "an", "to", "and", "of", "is", "am", "are", "in", "on", "for", "it", "that", "this", "with", "be", "was"])
const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9' ]+/g, " ").split(/\s+/).map((w) => w.replace(/'/g, "")).filter((w) => w.length > 1 && !STOP.has(w))

/** Worth asking about: speaks of the person, has some substance, is not a command or a question. */
export function worthLearning(text: string): boolean {
  const t = text.trim()
  if (t.length < 18 || t.length > 600) return false
  if (!SELF.test(t)) return false
  if (/^[a-z]+:/i.test(t)) return false
  if (/\?\s*$/.test(t)) return false
  return words(t).length >= 3
}

/**
 * Keep only facts the line states: three in four of a fact's content words are in the line, and every capitalized
 * name in the fact is too. A small model will otherwise add a city or a job the line never said.
 */
export function grounded(line: string, fact: string): boolean {
  const have = new Set(words(line))
  const need = words(fact)
  if (!need.length) return false
  if (need.filter((w) => have.has(w)).length / need.length < 0.75) return false
  const names = fact.slice(1).match(/\b[A-Z][a-z]+\b/g) ?? []
  return names.every((n) => have.has(n.toLowerCase()))
}

/** Ask once, keep what is grounded. Never throws. */
export async function learnFromLine(text: string, call: ModelCall, model: string, now: Date = new Date()): Promise<MeNote[]> {
  if (!worthLearning(text)) return []
  try {
    const out = (await call({ model, system: LEARN_SYSTEM, user: `LINE: ${text}`, schema: LEARN_SCHEMA, maxTokens: 200, temperature: 0 })) as { facts?: { kind?: string; text?: string }[] }
    const kept: MeNote[] = []
    for (const f of (out?.facts ?? []).slice(0, 3)) {
      const fact = String(f.text ?? "").trim()
      // Code's read of the sentence wins when it has one ("I work as …" is who, not like); else the model's label.
      const coded = kindOf(fact)
      const kind = coded !== "note" ? coded : (ME_KINDS as readonly string[]).includes(String(f.kind)) ? (f.kind as MeKind) : "note"
      if (!fact || !grounded(text, fact)) continue
      const note = useMeStore.getState().addNote({ kind, text: fact, source: "learned", at: now.getTime() })
      if (note) kept.push(note)
    }
    return kept
  } catch {
    return []
  }
}
