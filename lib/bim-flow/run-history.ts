/**
 * lib/bim-flow/run-history.ts — Every run from the bench, kept so it can be replayed
 *
 * The Run button saves one record per run: the graph as it was, the input, and
 * the whole result (steps, answers, proposals, blocks). Big step outputs are cut
 * (`keep`). Kept on this device (`bimflow-runs-v1`); if the device refuses the
 * write, fewer runs are kept until it fits.
 */

import { CAP, keep } from "./tests"
import type { Flow, FlowRun } from "./types"

export interface SavedRun {
  id: string
  flowId: string
  flowName: string
  at: string
  model: string
  inputLabel: string
  /** The graph as it was when this ran, so a replay matches what happened. */
  flow: Flow
  run: FlowRun
}

const KEY = "bimflow-runs-v1"
const KEEP = 120

/** The run with step outputs and prompts cut to a size that fits in storage. */
export function slimRun(run: FlowRun): FlowRun {
  return {
    ...run,
    messages: run.messages.map((m) => ({
      ...m,
      steps: m.steps.map((s) => ({ ...s, output: keep(s.output), prompt: s.prompt && s.prompt.length > CAP ? s.prompt.slice(0, CAP) + " …(cut)" : s.prompt })),
    })),
  }
}

export function loadHistory(): SavedRun[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as SavedRun[]) : []
  } catch {
    return []
  }
}

export function saveHistory(rows: SavedRun[]): SavedRun[] {
  for (let n = KEEP; n >= 3; n = Math.floor(n / 2)) {
    const kept = rows.slice(0, n)
    try {
      localStorage.setItem(KEY, JSON.stringify(kept))
      return kept
    } catch {}
  }
  return rows.slice(0, 3)
}

const NOTES_KEY = "bimflow-run-notes-v1"

/** The person's own notes on runs and test runs, by run id. Kept apart so trimming runs keeps the notes. */
export function loadNotes(): Record<string, string> {
  try {
    const raw = localStorage.getItem(NOTES_KEY)
    return raw ? (JSON.parse(raw) as Record<string, string>) : {}
  } catch {
    return {}
  }
}

export function saveNotes(notes: Record<string, string>): void {
  try {
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes))
  } catch {}
}
