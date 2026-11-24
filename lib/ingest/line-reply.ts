/**
 * lib/ingest/line-reply.ts — The Line Reply BIMBY: a chat line sent as a reply to one earlier line
 *
 * Right-click any line in BIM chat (yours or BIM's) and pick **Reply to**. The well shows the line, and the next
 * line you send carries it (`useLineReply` → `useBimChatStore.send` → `sendToBim({ line })`).
 *
 * What it does today:
 *   - **A to-do the line made.** "need to find another usb-c to usb-c" was filed as "To do today: find another usb-c
 *     to usb-c". A reply to either line, "found one, headphones charging now", ticks that to-do off now and keeps
 *     your words on it as a dated note. "never mind, don't need it" takes it off To Do (not deleted) with the note.
 *     Done or dropped is read in code; with LLM on, an unsure read asks the small model once.
 *   - **Anything else** goes through the chat as usual, with the quoted line as what it answers (`lastBim`).
 *
 * The quoted line and the line it pairs with (your line's reply, or the line BIM's reply answered) are both read,
 * so either side of the exchange works.
 */
import { create } from "zustand"
import { taskScheduledOnDay } from "@/lib/date-utils"
import { itemTitleOrUntitled } from "@/lib/item-utils"
import { localDayKey } from "@/lib/reviews-store"
import { useTaskStore } from "@/lib/task-store"
import type { Task } from "@/lib/types"
import { finishTodo } from "./apply-todos"

export interface LineRef {
  id: string
  who: "you" | "bim"
  text: string
}

/** The line the next one you send replies to. In memory: a reload forgets it. Sending clears it. */
export const useLineReply = create<{ target: LineRef | null; set: (t: LineRef | null) => void }>()((set) => ({
  target: null,
  set: (target) => set({ target }),
}))

/** A short quote of a line for the well and the "re:" tag. */
export function quoteOf(text: string, max = 70): string {
  const one = text.replace(/\s+/g, " ").trim()
  return one.length > max ? `${one.slice(0, max - 1)}…` : one
}

export type Resolution = "done" | "dropped"

/** Model yes/no when code is unsure. Returns null when it cannot tell or no model answered. */
export type ResolveGate = (reply: string, todo: string) => Promise<Resolution | "neither" | null>

export interface LineReplyResult {
  text: string
  route: string
  /** The to-do it changed. */
  taskId?: string
}

const NOT_DONE = /\b(not yet|didn'?t|did not|couldn'?t|could not|can'?t find|cannot find|haven'?t|have not|still (need|looking|have to)|no luck|nope)\b/i
const DROPPED = /\b(never ?mind|nvm|don'?t need|do not need|no longer need|not needed|no need|forget (it|that)|scrap (it|that)|cancel(led)? (it|that)|skip (it|that))\b/i
const DONE =
  /\b(found|got (one|it|a|an|them)|bought|ordered|picked (it )?up|grabbed|done|did (it|that)|finished|fixed|sorted|handled|took care|completed|solved|called|booked|paid|sent|returned|cleaned|washed|dropped (it )?off|checked off|all set)\b|^(yes|yep|yup|ok|okay)\b.{0,12}$/i

/** Done, dropped, or unsure, from the words alone. */
export function readResolution(reply: string): Resolution | null {
  const t = reply.trim()
  if (DROPPED.test(t)) return "dropped"
  if (NOT_DONE.test(t)) return null
  if (DONE.test(t)) return "done"
  return null
}

/** To-do names a reply line shows ("To do today: X", "On Next Actions: X", "Next actions · General: X"). */
export function todoNamesIn(text: string): string[] {
  const out: string[] = []
  for (const raw of text.split("\n")) {
    const m = /^(?:To do today|Next actions · [^:]+|On [^:]{1,40}):\s*(.+?)\.?$/i.exec(raw.trim())
    if (m?.[1]) out.push(m[1].trim())
  }
  return out
}

const STOP = new Set("a an the to of for and or my i me need needs want have has get go do some another one it this that on in at by with from".split(" "))
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, " ").trim()
const words = (s: string) => norm(s).split(" ").filter((w) => w && !STOP.has(w))

/**
 * The open to-do the quoted lines are about. A name BIM said back wins; else the open task whose title words are
 * mostly in the quoted text (at least two words, or one word that is the whole title). Today's To Do first.
 */
export function findTodo(texts: string[], now = new Date(), tasks: Task[] = useTaskStore.getState().tasks): Task | null {
  const open = tasks.filter((t) => !t.completed && !t.hiddenFromTodo && itemTitleOrUntitled(t, "").trim())
  const names = texts.flatMap(todoNamesIn).map(norm)
  const rank = (t: Task) => (taskScheduledOnDay(t, now) ? 1 : 0)
  // Newest first among equals: the one the line just filed.
  const byNewest = [...open].reverse()
  for (const name of names) {
    const hit = byNewest.filter((t) => norm(itemTitleOrUntitled(t)) === name).sort((a, b) => rank(b) - rank(a))[0]
    if (hit) return hit
  }
  const said = new Set(texts.flatMap(words))
  let best: { task: Task; score: number } | null = null
  for (const task of byNewest) {
    const title = words(itemTitleOrUntitled(task))
    if (!title.length) continue
    const hits = title.filter((w) => said.has(w)).length
    const share = hits / title.length
    if (share < 0.6 || (hits < 2 && title.length > 1)) continue
    const score = share + hits * 0.01 + rank(task) * 0.001
    if (!best || score > best.score) best = { task, score }
  }
  return best?.task ?? null
}

function clock(d: Date): string {
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
}

function noteOn(task: Task, text: string, now: Date): void {
  const fresh = useTaskStore.getState().tasks.find((t) => t.id === task.id) ?? task
  const hh = String(now.getHours()).padStart(2, "0")
  const mm = String(now.getMinutes()).padStart(2, "0")
  const entry = { id: `note-${now.getTime().toString(36)}`, date: localDayKey(now), time: `${hh}:${mm}`, text }
  useTaskStore.getState().updateTask({ ...fresh, noteLog: [entry, ...(fresh.noteLog ?? [])] })
}

/**
 * Read a reply against the quoted line. Returns null when it changes nothing, so the line goes on through the chat.
 * `pair` is the other side of the exchange (your line's reply, or the line BIM's reply answered).
 */
export async function replyToLine(text: string, ref: LineRef & { pair?: string }, now = new Date(), gate?: ResolveGate): Promise<LineReplyResult | null> {
  const task = findTodo([ref.text, ref.pair ?? ""].filter(Boolean), now)
  if (!task) return null
  const name = itemTitleOrUntitled(task)
  let how: Resolution | null = readResolution(text)
  let by = "code"
  if (!how && gate && !NOT_DONE.test(text)) {
    const asked = await gate(text, name).catch(() => null)
    if (asked === "done" || asked === "dropped") {
      how = asked
      by = "model"
    }
  }
  if (!how) return null
  if (how === "done") {
    finishTodo(task.id, now, false, now)
    noteOn(task, text, now)
    return { text: `Done: ${name} · ${clock(now)}\nNoted on it: ${text}`, route: `REPLY · to-do done · ${by}`, taskId: task.id }
  }
  const fresh = useTaskStore.getState().tasks.find((t) => t.id === task.id) ?? task
  useTaskStore.getState().updateTask({ ...fresh, hiddenFromTodo: true })
  noteOn(task, text, now)
  return { text: `Off To Do: ${name}\nNoted on it: ${text}`, route: `REPLY · to-do dropped · ${by}`, taskId: task.id }
}
