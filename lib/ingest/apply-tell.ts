/**
 * lib/ingest/apply-tell.ts — File a fact BIM was told, answer a question, or ask one back
 *
 * `parseTell` (`bim-tell.ts`) names the shape. This turns it into writes on the
 * stores the app already uses, or into one question when the vault lacks what the
 * line needs. A question that cannot be answered leaves a `TellPending`; the next
 * line answers it, and that answer is filed AND the original command runs.
 * A line whose subject the vault does not know returns null, so it falls through
 * to the normal ladder (`log:`) instead of being swallowed.
 *   last-seen   → `personProfile.interactions` row with `saw: true` (Last seen)
 *   overdue     → urgency/importance up, scheduled today, a dated note on the task
 *   event       → a Plan event (all-day unless a clock was given)
 *   countdown   → a Countdown mark (`home-days-until-store`), linked to the event
 * BIM Chat only (`bim-chat.ts`); Telegram is untouched.
 */
import { createScheduledTodoTask } from "@/components/Home/ToDo/todo-utils"
import { runAsAction } from "@/lib/action-history"
import { calendarDayDiff } from "@/lib/countdown"
import { parseLocalDate, taskScheduledOnDay, toLocalCalendarDate } from "@/lib/date-utils"
import { useEventStore } from "@/lib/event-store"
import { useHomeDaysUntilStore } from "@/lib/home-days-until-store"
import { itemTitle } from "@/lib/item-utils"
import { COMPANY_SCOPE_ID, personTimePenIds } from "@/lib/people-i-know"
import { lastSawSentence, lastTogetherDate } from "@/lib/person-profile"
import { personMinuteMasks } from "@/lib/person-time"
import { useTaskStore } from "@/lib/task-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import type { ItemNoteEntry, Task } from "@/lib/types"
import {
  isDecline,
  isoOf,
  parseDayAnswer,
  titleFromPhrase,
  type Tell,
} from "./bim-tell"
import { hasUnmatchedContent, normalizeName, resolveName, scoreName } from "./name-resolve"

export type TellOption = { id: string; label: string }

/** What BIM is waiting to hear. Lives in memory in `bim-chat.ts`. */
export type TellPending =
  | { kind: "date"; tell: Tell; personId?: string }
  | { kind: "which"; tell: Tell; what: "person" | "task"; options: TellOption[] }

export type TellReply = {
  text: string
  status: "ok" | "needs_clarify"
  pending?: TellPending
  summary: string
}

const EVENT_COLOR = "#6366f1"

function say(text: string, summary: string): TellReply {
  return { text, status: "ok", summary }
}

function ask(text: string, pending: TellPending, summary = "Asked a question"): TellReply {
  return { text, status: "needs_clarify", pending, summary }
}

function rowId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

function sentenceCase(text: string): string {
  return text ? text[0]!.toUpperCase() + text.slice(1) : text
}

/** "July 5", or "July 5, 2025" when the year is not this one. */
function dayLabel(iso: string, now: Date): string {
  const d = parseLocalDate(iso)
  if (!d) return iso
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    ...(d.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  })
}

function relative(iso: string, now: Date): string {
  const d = parseLocalDate(iso)
  if (!d) return ""
  const days = calendarDayDiff(now, d)
  if (days === 0) return "today"
  if (days === 1) return "tomorrow"
  if (days === -1) return "yesterday"
  if (days > 0) return `${days} days away`
  return lastSawSentence(iso, isoOf(now)).replace(/\.$/, "")
}

// ---------------------------------------------------------------- people

type Found<T> = { status: "one"; item: T } | { status: "many"; items: T[] } | { status: "none" }

function peopleTasks(): Task[] {
  return useTaskStore.getState().tasks.filter((t) => t.type === "person" && itemTitle(t))
}

function findPerson(query: string, pickId?: string): Found<Task> {
  const people = peopleTasks()
  if (pickId) {
    const hit = people.find((p) => p.id === pickId)
    if (hit) return { status: "one", item: hit }
  }
  // Rank per person on their best name. Two people who tie on a shared nickname ask "which".
  const ranked = people
    .map((p) => {
      const prof = p.personProfile
      const score = Math.max(
        ...[itemTitle(p), prof?.fullName ?? "", ...(prof?.nicknames ?? [])]
          .filter(Boolean)
          .map((name) => (hasUnmatchedContent(query, name) && scoreName(query, name) < 1 ? 0 : scoreName(query, name))),
      )
      return { p, score }
    })
    .filter((r) => r.score >= 0.55)
    .sort((a, b) => b.score - a.score)
  if (ranked.length === 0) return { status: "none" }
  const close = ranked.filter((r) => ranked[0]!.score - r.score < 0.12).map((r) => r.p)
  return close.length === 1 ? { status: "one", item: close[0]! } : { status: "many", items: close }
}

