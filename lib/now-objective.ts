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
  /** ISO wall clock when added. */
  addedAt: string
  /** ISO when marked complete; omit = still active. */
  completedAt?: string
  /**
   * The task step this objective is (only while a task is on the pen clock).
   * Ticking the objective ticks the step, with `completedAt − addedAt` as its
   * actual minutes. Omitted = free-form, as before.
   */
  stepId?: string
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
      x.stepId !== y.stepId
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
      if (row.stepId) packed.stepId = row.stepId
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
  const row: NowObjective = { id: rid(), text: trimmed, addedAt: (extra.addedAt ?? now).toISOString() }
  if (extra.stepId) row.stepId = extra.stepId
  return [...(list ?? []), row]
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
      const next = { ...row }
      delete next.completedAt
      return next
    }
    return { ...row, completedAt: now.toISOString() }
  })
}

export function removeNowObjective(list: NowObjective[] | undefined, id: string): NowObjective[] {
  return (list ?? []).filter((row) => row.id !== id)
}
