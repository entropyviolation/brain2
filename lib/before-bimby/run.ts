/**
 * lib/before-bimby/run.ts — BIM chat's door to the Before BIMBY
 *
 * `tryBefore` takes two kinds of line, in code, with LLM on or off:
 * - A filing ("what I absolutely need to do before Elijah gets back: clean the house amap, shower and get ready
 *   (45 minutes)"). Each thing becomes a To Do today, marked Required for the day unless said as "best case",
 *   due by the event's clock when one was said today, with the minutes said and a note naming the event. A thing
 *   that is already an open task updates that task instead of making a twin. One undo step.
 * - An ask ("what do I have to do before Elijah gets home", "how many minutes until Elijah gets back? and what do i
 *   have to do in the minutes"). The answer is the time left when a clock was said today, then every thing you said
 *   today you had to do before it: from tasks that carry the event's note, and from every line you sent today that
 *   names the event (a brain dump, an Inbox capture, a log line), so a thing filed somewhere else is still found.
 *   Done things are shown as done. With no clock and only a time question, it passes to the router and
 *   `beforeAppendix` adds the list to the model's answer.
 */
"use client"

import { createScheduledTodoTask } from "@/components/Home/ToDo/todo-utils"
import { runAsAction } from "@/lib/action-history"
import { taskScheduledOnDay, toLocalCalendarDate } from "@/lib/date-utils"
import { aboutSame, matchTask, planTokens } from "@/lib/dump-bimby/match"
import { bimLogs } from "@/lib/habit-helper/logs"
import { itemTitle } from "@/lib/item-utils"
import { useTaskStore } from "@/lib/task-store"
import { todoPeriodKey, withTodoCommitment } from "@/lib/todo-commitment"
import type { ItemNoteEntry, Task } from "@/lib/types"
import { readAnchor, readAnchorClock, readBeforeAsk, readFiling, readMentions, spanWords, type Anchor, type BeforeItem } from "./parse"

export interface BeforeReply {
  text: string
  route: string
  kind: "todo-today" | "tell"
}

interface Said {
  text: string
  at: string
}

export interface BeforeData {
  tasks: Task[]
  logs: Said[]
}

const pad = (n: number) => String(n).padStart(2, "0")
const clockWord = (ms: number) => new Date(ms).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).replace(":00", "")
const sameDay = (iso: string, now: Date) => {
  const d = new Date(iso)
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
}

/** The note a filed task carries, so the ask finds it by the event. */
export const beforeNote = (a: Anchor) => `Before ${a.label}.`

function stored(): BeforeData {
  let logs: Said[] = []
  try {
    logs = bimLogs()
  } catch {}
  return { tasks: useTaskStore.getState().tasks, logs }
}

/** The latest clock said today for the event, from your lines and from tasks filed for it. */
export function anchorClock(anchor: Anchor, data: BeforeData, now: Date, extra?: string): { at: number; said?: string } | null {
  let best: { at: number; said?: string; when: number } | null = null
  const lines = [...data.logs.filter((l) => sameDay(l.at, now)), ...(extra ? [{ text: extra, at: now.toISOString() }] : [])]
  for (const l of lines) {
    const at = readAnchorClock(l.text, anchor.key, now)
    const when = Date.parse(l.at)
    if (at && (!best || when >= best.when)) best = { at, said: l.at, when }
  }
  if (best) return { at: best.at, ...(best.said ? { said: best.said } : {}) }
  const note = beforeNote(anchor).toLowerCase()
  const due = data.tasks.filter((t) => t.deadline && (t.notes ?? "").toLowerCase().includes(note) && sameDay(new Date(t.deadline).toISOString(), now)).map((t) => new Date(t.deadline!).getTime())
  return due.length ? { at: Math.max(...due) } : null
}

export interface ListedItem {
  title: string
  done: boolean
  required: boolean
  minutes?: number
  /** "9:19 AM": when you said it, for a line read from your messages. */
  said?: string
}

