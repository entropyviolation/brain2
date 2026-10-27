/**
 * lib/now-objective.ts — Objectives for right now on a live timer block
 *
 * Free-form objectives nested in the current exact activity (an Operations
 * work session or a pen-color session and its painted TimeEntry). Not Home
 * Goals, and not the Tracking Objective pen (`so:` / switch objective).
 */
export interface NowObjective {
  id: string
  text: string
  /**
   * ISO wall clock when the objective was first written. Kept when it is
   * parked and picked up again. Not the start of the current work stint.
   */
  addedAt: string
  /** ISO when marked complete; omit = still active. */
  completedAt?: string
  /**
   * Logged as already done during this session. The start is unknown, but it
   * is not before the session (or block) began. `addedAt` is that floor, not
   * a claimed start, and the row has no worked duration.
   */
  startUnknown?: boolean
  /**
   * Milliseconds of work already banked, excluding time the objective spent
   * parked in unfinished. The open stint, when there is one, begins at
   * `stintStartedAt`. Omitted on older rows: a completed one then uses
   * `completedAt − addedAt`.
   */
  workedMs?: number
  /** ISO when the current active stint began. Omitted while parked or done. */
  stintStartedAt?: string
  /**
   * Task this objective is attached to. With `stepId`, that step belongs to
   * this task. Omitted = the task on the clock, if any.
   */
  taskId?: string
  /**
   * The task step this objective is. Ticking the objective ticks the step.
   * Minutes are active work (`workedMs` plus the open stint), not the calendar
   * gap while it was saved for later. Omitted = free-form, as before.
   */
  stepId?: string
  /**
   * What finishing the objective means for its task. With a `stepId`: omitted
   * or true ticks that step; false only counts the time toward it (the step
   * stays open). Without a `stepId`: true finishes the whole clock task;
   * omitted means it is just a line in the session.
   */
  completes?: boolean
}

