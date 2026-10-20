/**
 * lib/points-award-explain.ts — Why one ledger row paid (pure)
 *
 * The points ledger stores only date, taskId, points, and a description.
 * This reads that row back against the vault: which rule paid it (with the
 * live number from Settings → Points rules), which item or habit it belongs
 * to, the objective multipliers on that item for that day, and the other rows
 * the same thing earned that day (a completion and its objective bonus are two
 * rows). Nothing here writes. Shared by the Home Latest award detail and the
 * Analytics Points ledger.
 *
 * The rule numbers are today's values. A row written before a rule changed was
 * paid with the number of that day; the ledger does not keep it, so the
 * breakdown says "now".
 */

import { objectiveMultiplierFor } from "@/lib/goals-store"
import { awardReason, type LedgerAward } from "@/lib/habit-points"
import { beatTheClockMultiplier, itemTitleOrUntitled, taskIsNextAction } from "@/lib/item-utils"
import { pointsRuleDef, type PointsRuleId } from "@/lib/points-rules"
import { pointsRuleValue } from "@/lib/points-rules-live"
import type { Folder, Goal, List, Objective, Task, WeeklyTask } from "@/lib/types"

export type AwardKind =
  | "task"
  | "objective-bonus"
  | "schedule"
  | "inbox"
  | "habit-day"
  | "habit-period"
  | "habit-bonus"
  | "goal"
  | "goal-action"
  | "review"
  | "ritual"
  | "star-lord"
  | "friend"
  | "session"
  | "other"

export const AWARD_KIND_LABEL: Record<AwardKind, string> = {
  task: "Item completed",
  "objective-bonus": "Objective bonus",
  schedule: "Scheduled",
  inbox: "Inbox",
  "habit-day": "Daily habit",
  "habit-period": "Period habit",
  "habit-bonus": "Habit bonus",
  goal: "Goal completed",
  "goal-action": "Goal action",
  review: "Quick review",
  ritual: "Ritual",
  "star-lord": "Star Lord Report",
  friend: "Friend",
  session: "Session",
  other: "Points",
}

export type AwardLine = { label: string; value: string }

export type AwardRule = { id: PointsRuleId; label: string; value: string; explanation: string }

export type AwardMultiplier = { label: string; value: number; note?: string }

export type AwardExplanation = {
  kind: AwardKind
  kindLabel: string
  reason: string
  points: number
  date: string
  lines: AwardLine[]
  multipliers: AwardMultiplier[]
  rules: AwardRule[]
  item?: { id: string; title: string; lists: string[] }
  habit?: { id: string; name: string }
  goal?: { id: string; title: string }
  /** Other rows for the same thing on the same day. */
  related: LedgerAward[]
}

export type AwardContext = {
  tasks: readonly Task[]
  lists: readonly List[]
  folders: readonly Folder[]
  habits: readonly WeeklyTask[]
  goals: readonly Goal[]
  objectives: readonly Objective[]
  history: readonly LedgerAward[]
}

function fmt(n: number): string {
  const rounded = Math.round(n * 100) / 100
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0$/, "")
}

function rule(id: PointsRuleId): AwardRule {
  const def = pointsRuleDef(id)
  const value = pointsRuleValue(id)
  return { id, label: def.label, value: `${fmt(value)} ${def.unit}`.trim(), explanation: def.explanation }
}

/** Ledger kind from the row's id and description. Order matters: prefixes first. */
export function awardKindOf(entry: Pick<LedgerAward, "taskId" | "taskDescription">, ctx?: Pick<AwardContext, "habits" | "goals">): AwardKind {
  const id = entry.taskId
  const text = entry.taskDescription.trim()
  if (id.startsWith("habit-day:")) return "habit-day"
  if (id.startsWith("habit-")) return "habit-bonus"
  if (id.startsWith("review:")) return "review"
  if (id.startsWith("ritual:star-lord:")) return "star-lord"
  if (id.startsWith("ritual:")) return "ritual"
  if (id.startsWith("session:")) return "session"
  if (id.startsWith("inbox-clear:") || /^Inbox (handled|cleared)/i.test(text)) return "inbox"
  if (/^Objective bonus:/i.test(text)) return "objective-bonus"
  if (/^Goal completed:/i.test(text)) return "goal"
  if (/^Goal action:/i.test(text)) return "goal-action"
  if (/^Friend:/i.test(text)) return "friend"
  if (/ scheduled$/i.test(text)) return "schedule"
  if (ctx?.habits.some((h) => h.id === id)) return "habit-period"
  if (ctx?.goals.some((g) => g.id === id)) return "goal"
  return "task"
}