function lastSeenOf(person: Task): string | null {
  const { entries, scopes } = useTimeTrackingStore.getState()
  const company = entries.filter((e) => e.scopeId === COMPANY_SCOPE_ID)
  const stored = lastTogetherDate(person.personProfile, person.personPipelines, company)
  const tracked = [...personMinuteMasks(entries, scopes, personTimePenIds(person)).keys()].sort().at(-1) ?? null
  return [stored, tracked].filter(Boolean).sort().at(-1) ?? null
}

function whichPrompt(what: string, items: Task[], tell: Tell, kind: "person" | "task"): TellReply {
  const options = items.slice(0, 5).map((t) => ({ id: t.id, label: itemTitle(t) }))
  const lines = options.map((o, i) => `${i + 1}. ${o.label}`).join("\n")
  return ask(`Which ${what}?\n${lines}`, { kind: "which", tell, what: kind, options }, "Asked which")
}

// ---------------------------------------------------------------- events

type PlanEvent = ReturnType<typeof useEventStore.getState>["events"][number]

function futureEvents(now: Date): PlanEvent[] {
  const today = isoOf(now)
  return useEventStore.getState().events.filter((e) => e.title && isoOf(toLocalCalendarDate(e.date)) >= today)
}

function findEvent(phrase: string, now: Date): PlanEvent | null {
  const events = futureEvents(now)
  const res = resolveName(titleFromPhrase(phrase), events.map((e) => ({ id: e.id, name: e.title })))
  if (res.status === "none") return null
  const ids = new Set(res.status === "match" ? [res.candidate.id] : res.candidates.map((c) => c.id))
  return events
    .filter((e) => ids.has(e.id))
    .sort((a, b) => a.date.getTime() - b.date.getTime())[0] ?? null
}

function endClock(time: string): string {
  const [h, m] = time.split(":").map(Number)
  return `${String(Math.min(23, (h ?? 0) + 1)).padStart(2, "0")}:${String(m ?? 0).padStart(2, "0")}`
}

/** Add the Plan event, or return the same one when a title and day already exist. */
function planEvent(title: string, iso: string, time: string | undefined): { event: PlanEvent; added: boolean } {
  const day = parseLocalDate(iso)!
  const same = useEventStore
    .getState()
    .events.find((e) => isoOf(toLocalCalendarDate(e.date)) === iso && normalizeName(e.title) === normalizeName(title))
  if (same) return { event: same, added: false }
  const event: PlanEvent = {
    id: rowId("bim-event"),
    title,
    date: toLocalCalendarDate(day),
    startTime: time ?? "00:00",
    endTime: time ? endClock(time) : "23:59",
    type: "event",
    color: EVENT_COLOR,
    isScheduled: true,
    isAllDay: !time,
    location: "",
    description: "Told to BIM.",
  }
  useEventStore.getState().addEvent(event)
  return { event, added: true }
}

function countdownFor(title: string, iso: string, time: string | undefined, eventId: string): { id: string; added: boolean } {
  const store = useHomeDaysUntilStore.getState()
  const same = store.items.find((i) => i.date === iso && normalizeName(i.label) === normalizeName(title))
  if (same) return { id: same.id, added: false }
  const id = store.addCountdown({
    label: title,
    date: iso,
    time: time ?? "",
    format: "days",
    mode: "countdown",
    eventId,
    whenPassed: "stay",
  })
  return { id, added: true }
}

function countdownReply(title: string, iso: string, now: Date, added: boolean, eventAdded: boolean): string {
  const days = parseLocalDate(iso) ? calendarDayDiff(now, parseLocalDate(iso)!) : 0
  const face = days === 0 ? "today" : days === 1 ? "1 day" : `${days} days`
  const lead = added ? "Countdown widget made" : "That countdown is already there"
  return `${lead}: ${title}, ${face} (${dayLabel(iso, now)}).${eventAdded ? ` Added it to Plan on ${dayLabel(iso, now)}.` : ""}`
}

