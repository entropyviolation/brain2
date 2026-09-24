/**
 * lib/friend-mission.ts — Mission log for today's friend
 *
 * Cap 80. Gallery Details reads this. A mission is offered from the chat
 * button, then accepted (points only if finished before local midnight) or
 * declined through smaller tasks, a first step, and a written reason.
 * The mission sheet opens the associated Item in a popup (`friendMissionItemId`).
 */

import type { FriendDialogEffect, FriendSuggestionKind, FriendSuggestionSource } from "@/lib/baby-animal-personality"

export const FRIEND_MISSION_STATUSES = ["offered", "accepted", "declined", "done", "expired"] as const
export type FriendMissionStatus = (typeof FRIEND_MISSION_STATUSES)[number]

export const FRIEND_MISSION_NOTES = [
  "offered",
  "accepted",
  "breakdown-yes",
  "breakdown-no",
  "first-step-yes",
  "first-step-no",
  "declined",
  "done",
  "expired",
] as const
export type FriendMissionNote = (typeof FRIEND_MISSION_NOTES)[number]

export type FriendMissionLogEntry = {
  at: string
  note: FriendMissionNote
  detail?: string
}

export type FriendMission = {
  id: string
  animalId: string
  displayName: string
  offeredAt: string
  title: string
  line: string
  blurb: string
  source: FriendSuggestionSource | null
  taskId: string | null
  /** When accepted as “just the first step”, the subtask that counts. */
  stepId: string | null
  stepTitle: string
  kind: FriendSuggestionKind
  status: FriendMissionStatus
  points: number
  effect: FriendDialogEffect
  acceptedAt: string
  /** Local end of the accept day. Points only land at or before this instant. */
  deadline: string
  declineReason: string
  log: FriendMissionLogEntry[]
}

/** What `offerMission` receives. The store fills id, status, and the log. */
export type FriendMissionDraft = Omit<
  FriendMission,
  "id" | "offeredAt" | "status" | "log" | "acceptedAt" | "deadline" | "declineReason" | "stepId" | "stepTitle"
>

const KINDS: FriendSuggestionKind[] = ["mission", "affection", "whim", "reunion", "empty"]
const EFFECTS: FriendDialogEffect[] = ["plain", "heart", "sparkle", "stamp", "whisper", "bounce"]

/** 23:59:59.999 local time on `date`'s calendar day. */
export function endOfLocalDay(date = new Date()): string {
  const end = new Date(date)
  end.setHours(23, 59, 59, 999)
  return end.toISOString()
}

export function isBeforeDeadline(deadline: string | undefined, now = new Date()): boolean {
  if (!deadline) return true
  const time = new Date(deadline).getTime()
  if (Number.isNaN(time)) return true
  return now.getTime() <= time
}

export function withMissionLog(
  log: FriendMissionLogEntry[] | undefined,
  note: FriendMissionNote,
  detail?: string,
  at = new Date().toISOString(),
): FriendMissionLogEntry[] {
  const trimmed = detail?.trim().slice(0, 400)
  const entry: FriendMissionLogEntry = trimmed ? { at, note, detail: trimmed } : { at, note }
  return [...(log ?? []), entry].slice(-24)
}

export type FriendStepSpec = {
  description: string
  context: string
  isMolecular: true
}

/** Three small pieces for “break this down”, named from the task title. */
export function friendBreakdownSteps(title: string): FriendStepSpec[] {
  const name = title.trim() || "this task"
  return [
    { description: `Set out ${name}`, context: `Get what you need before "${name}".`, isMolecular: true },
    { description: name, context: `The main piece of "${name}".`, isMolecular: true },
    { description: `Close ${name}`, context: `Leave "${name}" finished or noted.`, isMolecular: true },
  ]
}

/** One molecular opener when they only want the first step. */
export function friendFirstStep(title: string): FriendStepSpec {
  const name = title.trim() || "this task"
  return {
    description: `Start ${name}`,
    context: `The first small piece of "${name}".`,
    isMolecular: true,
  }
}

const NOTE_LEAD: Record<FriendMissionNote, string> = {
  offered: "Offered",
  accepted: "Accepted",
  "breakdown-yes": "Broke it into smaller tasks",
  "breakdown-no": "Did not want it broken down",
  "first-step-yes": "Took just the first step",
  "first-step-no": "Did not want only the first step",
  declined: "Declined",
  done: "Finished",
  expired: "The day ended",
}