function objectiveMultipliers(ctx: AwardContext, ids: readonly string[] | undefined, date: Date): AwardMultiplier[] {
  const out: AwardMultiplier[] = []
  for (const id of ids ?? []) {
    const objective = ctx.objectives.find((o) => o.id === id)
    if (!objective) continue
    const value = objectiveMultiplierFor(objective, date)
    const prioritized = (objective.priorities ?? []).some((p) => p.multiplier === value)
    out.push({
      label: `Objective · ${objective.title}`,
      value,
      note: prioritized ? "prioritized for this period" : "default objective multiplier",
    })
  }
  return out
}

function habitBonusRules(id: string): PointsRuleId[] {
  if (id.startsWith("habit-grade-bonus:")) return ["habit.gradeBonusEither", "habit.gradeBonusBoth", "habit.gradeBonusThreshold"]
  if (id.startsWith("habit-raw-day-bonus:")) return ["habit.accomplishmentBonus", "habit.accomplishmentThreshold"]
  if (id.startsWith("habit-day-grade-lift:")) return ["habit.dayLiftBonus"]
  if (id.startsWith("habit-weekly-grade-lift:")) return ["habit.weeklyLiftBonus"]
  if (id.startsWith("habit-weekly-avg-beat:")) return ["habit.weeklyAvgBeatBonus"]
  if (id.startsWith("habit-monthly-avg-beat:")) return ["habit.monthlyAvgBeatBonus"]
  return []
}

