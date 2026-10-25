/**
 * components/Home/Tracking/timegrid-reveal.ts — Which block the Time Grid should show
 *
 * A tiny signal. The block editor asks; the day grid scrolls. No store import,
 * so pen settings and the header can listen without parsing the time grid.
 */

export interface TimegridReveal {
  entryId: string
  date: string
  scopeId: string
  startMin: number
}

type Listener = () => void

let pending: TimegridReveal | null = null
const listeners = new Set<Listener>()

export function peekTimegridReveal(): TimegridReveal | null {
  return pending
}

export function setTimegridReveal(next: TimegridReveal): void {
  pending = next
  listeners.forEach((listener) => listener())
}

/** Drop a reveal without telling the grid. Used after the day grid has scrolled. */
export function clearTimegridReveal(entryId?: string): void {
  if (entryId && pending && pending.entryId !== entryId) return
  pending = null
}

export function resetTimegridReveal(): void {
  pending = null
}

export function subscribeTimegridReveal(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Hour row (0–23) that holds this minute. */
export function timegridBlockHour(startMin: number): number {
  if (!Number.isFinite(startMin)) return 0
  return Math.min(23, Math.max(0, Math.floor(startMin / 60)))
}

/**
 * Scroll offset that puts `hour` just under the sticky minute ruler.
 * Same placement as the grid's waking open. A missing row falls back to
 * `hour * rowHeight`.
 */
export function timegridHourScrollTop(
  hour: number,
  rowHeight: number,
  rowOffset: number | null,
  rulerHeight: number,
): number {
  const rowTop = rowOffset == null ? hour * rowHeight : rowOffset
  return Math.max(0, rowTop - rulerHeight)
}