/** Every thing said today to do before the event, tasks first, then lines; one row per thing. */
export function itemsBefore(anchor: Anchor, data: BeforeData, now: Date, skipText?: string): ListedItem[] {
  const note = beforeNote(anchor).toLowerCase()
  const subject = anchor.key.split(":")[0]!
  const out: ListedItem[] = []
  const tied = data.tasks.filter((t) => {
    const notes = (t.notes ?? "").toLowerCase()
    const title = itemTitle(t).toLowerCase()
    if (!notes.includes(note) && !new RegExp(String.raw`\bbefore\s+${subject}\b`).test(title)) return false
    return !t.completed || (t.completedDate ? sameDay(new Date(t.completedDate).toISOString(), now) : true)
  })
  for (const t of tied) out.push({ title: itemTitle(t), done: !!t.completed, required: !!t.todoMarks?.some((m) => m.required), ...(t.estimatedDuration && t.estimatedDuration !== 30 ? { minutes: t.estimatedDuration } : {}) })
  const today = data.tasks.filter((t) => taskScheduledOnDay(t, now) || (t.completed && t.completedDate && sameDay(new Date(t.completedDate).toISOString(), now)))
  const named = today.map((t) => ({ id: t.id, name: itemTitle(t) })).filter((t) => t.name)
  for (const l of data.logs) {
    if (!sameDay(l.at, now) || l.text === skipText) continue
    const hit = readAnchor(l.text)
    if (!hit || hit.anchor.key !== anchor.key) {
      if (!new RegExp(String.raw`\b${subject}\b`, "i").test(l.text)) continue
    }
    for (const it of readMentions(l.text, anchor.key, now)) {
      if (out.some((o) => sameThing(o.title, it.title))) continue
      const task = named.find((n) => sameThing(it.title, n.name))
      const t = task ? today.find((x) => x.id === task.id) : undefined
      if (t && out.some((o) => o.title === itemTitle(t))) continue
      out.push({ title: t ? itemTitle(t) : it.title, done: !!t?.completed, required: it.required, ...(it.minutes ? { minutes: it.minutes } : {}), said: clockWord(Date.parse(l.at)) })
    }
  }
  return out
}

/** Both ways about the same words: "clean house" and "Clean the house" are one thing, "clear off couch" and "clean couch cushions" are two. */
function sameThing(a: string, b: string): boolean {
  if (a.toLowerCase() === b.toLowerCase()) return true
  const ta = planTokens(a)
  const tb = planTokens(b)
  return aboutSame(ta, tb) && aboutSame(tb, ta)
}

/** The reply to an ask. */
export function answerBefore(anchor: Anchor, wants: { list: boolean; time: boolean }, data: BeforeData, now: Date): string | null {
  const clock = anchorClock(anchor, data, now)
  const items = itemsBefore(anchor, data, now)
  if (!clock && !items.length) return null
  if (wants.time && !wants.list && !clock) return null
  const lines: string[] = []
  if (clock) {
    const left = clock.at - now.getTime()
    const when = clockWord(clock.at)
    const from = clock.said ? ` (you said ${when} at ${clockWord(Date.parse(clock.said))})` : ""
    lines.push(left > 0 ? `${anchor.label} around ${when}: ${spanWords(left)} from now${from}.` : `${anchor.label} was around ${when}, ${spanWords(-left)} ago${from}.`)
  } else if (wants.time) {
    lines.push(`No time said today for when ${anchor.label}. Say "${anchor.label} at 2pm" and I'll count down.`)
  }
  const open = items.filter((i) => !i.done)
  const must = open.filter((i) => i.required)
  const maybe = open.filter((i) => !i.required)
  const done = items.filter((i) => i.done)
  const row = (i: ListedItem, n: number) => `${n}. ${i.title}${i.minutes ? ` · ${i.minutes} min` : ""}`
  if (!items.length) lines.push(`Nothing said today that you have to do before ${anchor.label}.`)
  else {
    if (lines.length) lines.push("")
    lines.push(must.length ? `Before ${anchor.label}, you said you have to:` : `Nothing required is open before ${anchor.label}.`)
    must.forEach((i, k) => lines.push(row(i, k + 1)))
    if (maybe.length) {
      lines.push("", "If time:")
      maybe.forEach((i) => lines.push(`• ${i.title}`))
    }
    if (done.length) {
      lines.push("", "Done:")
      done.forEach((i) => lines.push(`• ${i.title}`))
    }
    const known = must.reduce((s, i) => s + (i.minutes ?? 0), 0)
    if (clock && known && clock.at > now.getTime()) lines.push("", `Minutes you gave: ${known} of the ${Math.round((clock.at - now.getTime()) / 60_000)} left.`)
  }
  return lines.join("\n")
}

/** The list alone, to add under the model's answer to "how many minutes until Elijah gets back?". */
export function beforeAppendix(text: string, now: Date, data: BeforeData = stored()): string | null {
  const hit = readAnchor(text)
  if (!hit) return null
  const items = itemsBefore(hit.anchor, data, now, text).filter((i) => !i.done)
  if (!items.length) return null
  return [`Before ${hit.anchor.label}, you said you have to:`, ...items.map((i, k) => `${k + 1}. ${i.title}${i.required ? "" : " (if time)"}${i.minutes ? ` · ${i.minutes} min` : ""}`)].join("\n")
}

