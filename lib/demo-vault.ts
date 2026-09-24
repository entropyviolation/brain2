/**
 * lib/demo-vault.ts — Stock fiction vault for the Demo data profile
 *
 * Writes only through `writeAliasedLocal` after Settings has set the selector
 * to Demo, so physical keys are `brain2-demo-*`. Never seeds Live. The persona
 * is invented (River Hale, Cedar Stacks library, Portland) — no real PII.
 */

import { addDays, format, startOfWeek } from "date-fns"
import { serializeAppendLog } from "@/lib/append-log"
import { BOOK_ATTR, BOOK_TYPE_ID } from "@/lib/book-types"
import { formatLocalDateKey, getWeekString } from "@/lib/date-utils"
import { FLIGHT_ATTR, FLIGHT_TYPE_ID } from "@/lib/flight-types"
import { getDefaultHabitCategories, getDefaultHabits, HABITS_STORE_PERSIST_VERSION } from "@/lib/habits-store"
import { ITEM_TYPE_STORE_PERSIST_VERSION } from "@/lib/item-type-store"
import { getBuiltinItemTypes } from "@/lib/item-types"
import { NOTE_ATTR, NOTE_TYPE_ID } from "@/lib/note-types"
import { OPERATION_ATTR, OPERATION_TYPE_ID } from "@/lib/operation-types"
import { dayPlanKey, monthPlanKey, weekPlanKey } from "@/lib/plan-text"
import { BELIEF_ATTR, BELIEF_TYPE_ID, SOURCE_ATTR, SOURCE_TYPE_ID, withSecondBrainTypes } from "@/lib/second-brain-types"
import { NA_SMART_DAILY, NA_SMART_WEEKLY, NA_SCHEDULED_FOLDER } from "@/lib/scheduled-lists-sync"
import {
  DEMO_VAULT_READY_KEY,
  isDemoProfile,
  persistKey,
  writeAliasedLocal,
} from "@/lib/storage-keys"
import { TASK_STORE_PERSIST_VERSION } from "@/lib/task-store"
import { DEFAULT_GRID_STEP } from "@/lib/time-entries"
import { defaultScopes, defaultTags } from "@/lib/time-tracking-store"
import type { Goal, List, Objective, PeriodReview, Task } from "@/lib/types"
import { TaskType } from "@/lib/types"

const PERSONA = "River Hale"

function wrap(version: number, state: object): string {
  return JSON.stringify({ state, version })
}

function ymd(date: Date): string {
  return formatLocalDateKey(date)
}

function iso(date: Date): string {
  return date.toISOString()
}

function put(logical: string, value: string): void {
  writeAliasedLocal(logical, value)
}

function task(partial: Partial<Task> & Pick<Task, "id" | "description">): Task {
  const created = partial.createdAt instanceof Date ? partial.createdAt : new Date(partial.createdAt ?? Date.now())
  return {
    stage: "clarified",
    estimatedDuration: 45,
    cognitiveLoad: 2,
    urgency: 3,
    importance: 3,
    dependencies: [],
    context: "@anywhere",
    entropy: 0.2,
    rewardValue: 20,
    completed: false,
    lists: [],
    allowPartialCompletion: false,
    minimumChunkSize: 15,
    type: "task",
    ...partial,
    createdAt: created,
  }
}

