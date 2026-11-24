/**
 * lib/graph-bimby/llm.ts — A model read for the sentences the rules left (LLM on only)
 *
 * One schema-bound call on the crew's `extract` ladder. Only sentences no rule read are sent. Every read must
 * quote words that are in that sentence, or it is dropped: the model may not invent a fact. A relation word
 * must be one `relationWord` knows. Null when no model answers; the card then holds the rules' reads only.
 */
"use client"

import { chatCrew } from "@/lib/bim-flow/chat-models"
import { escalate } from "@/lib/bim-flow/crew"
import { ollamaCall } from "@/lib/bim-flow/ollama"
import { relationWord } from "@/lib/person-relations"
import { dayIn, type GraphRead, type Subject } from "./parse"

const TIMEOUT_MS = 45_000
const KINDS = ["fact", "place", "relation", "seen", "todo", "consider", "none"] as const

const SCHEMA = {
  type: "object",
  properties: {
    reads: {
      type: "array",
      maxItems: 12,
      items: {
        type: "object",
        properties: {
          kind: { type: "string", enum: KINDS },
          quote: { type: "string" },
          value: { type: "string" },
          other: { type: "string" },
          role: { type: "string" },
          when: { type: "string" },
        },
        required: ["kind", "quote", "value"],
      },
    },
  },
  required: ["reads"],
}

const SYSTEM = `You file what a person told their second brain about one subject.
For each sentence, give at most one read:
- fact: a standing fact about the subject (job, trait, preference). value: the fact as a short sentence naming the subject.
- place: where the subject lives or is. value: the address or place words.
- relation: the subject's family or social tie to another named person. other: that person's name. role: one word (mother, sister, friend, boss…).
- seen: the speaker saw or spent time with the subject. when: the day words, if any. value: what happened.
- todo: something the speaker should do. value: the action, as an imperative ("Send my christmas list to Linda").
- consider: something weighed but not decided. value: the thought.
- none: nothing to file.
quote: the exact words from the sentence the read rests on. Never invent anything not in the text.`

interface Raw {
  kind: (typeof KINDS)[number]
  quote: string
  value: string
  other?: string
  role?: string
  when?: string
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim()

/** Model reads checked against the sentences they quote. Pure, so it is tested without a model. */
export function readsFromModel(raw: unknown, unread: readonly string[], subject: Subject, now: Date): GraphRead[] {
  const rows = (raw as { reads?: Raw[] } | null)?.reads ?? []
  const out: GraphRead[] = []
  for (const r of rows) {
    if (!r || typeof r.quote !== "string" || typeof r.value !== "string" || r.kind === "none") continue
    const sentence = unread.find((s) => norm(s).includes(norm(r.quote)) && norm(r.quote).length >= 4)
    const value = r.value.trim()
    if (!sentence || !value) continue
    switch (r.kind) {
      case "fact":
        out.push({ kind: "fact", text: value, quote: sentence })
        break
      case "consider":
        out.push({ kind: "consider", text: value, quote: sentence })
        break
      case "todo":
        out.push(subject.project ? { kind: "step", title: value, urgent: /\b(?:asap|today|right now)\b/i.test(sentence), quote: sentence } : { kind: "todo", title: value, urgent: /\b(?:asap|today|right now)\b/i.test(sentence), quote: sentence })
        break
      case "place":
        if (subject.person) out.push({ kind: "place", text: value, precision: /\d/.test(value) ? "mailing" : "neighborhood", quote: sentence })
        break
      case "seen":
        if (subject.person) {
          const date = (r.when && dayIn(r.when, now, "past")) || dayIn(sentence, now, "past")
          out.push({ kind: "seen", date: date ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`, dateSaid: !!date, text: sentence, quote: sentence })
        }
        break
      case "relation": {
        const seed = r.role ? relationWord(r.role) : undefined
        if (subject.person && seed && r.other?.trim() && norm(sentence).includes(norm(r.other.split(/\s+/)[0]))) out.push({ kind: "kin", relation: seed.personRelation, role: r.role!.toLowerCase(), otherName: r.other.trim(), quote: sentence })
        break
      }
    }
  }
  return out
}

/** The model's reads for the unread sentences, or [] when there are none, LLM is off, or no model answers. */
export async function readWithModel(unread: readonly string[], subject: Subject, now: Date): Promise<{ reads: GraphRead[]; model?: string }> {
  if (!unread.length) return { reads: [] }
  const crew = await chatCrew().catch(() => null)
  if (!crew) return { reads: [] }
  const call = ollamaCall(crew.main, AbortSignal.timeout(TIMEOUT_MS))
  const user = `SUBJECT: ${subject.name} (${subject.person ? "a person" : subject.project ? "a project" : "an item"})\nSENTENCES:\n${unread.map((s, i) => `${i + 1}. ${s}`).join("\n")}`
  const { out, hops } = await escalate<unknown>(call, crew.extract.length ? crew.extract : [crew.main], { system: SYSTEM, user, schema: SCHEMA, maxTokens: 900 }, (raw) => (readsFromModel(raw, unread, subject, now).length ? null : "no usable reads")).catch(() => ({ out: null, hops: [] }))
  if (!out) return { reads: [] }
  return { reads: readsFromModel(out, unread, subject, now), model: hops.at(-1)?.model }
}
