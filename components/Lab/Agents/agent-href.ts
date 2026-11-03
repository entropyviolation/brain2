/**
 * components/Lab/Agents/agent-href.ts — Which lab page an agent chip opens
 *
 * BIM flows switch the view inside the BIM flow lab, so they have no page of their own (null).
 */
import type { Blueprint } from "@/lib/agents/blueprint"
import { LISTS_HELPER_HREF, LISTS_HELPER_ID } from "@/lib/agents/adapters/lists-helper"
import { OVERCOME_HREF, OVERCOME_ID } from "@/lib/agents/adapters/overcome-bimby"

export function agentLabHref(agent: Blueprint): string | null {
  if (agent.id === "tracking-helper") return "/lab/tracking-helper"
  if (agent.id === "habit-helper") return "/lab/habit-helper"
  if (agent.id === LISTS_HELPER_ID) return LISTS_HELPER_HREF
  if (agent.id === OVERCOME_ID) return OVERCOME_HREF
  return null
}
