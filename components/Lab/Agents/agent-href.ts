/**
 * components/Lab/Agents/agent-href.ts — Which lab page an agent chip opens
 *
 * BIM flows switch the view inside the BIM flow lab, so they have no page of their own (null).
 */
import type { Blueprint } from "@/lib/agents/blueprint"
import { LISTS_HELPER_HREF, LISTS_HELPER_ID } from "@/lib/agents/adapters/lists-helper"
import { PLAN_BIMBY_HREF, PLAN_BIMBY_ID } from "@/lib/agents/adapters/plan-bimby"
import { CRITIC_BIMBY_HREF, CRITIC_BIMBY_ID } from "@/lib/agents/adapters/critic-bimby"
import { LINK_BIMBY_HREF, LINK_BIMBY_ID } from "@/lib/agents/adapters/link-bimby"
import { INBOX_BIMBY_HREF, INBOX_BIMBY_ID } from "@/lib/agents/adapters/inbox-bimby"
import { SKILLS_EVOLVE_HREF, SKILLS_EVOLVE_ID } from "@/lib/agents/adapters/skills-evolve"
import { IDEA_SWARM_HREF, IDEA_SWARM_ID } from "@/lib/agents/adapters/idea-swarm"
import { SWARM_VOTE_HREF, SWARM_VOTE_ID } from "@/lib/agents/adapters/swarm-vote"
import { OVERCOME_HREF, OVERCOME_ID } from "@/lib/agents/adapters/overcome-bimby"

export function agentLabHref(agent: Blueprint): string | null {
  if (agent.id === "tracking-helper") return "/lab/tracking-helper"
  if (agent.id === "habit-helper") return "/lab/habit-helper"
  if (agent.id === LISTS_HELPER_ID) return LISTS_HELPER_HREF
  if (agent.id === OVERCOME_ID) return OVERCOME_HREF
  if (agent.id === PLAN_BIMBY_ID) return PLAN_BIMBY_HREF
  if (agent.id === IDEA_SWARM_ID) return IDEA_SWARM_HREF
  if (agent.id === SWARM_VOTE_ID) return SWARM_VOTE_HREF
  if (agent.id === CRITIC_BIMBY_ID) return CRITIC_BIMBY_HREF
  if (agent.id === LINK_BIMBY_ID) return LINK_BIMBY_HREF
  if (agent.id === INBOX_BIMBY_ID) return INBOX_BIMBY_HREF
  if (agent.id === SKILLS_EVOLVE_ID) return SKILLS_EVOLVE_HREF
  return null
}
