/**
 * lib/ingest/bim-keep.ts — "Don't forget …" and "remind me if …" in BIM chat
 *
 * Two shapes, read in code:
 *   to do   "dont forget to cancel instacart"            → a To Do for today (tomorrow when the line says so)
 *   cue     "<fact>, remind me if <situation>"           → the fact comes back when a later line is that situation
 * A cue whose fact is a discount ("got 15$ off restaurant food on instacart") is also kept by the Financial
 * BIMBY as a perk, and the two are tied: using one closes the other.
 *
 * `fireCues` is run on every line after BIM has answered it. A sure match is code (`lib/cues/cue.ts`); an
 * unsure one is put to a model as one yes/no question when `gate` is given, and stays quiet otherwise.
 */

import { cueGatePrompt, cuesFor, parseCue, type Cue } from "@/lib/cues/cue"
import { openCues, useCueStore } from "@/lib/cues/store"
import { applyMoney, dropPerk, markPerkUsed, newestPerk, readContext } from "@/lib/finance-bimby/apply"
import { moneyTokens, readMoney } from "@/lib/finance-bimby/read"
import { patchPerk } from "@/lib/finance-bimby/store"

export type KeepChoice = { label: string; text: string }

// ---------------------------------------------------------------- to do

const FORGET = /^(?:please\s+)?(?:(?:don'?t|do\s+not|dont)\s+(?:let\s+me\s+)?forget|(?:i\s+)?(?:need|have|got|gotta)\s+(?:to\s+)?remember|remember|make\s+sure\s+i(?:\s+remember)?|(?:please\s+)?remind\s+me)\s+to\s+(.{2,200})$/i
/** A clock or a day the To Do list cannot carry from here: such a line is left for the rest of chat. */
const TIMED = /\b(?:at\s+\d|\d\s?(?:am|pm)\b|in\s+(?:\d+|an?|a\s+few)\s+(?:minutes?|mins?|hours?|hrs?|days?|weeks?)|next\s+(?:week|month|year)|on\s+(?:mon|tues?|wed(?:nes)?|thur?s?|fri|sat(?:ur)?|sun)(?:day)?|every\s+\w+|(?:mon|tues|wednes|thurs|fri|satur|sun)day|by\s+(?:the\s+)?\w+day)\b/i

export interface KeepTodo {
  what: string
  /** Days from today the To Do is for: 0, or 1 when the line says tomorrow. */
  dayOffset: 0 | 1
}

/** "dont forget to cancel instacart" → cancel instacart. Null when the line is not that, or names a time To Do cannot hold. */
export function parseKeepTodo(raw: string): KeepTodo | null {
  const text = raw.replace(/\s+/g, " ").trim()
  if (/\n/.test(raw.trim())) return null
  const m = FORGET.exec(text)
  if (!m) return null
  let what = m[1]!.replace(/[.!]+$/g, "").trim()
  // "remind me to X if Y" is a cue with a task in it, not a To Do.
  if (/\b(?:if|when|whenever)\b/i.test(what) || TIMED.test(what)) return null
  const tomorrow = /\btomorrow(?:\s+(?:morning|afternoon|evening|night))?\b/i.exec(what)
  if (tomorrow) what = what.replace(tomorrow[0], " ")
  what = what.replace(/\b(?:today|tonight|later(?:\s+today)?|soon|asap)\b/gi, " ").replace(/\s+/g, " ").replace(/^[\s,]+|[\s,]+$/g, "")
  if (what.length < 2) return null
  return { what, dayOffset: tomorrow ? 1 : 0 }
}

// ---------------------------------------------------------------- cues

let lastMade: { cueId: string; perkId?: string; at: number } | null = null
let lastShown: { ids: string[]; at: number } | null = null
const FRESH_MS = 30 * 60 * 1000

export function resetKeepForTests(): void {
  lastMade = null
  lastShown = null
}

/** "<fact>, remind me if <situation>": keeps the cue, and the perk when the fact is a discount. Null when the line is not a cue. */
export function tryKeepCue(text: string, now: Date): { text: string; route: string } | null {
  const parsed = parseCue(text)
  if (!parsed) return null
  const money = readMoney(parsed.fact, now, readContext())
  let perkId: string | undefined
  if (money?.kind === "perk") {
    applyMoney(money, now)
    perkId = newestPerk()?.id
  }
  const cue = useCueStore.getState().add({ ...parsed, ...(perkId ? { perkId } : {}) }, now)
  if (perkId) patchPerk(perkId, (p) => ({ ...p, cueId: cue.id }))
  lastMade = { cueId: cue.id, ...(perkId ? { perkId } : {}), at: now.getTime() }
  const lines = [`Kept: ${parsed.fact}.`, `I will say it back when you are ${parsed.when}, and only then.`]
  if (perkId) lines.push("The Financial BIMBY has it as a discount too, and will ask if you used it when you log a buy there.")
  lines.push("Say “used it” or “stop reminding me” when it is gone.")
  return { text: lines.join("\n"), route: "KEEP · cue · code" }
}

/** Take back the cue just made (and its perk). Null when none was made recently. */
export function undoLastCue(now: Date): string | null {
  if (!lastMade || now.getTime() - lastMade.at > FRESH_MS) return null
  const cue = useCueStore.getState().cues.find((c) => c.id === lastMade!.cueId)
  if (lastMade.perkId) dropPerk(lastMade.perkId)
  useCueStore.getState().drop(lastMade.cueId)
  lastMade = null
  return cue ? `Undone. I will not remind you about “${cue.fact}”.` : "Undone."
}

function close(cue: Cue, now: Date, used: boolean): void {
  if (cue.perkId && used) markPerkUsed(cue.perkId, now)
  useCueStore.getState().done(cue.id, now)
}

const USED = /^(?:(?:i\s+)?(?:already\s+)?used\s+(?:it|that|them|the\s+.+)|it(?:'|’)?s\s+(?:used|gone)|(?:all\s+)?used\s+up)[.!]*$/i
const STOP_IT = /^(?:drop\s+(?:it|that)(?:\s+reminder)?|stop\s+reminding\s+me(?:\s+(?:about|of)\s+(?:it|that))?|forget\s+(?:it|that)(?:\s+reminder)?|don'?t\s+remind\s+me(?:\s+again)?(?:\s+(?:about|of)\s+(?:it|that))?)[.!]*$/i
const KEEP_IT = /^(?:keep\s+reminding\s+me|keep\s+it|still\s+have\s+it|not\s+yet)[.!]*$/i
const STOP_ABOUT = /^(?:stop\s+reminding\s+me|don'?t\s+remind\s+me(?:\s+again)?|drop\s+the\s+reminder|forget\s+the\s+reminder)\s+(?:about|of|for)\s+(.{2,120}?)[.!]*$/i
const USED_ABOUT = /^(?:i\s+)?(?:already\s+)?used\s+(?:the|my|that)\s+(.{2,120}?)[.!]*$/i
const LIST = /^(?:what\s+(?:are|will)\s+you\s+(?:going\s+to\s+)?remind(?:ing)?\s+me\s+(?:about|of|for)|what\s+(?:cues|conditional\s+reminders)\s+do\s+i\s+have|(?:show\s+|list\s+)?(?:my\s+)?(?:cues|conditional\s+reminders))\s*[?.!]*$/i

function named(words: string): Cue | null {
  const want = new Set(moneyTokens(words))
  if (!want.size) return null
  let best: Cue | null = null
  let bestHit = 0
  for (const cue of openCues()) {
    const hit = moneyTokens(cue.fact).filter((t) => want.has(t)).length
    if (hit > bestHit) [best, bestHit] = [cue, hit]
  }
  return best
}

/** "used it", "stop reminding me about the instacart thing", "what are you reminding me about?". Null when the line is none of those. */
export function tryCueCommand(raw: string, now: Date): { text: string; route: string } | null {
  const text = raw.trim()
  const route = "KEEP · cue · code"
  if (LIST.test(text)) {
    const open = openCues()
    if (!open.length) return { text: "Nothing. Tell me a fact and when you want it back: “got $15 off on instacart, remind me if I'm thinking about ordering food”.", route }
    return { text: ["I will remind you of these:", ...open.map((c) => `• ${c.fact}, when you are ${c.when}${c.fires ? ` (said ${c.fires}×)` : ""}`)].join("\n"), route }
  }
  const about = STOP_ABOUT.exec(text)
  if (about && !/^(?:it|that)$/i.test(about[1]!)) {
    const cue = named(about[1]!)
    if (!cue) return null
    close(cue, now, false)
    return { text: `Okay. I will stop reminding you about “${cue.fact}”.`, route }
  }
  const shown = lastShown && now.getTime() - lastShown.at <= FRESH_MS ? lastShown : null
  const usedAbout = USED_ABOUT.exec(text)
  if (usedAbout && !shown) {
    const cue = named(usedAbout[1]!)
    if (!cue) return null
    close(cue, now, true)
    return { text: `Marked used: “${cue.fact}”. I will stop bringing it up.`, route }
  }
  if (!shown) return null
  const cues = useCueStore.getState().cues.filter((c) => shown.ids.includes(c.id) && !c.doneAt)
  if (!cues.length) return null
  if (USED.test(text) || usedAbout) {
    for (const cue of cues) close(cue, now, true)
    lastShown = null
    return { text: `Marked used: ${cues.map((c) => `“${c.fact}”`).join(", ")}. I will stop bringing it up.`, route }
  }
  if (STOP_IT.test(text)) {
    for (const cue of cues) close(cue, now, false)
    lastShown = null
    return { text: "Okay, I will stop reminding you about that.", route }
  }
  if (KEEP_IT.test(text)) {
    lastShown = null
    return { text: "Okay, I will keep reminding you.", route }
  }
  return null
}

/**
 * The cues this line calls up, as text to put under BIM's reply. `gate` answers one yes/no about an unsure
 * cue (a model); without it an unsure cue stays quiet. Shown cues go quiet for half an hour.
 */
export async function fireCues(line: string, now: Date, gate?: (prompt: ReturnType<typeof cueGatePrompt>) => Promise<boolean>): Promise<{ text: string; choices: KeepChoice[]; ids: string[] } | null> {
  const open = useCueStore.getState().cues.filter((c) => !c.doneAt)
  if (!open.length || !line.trim()) return null
  const { fire, unsure } = cuesFor(open, line, now.getTime())
  if (gate) {
    // At most two questions a line, so a long list of cues cannot hold a reply up.
    for (const cue of unsure.slice(0, 2)) {
      try {
        if (await gate(cueGatePrompt(cue, line))) fire.push(cue)
      } catch {}
    }
  }
  if (!fire.length) return null
  const ids = fire.map((c) => c.id)
  useCueStore.getState().fired(ids, now.getTime())
  lastShown = { ids, at: now.getTime() }
  const text = [...fire.map((c) => `↳ You asked me to remind you: ${c.fact}.`), "Say “used it” when it is gone."].join("\n")
  return { text, ids, choices: [{ label: "used it", text: "used it" }, { label: "keep reminding me", text: "keep reminding me" }] }
}
