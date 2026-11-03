/**
 * lib/agents/bench-variants.ts — Ready-made ways to answer a BIMBY's "pick one tool" question
 *
 * Every BIMBY with a closed tool list asks the same thing: which tool does this line mean? These variants answer
 * it differently so `bench.ts` can score them on the same cases: a free code baseline (the floor any model has to
 * beat), one small model, and a swarm of voters with an option to decline when the vote splits. A new idea from
 * `docs/BIMBY_IDEAS.md` joins by returning another `Variant`. Nothing here writes.
 */

import type { ModelCall } from "@/lib/bim-flow/ollama"
import { runSwarm, type SwarmVoter } from "@/lib/swarm-vote/run"
import type { Answer, Variant } from "./bench"

export interface ClosedList {
  actions: readonly string[]
  /** One sentence per action, in the same order, for the baseline and for prompts. */
  does: readonly string[]
  system: string
}

const STOP = new Set("a an and are as at be by for from i in is it its of on or that the this to with all my me do does into than then them they".split(/\s+/))
const words = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP.has(w))
const stem = (w: string) => w.replace(/(ing|es|s|ed)$/, "")

/** Words in common between the line and each action's name and sentence. No model. Declines on no overlap or a tie. */
export function keywordBaseline(list: ClosedList): Variant {
  const bags = list.actions.map((a, i) => new Set([...words(a), ...words(list.does[i] ?? "")].map(stem)))
  return {
    id: "code-keywords",
    label: "Code keywords",
    about: "Word overlap with each tool's sentence. Free. The floor a model must beat.",
    run: async (input) => {
      const w = words(input).map(stem)
      const scores = bags.map((b) => w.filter((x) => b.has(x)).length)
      const best = Math.max(0, ...scores)
      if (!best) return { pick: null, note: "no word in common" }
      const tied = scores.filter((s) => s === best).length
      if (tied > 1) return { pick: null, note: `${tied}-way tie` }
      return { pick: list.actions[scores.indexOf(best)]!, confidence: best / Math.max(1, w.length) }
    },
  }
}

/** The best-agreeing pick of one or many voters. With `declineOnSplit`, a `split` or `empty` tally is a decline. */
export function swarmVariant(id: string, label: string, list: ClosedList, voters: SwarmVoter[], opts: { declineOnSplit?: boolean; timeoutMs?: number; about?: string } = {}): Variant {
  return {
    id,
    label,
    about: opts.about ?? `${voters.length} voter${voters.length === 1 ? "" : "s"}, Borda merged${opts.declineOnSplit ? ", declines on a split" : ""}.`,
    run: async (input): Promise<Answer> => {
      const r = await runSwarm(voters, { actions: list.actions, system: list.system, line: input, timeoutMs: opts.timeoutMs })
      const top = r.tally.standings[0]
      const note = `${r.tally.verdict} · agree ${Math.round(r.tally.agreement * 100)}% · ${r.tally.voters}/${voters.length} answered`
      if (!top || r.tally.verdict === "empty") return { pick: null, note }
      if (opts.declineOnSplit && r.tally.verdict !== "clear") return { pick: null, confidence: r.tally.agreement, note }
      return { pick: top.action, confidence: r.tally.agreement, note }
    },
  }
}

/** One model, one ballot. The control for "does the swarm add anything?". */
export function singleModelVariant(model: string, call: ModelCall, list: ClosedList, family = model.split(/[:/-]/)[0] ?? model): Variant {
  return swarmVariant(`one:${model}`, `One ${model}`, list, [{ voter: { id: `${model}#1`, family }, call, model }], { about: "One small model, one ranking." })
}
