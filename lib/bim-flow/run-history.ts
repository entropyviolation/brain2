/**
 * lib/bim-flow/run-history.ts — Every run from the bench, kept so it can be replayed
 *
 * The Run button saves one record per run: the graph as it was, the input, and
 * the whole result (steps, answers, proposals, blocks). Big step outputs are cut
 * (`keep`). Kept on this device (`bimflow-runs-v1`); if the device refuses the
 * write, fewer runs are kept until it fits.
 *
 * Every run says where it came from (`origin`). Runs started by the Suggest button in BIM's LLM
 * tab are kept under their own key (`bimflow-button-runs-v1`), so a week of messages cannot push the
 * bench's runs out, and they keep the suggestions that pass showed.
 */

import { archive } from "./archive"
import { CAP, keep } from "./tests"
import type { Suggestion } from "./suggestions"
import type { Flow, FlowRun } from "./types"

/** Where a run started. Test runs live in `tests.ts` and are always "tests". */
export type RunOrigin = "bench" | "brain2-button" | "tests"

export const ORIGIN_LABEL: Record<RunOrigin, string> = {
  bench: "Run on the BIM flow bench",
  "brain2-button": "Activated from Brain2 button click (BIM LLM tab → Suggest)",
  tests: "Created in BIM flow tests",
}

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
  /** Absent on runs kept before origins were recorded: those came from the bench. */
  origin?: RunOrigin
  /** brain2-button: the suggestions this pass showed, so verdicts can be read against them. */
  suggestions?: Suggestion[]
}

export const originOf = (r: Pick<SavedRun, "origin">): RunOrigin => r.origin ?? "bench"

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

const BUTTON_KEY = "bimflow-button-runs-v1"
const BUTTON_KEEP = 30

function read(key: string): SavedRun[] {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as SavedRun[]) : []
  } catch {
    return []
  }
}

function write(key: string, rows: SavedRun[], most: number): SavedRun[] {
  for (let n = most; n >= 1; n = Math.floor(n / 2)) {
    const kept = rows.slice(0, n)
    try {
      localStorage.setItem(key, JSON.stringify(kept))
      return kept
    } catch {}
  }
  return []
}

/** Bench runs and button runs together, newest first. */
export function loadHistory(): SavedRun[] {
  return [...read(KEY), ...read(BUTTON_KEY)].sort((a, b) => b.at.localeCompare(a.at))
}

/** Saves each run under its own origin's key. Returns what was kept. */
export function saveHistory(rows: SavedRun[]): SavedRun[] {
  const button = write(BUTTON_KEY, rows.filter((r) => originOf(r) === "brain2-button"), BUTTON_KEEP)
  const bench = write(KEY, rows.filter((r) => originOf(r) !== "brain2-button"), KEEP)
  return [...bench, ...button].sort((a, b) => b.at.localeCompare(a.at))
}

/** Keep one Suggest pass from the LLM tab: on this device, and whole on disk (`archive.ts`). */
export function saveButtonRun(row: SavedRun): void {
  archive("flow-run", { origin: row.origin, flowId: row.flowId, model: row.model, flow: row.flow, run: row.run, suggestions: row.suggestions })
  write(BUTTON_KEY, [{ ...row, run: slimRun(row.run) }, ...read(BUTTON_KEY).filter((r) => r.id !== row.id)], BUTTON_KEEP)
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
