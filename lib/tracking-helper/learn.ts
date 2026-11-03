/**
 * lib/tracking-helper/learn.ts — What a person's reaction to a proposed block teaches
 *
 * Read when a block is added or dismissed. The block as proposed is compared with the block as added:
 * unchanged is a success; a changed activity, edge or place is a failure the person already corrected, which
 * is exactly what a failure lesson needs (what was chosen, what should have been). A dismissed block is a
 * failure with no better move. A correction line ("actually it was 5") is a failure for the blocks it replaced.
 * Pure: `lib/skills/learn.ts` does the saving.
 */

import type { Reaction } from "@/lib/skills/experience"
import { clockText } from "./clock"
import type { ProposedBlock } from "./types"

export const HELPER_AGENT_ID = "tracking-helper"

type Base = Pick<Reaction, "agentId" | "input" | "skillsUsed">

const edge = (m: number | null) => (m === null ? "none" : clockText(m))

/**
 * One reaction per aspect of the block (activity, edges, place): a failure with the corrected value when the person
 * changed it, a success when they left it. Each aspect is its own category, so a category's success rate means
 * "how often this was right", which is what `weakCategories` reads.
 */
export function reactionsOfAdd(was: ProposedBlock, now: ProposedBlock, base: Omit<Base, "agentId">): Reaction[] {
  const common = { agentId: HELPER_AGENT_ID, ...base }
  const out: Reaction[] = []
  const name = (b: ProposedBlock) => b.activity.trim().toLowerCase()
  out.push(name(was) !== name(now) ? { ...common, category: "wire:activity-name", chose: was.activity, should: now.activity, severity: 1 } : { ...common, category: "wire:activity-name", chose: was.activity })
  out.push(
    was.startMin !== now.startMin || was.endMin !== now.endMin
      ? { ...common, category: "wire:time-edge", chose: `${edge(was.startMin)}-${edge(was.endMin)} for ${was.activity}`, should: `${edge(now.startMin)}-${edge(now.endMin)}`, severity: 1 }
      : { ...common, category: "wire:time-edge", chose: `${edge(was.startMin)}-${edge(was.endMin)} for ${was.activity}` },
  )
  if (was.place || now.place)
    out.push(
      (was.place?.name ?? "") !== (now.place?.name ?? "")
        ? { ...common, category: "wire:place", chose: was.place?.name || "no place", should: now.place?.name || "no place", severity: 1 }
        : { ...common, category: "wire:place", chose: was.place?.name || "no place" },
    )
  return out
}

export const reactionOfDismiss = (was: ProposedBlock, base: Omit<Base, "agentId">): Reaction => ({ agentId: HELPER_AGENT_ID, ...base, category: "wire:extra-entry", chose: was.activity, severity: 2 })

export const reactionOfCorrection = (was: ProposedBlock, correction: string, base: Omit<Base, "agentId">): Reaction => ({ agentId: HELPER_AGENT_ID, ...base, category: "wire:correction", chose: was.activity, should: correction.slice(0, 160), severity: 1 })
