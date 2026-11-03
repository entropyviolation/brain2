/**
 * lib/swarm-vote/types.ts — Shapes for the swarm vote
 *
 * A voter is one small model asked once. It returns a ranked list of actions from the BIMBY's closed list,
 * most wanted first. Plan: `docs/BIMBY_IDEAS.md` §1.
 */

export interface Voter {
  /** Stable id, e.g. the model name plus the phrasing number. */
  id: string
  /** Model family, so the tally can say how diverse the swarm was. */
  family: string
  /** Counts for this much in the tally. Default 1. */
  weight?: number
}

export interface Ballot {
  voter: Voter
  /** Actions from the closed list, most wanted first. Anything off the list is dropped by `cleanBallot`. */
  ranking: string[]
  ms: number
}

export interface Standing {
  action: string
  /** Borda points: first of n scores n, last scores 1, unlisted 0. Weighted. */
  score: number
  /** Voters that listed it at all. */
  listedBy: number
  /** Voters that put it first. */
  firstBy: number
}

export interface Tally {
  standings: Standing[]
  voters: number
  /** Distinct families that answered. */
  families: number
  /** Share of voters whose first pick is the winner (plurality agreement), 0 to 1. */
  agreement: number
  /** Winner's score minus the runner-up's, as a share of the winner's score. 0 when one action stands alone. */
  margin: number
  /** `clear` goes straight to the plan; `split` goes to the reword and the keys; `empty` goes to the person. */
  verdict: "clear" | "split" | "empty"
}