function buildLists(now: Date): List[] {
  const createdAt = now
  return [
    { id: NA_SMART_DAILY, name: `To Do - ${format(now, "MMM d, yyyy")}`, color: "#16a34a", createdAt, order: 0, scheduleable: true },
    {
      id: NA_SMART_WEEKLY,
      name: `To Do - week of ${format(startOfWeek(now, { weekStartsOn: 1 }), "MMM d, yyyy")}`,
      color: "#2563eb",
      createdAt,
      order: 1,
      scheduleable: true,
    },
    { id: "list-work", name: "Cedar Stacks desk", color: "#0ea5e9", description: "Paid library work", createdAt, order: 2, scheduleable: true },
    { id: "list-studio", name: "Studio kiln", color: "#f97316", description: "Pottery studio rebuild", createdAt, order: 3, scheduleable: true },
    { id: "list-reading", name: "Reading", color: "#a855f7", createdAt, order: 4, scheduleable: false, itemTypeId: BOOK_TYPE_ID },
    { id: "list-waiting", name: "Waiting for", color: "#64748b", createdAt, order: 5, scheduleable: false },
    { id: "list-someday", name: "Someday / maybe", color: "#94a3b8", createdAt, order: 6, scheduleable: false },
    { id: "list-errands", name: "Errands", color: "#eab308", createdAt, order: 7, scheduleable: true },
    { id: "list-people", name: "People", color: "#ec4899", createdAt, order: 8, scheduleable: false },
    { id: "list-trips", name: "Trips", color: "#14b8a6", createdAt, order: 9, scheduleable: true, itemTypeId: FLIGHT_TYPE_ID },
    { id: "list-house", name: "House", color: "#84cc16", createdAt, order: 10, scheduleable: true },
    { id: "list-research", name: "Research", color: "#6366f1", createdAt, order: 11, scheduleable: false },
  ]
}

