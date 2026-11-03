/**
 * lib/plan-bimby/run.ts — The run list's clock (pure)
 *
 * One item plays at a time: playing another pauses the first. Every function returns the next `Run` and the
 * `spans` it closed (a span is one play-to-pause stretch), so the caller can log each as time on a task.
 * Nothing here reads a store or the real clock.
 */

import type { PlanItem, Run, RunItem } from "./types"

export interface Span {
  itemId: string
  startedAt: string
  endedAt: string
}

export interface Step {
  run: Run
  spans: Span[]
  /** The item the step finished, for effects that fire on done. */
  finished?: RunItem
}

export function startRun(items: PlanItem[], remarks: string[], source: string, now: Date): Run {
  return {
    id: `run-${now.getTime().toString(36)}`,
    startedAt: now.toISOString(),
    items: items.map((item) => ({
      ...item,
      state: "todo",
      accumMs: 0,
      effects: [],
      needsConfirmation: item.link?.kind === "flight",
    })),
    remarks,
    source,
  }
}

export function elapsedMs(item: Pick<RunItem, "accumMs" | "playedAt" | "state">, now: Date): number {
  const live = item.state === "running" && item.playedAt ? Math.max(0, now.getTime() - new Date(item.playedAt).getTime()) : 0
  return item.accumMs + live
}

/** Fold a running item's open stretch into `accumMs`; returns the closed span. */
function settle(item: RunItem, now: Date): { item: RunItem; span?: Span } {
  if (item.state !== "running" || !item.playedAt) return { item }
  const ms = Math.max(0, now.getTime() - new Date(item.playedAt).getTime())
  const span: Span = { itemId: item.id, startedAt: item.playedAt, endedAt: now.toISOString() }
  const { playedAt: _gone, ...rest } = item
  return { item: { ...rest, accumMs: item.accumMs + ms }, span }
}

function map(run: Run, id: string, now: Date, edit: (item: RunItem) => RunItem, alsoPause = false): Step {
  const spans: Span[] = []
  let finished: RunItem | undefined
  const items = run.items.map((item) => {
    if (item.id === id) {
      const settled = settle(item, now)
      if (settled.span) spans.push(settled.span)
      const next = edit(settled.item)
      if (next.state === "done" && item.state !== "done") finished = next
      return next
    }
    if (alsoPause && item.state === "running") {
      const settled = settle(item, now)
      if (settled.span) spans.push(settled.span)
      return { ...settled.item, state: "paused" as const }
    }
    return item
  })
  return { run: { ...run, items }, spans, ...(finished ? { finished } : {}) }
}

const open = (item: RunItem) => item.state !== "done" && item.state !== "skipped"

/** Play an item; any other running item is paused first. */
export function play(run: Run, id: string, now: Date): Step {
  const target = run.items.find((i) => i.id === id)
  if (!target || !open(target) || target.state === "running") return { run, spans: [] }
  return map(run, id, now, (item) => ({ ...item, state: "running", playedAt: now.toISOString() }), true)
}

export function pause(run: Run, id: string, now: Date): Step {
  return map(run, id, now, (item) => (item.state === "running" ? { ...item, state: "paused" } : item))
}

/** Done from any open state. An item that was never played is done with no time. */
export function complete(run: Run, id: string, now: Date): Step {
  const target = run.items.find((i) => i.id === id)
  if (!target || !open(target)) return { run, spans: [] }
  return map(run, id, now, (item) => ({ ...item, state: "done", doneAt: now.toISOString() }))
}

export function skip(run: Run, id: string, now: Date): Step {
  const target = run.items.find((i) => i.id === id)
  if (!target || !open(target)) return { run, spans: [] }
  return map(run, id, now, (item) => ({ ...item, state: "skipped" }))
}

/** Put a done or skipped item back to paused (it keeps its time). */
export function reopen(run: Run, id: string): Run {
  return { ...run, items: run.items.map((i) => (i.id === id && !open(i) ? { ...i, state: "paused" as const, doneAt: undefined } : i)) }
}

export function toggleSub(run: Run, id: string, subId: string): Run {
  return {
    ...run,
    items: run.items.map((i) =>
      i.id === id ? { ...i, subtasks: i.subtasks.map((s) => (s.id === subId ? { ...s, done: !s.done } : s)) } : i,
    ),
  }
}

export function addEffect(run: Run, id: string, text: string): Run {
  return { ...run, items: run.items.map((i) => (i.id === id ? { ...i, effects: [...i.effects, text] } : i)) }
}

/** The next item to play after this one: the first open item below it, else the first open anywhere. */
export function nextOpen(run: Run, afterId: string): RunItem | undefined {
  const at = run.items.findIndex((i) => i.id === afterId)
  return run.items.slice(at + 1).find(open) ?? run.items.find((i) => open(i) && i.id !== afterId)
}

export function isFinished(run: Run): boolean {
  return run.items.every((i) => !open(i))
}

export function formatClock(ms: number): string {
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const pad = (n: number) => String(n).padStart(2, "0")
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`
}