// ---------------------------------------------------------------- overdue

function openTasks(): Task[] {
  return useTaskStore
    .getState()
    .tasks.filter((t) => !t.completed && t.type !== "person" && t.type !== "log" && !!itemTitle(t))
}

function overdueNote(severity: "overdue" | "extreme", now: Date): ItemNoteEntry {
  const clock = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`
  return {
    id: rowId("bn"),
    date: isoOf(now),
    time: clock,
    text: severity === "extreme" ? "Extremely overdue. Needs to be done immediately. (Told to BIM.)" : "Overdue. (Told to BIM.)",
  }
}

function applyOverdue(tell: Extract<Tell, { kind: "overdue" }>, now: Date, pickId?: string): TellReply | null {
  const tasks = openTasks()
  let task: Task | undefined = pickId ? tasks.find((t) => t.id === pickId) : undefined
  if (!task) {
    const res = resolveName(tell.what, tasks.map((t) => ({ id: t.id, name: itemTitle(t) })))
    if (res.status === "ambiguous") {
      const ids = new Set(res.candidates.map((c) => c.id))
      return whichPrompt("one", tasks.filter((t) => ids.has(t.id)), tell, "task")
    }
    if (res.status === "match") task = tasks.find((t) => t.id === res.candidate.id)
  }
  const extreme = tell.severity === "extreme"
  const rank = extreme ? 5 : 4
  const note = overdueNote(tell.severity, now)

  return runAsAction("BIM: overdue", () => {
    if (!task) {
      const made = createScheduledTodoTask({
        description: sentenceCase(tell.what),
        period: "day",
        date: now,
        tier: extreme ? "A+" : "A",
      })
      useTaskStore.getState().addTask({ ...made, noteLog: [note] })
      return say(
        `I had no task called "${sentenceCase(tell.what)}", so I made one on today's to do at ${extreme ? "the highest" : "high"} priority, noted as ${extreme ? "extremely " : ""}overdue.`,
        `To do today: ${tell.what}`,
      )
    }
    const wasToday = taskScheduledOnDay(task, now) && !task.hiddenFromTodo
    const next: Task = {
      ...task,
      urgency: Math.max(task.urgency ?? 0, rank),
      importance: Math.max(task.importance ?? 0, rank),
      hiddenFromTodo: false,
      ...(wasToday ? {} : { scheduledDate: toLocalCalendarDate(now) }),
      noteLog: [...(task.noteLog ?? []), note],
    }
    useTaskStore.getState().updateTask(next)
    const title = itemTitle(task)
    return say(
      `${title}: ${extreme ? "top" : "high"} priority, noted as ${extreme ? "extremely " : ""}overdue, ${wasToday ? "already on" : "added to"} today's to do.`,
      `Overdue: ${title}`,
    )
  })
}

// ---------------------------------------------------------------- the entry points

type Picked = { personId?: string; taskId?: string }

/**
 * File or answer one parsed line. Null means the vault does not know what the
 * line is about, so the caller lets it fall through to the normal ladder.
 */
