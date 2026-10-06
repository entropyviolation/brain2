/**
 * lib/demo-corpus/periods.ts — Plans, agenda, rituals, goals, habits, sleep
 *
 * Every day of the current week gets a plan log and an agenda block. Rituals
 * cover day, week, month, and quarter. Goals and habit cells use the same
 * shapes a real vault writes (tracked minutes, incremental scores, text).
 */

import { addDays, format } from "date-fns"
import { serializeAppendLog } from "@/lib/append-log"
import { formatLocalDateKey, getWeekDates, getWeekStartDate, getWeekString } from "@/lib/date-utils"
import { dayPlanKey, monthPlanKey, quarterPlanKey, weekPlanKey } from "@/lib/plan-text"
import type { PlannedAction } from "@/lib/planned-actions"
import { quarterKey } from "@/lib/seasons"
import type { Goal, Objective, PeriodReview } from "@/lib/types"

function ymd(date: Date): string {
  return formatLocalDateKey(date)
}

const DAY_LINES = [
  "Monday: open the returns cart, then one quiet wheel hour before email.",
  "Tuesday: protect the studio morning. Insurance scan only if the desk is free.",
  "Wednesday: proof the fall-hours poster. Leave a finger of margin for the handle.",
  "Thursday: class at 6:30. Extra bats. Juniper is short one.",
  "Friday: picture night is The Last Catalog Card. Do not start a second feature.",
  "Saturday: garden gate, then the co-op if the grog bag is actually empty.",
  "Sunday: ferry timetable, bread, and a short plan for the week ahead.",
]

export interface DemoPlans {
  /** Logical storage key → append-log JSON. */
  logs: Record<string, string>
  /** Days that now have a plan, so week coverage will not write a second one. */
  dayKeys: Set<string>
}

export function demoPlanLogs(now: Date): DemoPlans {
  const logs: Record<string, string> = {}
  const dayKeys = new Set<string>()
  const days = getWeekDates(getWeekStartDate(now))
  for (const [index, day] of days.entries()) {
    const key = ymd(day)
    dayKeys.add(key)
    const lines = [
      {
        id: `al-day-${key}`,
        createdAt: new Date(day.getFullYear(), day.getMonth(), day.getDate(), 7, 5).toISOString(),
        text: DAY_LINES[index] ?? DAY_LINES[0],
      },
    ]
    if (index === 2) {
      lines.push({
        id: `al-day-${key}-b`,
        createdAt: new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12, 40).toISOString(),
        text: "Midweek revision: the red pass can slip. Iron black is the one that has to dry.",
      })
    }
    const draft = key === ymd(now) ? "Draft: leave by 5:15 to catch the #15." : ""
    logs[dayPlanKey(key)] = serializeAppendLog(lines, draft)
  }

  const week = getWeekString(now)
  logs[weekPlanKey(week)] = serializeAppendLog(
    [
      {
        id: "al-week-1",
        createdAt: addDays(now, -1).toISOString(),
        text: "Protect two studio mornings. The Seattle hop is soon — pack the glaze notebook, not the whole shelf.",
      },
      {
        id: "al-week-2",
        createdAt: now.toISOString(),
        text: "Required this week: the fall-hours lockup stays ahead of Thursday's class. Bird count can wait.",
      },
    ],
    "",
  )
  const month = format(now, "yyyy-MM")
  logs[monthPlanKey(month)] = serializeAppendLog(
    [
      {
        id: "al-month-1",
        createdAt: addDays(now, -8).toISOString(),
        text: "This month: kiln back online, one firing party, Spanish streak, twelve more pages of the circulation manual.",
      },
      {
        id: "al-month-2",
        createdAt: addDays(now, -1).toISOString(),
        text: "The poster is a month goal only if the proof is readable at arm's length.",
      },
    ],
    "",
  )
  logs[quarterPlanKey(quarterKey(now))] = serializeAppendLog(
    [
      {
        id: "al-quarter-1",
        createdAt: addDays(now, -20).toISOString(),
        text: "Season: keep the weekly studio cadence, host one firing party, and do not let the insurance packet become a second season.",
      },
    ],
    "",
  )
  return { logs, dayKeys }
}

export function demoAgenda(now: Date, existing: PlannedAction[]): PlannedAction[] {
  const taken = new Set(existing.map((action) => action.date))
  const added: PlannedAction[] = []
  for (const [index, day] of getWeekDates(getWeekStartDate(now)).entries()) {
    const key = ymd(day)
    added.push({
      id: `demo-pa-week-${key}`,
      date: key,
      startTime: "19:10",
      endTime: "19:50",
      source: "free",
      title: DAY_LINES[index]?.split(": ")[1]?.slice(0, 80) || "Evening pass",
      notes: "Agenda block for this day of the week.",
    })
    if (!taken.has(key) && key === ymd(now)) {
      added.push({
        id: "demo-pa-1",
        date: key,
        startTime: "10:00",
        endTime: "11:30",
        source: "todo",
        sourceId: "demo-na-catalog",
        title: "Catalog notes",
        notes: "",
      })
    }
  }
  const today = ymd(now)
  if (!existing.some((action) => action.date === today && action.sourceId === "task-10")) {
    added.push({
      id: "demo-pa-2",
      date: today,
      startTime: "14:30",
      endTime: "15:00",
      source: "habit",
      sourceId: "task-10",
      title: "Plan the day",
      notes: "",
    })
  }
  return added
}