function buildTasks(now: Date): Task[] {
  const d = (n: number) => addDays(now, n)
  const today = ymd(now)
  const tomorrow = ymd(d(1))
  return [
    task({
      id: "demo-inbox-glaze",
      description: "Try a celadon test tile on the leftover cone 6 batch",
      stage: "inbox",
      context: "@studio",
      urgency: 2,
      importance: 2,
    }),
    task({
      id: "demo-inbox-call",
      description: "Call the community garden about Saturday volunteer hours",
      stage: "inbox",
      context: "@phone",
    }),
    task({
      id: "demo-na-catalog",
      description: "Finish Saturday catalog shift notes",
      lists: [NA_SMART_DAILY, "list-work"],
      scheduledDate: now,
      scheduledTime: "10:00",
      estimatedDuration: 90,
      urgency: 4,
      importance: 4,
      context: "@work",
      type: "task",
    }),
    task({
      id: "demo-na-email",
      description: "Email interlibrary loan about the kiln-repair manuals",
      lists: [NA_SMART_DAILY, "list-work"],
      scheduledDate: now,
      scheduledTime: "14:30",
      estimatedDuration: 25,
      context: "@computer",
    }),
    task({
      id: "demo-week-inventory",
      description: "Studio clay inventory before the restock order",
      lists: [NA_SMART_WEEKLY, "list-studio"],
      urgency: 3,
      importance: 4,
      context: "@studio",
    }),
    task({
      id: "demo-waiting-parts",
      description: "Waiting: kiln controller board from Northwind Ceramics",
      lists: ["list-waiting"],
      stage: "list",
      context: "@waiting",
      type: "item",
    }),
    task({
      id: "demo-someday-residency",
      description: "Someday: apply to a one-month clay residency",
      lists: ["list-someday"],
      stage: "list",
      importance: 3,
      urgency: 1,
      type: "item",
    }),
    task({
      id: "demo-errand-grog",
      description: "Pick up grog and a bag of porcelain at the co-op",
      lists: ["list-errands"],
      scheduledDate: d(1),
      context: "@errands",
      estimatedDuration: 40,
    }),
    task({
      id: "demo-house-gutter",
      description: "Clear the back-porch gutters before the rain week",
      lists: ["list-house"],
      deadline: d(4),
      urgency: 4,
      importance: 3,
    }),
    task({
      id: "demo-people-sam",
      description: "Sam Okonkwo — pottery class classmate, swap leftover glazes",
      lists: ["list-people"],
      stage: "list",
      type: "item",
      context: "@people",
    }),
    task({
      id: "demo-op-kiln",
      description: "Rebuild studio kiln controller",
      type: OPERATION_TYPE_ID,
      lists: ["list-studio"],
      importance: 5,
      urgency: 4,
      estimatedDuration: 480,
      attributes: {
        [OPERATION_ATTR.mission]: "Get the studio firing again before the October class.",
        [OPERATION_ATTR.stage]: "active",
        [OPERATION_ATTR.categories]: ["studio", "maintenance"],
        [OPERATION_ATTR.homeNotes]: "Controller board is on order. Document each wiring photo.",
        [OPERATION_ATTR.trackingTagIds]: ["tag-work"],
      },
    }),
    task({
      id: "demo-op-phase-photos",
      description: "Photograph the old wiring before disconnect",
      lists: ["list-studio"],
      parentTaskId: "demo-op-kiln",
      estimatedDuration: 30,
      completed: true,
      completedDate: d(-2),
    }),
    task({
      id: "demo-op-phase-order",
      description: "Order thermocouple and high-temp tape",
      lists: ["list-studio", "list-errands"],
      parentTaskId: "demo-op-kiln",
      estimatedDuration: 20,
      completed: true,
      completedDate: d(-1),
    }),
    task({
      id: "demo-op-phase-install",
      description: "Install the new controller and dry-fire once",
      lists: ["list-studio"],
      parentTaskId: "demo-op-kiln",
      estimatedDuration: 180,
      scheduledDate: d(3),
    }),
    task({
      id: "demo-book-leach",
      description: "A Potter's Book",
      type: BOOK_TYPE_ID,
      lists: ["list-reading"],
      stage: "list",
      attributes: {
        [BOOK_ATTR.author]: "Bernard Leach",
        [BOOK_ATTR.status]: "reading",
        [BOOK_ATTR.pageCount]: 320,
        [BOOK_ATTR.pagesRead]: 86,
      },
    }),
    task({
      id: "demo-book-calvino",
      description: "Invisible Cities",
      type: BOOK_TYPE_ID,
      lists: ["list-reading"],
      stage: "list",
      attributes: {
        [BOOK_ATTR.author]: "Italo Calvino",
        [BOOK_ATTR.status]: "queued",
        [BOOK_ATTR.pageCount]: 165,
        [BOOK_ATTR.pagesRead]: 0,
      },
    }),
    task({
      id: "demo-flight-pdx-sea",
      description: "PDX → SEA — library conference shuttle hop",
      type: FLIGHT_TYPE_ID,
      lists: ["list-trips"],
      scheduledDate: d(12),
      attributes: {
        [FLIGHT_ATTR.airline]: "Horizon",
        [FLIGHT_ATTR.flightNumber]: "QX 2174",
        [FLIGHT_ATTR.departureAirport]: "PDX",
        [FLIGHT_ATTR.arrivalAirport]: "SEA",
        [FLIGHT_ATTR.booked]: true,
        [FLIGHT_ATTR.cost]: 118,
      },
    }),
    task({
      id: "demo-note-glaze",
      description: "Celadon notes — iron, reduction, cone 6",
      type: NOTE_TYPE_ID,
      lists: ["list-studio"],
      stage: "list",
      body: "<p>Stock demo note. Keep the iron oxide under 2%. Reduction starts at cone 010.</p>",
      attributes: {
        [NOTE_ATTR.folder]: "Studio",
        [NOTE_ATTR.status]: "draft",
        [NOTE_ATTR.fontFamily]: "Merriweather",
      },
    }),
    task({
      id: "demo-source-leach",
      description: "Leach on workshop rhythm",
      type: SOURCE_TYPE_ID,
      lists: ["list-research"],
      stage: "list",
      attributes: {
        [SOURCE_ATTR.content]: "A workshop should keep a repeating weekly cadence so craft memory can settle.",
        [SOURCE_ATTR.origin]: "A Potter's Book (demo excerpt)",
        [SOURCE_ATTR.trust]: 0.8,
        [SOURCE_ATTR.summaryShort]: "Rhythm beats intensity.",
      },
    }),
    task({
      id: "demo-belief-cadence",
      description: "Craft improves faster with a weekly cadence than with occasional marathons",
      type: BELIEF_TYPE_ID,
      lists: ["list-research"],
      stage: "list",
      attributes: {
        [BELIEF_ATTR.statement]: "A weekly studio cadence beats occasional marathons.",
        [BELIEF_ATTR.certainty]: 0.7,
        [BELIEF_ATTR.strength]: 0.6,
        [BELIEF_ATTR.justification]: "Supported by the Leach demo source plus River's class notes.",
      },
    }),
    task({
      id: "demo-done-newsletter",
      description: "Send the friends-of-the-library newsletter",
      lists: ["list-work"],
      completed: true,
      completedDate: d(-3),
      actualDuration: 70,
    }),
    task({
      id: "demo-overdue-tax",
      description: "Mail the studio insurance renewal",
      lists: ["list-house"],
      deadline: d(-5),
      urgency: 5,
      importance: 4,
      entropy: 0.6,
    }),
    task({
      id: "demo-scheduled-class",
      description: "Teach Thursday evening intro-throwing class",
      lists: ["list-studio"],
      scheduledDate: d(3),
      scheduledTime: "18:30",
      estimatedDuration: 120,
      importance: 5,
    }),
    task({
      id: "demo-na-today-plan",
      description: "Write tomorrow's desk plan before leaving",
      lists: [NA_SMART_DAILY],
      scheduledDate: now,
      scheduledTime: "16:45",
      estimatedDuration: 15,
      context: "@computer",
    }),
  ].map((row) => ({ ...row, createdAt: row.createdAt ?? now }))
}

