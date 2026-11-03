/**
 * lib/swarm-vote/run.ts — Ask the voters in parallel and tally whoever answered
 *
 * Each voter is one `ModelCall` with the same closed-list schema. The wait is the slowest voter, capped by
 * `timeoutMs`; the vote goes ahead with whoever answered. A voter that throws is dropped, never retried.
 * The swarm picks what to show and never writes (`docs/BIMBY_IDEAS.md` §1).
 */

import type { ModelCall } from "@/lib/bim-flow/ollama"
import { cleanBallot, earlyStop, tally, type TallyOptions } from "./tally"
import type { Ballot, Tally, Voter } from "./types"

export interface SwarmVoter {
  voter: Voter
  call: ModelCall
  /** An Ollama model for this call alone, passed through to the call. */
  model?: string
  /** A phrasing of the system prompt; voters may differ here on purpose. */
  system?: string
}

export interface SwarmRequest {
  /** The BIMBY's closed list of tool names. */
  actions: readonly string[]
  system: string
  /** The person's line. */
  line: string
  timeoutMs?: number
  /** Stop waiting once the remaining voters cannot change the winner. */
  stopEarly?: boolean
  tally?: TallyOptions
}

export interface SwarmResult {
  ballots: Ballot[]
  /** Voters that threw or ran out of time. */
  missed: string[]
  tally: Tally
  stoppedEarly: boolean
}

/** The schema every voter fills: a ranking over the closed list. */
export const rankingSchema = (actions: readonly string[]): Record<string, unknown> => ({
  type: "object",
  required: ["ranking"],
  properties: { ranking: { type: "array", maxItems: actions.length, items: { type: "string", enum: [...actions] } } },
})

export async function runSwarm(voters: SwarmVoter[], req: SwarmRequest): Promise<SwarmResult> {
  const { actions, timeoutMs = 8000, stopEarly = false } = req
  const schema = rankingSchema(actions)
  const ballots: Ballot[] = []
  const missed = new Set(voters.map((v) => v.voter.id))
  let stoppedEarly = false

  await new Promise<void>((resolve) => {
    let pending = voters.length
    if (!pending) return resolve()
    const timer = setTimeout(resolve, timeoutMs)
    const finish = () => {
      clearTimeout(timer)
      resolve()
    }
    for (const v of voters) {
      const t0 = Date.now()
      v.call({
        model: v.model,
        system: v.system ?? req.system,
        user: req.line,
        schema,
        maxTokens: 120,
      })
        .then((out) => {
          const ranking = cleanBallot((out as { ranking?: unknown } | null)?.ranking, actions)
          ballots.push({ voter: v.voter, ranking, ms: Date.now() - t0 })
          missed.delete(v.voter.id)
        })
        .catch(() => {})
        .finally(() => {
          pending -= 1
          if (stopEarly && pending > 0 && earlyStop(ballots, voters.length)) {
            stoppedEarly = true
            finish()
          } else if (pending === 0) finish()
        })
    }
  })

  const done = [...ballots]
  return { ballots: done, missed: [...missed], tally: tally(done, req.tally), stoppedEarly }
}
