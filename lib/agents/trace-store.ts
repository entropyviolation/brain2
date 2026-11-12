/**
 * lib/agents/trace-store.ts — Where Traces are kept
 *
 * One shared run store for every agent (`docs/AGENT_LAB_PLAN.md` `PH-2`). The newest Traces stay on this
 * device (`agent-traces-v1`, outside the vault); every Trace also goes whole to the disk archive
 * (`lib/bim-flow/archive.ts`, kind `trace`), which is the long record. If the device refuses the write,
 * fewer are kept until it fits. Saving never throws: a Trace that cannot be kept never stops a run.
 *
 * The one impure file in `lib/agents/`.
 */

import { archive } from "@/lib/bim-flow/archive"
import type { Trace } from "./trace"

const KEY = "agent-traces-v1"
export const TRACE_KEEP = 150

/** Newest first. Empty where there is no `localStorage` (tests in node, the hub). */
export function loadTraces(): Trace[] {
  try {
    const rows = JSON.parse(localStorage.getItem(KEY) ?? "[]") as Trace[]
    return Array.isArray(rows) ? rows : []
  } catch {
    return []
  }
}

function write(rows: Trace[]): void {
  for (let n = Math.min(rows.length, TRACE_KEEP); n >= 1; n = Math.floor(n / 2)) {
    try {
      localStorage.setItem(KEY, JSON.stringify(rows.slice(0, n)))
      return
    } catch {}
  }
}

/** Keeps one Trace: newest first on the device, and whole on disk. A Trace saved twice replaces itself. */
export function saveTrace(trace: Trace): void {
  try {
    write([trace, ...loadTraces().filter((t) => t.run.id !== trace.run.id)])
  } catch {}
  archive("trace", trace)
}

export function getTrace(id: string): Trace | undefined {
  return loadTraces().find((t) => t.run.id === id)
}

/** The kept Traces of one agent, newest first. */
export function tracesOf(blueprintId: string): Trace[] {
  return loadTraces().filter((t) => t.run.blueprint.id === blueprintId)
}