export function explainPointAward(entry: LedgerAward, ctx: AwardContext): AwardExplanation {
  const kind = awardKindOf(entry, ctx)
  const date = new Date(`${entry.date}T12:00:00`)
  const lines: AwardLine[] = []
  const multipliers: AwardMultiplier[] = []
  const rules: PointsRuleId[] = []
  let item: AwardExplanation["item"]
  let habit: AwardExplanation["habit"]
  let goal: AwardExplanation["goal"]

  const listNames = (task: Task) =>
    (task.lists ?? []).map((id) => ctx.lists.find((l) => l.id === id)?.name).filter((n): n is string => !!n)
  const attachTask = (task: Task | undefined) => {
    if (!task) return
    item = { id: task.id, title: itemTitleOrUntitled(task, "Task"), lists: listNames(task) }
  }

  const task = ctx.tasks.find((t) => t.id === entry.taskId)

  switch (kind) {
    case "task": {
      attachTask(task)
      if (task) {
        const nextAction = taskIsNextAction(task, ctx.folders as Folder[])
        if (task.rewardValue != null) lines.push({ label: "Item reward", value: `${fmt(task.rewardValue)} pts` })
        else rules.push("list.defaultCompletionPoints")
        if (nextAction) {
          const m = beatTheClockMultiplier(task.estimatedDuration, task.actualDuration)
          if (task.estimatedDuration) lines.push({ label: "Estimated", value: `${task.estimatedDuration} min` })
          if (task.actualDuration) lines.push({ label: "Actual", value: `${task.actualDuration} min` })
          multipliers.push({ label: "Beat the clock", value: m, note: m > 1 ? "finished under the estimate" : "no time beaten" })
          rules.push("list.beatTheClockMaxBonus")
        }
        multipliers.push(...objectiveMultipliers(ctx, task.contributesToObjectiveIds, date))
      } else {
        rules.push("list.defaultCompletionPoints")
        lines.push({ label: "Item", value: "no longer in the vault" })
      }
      break
    }
    case "objective-bonus": {
      attachTask(task)
      const base = ctx.history.find(
        (e) => e.taskId === entry.taskId && e.date === entry.date && e !== entry && !/^Objective bonus:/i.test(e.taskDescription) && !/ scheduled$/i.test(e.taskDescription),
      )
      if (base) {
        lines.push({ label: "Completion points", value: `${fmt(base.points)} pts` })
        if (base.points > 0) lines.push({ label: "Combined multiplier", value: `×${fmt((base.points + entry.points) / base.points)}` })
      }
      multipliers.push(...objectiveMultipliers(ctx, task?.contributesToObjectiveIds, date))
      rules.push("objective.defaultMultiplier", "goalFocus.multiplier", "list.defaultCompletionPoints")
      break
    }
    case "schedule":
      attachTask(task)
      rules.push("schedule.placementPoints")
      break
    case "inbox":
      attachTask(task)
      rules.push(entry.taskId.startsWith("inbox-clear:") ? "inbox.clearBonus" : "inbox.handlePoints")
      break
    case "habit-day": {
      const [, habitId] = entry.taskId.split(":")
      const found = ctx.habits.find((h) => h.id === habitId)
      if (found) habit = { id: found.id, name: found.name }
      const full = pointsRuleValue("habit.dailyFullMark")
      lines.push({ label: "Full day", value: `${fmt(full)} pts` })
      if (full > 0) lines.push({ label: "Completion that day", value: `${Math.round((entry.points / full) * 100)}%` })
      rules.push("habit.dailyFullMark")
      break
    }
    case "habit-period": {
      const found = ctx.habits.find((h) => h.id === entry.taskId)
      if (found) {
        habit = { id: found.id, name: found.name }
        lines.push({ label: "Frequency", value: found.frequency ?? "daily" })
        lines.push({ label: "Habit points", value: `${fmt(found.rewardValue ?? 0)} pts` })
      }
      break
    }
    case "habit-bonus":
      rules.push(...habitBonusRules(entry.taskId))
      break
    case "goal": {
      const found = ctx.goals.find((g) => g.id === entry.taskId)
      if (found) {
        goal = { id: found.id, title: found.title }
        lines.push({ label: "Goal points", value: `${fmt(found.points ?? 0)} pts` })
        lines.push({ label: "Progress", value: `${found.current}/${found.target}${found.unit ? ` ${found.unit}` : ""}` })
      }
      rules.push("goal.defaultPoints")
      break
    }
    case "goal-action": {
      attachTask(task)
      const goalId = task?.contributesToGoalIds?.[0]
      const found = goalId ? ctx.goals.find((g) => g.id === goalId) : undefined
      if (found) goal = { id: found.id, title: found.title }
      multipliers.push(...objectiveMultipliers(ctx, found?.objectiveIds ?? task?.contributesToObjectiveIds, date))
      rules.push("goal.actionBasePoints", "objective.defaultMultiplier")
      break
    }
    case "review": {
      const source = ctx.tasks.find((t) => t.id === entry.taskId.slice("review:".length))
      attachTask(source)
      rules.push("review.quickBase", "review.pointsPerWord")
      break
    }
    case "ritual":
    case "star-lord": {
      const parts = entry.taskId.split(":")
      lines.push({ label: kind === "star-lord" ? "Report" : "Period", value: parts.slice(1).join(" · ") })
      rules.push("ritual.sectionPoints", "ritual.completionBonus")
      break
    }
    case "friend":
      rules.push("friend.rewardBase", "friend.rewardScaleDivisor")
      break
    case "session":
      lines.push({ label: "Session", value: entry.taskId.slice("session:".length) })
      break
    default:
      break
  }

  const product = multipliers.reduce((p, m) => p * m.value, 1)
  if (multipliers.length > 1) lines.push({ label: "Multipliers combined", value: `×${fmt(product)}` })

  const related = ctx.history.filter(
    (e) => e !== entry && e.date === entry.date && (e.taskId === entry.taskId || (item && e.taskId === `review:${item.id}`)),
  )

  return {
    kind,
    kindLabel: AWARD_KIND_LABEL[kind],
    reason: awardReason(entry),
    points: entry.points,
    date: entry.date,
    lines,
    multipliers,
    rules: [...new Set(rules)].map(rule),
    item,
    habit,
    goal,
    related,
  }
}

/** Stable key for one ledger row (rows have no id). */
export function awardKey(entry: LedgerAward, index: number): string {
  return `${entry.date}|${entry.taskId}|${index}`
}