export function friendMissionLogSentence(entry: FriendMissionLogEntry): string {
  const lead = NOTE_LEAD[entry.note] ?? entry.note
  return entry.detail ? `${lead}: ${entry.detail}` : lead
}

const STATUS_LEAD: Record<FriendMissionStatus, string> = {
  offered: "Waiting for a yes or no",
  accepted: "Accepted",
  declined: "Declined",
  done: "Finished",
  expired: "Expired",
}

export function friendMissionStatusLabel(status: FriendMissionStatus): string {
  return STATUS_LEAD[status] ?? status
}

export function isActionableFriendKind(kind: FriendSuggestionKind): boolean {
  return kind === "mission" || kind === "whim"
}

export function sanitizeFriendMission(raw: unknown): FriendMission | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
  const rec = raw as Record<string, unknown>
  const id = typeof rec.id === "string" && rec.id.trim() ? rec.id.trim().slice(0, 80) : ""
  if (!id) return null
  const status = FRIEND_MISSION_STATUSES.includes(rec.status as FriendMissionStatus)
    ? (rec.status as FriendMissionStatus)
    : "offered"
  const kind = KINDS.includes(rec.kind as FriendSuggestionKind) ? (rec.kind as FriendSuggestionKind) : "mission"
  const effect = EFFECTS.includes(rec.effect as FriendDialogEffect) ? (rec.effect as FriendDialogEffect) : "plain"
  const points = typeof rec.points === "number" && Number.isFinite(rec.points) ? Math.max(0, Math.round(rec.points)) : 0
  const log = sanitizeMissionLog(rec.log)
  return {
    id,
    animalId: typeof rec.animalId === "string" ? rec.animalId.slice(0, 48) : "",
    displayName: typeof rec.displayName === "string" ? rec.displayName.slice(0, 80) : "",
    offeredAt: typeof rec.offeredAt === "string" ? rec.offeredAt : new Date().toISOString(),
    title: typeof rec.title === "string" ? rec.title.slice(0, 160) : "Mission",
    line: typeof rec.line === "string" ? rec.line.slice(0, 240) : "",
    blurb: typeof rec.blurb === "string" ? rec.blurb.slice(0, 400) : "",
    source: typeof rec.source === "string" ? (rec.source as FriendSuggestionSource) : null,
    taskId: typeof rec.taskId === "string" ? rec.taskId.slice(0, 80) : null,
    stepId: typeof rec.stepId === "string" && rec.stepId.trim() ? rec.stepId.trim().slice(0, 80) : null,
    stepTitle: typeof rec.stepTitle === "string" ? rec.stepTitle.slice(0, 160) : "",
    kind,
    status,
    points,
    effect,
    acceptedAt: typeof rec.acceptedAt === "string" ? rec.acceptedAt : "",
    deadline: typeof rec.deadline === "string" ? rec.deadline : "",
    declineReason: typeof rec.declineReason === "string" ? rec.declineReason.slice(0, 400) : "",
    log,
  }
}

function sanitizeMissionLog(raw: unknown): FriendMissionLogEntry[] {
  if (!Array.isArray(raw)) return []
  const out: FriendMissionLogEntry[] = []
  for (const row of raw) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue
    const rec = row as Record<string, unknown>
    if (!FRIEND_MISSION_NOTES.includes(rec.note as FriendMissionNote)) continue
    const detail = typeof rec.detail === "string" ? rec.detail.trim().slice(0, 400) : ""
    out.push({
      at: typeof rec.at === "string" ? rec.at : new Date().toISOString(),
      note: rec.note as FriendMissionNote,
      ...(detail ? { detail } : {}),
    })
    if (out.length >= 24) break
  }
  return out
}

export function sanitizeFriendMissions(raw: unknown): FriendMission[] {
  if (!Array.isArray(raw)) return []
  const out: FriendMission[] = []
  for (const row of raw) {
    const next = sanitizeFriendMission(row)
    if (next) out.push(next)
    if (out.length >= 80) break
  }
  return out
}

export function missionsForAnimal(rows: FriendMission[], animalId: string): FriendMission[] {
  const id = animalId.trim().toLowerCase()
  return rows.filter((row) => row.animalId.toLowerCase() === id)
}

/** Real Item id for the mission sheet, or null (habits / whims / affection). */
export function friendMissionItemId(taskId: string | null | undefined): string | null {
  if (!taskId) return null
  const id = taskId.trim()
  if (!id) return null
  if (id.startsWith("habit:") || id.startsWith("whim:")) return null
  return id
}