function habitCompletions(now: Date) {
  const habits = getDefaultHabits()
  const weeklyData: Record<string, Record<string, { completed?: boolean; value?: number; text?: string }>> = {}
  for (let i = 21; i >= 0; i--) {
    const date = ymd(addDays(now, -i))
    const day: Record<string, { completed?: boolean; value?: number; text?: string }> = {}
    for (const habit of habits) {
      if (habit.frequency === "weekly" || habit.frequency === "monthly") continue
      if (habit.type === TaskType.BOOLEAN) {
        day[habit.id] = { completed: (i + habit.id.length) % 3 !== 0 }
      } else if (habit.type === TaskType.GOAL && habit.goal) {
        const ratio = 0.4 + ((i * 17 + habit.id.length) % 60) / 100
        day[habit.id] = { value: Math.round(habit.goal * Math.min(1.15, ratio)), goal: habit.goal }
      } else if (habit.type === TaskType.TEXT) {
        day[habit.id] = { text: i % 4 === 0 ? "Sketch a mug handle" : "" }
      } else if (habit.type === TaskType.INCREMENTAL) {
        day[habit.id] = { value: 1 + (i % 3) }
      }
    }
    weeklyData[date] = day
  }
  const weekKey = getWeekString(now)
  const monthKey = format(now, "yyyy-MM")
  return {
    weeklyData,
    weeklyHabitData: {
      [weekKey]: {
        "task-w-review": { completed: true },
        "task-w-deep": { value: 8, goal: 10 },
        "task-w-workout": { completed: true },
        "task-w-lesson": { text: "Slow the wheel when centering — less water." },
      },
    },
    monthlyHabitData: {
      [monthKey]: {
        "task-m-bills": { completed: true },
        "task-m-book": { value: 1 },
      },
    },
  }
}

function trackingEntries(now: Date) {
  const entries: Array<{
    id: string
    date: string
    scopeId: string
    penId: string
    startMin: number
    endMin: number
    precision?: "estimated" | "definite"
  }> = []
  let n = 0
  for (let i = 10; i >= 0; i--) {
    const date = ymd(addDays(now, -i))
    const weekend = addDays(now, -i).getDay() === 0 || addDays(now, -i).getDay() === 6
    entries.push(
      { id: `te-${n++}`, date, scopeId: "activity", penId: "act-sleep", startMin: 0, endMin: 420, precision: "estimated" },
      {
        id: `te-${n++}`,
        date,
        scopeId: "activity",
        penId: weekend ? "act-exercise" : "act-work",
        startMin: 540,
        endMin: weekend ? 660 : 720,
        precision: "definite",
      },
      { id: `te-${n++}`, date, scopeId: "activity", penId: "act-chores", startMin: 780, endMin: 840, precision: "definite" },
      { id: `te-${n++}`, date, scopeId: "location", penId: weekend ? "loc-home" : "loc-work", startMin: 540, endMin: 720 },
      { id: `te-${n++}`, date, scopeId: "mood", penId: i % 5 === 0 ? "mood-meh" : "mood-good", startMin: 540, endMin: 720 },
      { id: `te-${n++}`, date, scopeId: "company", penId: "co-alone", startMin: 540, endMin: 720 },
    )
  }
  return entries
}