export function deepenReviews(reviews: PeriodReview[], now: Date): PeriodReview[] {
  const today = ymd(now)
  const week = getWeekString(now)
  const month = format(now, "yyyy-MM")
  const quarter = quarterKey(now)
  const extra: PeriodReview[] = [
    {
      id: `day:${today}`,
      period: "day",
      periodKey: today,
      completedAt: now,
      summary: "Morning ritual saved. Evening still open.",
      gratitude: ["The kettle clicked on time"],
      nextPlans: "Catalog notes, then the wheel.",
      reflections: {},
      resolvedTaskIds: [],
      pushedTaskIds: [],
      endCompleted: false,
      morning: {
        wakeTime: "07:05",
        bedTime: "23:40",
        dream: "A card catalog whose drawers were tide pools.",
        intentions: ["Finish the returns cart", "Center ten bowls"],
        affirmations: ["The cadence is enough."],
        completed: true,
        mustDo: "Catalog notes before lunch.",
        mustNotDo: "Do not open a second glaze test.",
        excitedAbout: "Thursday's collapsed-cylinder demo.",
        gratitude: ["Quiet stacks", "Sam's grog bag"],
        requiredTaskIds: ["demo-na-catalog"],
        priorityTaskIds: ["demo-na-catalog", "demo-week-open-" + today],
        priorityHabitIds: ["task-10", "task-14"],
        source: "desktop",
      },
    },
    {
      id: `week:${week}`,
      period: "week",
      periodKey: week,
      completedAt: now,
      summary: "Week is in progress. Start ritual names the poster and the desk.",
      gratitude: ["The ferry still runs"],
      nextPlans: "Two studio mornings.",
      reflections: { energy: "Better when the wheel is uncovered before email." },
      resolvedTaskIds: [],
      pushedTaskIds: ["demo-pushed-bird"],
      endCompleted: false,
      start: {
        completed: true,
        priorities: "Poster proof, catalog shift, one river walk.",
        mustDo: "Fall-hours lockup stays ahead of class.",
        undoneNotes: "Insurance packet came with me from last week.",
        pulledTaskIds: ["demo-overdue-tax"],
        summary: "Cadence over a marathon.",
        nextPlans: "Protect Tuesday and Thursday mornings.",
        gratitude: ["Juniper saved a bat"],
        source: "desktop",
      },
      blockedReasons: { "demo-overdue-tax": "no-time" },
    },
    {
      id: `month:${month}`,
      period: "month",
      periodKey: month,
      completedAt: addDays(now, -2),
      summary: "Kiln still down. Reading is ahead of the studio.",
      gratitude: ["The circulation manual is finally interesting"],
      nextPlans: "One firing party, controller installed.",
      reflections: {},
      resolvedTaskIds: ["demo-done-newsletter"],
      pushedTaskIds: [],
      start: {
        completed: false,
        resumeStep: "mustDo",
        priorities: "Kiln, poster, Spanish days.",
        summary: "Left the month start half written.",
      },
    },
    {
      id: `quarter:${quarter}`,
      period: "quarter",
      periodKey: quarter,
      completedAt: addDays(now, -15),
      summary: "Season so far: the desk held. The kiln did not.",
      gratitude: ["Thursday class still laughs"],
      nextPlans: "Host the firing party before the season turns.",
      reflections: { craft: "Weekly beats heroic." },
      resolvedTaskIds: [],
      pushedTaskIds: [],
      start: {
        completed: true,
        priorities: "Cadence, one party, the insurance packet.",
        mustDo: "Do not add a second residency application.",
        nextPlans: "Eight firings is the year goal; this season owes two.",
      },
    },
  ]
  const ids = new Set(reviews.map((review) => review.id))
  return [...reviews, ...extra.filter((review) => !ids.has(review.id))]
}

export function extraGoals(now: Date): Goal[] {
  const week = getWeekString(now)
  return [
    {
      id: "demo-goal-poster",
      title: "Pull a readable proof this week",
      description: "Arm's length, handle margin intact.",
      type: "boolean",
      target: 1,
      current: 0,
      unit: "proof",
      periodKind: "week",
      periodLabel: week,
      objectiveIds: ["demo-obj-1"],
      points: 25,
      completed: false,
      createdAt: now,
    },
    {
      id: "demo-goal-walks",
      title: "Three river walks",
      type: "count",
      target: 3,
      current: 1,
      unit: "walks",
      periodKind: "week",
      objectiveIds: ["demo-obj-3"],
      points: 15,
      completed: false,
      createdAt: now,
    },
    {
      id: "demo-goal-party",
      title: "Host the firing party",
      description: "Aspirational until the kiln holds a cone.",
      type: "boolean",
      target: 1,
      current: 0,
      unit: "party",
      periodKind: "aspirational",
      objectiveIds: ["demo-obj-8"],
      points: 40,
      completed: false,
      createdAt: now,
    },
    {
      id: "demo-goal-hop",
      title: "Pack the glaze notebook before the hop",
      type: "boolean",
      target: 1,
      current: 0,
      unit: "notebook",
      periodKind: "custom",
      periodLabel: "before the Seattle hop",
      startDate: now,
      endDate: addDays(now, 12),
      objectiveIds: ["demo-obj-4", "demo-obj-1"],
      points: 10,
      completed: false,
      createdAt: now,
    },
  ]
}