/** File the things as To Dos today, one undo step. */
export function fileBefore(anchor: Anchor, items: BeforeItem[], by: number | undefined, now: Date, said: string): { added: string[]; amended: string[] } {
  const store = useTaskStore.getState()
  const day = toLocalCalendarDate(now)
  const open = store.tasks.filter((t) => !t.completed && t.type !== "person" && t.type !== "log" && !!itemTitle(t))
  const named = open.map((t) => ({ id: t.id, name: itemTitle(t) }))
  const note = beforeNote(anchor)
  const added: string[] = []
  const amended: string[] = []
  const entry = (): ItemNoteEntry => ({ id: `bf_${now.getTime().toString(36)}_${Math.random().toString(36).slice(2, 6)}`, date: now.toISOString().slice(0, 10), time: `${pad(now.getHours())}:${pad(now.getMinutes())}`, text: said })
  runAsAction(`BIM: before ${anchor.label}`, () => {
    for (const it of items) {
      const hit = matchTask(it.title, named)
      const old = hit ? open.find((t) => t.id === hit.id) : undefined
      const base: Task = old ?? createScheduledTodoTask({ description: it.title, period: "day", date: now, tier: it.urgent ? "A+" : "A" })
      const notes = (base.notes ?? "").toLowerCase().includes(note.toLowerCase()) ? base.notes : [base.notes?.trim(), note].filter(Boolean).join("\n")
      let next: Task = {
        ...base,
        notes,
        ...(taskScheduledOnDay(base, now) && !base.hiddenFromTodo ? {} : { scheduledDate: day, hiddenFromTodo: false }),
        ...(by && (!base.deadline || new Date(base.deadline).getTime() > by) ? { deadline: new Date(by) } : {}),
        ...(it.minutes ? { estimatedDuration: it.minutes } : {}),
        ...(it.urgent ? { urgency: Math.max(base.urgency ?? 0, 4), importance: Math.max(base.importance ?? 0, 4) } : {}),
        ...(old ? { noteLog: [...(old.noteLog ?? []), entry()] } : {}),
      }
      next = withTodoCommitment(next, "day", todoPeriodKey("day", now), { required: it.required, prioritized: !it.required })
      if (old) {
        store.updateTask(next)
        amended.push(itemTitle(old))
      } else {
        store.addTask(next)
        added.push(it.title)
      }
    }
  })
  return { added, amended }
}

/**
 * "Elijah gets home at 2pm" when tasks are filed for that event today: their deadline becomes that clock. Only the
 * bare statement is taken; a longer line goes on to the other lanes.
 */
function setClock(text: string, now: Date, d: BeforeData): BeforeReply | null {
  const m = /^\s*([a-z][a-z'.-]*(?:\s[a-z][a-z'.-]*)?)\s+(?:gets?|comes?|will be|will get|is getting|is coming|'s getting|'s coming)\s+(?:home|back|here)\b/i.exec(text)
  if (!m || text.length > 80) return null
  const key = `${m[1]!.toLowerCase()}:home`
  const at = readAnchorClock(text, key, now)
  if (!at || at <= now.getTime()) return null
  const anchor: Anchor = { key, label: `${m[1]!.replace(/\b[a-z]/g, (c) => c.toUpperCase())} gets home` }
  const note = beforeNote(anchor).toLowerCase()
  const tied = d.tasks.filter((t) => !t.completed && (t.notes ?? "").toLowerCase().includes(note))
  if (!tied.length) return null
  runAsAction(`BIM: ${anchor.label} at ${clockWord(at)}`, () => {
    for (const t of tied) useTaskStore.getState().updateTask({ ...t, deadline: new Date(at) })
  })
  return { text: `${anchor.label} around ${clockWord(at)}: ${spanWords(at - now.getTime())} from now. ${tied.length} To Do${tied.length === 1 ? "" : "s"} for it now due by then.\n\nSend undo to reverse it.`, route: "BEFORE · time · code", kind: "todo-today" }
}

export function tryBefore(text: string, now: Date, data?: BeforeData): BeforeReply | null {
  const told = setClock(text, now, data ?? stored())
  if (told) return told
  const ask = readBeforeAsk(text)
  if (ask) {
    const reply = answerBefore(ask.anchor, ask, data ?? stored(), now)
    return reply ? { text: reply, route: `BEFORE · ${ask.time ? "time" : ""}${ask.time && ask.list ? " + " : ""}${ask.list ? "list" : ""} · code`, kind: "tell" } : null
  }
  const filing = readFiling(text, now)
  if (!filing) return null
  const d = data ?? stored()
  const by = filing.by ?? anchorClock(filing.anchor, d, now)?.at
  const { added, amended } = fileBefore(filing.anchor, filing.items, by && by > now.getTime() ? by : undefined, now, text)
  const due = by && by > now.getTime() ? `, due by ${clockWord(by)} (${spanWords(by - now.getTime())} from now)` : ""
  const lines = [`Before ${filing.anchor.label}: ${added.length + amended.length} on To Do today, marked required${due}.`]
  for (const t of added) lines.push(`• ${t}`)
  for (const t of amended) lines.push(`• ${t} (already open, updated)`)
  const minutes = filing.items.reduce((s, i) => s + (i.minutes ?? 0), 0)
  if (minutes) lines.push("", `Minutes you gave: ${minutes}.`)
  if (!by) lines.push("", `When does ${filing.anchor.label.split(" ")[0]} get home? Say "${filing.anchor.label} at 2pm" and I'll put that time on them.`)
  lines.push("", "Send undo to reverse it.")
  return { text: lines.join("\n"), route: `BEFORE · to do ×${filing.items.length} · code`, kind: "todo-today" }
}
