/**
 * lib/critic-bimby/qualify.ts — Run the bench on one model and record whether it may be the critic
 *
 * Used by the "Check the second look" key on the Plan BIMBY and by the live bench. The model reads every gold plan and
 * every injected fault, with the model layer forced on, and `gateOf` decides. Slow on a local model: one call per case.
 */

import type { ModelCall } from "@/lib/bim-flow/ollama"
import { GOLD, runBench, runBenchAsync, type BenchReport } from "./bench"
import { gateOf, recordGate, type GateResult } from "./gate"
import { critiqueWithModel, HOST } from "./run"

export interface Qualified {
  result: GateResult
  code: BenchReport
  combined: BenchReport
}

export async function qualifyModel(call: ModelCall, model: string, onProgress?: (done: number, total: number) => void): Promise<Qualified> {
  const code = runBench()
  const combined = await runBenchAsync(
    // The planner is a made-up model name, so the critic always counts as a different model.
    (d) => critiqueWithModel({ draft: { ...d, model: "bench-planner" }, call, ladder: [model], ready: () => true, force: true }),
    GOLD,
    onProgress,
  )
  const result = gateOf(code, combined)
  recordGate(HOST, model, result)
  return { result, code, combined }
}
