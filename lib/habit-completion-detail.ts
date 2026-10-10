/**
 * lib/habit-completion-detail.ts — One line for the period-detail column
 *
 * Current / target first. Then a single sentence: which list, what is
 * counted, the list length, the trust order, and a typed tick when that
 * source wins. Display only.
 */
import { effectiveHabitCount, listRoutingFromLink } from "./habit-completion-pipeline"
import { bindingSelectsLoggedAmount, formatStatDisplay } from "./habit-stat-pipeline"
import type { ListPipelinePreviewItem } from "./habit-completion-pipeline"
import { effectiveCompletionSources, effectiveCoverageLink } from "./habit-completion-source"
import { COMPLETION_SOURCE_LABELS, manualReading, readingsFromCell, trustedOutcome } from "./habit-completion-trust"
import { printedGoalAmounts } from "./habit-missed-opportunity"
import { isGoalType } from "./habit-utils"
import { TaskType, type TaskCompletion, type WeeklyTask } from "./types"

export interface HabitDetailList {
  id: string
  name: string
}

export interface HabitCompletionDetail {
  amount: string
  source: string
}

function formatCount(value: number): string {
  if (!Number.isFinite(value)) return "0"
  const rounded = Math.round(value * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : String(rounded)
}

function measureWord(measure: "sent" | "completed" | "added"): string {
  if (measure === "sent") return "sent"
  if (measure === "added") return "added"
  return "completed"
}

export function habitCompletionDetail(input: {
  task: WeeklyTask
  completion: TaskCompletion | undefined
  items?: readonly ListPipelinePreviewItem[]
  lists?: readonly HabitDetailList[]
  now?: Date
  /** Clock for a frozen list length. Defaults to the real now. */
  clock?: Date
  /** Live stats reading. The amount uses it when this cell was not typed by hand. */
  liveStat?: { value: number; label: string } | null
}): HabitCompletionDetail {
  const items = input.items ?? []
  const now = input.now ?? new Date()
  const task = input.task
  const completion = input.completion
  const printed = printedGoalAmounts(task, completion, items, now, input.clock)
  const counted = effectiveHabitCount(task, completion, items, now)

  let amount = "—"
  const handOwns = completion?.manualValue !== undefined || completion?.handCompleted !== undefined
  const loggedSum =
    !handOwns && !counted.derived && bindingSelectsLoggedAmount(task) && input.liveStat && input.liveStat.value != null
      ? input.liveStat.value
      : null
  if (isGoalType(task.type) || task.type === TaskType.INCREMENTAL) {
    const current = loggedSum != null ? loggedSum : (printed.shown ?? counted.current ?? completion?.value ?? 0)
    const target = printed.goal ?? counted.target ?? task.goal ?? 0
    amount = `${formatCount(current)} / ${formatCount(target)}`
  } else if (task.type === TaskType.TEXT) {
    amount = completion?.text?.trim() || "—"
  } else {
    amount = completion?.completed ? "1 / 1" : "0 / 1"
  }

  const live =
    !handOwns && !counted.derived && !effectiveCoverageLink(task) && input.liveStat && input.liveStat.value != null
      ? input.liveStat
      : null

  const parts: string[] = []
  if (live) parts.push(`${live.label} ${formatStatDisplay(live.value)}`)
  const sent = task.listSentLink
  if (sent?.listId && sent.enabled !== false) {
    const listName = input.lists?.find((list) => list.id === sent.listId)?.name?.trim() || "List"
    const routing = listRoutingFromLink(sent)
    const length = items.filter((item) => (item.lists ?? []).includes(sent.listId)).length
    parts.push(`${listName} · ${measureWord(routing.measure)} · ${length} on the list`)
  } else if (task.listLink?.listName) {
    const name = task.listLink.listName.trim()
    const list = input.lists?.find((row) => row.name.trim().toLowerCase() === name.toLowerCase())
    const length = list ? items.filter((item) => (item.lists ?? []).includes(list.id)).length : null
    const lengthBit = length == null ? "" : ` · ${length} on the list`
    parts.push(`${name} · next actions${lengthBit}`)
  }

  const order = effectiveCompletionSources(task)
  if (order.length > 0) {
    parts.push(order.map((id) => COMPLETION_SOURCE_LABELS[id]).join(", then "))
  }
  const outcome = trustedOutcome(
    order,
    readingsFromCell(order, completion, task.goal),
  )
  if (outcome.winner === "manual" && manualReading(completion, task.goal).state !== "empty") {
    parts.push("typed tick")
  }

  return { amount, source: parts.join(" · ") || "By hand" }
}
