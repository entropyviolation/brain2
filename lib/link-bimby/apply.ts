/**
 * lib/link-bimby/apply.ts — Using a guess (pure)
 *
 * A list guess adds the list to the link task and files it out of the Inbox.
 * An item guess ties the link to that item (`resource-for`) and files it into
 * the item's own lists. Nothing else on the task changes; the caller remembers
 * the world first so Cmd/Ctrl-Z undoes it.
 */

import { clarifyInboxItems } from "@/lib/inbox-batch"
import type { Task } from "@/lib/types"
import type { LinkGuess } from "./types"

export const RESOURCE_FOR = "resource-for"

export function applyGuess(tasks: Task[], linkId: string, guess: LinkGuess): Task[] {
  const target = guess.kind === "item" ? tasks.find((t) => t.id === guess.id) : undefined
  const next = tasks.map((t) => {
    if (t.id !== linkId) return t
    const addLists = guess.kind === "list" ? [guess.id] : (target?.lists ?? [])
    const lists = [...new Set([...(t.lists ?? []), ...addLists])]
    if (guess.kind === "list") return { ...t, lists }
    const links = t.links ?? []
    if (links.some((l) => l.relation === RESOURCE_FOR && l.targetId === guess.id)) return { ...t, lists }
    return { ...t, lists, links: [...links, { id: `lnk-${Date.now().toString(36)}`, relation: RESOURCE_FOR, targetId: guess.id }] }
  })
  return clarifyInboxItems(next, [linkId])
}
