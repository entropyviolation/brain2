/**
 * components/Inventory/gems/earned-stacks.ts — Counts for the gem bag
 *
 * A daily habit leaves one copy of its current gem (`resolveTaskGem`) for each
 * day the goal is met. A finished task leaves one copy of its Lists orb
 * (`iconFor`), the same trinket Plan's gem-and-trinket month paints. A custom
 * icon replaces that orb. The same photograph stacks. The bag rebuilds from
 * those records, so a gem or icon changed later moves the copies already earned.
 */
import { iconFor } from "@/components/Icons"
import { dateKeyOf, parseLocalDate } from "@/lib/date-utils"
import { resolveTaskGem } from "@/lib/habit-gems"
import { isDailyHabit } from "@/lib/habit-points"
import { isHabitGoalMet } from "@/lib/habit-utils"
import { itemTitle } from "@/lib/item-utils"
import type { Task, WeeklyData, WeeklyTask } from "@/lib/types"

export type LootKind = "gem" | "trinket"

export type LootStack = {
  id: string
  kind: LootKind
  src: string
  count: number
  names: string[]
}

const DONE_LOG_ID = /^habit-done-(.+)-(\d{4}-\d{2}-\d{2})$/

type Bucket = {
  kind: LootKind
  src: string
  count: number
  names: Set<string>
}

function mirrorHabitId(task: Pick<Task, "id" | "attributes">): string | null {
  const attr = task.attributes?.sourceHabitId
  if (typeof attr === "string" && attr.length > 0) return attr
  return DONE_LOG_ID.exec(task.id)?.[1] ?? null
}

function mirrorDateKey(task: Pick<Task, "id" | "completedDate">): string | null {
  const fromId = DONE_LOG_ID.exec(task.id)?.[2]
  if (fromId) return fromId
  return dateKeyOf(task.completedDate)
}

function addCopy(buckets: Map<string, Bucket>, kind: LootKind, src: string, name: string) {
  const id = `${kind}\n${src}`
  let bucket = buckets.get(id)
  if (!bucket) {
    bucket = { kind, src, count: 0, names: new Set() }
    buckets.set(id, bucket)
  }
  bucket.count += 1
  const label = name.trim()
  if (label) bucket.names.add(label)
}

function habitById(habits: WeeklyTask[], id: string): WeeklyTask | undefined {
  return habits.find((habit) => habit.id === id)
}

export function lootStackLabel(stack: Pick<LootStack, "kind" | "names">): string {
  if (stack.names.length === 0) return stack.kind === "gem" ? "Gem" : "Trinket"
  if (stack.names.length <= 3) return stack.names.join(", ")
  return `${stack.names.slice(0, 2).join(", ")} and ${stack.names.length - 2} more`
}

/** Pad the bag so the last row is full and the chest is never a single slot. */
export function lootSlotCount(filled: number, columns: number, minSlots: number): number {
  const cols = Math.max(1, columns)
  const need = Math.max(minSlots, filled)
  return Math.ceil(need / cols) * cols
}

export function earnedLootStacks({
  habits,
  weeklyData,
  tasks,
}: {
  habits: WeeklyTask[]
  weeklyData: WeeklyData
  tasks: Task[]
}): LootStack[] {
  const buckets = new Map<string, Bucket>()
  const seenHabitDays = new Set<string>()

  for (const habit of habits) {
    if (!isDailyHabit(habit)) continue
    const src = resolveTaskGem(habit)
    for (const dateKey of Object.keys(weeklyData)) {
      const date = parseLocalDate(dateKey)
      if (!date) continue
      if (!isHabitGoalMet(habit, weeklyData[dateKey]?.[habit.id], { date, weeklyData })) continue
      seenHabitDays.add(`${habit.id}:${dateKey}`)
      addCopy(buckets, "gem", src, habit.name)
    }
  }

  for (const task of tasks) {
    if (!task.completed) continue
    const habitId = mirrorHabitId(task)
    if (habitId) {
      const habit = habitById(habits, habitId)
      if (!habit || !isDailyHabit(habit)) continue
      const dateKey = mirrorDateKey(task)
      if (!dateKey || seenHabitDays.has(`${habit.id}:${dateKey}`)) continue
      seenHabitDays.add(`${habit.id}:${dateKey}`)
      addCopy(buckets, "gem", resolveTaskGem(habit), habit.name)
      continue
    }
    addCopy(buckets, "trinket", iconFor(task.id, task.icon), itemTitle(task) || "Trinket")
  }

  return [...buckets.entries()]
    .map(([id, bucket]) => ({
      id,
      kind: bucket.kind,
      src: bucket.src,
      count: bucket.count,
      names: [...bucket.names].sort((a, b) => a.localeCompare(b)),
    }))
    .sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "gem" ? -1 : 1
      if (a.count !== b.count) return b.count - a.count
      return lootStackLabel(a).localeCompare(lootStackLabel(b))
    })
}

export function lootSummary(stacks: LootStack[]): string {
  if (stacks.length === 0) return "No gems or trinkets."
  let gems = 0
  let trinkets = 0
  for (const stack of stacks) {
    if (stack.kind === "gem") gems += stack.count
    else trinkets += stack.count
  }
  const parts: string[] = []
  if (gems > 0) parts.push(gems === 1 ? "1 gem" : `${gems} gems`)
  if (trinkets > 0) parts.push(trinkets === 1 ? "1 trinket" : `${trinkets} trinkets`)
  return parts.join(" · ")
}
