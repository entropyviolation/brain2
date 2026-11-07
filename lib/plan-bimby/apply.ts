/**
 * lib/plan-bimby/apply.ts — What finishing a plan item writes
 *
 * Three doors, each through the store that owns it: an intake row (`applyIntake`, source `plan-bimby`),
 * a `timeLogs` slice on the linked task (`taskRepository`, the way `focus-timer-log.ts` does it), and a Flight
 * item built from a pasted confirmation (`parseFlightText`). Each returns the plain sentence the run list shows,
 * or null when it wrote nothing. Called only after the person pressed play, done or file; never on its own.
 */

import { runAsAction } from "@/lib/action-history"
import { taskRepository } from "@/lib/data/task-repository"
import { extractFlights } from "@/lib/flight-bimby/extract"
import { fileFlightDraft, flightList } from "@/lib/flight-bimby/file"
import { FLIGHT_ATTR, FLIGHT_TYPE_ID } from "@/lib/flight-types"
import { applyIntake } from "@/lib/ingest/apply-discrete-event"
import { splitIntoDaySlices } from "@/lib/operation-work-session"
import { formatParsedFlightBody, parseFlightText } from "@/lib/parse-flight-text"
import { useTaskStore } from "@/lib/task-store"
import { minutesToTimeString } from "@/lib/time-entries"
import type { Task, TimeLogEntry } from "@/lib/types"
import type { Span } from "./run"
import type { PlanLink, RunItem } from "./types"

export const PLAN_BIMBY_ACTIVITY = "plan bimby"
/** A play shorter than this is a mis-tap, not work. */
const MIN_SPAN_MS = 30_000

/** The intake row for a finished "make more coffee". The note says where it came from. */
export function logIntakeFor(item: Pick<RunItem, "title">, link: Extract<PlanLink, { kind: "intake" }>, now: Date): string | null {
  const note = `Auto-created from the task “${item.title}” in a short-term plan, run with the Plan BIMBY.`
  const res = applyIntake(`${link.label}\n${note}`, now, link.intakeClass, "plan-bimby")
  return res.status === "ok" ? `Logged intake: ${link.label}` : null
}

export function planLogId(taskId: string, startedAtIso: string, date: string): string {
  return `plan-log-${taskId}-${startedAtIso}-${date}`
}

/** One closed play as time on the task. Returns "Logged 12 min on …" or null (no task, or too short). */
export function logSpanOnTask(taskId: string, span: Span): string | null {
  const start = new Date(span.startedAt)
  const end = new Date(span.endedAt)
  if (end.getTime() - start.getTime() < MIN_SPAN_MS) return null
  return runAsAction("plan bimby time", () => {
    const task = taskRepository.getById(taskId)
    if (!task) return null
    let logs = [...(task.timeLogs ?? [])]
    let minutes = 0
    for (const slice of splitIntoDaySlices(start, end)) {
      const log: TimeLogEntry = {
        id: planLogId(taskId, span.startedAt, slice.date),
        date: slice.date,
        startTime: minutesToTimeString(slice.startMin),
        endTime: minutesToTimeString(slice.endMin),
        durationMinutes: Math.max(1, slice.durationMinutes),
        notes: PLAN_BIMBY_ACTIVITY,
        activityLabel: PLAN_BIMBY_ACTIVITY,
        taskId,
      }
      const at = logs.findIndex((l) => l.id === log.id)
      if (at >= 0) logs[at] = log
      else logs = [...logs, log]
      minutes += log.durationMinutes
    }
    const latest = taskRepository.getById(taskId)
    if (!latest) return null
    taskRepository.update({ ...latest, timeLogs: logs, actualDuration: logs.reduce((sum, l) => sum + l.durationMinutes, 0) })
    return `Logged ${minutes} min on ${task.title || task.description}`
  })
}

export { flightList }

