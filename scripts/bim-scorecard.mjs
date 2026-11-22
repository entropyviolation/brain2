#!/usr/bin/env node
/**
 * scripts/bim-scorecard.mjs — `npm run bim:scorecard`: replay the real labelled lines through BIM chat and save a
 * dated scorecard to `data/bim-scorecards/`, compared with the last one (gained / lost).
 *
 *   npm run bim:scorecard                 code only, the person's vault copy
 *   npm run bim:scorecard -- --llm        also the live run on this Mac's Ollama (loads the crew first)
 *   npm run bim:scorecard -- --llm --cold no warm-up: a cold model load shows inside the turns
 *   npm run bim:scorecard -- --llm-only   the live run alone
 *   npm run bim:scorecard -- --limit 50 --lanes track,todo --no-vault
 *
 * It runs `lib/bim-scorecard/real-lines.live.test.ts` in vitest, because the stores need its browser shim.
 */
import { spawnSync } from "node:child_process"

const args = process.argv.slice(2)
const env = { ...process.env, BIM_SCORECARD: "1" }
for (let i = 0; i < args.length; i++) {
  const a = args[i]
  if (a === "--llm") env.BIM_SCORECARD_LLM = "1"
  else if (a === "--llm-only") env.BIM_SCORECARD_LLM = "only"
  else if (a === "--cold") env.BIM_SCORECARD_COLD = "1"
  else if (a === "--no-vault") env.BIM_SCORECARD_VAULT = "0"
  else if (a === "--limit") env.BIM_SCORECARD_LIMIT = args[++i]
  else if (a === "--lanes") env.BIM_SCORECARD_LANES = args[++i]
  else if (a === "--file") env.BIM_SCORECARD_FILE = args[++i]
  else {
    console.error(`unknown option ${a}`)
    process.exit(2)
  }
}
const run = spawnSync("npx", ["vitest", "run", "lib/bim-scorecard/real-lines.live.test.ts", "--silent=false", "--dir", "lib/bim-scorecard"], { stdio: "inherit", env })
process.exit(run.status ?? 1)
