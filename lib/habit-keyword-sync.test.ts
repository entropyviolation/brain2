/**
 * lib/habit-keyword-sync.test.ts — Logged duration phrase credits the habit
 * and paints the prior tracking span once.
 */
import { beforeEach, describe, expect, it } from "vitest"
import { formatLocalDateKey } from "@/lib/date-utils"
import { useHabitsStore } from "@/lib/habits-store"
import { useIngestStore } from "@/lib/ingest/ingest-store"
import { syncKeywordHabits } from "@/lib/habit-keyword-sync"
import { planLoggedSpan } from "@/lib/habit-logged-span"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { TaskType, type WeeklyTask } from "@/lib/types"
import type { IngestEvent } from "@/lib/ingest/types"

const PATTERN = "cleaned for {x} minutes"

function event(text: string, at: Date, id = "e1"): IngestEvent {
  return {
    id,
    at: at.toISOString(),
    channel: "simulate",
    chatId: "c",
    raw: text,
    kind: "capture",
    status: "applied",
    summary: text,
  }
}

function habit(extra: Partial<WeeklyTask> = {}): WeeklyTask {
  return {
    id: "clean",
    name: "Clean for 15 minutes",
    type: TaskType.GOAL,
    goal: 15,
    unit: "minutes",
    frequency: "daily",
    completionSources: ["keywords"],
    completionPipelines: [
      {
        id: "kw",
        kind: "keywords",
        sources: ["keywords"],
        keyword: { use: "logged", pattern: PATTERN },
      },
    ],
    ...extra,
  }
}

function cell(at: Date) {
  return useHabitsStore.getState().weeklyData[formatLocalDateKey(at)]?.clean
}

function spans() {
  return useTimeTrackingStore.getState().entries.filter((entry) => entry.generatedBy?.id?.startsWith("kw:"))
}

beforeEach(() => {
  useTimeTrackingStore.setState({ entries: [] })
  useIngestStore.setState({ events: [] })
  useHabitsStore.setState({ tasks: [], weeklyData: {} })
})

describe("logged duration phrase", () => {
  const now = new Date(2026, 9, 5, 13, 11, 0, 0)

  it("credits 9 toward a 15 minute goal and paints the prior 9 minutes as estimated", () => {
    useHabitsStore.setState({
      tasks: [habit({ trackingLink: { tagIds: ["tag-cleaning"], unit: "minutes", mode: "add", enabled: true } })],
      weeklyData: {},
    })
    useIngestStore.setState({ events: [event("cleaned for 9 minutes", now)] })
    syncKeywordHabits(now)

    expect(cell(now)).toMatchObject({ value: 9, goal: 15, keywordValue: 9, keywordLogged: true })
    const block = spans()
    expect(block).toHaveLength(1)
    expect(block[0]).toMatchObject({
      penId: "act-chores",
      title: "Cleaning",
      scopeId: "activity",
      startMin: 13 * 60 + 2,
      endMin: 13 * 60 + 11,
      precision: "estimated",
      clockCertainty: "estimated",
    })
    expect(block[0]?.endMin! - block[0]?.startMin!).toBe(9)
  })

  it("places a trailing 1:11 as the end and walks back 9 minutes", () => {
    const afternoon = new Date(2026, 9, 5, 15, 0, 0, 0)
    useHabitsStore.setState({ tasks: [habit()], weeklyData: {} })
    useIngestStore.setState({ events: [event("cleaned for 9 minutes 1:11", afternoon)] })
    syncKeywordHabits(afternoon)

    expect(cell(afternoon)?.value).toBe(9)
    expect(cell(afternoon)?.keywordValue).toBe(9)
    const block = spans()[0]
    expect(block).toMatchObject({
      startMin: 1 * 60 + 2,
      endMin: 1 * 60 + 11,
    })
    expect(block?.precision).toBeUndefined()
    expect(block?.clockCertainty).toBeUndefined()
    expect(block?.title).toBe("Clean for 15 minutes")
  })

  it("keeps a stated clock that is still ahead of the message time", () => {
    const early = new Date(2026, 9, 5, 1, 0, 0, 0)
    const plan = planLoggedSpan({
      habit: habit(),
      pattern: PATTERN,
      text: "cleaned for 9 minutes 1:11",
      at: early.toISOString(),
      scopes: useTimeTrackingStore.getState().scopes,
      tags: useTimeTrackingStore.getState().tags,
    })
    expect(plan).toMatchObject({ startMin: 62, endMin: 71, endAssumed: false })
  })

  it("does not double-count the same message", () => {
    useHabitsStore.setState({
      tasks: [habit({ trackingLink: { tagIds: ["tag-cleaning"], unit: "minutes", enabled: true } })],
      weeklyData: {},
    })
    useIngestStore.setState({
      events: [event("cleaned for 9 minutes", now, "a"), event("cleaned for 9 minutes", now, "b")],
    })
    syncKeywordHabits(now)
    syncKeywordHabits(now)
    expect(cell(now)?.value).toBe(9)
    expect(cell(now)?.keywordValue).toBe(9)
    expect(spans()).toHaveLength(1)
  })

  it("does not paint a page count, and still writes that amount when nothing is tracking it", () => {
    useHabitsStore.setState({
      tasks: [
        habit({
          id: "read",
          name: "Read",
          goal: 20,
          unit: "pages",
          completionPipelines: [
            {
              id: "kw",
              kind: "keywords",
              sources: ["keywords"],
              keyword: { use: "logged", pattern: "read {n} pages of {bookname}" },
            },
          ],
        }),
      ],
      weeklyData: {},
    })
    useIngestStore.setState({ events: [event("read 3 pages of Dune", now)] })
    syncKeywordHabits(now)
    const read = useHabitsStore.getState().weeklyData[formatLocalDateKey(now)]?.read
    expect(read).toMatchObject({ value: 3, keywordValue: 3 })
    expect(read?.keywordSlots?.bookname).toBe("Dune")
    expect(spans()).toHaveLength(0)
  })
})