/** Build a Flight task from whatever the person pasted (a confirmation email, or just the code). */
export function buildFlightTask(raw: string, listId: string, now: Date): Task {
  const text = raw.trim()
  const parsed = parseFlightText(text)
  // A bare code ("K7QZ2P") reads as a confirmation even when nothing else parsed.
  const bare = /^[A-Z0-9]{5,8}$/i.test(text) ? text.toUpperCase() : undefined
  const confirmation = parsed.confirmation ?? bare
  const first = parsed.segments[0]
  const last = parsed.segments[parsed.segments.length - 1]
  const departDate = first?.departDate ?? parsed.departureDate
  const departTime = first?.departTime ?? parsed.time
  const attributes: Task["attributes"] = {
    [FLIGHT_ATTR.booked]: true,
    ...(parsed.airline ? { [FLIGHT_ATTR.airline]: parsed.airline } : {}),
    ...(parsed.flightNumbers.length ? { [FLIGHT_ATTR.flightNumber]: parsed.flightNumbers.join(", ") } : {}),
    ...(parsed.fromAirport ?? first?.from ? { [FLIGHT_ATTR.departureAirport]: (parsed.fromAirport ?? first?.from)! } : {}),
    ...(parsed.toAirport ?? last?.to ? { [FLIGHT_ATTR.arrivalAirport]: (parsed.toAirport ?? last?.to)! } : {}),
    ...(departDate ? { [FLIGHT_ATTR.departureTime]: departTime ? `${departDate}T${departTime}` : departDate } : {}),
    ...(last?.arriveDate && last.arriveTime ? { [FLIGHT_ATTR.arrivalTime]: `${last.arriveDate}T${last.arriveTime}` } : {}),
    ...(parsed.layovers.length ? { [FLIGHT_ATTR.layovers]: parsed.layovers.map((l) => [l.place, l.durationLabel].filter(Boolean).join(" ") || l.label) } : {}),
    ...(confirmation ? { [FLIGHT_ATTR.bookingNumber]: confirmation } : {}),
  }
  const route = [attributes[FLIGHT_ATTR.departureAirport], attributes[FLIGHT_ATTR.arrivalAirport]].filter(Boolean).join(" → ")
  const title = parsed.title && parsed.title !== text ? parsed.title : route || (confirmation ? `Flight ${confirmation}` : "Flight")
  return {
    id: `flight-${now.getTime().toString(36)}`,
    description: title,
    title,
    type: FLIGHT_TYPE_ID,
    lists: [listId],
    stage: "clarified",
    estimatedDuration: 0,
    cognitiveLoad: 1,
    urgency: 3,
    importance: 3,
    dependencies: [],
    context: "@anywhere",
    entropy: 0.2,
    rewardValue: 0,
    completed: false,
    allowPartialCompletion: false,
    minimumChunkSize: 15,
    createdAt: now,
    ...(departDate ? { scheduledDate: new Date(`${departDate}T00:00:00`) } : {}),
    body: formatParsedFlightBody(parsed) ? `<p>${formatParsedFlightBody(parsed).replace(/\n/g, "<br>")}</p>` : undefined,
    attributes,
  } as Task
}

/** File a flight from a confirmation. Returns the sentence for the run list, or null when there was nothing to read. */
export function fileFlight(raw: string, now: Date): string | null {
  if (!raw.trim()) return null
  // The Flight BIMBY reads a full confirmation (several flights, cross-zone times) and files the event too.
  const read = extractFlights(raw, now)
  if (read.flights.length) return read.flights.map((d) => fileFlightDraft(d, now).line).join(" ")
  // A bare code, or a paste with no route in it: keep the old, plain Flight item.
  return runAsAction("plan bimby flight", () => {
    const state = useTaskStore.getState()
    const list = flightList(state.lists, (l) => state.addList(l), now)
    const task = buildFlightTask(raw, list.id, now)
    taskRepository.add(task)
    return `Filed flight “${task.title}” in ${list.name}`
  })
}