export function deepenObjectives(objectives: Objective[], now: Date): Objective[] {
  const week = getWeekString(now)
  const month = format(now, "yyyy-MM")
  return objectives.map((objective) => {
    if (objective.id === "demo-obj-1") {
      return {
        ...objective,
        description: "A repeating studio week, not a heroic weekend.",
        color: "#f97316",
        priorities: [
          { period: "week" as const, periodKey: week, multiplier: 2 },
          { period: "month" as const, periodKey: month, multiplier: 1.5 },
        ],
        reviews: [
          {
            id: `week:${week}`,
            period: "week" as const,
            periodKey: week,
            summary: "Lockup is done. The proof is the rest of the cadence.",
            completedAt: now,
          },
        ],
      }
    }
    if (objective.id === "demo-obj-7") {
      return {
        ...objective,
        description: "The desk is the job. Catalog notes before heroics.",
        priorities: [{ period: "day" as const, periodKey: ymd(now), multiplier: 2 }],
      }
    }
    return objective
  })
}

type HabitCell = {
  completed?: boolean
  value?: number
  goal?: number
  text?: string
  incrementalValues?: Record<string, number>
  trackedValue?: number
  manualValue?: number
  trackedCompleted?: boolean
  coverageCompleted?: boolean
  updatedAt?: string
}

/** Paint a few richer habit cells on top of the uniform three-week grid. */
export function deepenHabitDays(
  weeklyData: Record<string, Record<string, HabitCell>>,
  now: Date,
): Record<string, Record<string, HabitCell>> {
  const next: Record<string, Record<string, HabitCell>> = { ...weeklyData }
  const texts = [
    "Trimmed a foot ring",
    "Set two lines of the fall hours",
    "Sketched the door margin",
    "Mended the navy cuff",
    "Threw a bowl and kept it",
  ]
  for (const [index, day] of getWeekDates(getWeekStartDate(now)).entries()) {
    const key = ymd(day)
    if (key > ymd(now)) continue
    const prev = next[key] ?? {}
    next[key] = {
      ...prev,
      "task-1": {
        completed: true,
        value: 70,
        goal: 60,
        manualValue: 20,
        trackedValue: 50,
        updatedAt: now.toISOString(),
      },
      "task-7": {
        value: 265 + index * 10,
        incrementalValues: { rating: 265 + index * 10 },
        completed: true,
      },
      "task-9": {
        completed: true,
        value: 12,
        goal: 10,
        manualValue: 12,
        trackedValue: 0,
        updatedAt: now.toISOString(),
      },
      "task-14": { completed: true, text: texts[index % texts.length], updatedAt: now.toISOString() },
      "task-10": { completed: true, updatedAt: now.toISOString() },
    }
  }
  return next
}

export function demoSleepNotes(
  nights: Record<string, { date: string; sleptMin: number; wokeMin: number; precision?: string; note?: string }>,
  now: Date,
): typeof nights {
  const next = { ...nights }
  const ferry = ymd(addDays(now, -3))
  if (next[ferry]) {
    next[ferry] = { ...next[ferry], precision: "estimated", note: "Last ferry. The location span is the same ride." }
  }
  const rain = ymd(addDays(now, -1))
  if (next[rain]) next[rain] = { ...next[rain], note: "Rain on the skylight; slept in." }
  return next
}

export function demoEvents(now: Date): Array<Record<string, unknown>> {
  return getWeekDates(getWeekStartDate(now)).map((day, index) => {
    const titles = [
      "Returns cart",
      "Studio morning",
      "Poster proof",
      "Intro throwing class",
      "Picture night",
      "Garden gate",
      "Bread and the week plan",
    ]
    const start = ["09:30", "08:00", "13:00", "18:30", "19:30", "10:00", "11:00"][index]
    const end = ["11:00", "10:30", "15:00", "20:30", "21:15", "12:00", "12:00"][index]
    return {
      id: `demo-ev-week-${ymd(day)}`,
      title: titles[index],
      startTime: start,
      endTime: end,
      date: new Date(day.getFullYear(), day.getMonth(), day.getDate()).toISOString(),
      type: "event",
      color: index === 3 ? "#f97316" : "#0ea5e9",
      isScheduled: true,
      isAllDay: false,
      location: index === 3 ? "River's studio" : index === 5 ? "Hawthorne beds" : "Cedar Stacks",
      description: DAY_LINES[index],
      taskId: index === 3 ? "demo-scheduled-class" : undefined,
    }
  })
}
