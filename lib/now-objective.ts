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
    if (x.id !== y.id || x.text !== y.text || x.addedAt !== y.addedAt || x.completedAt !== y.completedAt) {
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
      return packed
    })
    .filter((row): row is NowObjective => row != null)
  return next.length ? next : undefined
}

export function addNowObjective(
  list: NowObjective[] | undefined,
  text: string,
  now = new Date(),
): NowObjective[] {
  const trimmed = text.trim()
  if (!trimmed) return list ?? []
  return [
    ...(list ?? []),
    { id: rid(), text: trimmed, addedAt: now.toISOString() },
  ]
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
