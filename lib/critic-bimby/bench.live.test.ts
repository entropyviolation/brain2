/**
 * Opt-in: the model critic against a real local model, on the gold plans and injected faults.
 * `BIM_LIVE=1 npx vitest run lib/critic-bimby/bench.live.test.ts`
 * Needs Ollama. BIM_CRITIC_MODELS is a comma list (default the `critic` crew ladder). Prints the report and the gate's
 * verdict per model, and appends them to the file named by BIM_LIVE_OUT when set. It does not write the gate to storage (there is none under vitest).
 */
import fs from "node:fs"
import { describe, expect, it } from "vitest"
import { CREW_LADDERS } from "@/lib/bim-flow/crew"
import { ollamaCall } from "@/lib/bim-flow/ollama"
import { formatBench, GOLD, runBench, runBenchAsync } from "./bench"
import { gateOf } from "./gate"
import { critiqueWithModel } from "./run"

const live = process.env.BIM_LIVE === "1"
const models = (process.env.BIM_CRITIC_MODELS ?? CREW_LADDERS.critic.join(",")).split(",").map((m) => m.trim()).filter(Boolean)

describe.skipIf(!live)("live: the model critic on the bench", () => {
  const code = runBench()
  for (const model of models) {
    it(`${model}`, async () => {
      const call = ollamaCall(model, undefined, { fresh: true })
      const t0 = Date.now()
      const combined = await runBenchAsync((d) => critiqueWithModel({ draft: { ...d, model: "bench-planner" }, call, ladder: [model], ready: () => true, force: true }), GOLD)
      const g = gateOf(code, combined)
      const report = `\n${model} (${Math.round((Date.now() - t0) / 1000)}s)\n${formatBench(combined)}\ncatch ${g.catchRate.toFixed(2)}, false alarms ${g.falseAlarmRate.toFixed(2)}, margin ${g.margin.toFixed(2)} → ${g.ready ? "READY" : `not ready: ${g.why.join("; ")}`}`
      console.log(report)
      if (process.env.BIM_LIVE_OUT) fs.appendFileSync(process.env.BIM_LIVE_OUT, `${report}\n`)
      expect(combined.of).toBeGreaterThan(0)
    }, 30 * 60_000)
  }
})