export function applyTell(tell: Tell, now: Date, pick: Picked = {}): TellReply | null {
  switch (tell.kind) {
    case "last-seen": {
      const found = findPerson(tell.who, pick.personId)
      if (found.status === "none") return null
      if (found.status === "many") return whichPrompt(`${tell.who}`, found.items, tell, "person")
      const person = found.item
      const name = itemTitle(person)
      const profile = person.personProfile ?? {}
      const had = (profile.interactions ?? []).some((r) => r.saw && r.date === tell.date)
      return runAsAction("BIM: last seen", () => {
        if (!had) {
          useTaskStore.getState().updateTask({
            ...person,
            personProfile: {
              ...profile,
              interactions: [{ id: rowId("pi"), date: tell.date, text: "Told to BIM.", saw: true }, ...(profile.interactions ?? [])],
            },
          })
        }
        const latest = lastSeenOf(useTaskStore.getState().tasks.find((t) => t.id === person.id) ?? person)
        const later = latest && latest > tell.date ? ` Their Last seen still reads ${dayLabel(latest, now)}, which is later.` : ""
        return say(
          `${name}: last seen ${dayLabel(tell.date, now)} (${relative(tell.date, now)}).${later}`,
          `Last seen ${name}`,
        )
      })
    }
    case "ask-last-seen": {
      const found = findPerson(tell.who, pick.personId)
      if (found.status === "none") return say(`I don't know anyone called ${sentenceCase(tell.who)}.`, "Unknown person")
      if (found.status === "many") return whichPrompt(`${tell.who}`, found.items, tell, "person")
      const person = found.item
      const name = itemTitle(person)
      const last = lastSeenOf(person)
      if (last) {
        return say(`You last saw ${name} on ${dayLabel(last, now)} (${relative(last, now)}).`, `Last seen ${name}`)
      }
      return ask(
        `I don't have any info on that. When do you remember last seeing ${name}?`,
        { kind: "date", tell: { kind: "last-seen", who: name, date: "" }, personId: person.id },
        `No last seen for ${name}`,
      )
    }
    case "event": {
      const { event, added } = planEvent(tell.title, tell.date, tell.time)
      const at = tell.time ? ` at ${tell.time}` : ""
      return say(
        added
          ? `Planned: ${event.title}, ${dayLabel(tell.date, now)}${at} (${relative(tell.date, now)}).`
          : `${event.title} is already planned for ${dayLabel(tell.date, now)}.`,
        `Planned ${event.title}`,
      )
    }
    case "ask-event": {
      const event = findEvent(tell.phrase, now)
      if (event) {
        const iso = isoOf(toLocalCalendarDate(event.date))
        return say(`${event.title}: ${dayLabel(iso, now)} (${relative(iso, now)}).`, `Event ${event.title}`)
      }
      return ask(
        `I don't have a date for ${titleFromPhrase(tell.phrase)}. Do you know when?`,
        { kind: "date", tell },
        "No event date",
      )
    }
    case "countdown": {
      const event = findEvent(tell.phrase, now)
      if (!event) {
        return ask(
          `I don't seem to have any future dates associated with ${tell.phrase}, do you have any more information for me?`,
          { kind: "date", tell },
          "No date for countdown",
        )
      }
      const iso = isoOf(toLocalCalendarDate(event.date))
      const time = event.isAllDay ? undefined : event.startTime
      return runAsAction("BIM: countdown", () => {
        const made = countdownFor(event.title, iso, time, event.id)
        return say(countdownReply(event.title, iso, now, made.added, false), `Countdown ${event.title}`)
      })
    }
    case "overdue":
      return applyOverdue(tell, now, pick.taskId)
  }
}

/** The line after a question. Null means it did not answer, so the caller drops the question and runs the line normally. */
export function answerTell(pending: TellPending, text: string, now: Date): TellReply | null {
  const raw = text.trim()
  if (pending.kind === "which") {
    const n = Number(raw)
    const byNumber = Number.isInteger(n) ? pending.options[n - 1] : undefined
    const key = normalizeName(raw)
    const byName = key ? pending.options.find((o) => normalizeName(o.label).includes(key)) : undefined
    const chosen = byNumber ?? byName
    if (!chosen) return isDecline(raw) ? say("Okay, dropped it.", "Dropped") : null
    return applyTell(pending.tell, now, pending.what === "person" ? { personId: chosen.id } : { taskId: chosen.id })
  }

  if (isDecline(raw)) {
    const what = pending.tell.kind === "last-seen" ? "I'll leave it blank." : "Okay, nothing added."
    return say(what, "Declined")
  }
  const tell = pending.tell
  if (tell.kind === "last-seen") {
    const day = parseDayAnswer(raw, now, "past")
    if (!day) return null
    if (day.iso > isoOf(now)) {
      return ask("That day hasn't happened yet. When did you last see them?", pending, "Date in the future")
    }
    return applyTell({ ...tell, date: day.iso }, now, { personId: pending.personId })
  }
  const day = parseDayAnswer(raw, now, "future")
  if (!day) return null
  if (day.iso < isoOf(now)) {
    return ask("That day has already passed. When is it?", pending, "Date in the past")
  }
  if (tell.kind === "ask-event") {
    return applyTell({ kind: "event", title: titleFromPhrase(tell.phrase), date: day.iso, time: day.time }, now)
  }
  if (tell.kind === "countdown") {
    const title = titleFromPhrase(tell.phrase)
    return runAsAction("BIM: countdown", () => {
      const planned = planEvent(title, day.iso, day.time)
      const made = countdownFor(title, day.iso, day.time, planned.event.id)
      return say(countdownReply(title, day.iso, now, made.added, planned.added), `Countdown ${title}`)
    })
  }
  return null
}