function sleepNights(now: Date) {
  const nights: Record<string, { date: string; sleptMin: number; wokeMin: number; precision?: string; note?: string }> = {}
  for (let i = 14; i >= 1; i--) {
    const date = ymd(addDays(now, -i + 1))
    nights[date] = {
      date,
      sleptMin: -45 - (i % 4) * 10,
      wokeMin: 420 + (i % 3) * 15,
      precision: "definite",
      note: i % 7 === 0 ? "Rain on the skylight; slept in." : undefined,
    }
  }
  return nights
}

function demoObjectives(now: Date): Objective[] {
  const titles = [
    "Keep a weekly studio cadence",
    "Be a generous neighbor",
    "Stay strong enough to throw large forms",
    "Read widely outside the craft",
    "Keep the house in working order",
    "Learn enough Spanish for travel",
    "Do good work at the library desk",
    "Host a firing party once a season",
  ]
  return titles.map((title, i) => ({
    id: `demo-obj-${i + 1}`,
    title,
    createdAt: now,
    priorities: i < 3 ? [{ period: "week" as const, periodKey: getWeekString(now), multiplier: 2 }] : [],
    reviews: [],
  }))
}

function demoGoals(now: Date): Goal[] {
  return [
    {
      id: "demo-goal-books",
      title: "Read 12 books this year",
      type: "count",
      target: 12,
      current: 4,
      unit: "books",
      periodKind: "year",
      objectiveIds: ["demo-obj-4"],
      points: 40,
      completed: false,
      createdAt: now,
    },
    {
      id: "demo-goal-firings",
      title: "Complete 8 studio firings",
      type: "count",
      target: 8,
      current: 3,
      unit: "firings",
      periodKind: "year",
      objectiveIds: ["demo-obj-1"],
      points: 50,
      completed: false,
      createdAt: now,
    },
    {
      id: "demo-goal-spanish",
      title: "Spanish practice days this month",
      type: "count",
      target: 20,
      current: 11,
      unit: "days",
      periodKind: "month",
      objectiveIds: ["demo-obj-6"],
      points: 10,
      completed: false,
      createdAt: now,
    },
  ]
}

function reviews(now: Date): PeriodReview[] {
  const yesterday = ymd(addDays(now, -1))
  return [
    {
      id: `day:${yesterday}`,
      period: "day",
      periodKey: yesterday,
      completedAt: addDays(now, -1),
      summary: "Catalog shift ran long; still got forty minutes on the wheel.",
      gratitude: ["Quiet stacks after lunch", "Sam saved me a bag of grog"],
      nextPlans: "Photograph kiln wiring and send the insurance packet.",
      reflections: { energy: "Solid after coffee; faded at 4." },
      resolvedTaskIds: ["demo-done-newsletter"],
      pushedTaskIds: ["demo-overdue-tax"],
      morning: {
        wakeTime: "07:05",
        dream: "A library that was also a tide pool.",
        intentions: ["Finish catalog notes", "Throw one bowl"],
      },
      blockedReasons: { "demo-overdue-tax": "no-time" },
    },
    {
      id: `week:${getWeekString(addDays(now, -7))}`,
      period: "week",
      periodKey: getWeekString(addDays(now, -7)),
      completedAt: addDays(now, -2),
      summary: "Deep work hours were short because of the kiln teardown.",
      gratitude: ["Thursday class laughed at the collapsed cylinder demo"],
      nextPlans: "Protect two studio mornings.",
      reflections: {},
      resolvedTaskIds: [],
      pushedTaskIds: [],
    },
  ]
}

