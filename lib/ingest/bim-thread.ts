/**
 * lib/ingest/bim-thread.ts — BIM Chat's thread: what the last question was about
 *
 * BIM answered each line alone, so "and last week?" had no subject. The thread
 * keeps the last question asked (the focus). A short follow-up is rewritten, in
 * code, into a whole question before anything else reads it:
 *
 *   "how many hours of computer work this week?"  then  "and last week?"
 *     → "how many hours of computer work last week?"
 *   "when did I last see Shelby?"  then  "what about Elijah?"
 *     → "when did I last see Elijah?"
 *   "when did I last see Shelby?"  then  "where did she go after?"
 *     → "where did Shelby go after?"
 *
 * No model is asked. The rewritten line runs through the same lanes a typed
 * line does, and the reply says what it was read as. The focus is kept on this
 * device beside the transcript (`bimchat-thread`), never in the vault, and goes
 * stale after `FOCUS_TTL_MS`. Plan: `docs/BIM_CHAT_SWITCHBOARD_PLAN.md` §5.
 */

import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import type { LinkedMention } from "@/lib/bim-flow/entity-link"

/** A follow-up this long after the question is a new subject. */
export const FOCUS_TTL_MS = 30 * 60 * 1000

export type ThreadFocus = { question: string; at: number }

type ThreadState = { focus: ThreadFocus | null; setFocus: (focus: ThreadFocus | null) => void }

export const useBimThread = create<ThreadState>()(
  persist((set) => ({ focus: null, setFocus: (focus) => set({ focus }) }), {
    name: "bimchat-thread",
    storage: createJSONStorage(() => localStorage),
  }),
)

/** The focus, when there is one and it is still fresh. */
export function liveFocus(now: Date): ThreadFocus | null {
  const focus = useBimThread.getState().focus
  return focus && now.getTime() - focus.at <= FOCUS_TTL_MS && now.getTime() >= focus.at ? focus : null
}

/** The time phrases `parseWhenAll` (`lib/bim-flow/compute.ts`) reads, so a swapped window is one the Ask flow understands. */
const TIME =
  "(?:(?:last|past)\\s+(?:\\d+|two|three|four|five|six|seven|ten|fourteen)\\s+days?|day before yesterday|yesterday|last night|today|this morning|this afternoon|tonight|last week|this week|last month|this month|this year|(?:(?:this|last|the)\\s+)?weekend)"
const TIME_ONLY = new RegExp(`^${TIME}$`, "i")
const TIME_ALL = new RegExp(`\\b${TIME}\\b`, "gi")
const LEAD = /^(?:and|but|so|then|also|ok|okay|(?:what|how)\s+about|what\s+of)\b[\s,]*/i
const FILLER = /^(?:for|in|on|during|over|from|the)\s+/i

const SUBJECT = /\b(she|he|they)\b/gi
const OBJECT = /\b(her|him|them)\b/gi
const POSSESSIVE = /\b(his|their|hers|theirs)\b/gi
const PRONOUN = /\b(she|he|they|her|him|them|his|their|hers|theirs)\b/i
const QUESTION = /\?\s*$|^(when|what|how|who|where|which|why|did|do|does|have|has|was|were|is|are|can|could|should)\b/i

export type FollowUp = {
  /** The whole question the follow-up stands for. */
  text: string
  /** What was carried over from the focus. */
  why: "time" | "person" | "pronoun"
}

/** People named in a line. Injected so this file stays pure; chat passes the vault's linker. */
export type PeopleLinker = (text: string) => LinkedMention[]

const people = (link: PeopleLinker, text: string) => link(text).filter((m) => m.status === "linked" && m.best?.sub === "person")

/** The line without its lead-in ("and", "what about") and closing mark, and whether it had either. */
function strip(text: string): { rest: string; marked: boolean } {
  let rest = text.trim()
  const asked = /\?\s*$/.test(rest)
  rest = rest.replace(/[?.!\s]+$/, "")
  let led = false
  for (let m = LEAD.exec(rest); m && m[0]; m = LEAD.exec(rest)) {
    rest = rest.slice(m[0].length)
    led = true
  }
  return { rest: rest.trim(), marked: asked || led }
}

/** The focus question in a new window: the last time phrase is swapped, or the phrase is added. */
function swapWindow(question: string, phrase: string): string {
  const hits = [...question.matchAll(TIME_ALL)]
  const last = hits[hits.length - 1]
  if (last) return `${question.slice(0, last.index)}${phrase}${question.slice(last.index + last[0].length)}`
  return `${question.replace(/[?.!\s]+$/, "")} ${phrase}?`
}

/**
 * The whole question a short follow-up stands for, or null when the line is not
 * a follow-up. Strict on purpose: a bare "yesterday" is an answer or a log line,
 * so a time or a name alone counts only with a lead-in or a question mark.
 */
export function resolveFollowUp(text: string, focus: ThreadFocus | null, link: PeopleLinker): FollowUp | null {
  if (!focus || !text.trim() || text.includes("\n") || text.length > 200) return null
  const { rest, marked } = strip(text)
  if (!rest) return null

  if (marked) {
    let time = rest
    for (let m = FILLER.exec(time); m; m = FILLER.exec(time)) time = time.slice(m[0].length)
    if (TIME_ONLY.test(time)) {
      const next = swapWindow(focus.question, time.toLowerCase())
      return next === focus.question ? null : { text: next, why: "time" }
    }

    // "what about Elijah?": the line is one known person and nothing else.
    const named = people(link, rest)
    if (named.length === 1 && named[0]!.start === 0 && named[0]!.end === rest.length) {
      const was = people(link, focus.question)
      if (was.length !== 1 || was[0]!.best!.id === named[0]!.best!.id) return null
      const old = was[0]!
      return { text: `${focus.question.slice(0, old.start)}${rest}${focus.question.slice(old.end)}`, why: "person" }
    }
  }

  // "where did she go after?": a whole question whose only person is a pronoun. One person in focus, or no rewrite.
  const line = text.trim()
  if (QUESTION.test(line) && PRONOUN.test(line) && people(link, line).length === 0) {
    const was = people(link, focus.question)
    if (was.length !== 1) return null
    const name = focus.question.slice(was[0]!.start, was[0]!.end)
    return {
      text: line.replace(SUBJECT, name).replace(OBJECT, name).replace(POSSESSIVE, `${name}'s`),
      why: "pronoun",
    }
  }
  return null
}
