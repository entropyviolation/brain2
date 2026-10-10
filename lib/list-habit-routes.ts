/**
 * lib/list-habit-routes.ts — Which habits read a list
 *
 * Derived from the habit. `listSentLink.listId` and a saved `listLink`
 * are the links. List settings shows them. Nothing is written back onto
 * the list, so a later edit of the habit is the list’s next reading.
 *
 * A Habits stats pipeline names another habit (page total is that habit’s
 * logged amount). It does not name a list, so it is not a row here.
 */
import { normalizeListName } from "./habit-connections"
import { listRoutingFromLink } from "./habit-completion-pipeline"
import type { HabitListSentLink, WeeklyTask } from "./types"

export interface ListHabitRoute {
  habitId: string
  title: string
  role: string
}

type HabitRouteSource = Pick<WeeklyTask, "id" | "name" | "listSentLink" | "listLink">

/** What is counted, and what the target is, in the words the habit form uses. */
export function listHabitRole(link: Pick<HabitListSentLink, "mode" | "measure" | "target"> | null | undefined): string {
  const routing = listRoutingFromLink(link)
  const counted =
    routing.measure === "sent"
      ? "sent items"
      : routing.measure === "completed"
        ? "completed items"
        : "items added this period"
  const target =
    routing.target === "listLength"
      ? "target is list length"
      : routing.target === "periodSet"
        ? "target is this period's set"
        : "target is 1"
  return `${counted}, ${target}`
}

function nextActionRole(count: number): string {
  const n = Number.isInteger(count) ? count : Math.round(count)
  return `next actions, target is ${n}`
}

/**
 * One row per habit that saves a link to this list.
 * A list source wins over a next-action link on the same habit and list.
 * A stats pipeline with no list id contributes nothing.
 */
export function listHabitRoutes(
  list: { id: string; name: string },
  habits: readonly HabitRouteSource[],
): ListHabitRoute[] {
  const listId = list.id.trim()
  const listName = normalizeListName(list.name)
  const rows: ListHabitRoute[] = []
  for (const habit of habits) {
    const title = habit.name.trim() || "Untitled"
    const sent = habit.listSentLink
    if (sent && sent.enabled !== false && sent.listId.trim() === listId && listId) {
      rows.push({ habitId: habit.id, title, role: listHabitRole(sent) })
      continue
    }
    const named = habit.listLink
    if (
      named &&
      named.count >= 1 &&
      listName &&
      normalizeListName(named.listName) === listName
    ) {
      rows.push({ habitId: habit.id, title, role: nextActionRole(named.count) })
    }
  }
  rows.sort((a, b) => a.title.localeCompare(b.title) || a.habitId.localeCompare(b.habitId))
  return rows
}