function planLogs(now: Date) {
  const day = ymd(now)
  const week = getWeekString(now)
  const month = format(now, "yyyy-MM")
  put(
    dayPlanKey(day),
    serializeAppendLog(
      [
        {
          id: "al-day-1",
          createdAt: iso(now),
          text: `${PERSONA} — morning: catalog notes, then a short wheel session. Afternoon: insurance packet and kiln photos.`,
        },
      ],
      "Draft: leave by 5:15 to catch the #15.",
    ),
  )
  put(
    weekPlanKey(week),
    serializeAppendLog(
      [
        {
          id: "al-week-1",
          createdAt: iso(addDays(now, -1)),
          text: "Protect Tuesday/Thursday studio mornings. Conference hop is in twelve days — pack the glaze notebook.",
        },
      ],
      "",
    ),
  )
  put(
    monthPlanKey(month),
    serializeAppendLog(
      [
        {
          id: "al-month-1",
          createdAt: iso(addDays(now, -8)),
          text: "October: kiln back online, one firing party, Spanish streak to 20 days.",
        },
      ],
      "",
    ),
  )
}

function seedDemoVault(): void {
  const now = new Date()
  const lists = buildLists(now)
  const tasks = buildTasks(now)
  const habits = habitCompletions(now)

  put(
    persistKey("task-storage"),
    wrap(TASK_STORE_PERSIST_VERSION, {
      tasks,
      lists,
      folders: [
        {
          id: "folder-next-actions",
          name: "Next Actions",
          createdAt: iso(now),
          listIds: [NA_SMART_DAILY, NA_SMART_WEEKLY],
          scheduleable: true,
          color: "#2563eb",
        },
        {
          id: NA_SCHEDULED_FOLDER,
          name: "Scheduled",
          createdAt: iso(now),
          listIds: [],
          scheduleable: true,
          color: "#0f766e",
        },
        {
          id: "folder-areas",
          name: "Areas",
          createdAt: iso(now),
          listIds: ["list-work", "list-studio", "list-house", "list-reading"],
          color: "#64748b",
        },
      ],
      priorityFormula: { urgencyWeight: 1, importanceWeight: 1, effortWeight: 1, cognitiveLoadWeight: 1 },
      priorityWeights: { urgency: 1, importance: 1, cognitiveLoad: 1, entropy: 1 },
    }),
  )

  put(
    persistKey("habits-store"),
    wrap(HABITS_STORE_PERSIST_VERSION, {
      tasks: getDefaultHabits(),
      categories: getDefaultHabitCategories(),
      ...habits,
      habitViewMode: "grid",
      habitSortMode: "default",
      appearanceRev: 1,
    }),
  )

  put(
    persistKey("event-storage"),
    wrap(1, {
      events: [
        {
          id: "demo-ev-class",
          title: "Intro throwing class",
          startTime: "18:30",
          endTime: "20:30",
          date: iso(addDays(now, 3)),
          type: "event",
          color: "#f97316",
          isScheduled: true,
          isAllDay: false,
          location: "River's studio",
          description: "Six beginners. Bring extra bats.",
        },
        {
          id: "demo-ev-garden",
          title: "Community garden shift",
          startTime: "09:00",
          endTime: "12:00",
          date: iso(addDays(now, 5)),
          type: "event",
          color: "#16a34a",
          isScheduled: true,
          isAllDay: false,
          location: "Hawthorne beds",
          description: "",
        },
        {
          id: "demo-ev-conference",
          title: "Northwest library meetup",
          startTime: "09:00",
          endTime: "17:00",
          date: iso(addDays(now, 12)),
          type: "event",
          color: "#0ea5e9",
          isScheduled: true,
          isAllDay: true,
          location: "Seattle",
          description: "Panel on rural interlibrary loan.",
        },
      ],
    }),
  )

  put(
    persistKey("planned-actions"),
    wrap(1, {
      actions: [
        {
          id: "demo-pa-1",
          date: ymd(now),
          startTime: "10:00",
          endTime: "11:30",
          source: "todo",
          sourceId: "demo-na-catalog",
          title: "Catalog notes",
          notes: "",
        },
        {
          id: "demo-pa-2",
          date: ymd(now),
          startTime: "14:30",
          endTime: "15:00",
          source: "habit",
          sourceId: "task-10",
          title: "Plan the day",
          notes: "",
        },
      ],
    }),
  )

  put(persistKey("goals-store"), wrap(3, { objectives: demoObjectives(now), goals: demoGoals(now) }))
  put("points-store", wrap(0, {
    pointsHistory: [
      { date: ymd(addDays(now, -1)), taskId: "task-1", points: 50, taskDescription: "Work for at least 1 hour" },
      { date: ymd(addDays(now, -1)), taskId: "demo-done-newsletter", points: 20, taskDescription: "Send the friends-of-the-library newsletter" },
      { date: ymd(now), taskId: "task-4", points: 10, taskDescription: "Drink water" },
    ],
  }))
  put("regret-store", wrap(0, {
    regretHistory: [
      {
        date: ymd(now),
        taskId: "demo-overdue-tax",
        regret: 8,
        taskDescription: "Mail the studio insurance renewal",
        reason: "no-time",
      },
    ],
  }))

  put(persistKey("reviews-store"), wrap(1, { reviews: reviews(now), operationReviews: [] }))
  put(
    persistKey("timegrid-store"),
    wrap(11, {
      scopes: defaultScopes(),
      tags: defaultTags(),
      entries: trackingEntries(now),
      gridStep: DEFAULT_GRID_STEP,
      gridSpan: "week",
      infiniteScroll: false,
      hiddenPenIds: {},
      untrackedNotes: {},
      confirmedEventIds: [],
    }),
  )
  put(
    persistKey("tracking-day-notes"),
    JSON.stringify({
      [ymd(now)]: serializeAppendLog([{ id: "dn-1", createdAt: iso(now), text: "Desk was loud until 11; deep work after lunch." }], ""),
    }),
  )
  put(persistKey("sleep-store"), wrap(1, { nights: sleepNights(now), targetMinutes: 480 }))
  put(
    persistKey("metrics-store"),
    wrap(2, {
      datapoints: Array.from({ length: 10 }, (_, i) => {
        const at = addDays(now, -i)
        return {
          id: `md-${i}`,
          at: `${ymd(at)}T21:00`,
          values: {
            joy: 55 + (i % 20),
            suffering: 20 + (i % 15),
            alignment: 60 + (i % 10),
            selfSatisfaction: 50 + (i % 18),
            situationalSatisfaction: 58 + (i % 12),
          },
          context: i % 3 === 0 ? "After studio" : "After desk shift",
        }
      }),
    }),
  )
  put(persistKey("item-types-store"), wrap(ITEM_TYPE_STORE_PERSIST_VERSION, { types: withSecondBrainTypes(getBuiltinItemTypes()) }))
  put(
    persistKey("modules-store"),
    wrap(2, {
      modules: [
        {
          id: "demo-mod-studio",
          type: "workspace",
          title: "Studio kiln",
          kind: "workspace",
          config: { categoryId: "list-studio" },
          views: [{ id: "v1", kind: "checklist", title: "Rebuild steps", config: { categoryId: "list-studio" } }],
        },
        { id: "demo-mod-reading", type: "list-explorer", title: "Reading stack", config: { categoryId: "list-reading" } },
      ],
    }),
  )
  put(
    persistKey("workflows-store"),
    wrap(1, {
      workflows: [
        {
          id: "demo-wf-waiting",
          name: "When waiting, drop out of Next Actions",
          enabled: true,
          trigger: { kind: "item", event: "update" },
          conditions: [{ field: "lists", operator: "contains", value: "list-waiting" }],
          actions: [{ kind: "setAttribute", field: "stage", value: "list" }],
        },
      ],
    }),
  )
  put(persistKey("user-settings"), wrap(2, { homeCity: "Portland, Oregon", dayAnchorMinutes: 21 * 60 }))
  put(persistKey("theme-store"), wrap(4, { pcbMode: "ice", chromeFace: 50, appearanceRev: 1 }))
  put(persistKey("pcb-mode"), "ice")

  planLogs(now)
}

/** Fill `brain2-demo-*` when the selector is already Demo. No-op on Live. */
export function ensureDemoVault(options?: { force?: boolean }): void {
  if (!isDemoProfile()) return
  if (typeof localStorage === "undefined") return
  try {
    if (!options?.force && localStorage.getItem(DEMO_VAULT_READY_KEY) === "1") return
    seedDemoVault()
    localStorage.setItem(DEMO_VAULT_READY_KEY, "1")
  } catch {
    /* seed is best-effort */
  }
}
