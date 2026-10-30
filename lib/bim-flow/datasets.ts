/**
 * lib/bim-flow/datasets.ts — The Data screens as named tables of dated text
 *
 * An analysis reads one of these. Each row is a date, a source (the column the
 * Data screen groups by), and a line of the person's own words. Built from the
 * same collectors the Data → Reviews screen uses, so BIM sees what the person
 * sees there. Read only.
 */

import { addDays } from "date-fns"
import { blockedReasonLabel } from "@/lib/blocked-reason"
import { dateKeyOf, formatLocalDateKey } from "@/lib/date-utils"
import { itemTitleOrUntitled } from "@/lib/item-utils"
import { collectMissReasonCorpus, MISS_SOURCE_LABEL } from "@/lib/miss-reason-corpus"
import type { OperationReview } from "@/lib/reviews-store"
import type { PeriodReview, Task, WeeklyData, WeeklyTask } from "@/lib/types"
import type { Dataset, DatasetRow, VaultHistory } from "./vault-search"

export interface DatasetInput {
  tasks: Task[]
  habits: WeeklyTask[]
  weeklyData?: WeeklyData
  weeklyHabitData?: WeeklyData
  monthlyHabitData?: WeeklyData
  quarterlyHabitData?: WeeklyData
  reviews: PeriodReview[]
  operationReviews: OperationReview[]
  history?: VaultHistory
  now: Date
}

const clip = (s: string, n = 260) => (s.length > n ? `${s.slice(0, n)}…` : s)

/** Every string the person wrote in an object, with the key it was written under. */
function writtenStrings(value: unknown, key: string, out: { key: string; text: string }[], depth = 0): void {
  if (depth > 3 || value == null) return
  if (typeof value === "string") {
    if (value.trim().length >= 4 && !/^[0-9a-f-]{16,}$/i.test(value) && !/^\d{4}-\d\d-\d\d/.test(value)) out.push({ key, text: value.trim() })
  } else if (Array.isArray(value)) value.forEach((v) => writtenStrings(v, key, out, depth + 1))
  else if (typeof value === "object") for (const [k, v] of Object.entries(value)) writtenStrings(v, k, out, depth + 1)
}

const PRETTY: Record<string, string> = {
  summary: "Summary",
  gratitude: "Gratitude",
  nextPlans: "Next plans",
  planReflection: "Plan reflection",
  lookBack: "Look back",
  timeReflection: "Time reflection",
  tomorrowMatters: "Tomorrow matters",
  wakeReminder: "Wake reminder",
  bestDayWhy: "Best day because",
}

export function buildDatasets(input: DatasetInput): Record<string, Dataset> {
  const days = new Set<string>()
  for (let i = 0; i < 400; i++) days.add(formatLocalDateKey(addDays(input.now, -i)))

  const out: Record<string, Dataset> = {}

  const corpus = collectMissReasonCorpus({
    tasks: input.tasks,
    habits: input.habits,
    weeklyData: input.weeklyData,
    weeklyHabitData: input.weeklyHabitData,
    monthlyHabitData: input.monthlyHabitData,
    quarterlyHabitData: input.quarterlyHabitData,
    reviewsInRange: input.reviews,
    operationReviews: input.operationReviews,
    keySet: days,
  })
  out["miss-reasons"] = {
    id: "miss-reasons",
    label: "Why things did not get done",
    blurb: "Data → Reviews: push, missed task, habit, missed op, and ritual reasons, with the preset token.",
    rows: corpus.notes.map((n) => ({
      date: /^\d{4}-\d\d-\d\d$/.test(n.date) ? n.date : dateKeyOf(n.sortKey) ?? "",
      source: `${MISS_SOURCE_LABEL[n.source]}${n.token ? ` · ${n.token}` : ""}`,
      text: clip(`${n.subject} — ${n.text || n.token || "no words"}`),
    })),
  }

  const ritual: DatasetRow[] = []
  for (const r of input.reviews) {
    const date = r.period === "day" ? r.periodKey : dateKeyOf(r.completedAt) ?? ""
    const found: { key: string; text: string }[] = []
    for (const k of ["summary", "nextPlans", "planReflection", "lookBack", "timeReflection", "tomorrowMatters", "wakeReminder"] as const) writtenStrings(r[k], k, found)
    writtenStrings(r.gratitude, "gratitude", found)
    writtenStrings(r.reflections, "reflection", found)
    writtenStrings((r as unknown as { morning?: unknown }).morning, "morning", found)
    for (const f of found) {
      ritual.push({ date, source: `${r.period} ritual · ${PRETTY[f.key] ?? f.key}`, text: clip(f.text) })
    }
  }
  out["ritual-answers"] = {
    id: "ritual-answers",
    label: "Ritual answers",
    blurb: "What was written in morning, night, and period rituals: reflections, gratitude, plans, look backs.",
    rows: ritual,
  }

  const pushed: DatasetRow[] = []
  for (const t of input.tasks) {
    const places = t.schedulePlacements ?? []
    const reasons = places.map((p) => blockedReasonLabel(p.missReason)).filter(Boolean)
    if (places.length < 2 && reasons.length === 0) continue
    const last = places[places.length - 1]
    pushed.push({
      date: dateKeyOf((last as { value?: string } | undefined)?.value ?? null) ?? dateKeyOf(t.createdAt) ?? "",
      source: `placed ${Math.min(places.length, 9)}${places.length > 9 ? "+" : ""} times`,
      text: clip(`${itemTitleOrUntitled(t)}${reasons.length ? ` — reasons given: ${[...new Set(reasons)].join(", ")}` : " — no reason given"}`),
    })
  }
  out["pushed-tasks"] = {
    id: "pushed-tasks",
    label: "Tasks that keep getting pushed",
    blurb: "Tasks placed on the schedule more than once, with the reasons given for each push.",
    rows: pushed,
  }

  out["thoughts"] = {
    id: "thoughts",
    label: "Thought process notes",
    blurb: "Items of type thought-process and the person's logged thinking.",
    rows: input.tasks
      .filter((t) => t.type === "thought-process")
      .map((t) => ({ date: dateKeyOf(t.createdAt) ?? "", source: "thought process", text: clip(itemTitleOrUntitled(t)) })),
  }

  out["moods"] = {
    id: "moods",
    label: "Moods tracked",
    blurb: "The Mood view of the time grid, with whatever was written beside each entry.",
    rows: (input.history?.entries ?? [])
      .filter((e) => e.scope === "mood")
      .map((e) => ({ date: e.date, source: "mood", text: clip(e.text && e.text !== e.pen ? `${e.pen} — ${e.text}` : e.pen) })),
  }

  for (const d of Object.values(out)) d.rows.sort((a, b) => a.date.localeCompare(b.date))
  return out
}