function rid(): string {
  return `nobj-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function activeNowObjectives(list: NowObjective[] | undefined): NowObjective[] {
  return (list ?? []).filter((row) => !row.completedAt)
}

export function sameNowObjectives(
  a: NowObjective[] | undefined,
  b: NowObjective[] | undefined,
): boolean {
  const left = a ?? []
  const right = b ?? []
  if (left.length !== right.length) return false
  for (let i = 0; i < left.length; i++) {
    const x = left[i]
    const y = right[i]
    if (
      x.id !== y.id ||
      x.text !== y.text ||
      x.addedAt !== y.addedAt ||
      x.completedAt !== y.completedAt ||
      x.startUnknown !== y.startUnknown ||
      x.workedMs !== y.workedMs ||
      x.stintStartedAt !== y.stintStartedAt ||
      x.taskId !== y.taskId ||
      x.stepId !== y.stepId ||
      x.completes !== y.completes
    ) {
      return false
    }
  }
  return true
}

/** Compact empty → undefined so omitted vault rows stay clean. Drops blank rows. */
export function compactNowObjectives(list: NowObjective[] | undefined): NowObjective[] | undefined {
  if (!list?.length) return undefined
  const next = list
    .map((row) => {
      const text = row.text.trim()
      if (!text) return null
      const packed: NowObjective = { id: row.id, text, addedAt: row.addedAt }
      if (row.completedAt) packed.completedAt = row.completedAt
      if (row.startUnknown) packed.startUnknown = true
      if (row.workedMs) packed.workedMs = row.workedMs
      if (row.stintStartedAt && !row.completedAt) packed.stintStartedAt = row.stintStartedAt
      if (row.taskId) packed.taskId = row.taskId
      if (row.stepId) packed.stepId = row.stepId
      if (row.completes !== undefined) packed.completes = row.completes
      return packed
    })
    .filter((row): row is NowObjective => row != null)
  return next.length ? next : undefined
}

export function addNowObjective(
  list: NowObjective[] | undefined,
  text: string,
  now = new Date(),
  extra: { stepId?: string; addedAt?: Date } = {},
): NowObjective[] {
  const trimmed = text.trim()
  if (!trimmed) return list ?? []
  const addedAt = (extra.addedAt ?? now).toISOString()
  const row: NowObjective = { id: rid(), text: trimmed, addedAt, stintStartedAt: addedAt }
  if (extra.stepId) row.stepId = extra.stepId
  return [...(list ?? []), row]
}

/**
 * An objective already finished during this session. The start is unknown.
 * `sessionStartedAt` is only the floor (it began after the session did).
 * `completedAt` is the moment it was logged, which is before or at `now`.
 */
export function addCompletedNowObjective(
  list: NowObjective[] | undefined,
  text: string,
  sessionStartedAt: Date,
  now = new Date(),
): NowObjective[] {
  const trimmed = text.trim()
  if (!trimmed) return list ?? []
  const floor = sessionStartedAt.getTime() <= now.getTime() ? sessionStartedAt : now
  const row: NowObjective = {
    id: rid(),
    text: trimmed,
    addedAt: floor.toISOString(),
    completedAt: now.toISOString(),
    startUnknown: true,
  }
  return [...(list ?? []), row]
}

/** Fold the open stint into `workedMs` and close it. Done and unknown-start rows stay put. */
export function bankOpenStint(row: NowObjective, now = new Date()): NowObjective {
  if (row.completedAt || row.startUnknown || !row.stintStartedAt) return row
  const extra = Math.max(0, now.getTime() - Date.parse(row.stintStartedAt))
  const next: NowObjective = { ...row, workedMs: (row.workedMs ?? 0) + extra }
  delete next.stintStartedAt
  return next
}

/**
 * Active work so far. Undefined when the start is unknown. Older completed
 * rows with no banked time use the wall span from `addedAt`.
 */
export function objectiveWorkedMs(
  row: Pick<NowObjective, "addedAt" | "completedAt" | "startUnknown" | "workedMs" | "stintStartedAt">,
  now = new Date(),
): number | undefined {
  if (row.startUnknown) return undefined
  const open =
    row.stintStartedAt && !row.completedAt ? Math.max(0, now.getTime() - Date.parse(row.stintStartedAt)) : 0
  if (row.workedMs != null || row.stintStartedAt) return (row.workedMs ?? 0) + open
  if (row.completedAt) return Math.max(0, Date.parse(row.completedAt) - Date.parse(row.addedAt))
  return undefined
}

/** Point an objective at a task, and optionally one of that task's steps. */
export function attachNowObjective(
  list: NowObjective[] | undefined,
  id: string,
  target: { taskId: string; stepId?: string },
): NowObjective[] {
  return (list ?? []).map((row) => {
    if (row.id !== id) return row
    const next: NowObjective = { ...row, taskId: target.taskId }
    if (target.stepId) {
      next.stepId = target.stepId
      next.completes = true
    } else {
      delete next.stepId
      if (next.completes === true) delete next.completes
    }
    return next
  })
}

/** Point an objective at a step, or clear the link with `undefined`. */
export function tieNowObjectiveToStep(
  list: NowObjective[] | undefined,
  id: string,
  stepId: string | undefined,
): NowObjective[] {
  return (list ?? []).map((row) => {
    if (row.id !== id) return row
    const next = { ...row }
    if (stepId) next.stepId = stepId
    else delete next.stepId
    return next
  })
}

/** Whether ticking this objective finishes something (its step, or the whole task). */
export function objectiveCompletesTarget(row: NowObjective): boolean {
  return row.stepId ? row.completes !== false : row.completes === true
}

/** Switch an objective between "counts toward" and "finishes" its target. */
export function setNowObjectiveCompletes(
  list: NowObjective[] | undefined,
  id: string,
  completes: boolean,
): NowObjective[] {
  return (list ?? []).map((row) => (row.id === id ? { ...row, completes } : row))
}

/**
 * A live line may start with when it began: `NOW 847 looking for photos`,
 * `now 8:47pm …`, or `8:47 …`. A bare number needs the `now` word, so
 * "1500 words" stays text. The clock is the latest such time not after `now`
 * (today, else yesterday). Returns the text without the clock.
 */
export function parseObjectiveClock(input: string, now = new Date()): { text: string; at?: Date } {
  const raw = input.trim()
  const lead = /^now\b[\s:,-]*/i.exec(raw)
  const rest = lead ? raw.slice(lead[0].length) : raw
  const re = lead
    ? /^(\d{1,2}):?(\d{2})\s*(am|pm)?\b[\s:,-]*(.*)$/i
    : /^(\d{1,2}):(\d{2})\s*(am|pm)?\b[\s:,-]*(.*)$/i
  const m = re.exec(rest)
  if (!m) return { text: lead ? rest || raw : raw }
  const hour = Number(m[1])
  const minute = Number(m[2])
  const text = m[4].trim()
  if (hour > 23 || minute > 59 || !text) return { text: lead ? rest : raw }
  const suffix = m[3]?.toLowerCase()
  const hours: number[] = suffix
    ? [(hour % 12) + (suffix === "pm" ? 12 : 0)]
    : hour >= 13 || hour === 0
      ? [hour]
      : [hour, hour + 12 === 24 ? 12 : hour + 12]
  let best: Date | undefined
  for (const dayBack of [0, 1]) {
    for (const h of hours) {
      const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayBack, h, minute, 0, 0)
      if (at.getTime() <= now.getTime() && (!best || at.getTime() > best.getTime())) best = at
    }
    if (best) break
  }
  return best ? { text, at: best } : { text: lead ? rest : raw }
}

export function editNowObjectiveText(
  list: NowObjective[] | undefined,
  id: string,
  text: string,
): NowObjective[] {
  return (list ?? []).map((row) => (row.id === id ? { ...row, text } : row))
}

export function toggleNowObjectiveComplete(
  list: NowObjective[] | undefined,
  id: string,
  now = new Date(),
): NowObjective[] {
  return (list ?? []).map((row) => {
    if (row.id !== id) return row
    if (row.completedAt) {
      const next = { ...row, stintStartedAt: now.toISOString() }
      delete next.completedAt
      delete next.startUnknown
      return next
    }
    const banked = bankOpenStint(row, now)
    const next: NowObjective = { ...banked, completedAt: now.toISOString() }
    delete next.stintStartedAt
    return next
  })
}

export function removeNowObjective(list: NowObjective[] | undefined, id: string): NowObjective[] {
  return (list ?? []).filter((row) => row.id !== id)
}
