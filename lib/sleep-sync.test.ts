import { renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useSleepStore } from "./sleep-store"
import { useTimeTrackingStore } from "./time-tracking-store"
import { useHabitsStore } from "./habits-store"
import { taskRepository } from "./data/task-repository"
import { trackedMinutesForTags } from "./tracked-time"
import {
  SLEEP_TAG_ID,
  applySleepEntries,
  deriveSleepEntries,
  findSleepPen,
  reconcileNightFromGrid,
  removeSleepEntries,
  sleepDoneLogId,
  syncSleepNight,
  useSleepSync,
  replaceEntriesForTests,
} from "./sleep-sync"
import type { SleepNight } from "./sleep-log"
import type { TimeEntry } from "./time-entries"
import { TaskType, type WeeklyTask } from "./types"

const MORNING = "2026-09-17"
const EVENING = "2026-09-16"

const night: SleepNight = {
  date: MORNING,
  sleptMin: -30, // 11:30 PM on the 16th
  wokeMin: 420, // 7:00 AM on the 17th
  sleptPrecision: "definite",
  wokePrecision: "definite",
}

let seq = 0
const ids = () => `gen-${++seq}`

beforeEach(() => {
  resetAllStores()
  useSleepStore.setState({ nights: {} })
  seq = 0
})

describe("deriving blocks from a night", () => {
  it("splits the night at midnight and stamps both halves", () => {
    const derived = deriveSleepEntries(night, "activity", "act-sleep", ids)
    expect(derived).toHaveLength(2)
    expect(derived[0]).toMatchObject({ date: EVENING, startMin: 1410, endMin: 1440 })
    expect(derived[1]).toMatchObject({ date: MORNING, startMin: 0, endMin: 420 })
    for (const entry of derived) {
      expect(entry.generatedBy).toEqual({ kind: "sleep", id: MORNING })
      expect(entry.tagIds).toEqual([SLEEP_TAG_ID])
    }
  })

  it("leaves hand-painted time alone", () => {
    const painted: TimeEntry = {
      id: "hand",
      date: MORNING,
      scopeId: "activity",
      penId: "act-work",
      startMin: 200,
      endMin: 260,
    }
    const next = applySleepEntries([painted], night, "activity", "act-sleep", ids)
    expect(next.find((e) => e.id === "hand")).toBeDefined()
  })

  it("replaces its own output rather than stacking, however often it runs", () => {
    let entries = applySleepEntries([], night, "activity", "act-sleep", ids)
    entries = applySleepEntries(entries, night, "activity", "act-sleep", ids)
    entries = applySleepEntries(entries, night, "activity", "act-sleep", ids)
    expect(entries.filter((e) => e.generatedBy?.id === MORNING)).toHaveLength(2)
  })

  it("keeps the same block ids when the night has not moved", () => {
    const first = applySleepEntries([], night, "activity", "act-sleep", ids)
    const second = applySleepEntries(first, night, "activity", "act-sleep", () => {
      throw new Error("must not mint a new id")
    })
    expect(second).toBe(first)
    expect(second.map((e) => e.id)).toEqual(first.map((e) => e.id))
  })

  it("re-derives a corrected night in place", () => {
    const first = applySleepEntries([], night, "activity", "act-sleep", ids)
    const corrected = applySleepEntries(first, { ...night, wokeMin: 480 }, "activity", "act-sleep", ids)
    const morning = corrected.find((e) => e.date === MORNING)
    expect(morning?.endMin).toBe(480)
    expect(corrected.filter((e) => e.generatedBy?.id === MORNING)).toHaveLength(2)
  })

  it("removes only its own blocks", () => {
    const painted: TimeEntry = { id: "hand", date: MORNING, scopeId: "activity", penId: "act-work", startMin: 600, endMin: 660 }
    const entries = applySleepEntries([painted], night, "activity", "act-sleep", ids)
    expect(removeSleepEntries(entries, MORNING)).toEqual([painted])
  })

  it("never merges a derived block into a neighbouring hand-painted one", () => {
    // Painted sleep ending exactly where the derived night begins.
    const painted: TimeEntry = { id: "hand", date: MORNING, scopeId: "activity", penId: "act-sleep", startMin: 420, endMin: 480 }
    const entries = applySleepEntries([painted], night, "activity", "act-sleep", ids)
    const hand = entries.find((e) => e.id === "hand")
    expect(hand).toMatchObject({ startMin: 420, endMin: 480 })
    expect(hand?.generatedBy).toBeUndefined()
  })
})

describe("finding where sleep is painted", () => {
  it("prefers whatever pen carries the Sleep tag", () => {
    const found = findSleepPen(useTimeTrackingStore.getState().scopes)
    expect(found?.pen.id).toBe("act-sleep")
  })

  it("follows the tag after the pen is renamed", () => {
    const store = useTimeTrackingStore.getState()
    const scope = store.scopes.find((s) => s.id === "activity")!
    const pen = scope.pens.find((p) => p.id === "act-sleep")!
    store.updatePen("activity", { ...pen, name: "Kip" })
    expect(findSleepPen(useTimeTrackingStore.getState().scopes)?.pen.name).toBe("Kip")
  })

  it("returns null when every sleep pen is gone", () => {
    const scopes = useTimeTrackingStore.getState().scopes.map((s) => ({
      ...s,
      pens: s.pens.filter((p) => p.id !== "act-sleep"),
    }))
    expect(findSleepPen(scopes)).toBeNull()
  })
})

describe("syncing a night end to end", () => {
  it("paints the night and logs it in Done", () => {
    useSleepStore.setState({ nights: { [MORNING]: night } })
    syncSleepNight(MORNING, new Date("2026-09-17T09:00:00"))

    const { entries, scopes } = useTimeTrackingStore.getState()
    expect(entries.filter((e) => e.generatedBy?.id === MORNING)).toHaveLength(2)
    // 30 minutes of the 16th plus 7 hours of the 17th.
    expect(trackedMinutesForTags({ scopes, entries }, EVENING, [SLEEP_TAG_ID])).toBe(30)
    expect(trackedMinutesForTags({ scopes, entries }, MORNING, [SLEEP_TAG_ID])).toBe(420)

    const row = taskRepository.getById(sleepDoneLogId(MORNING))
    expect(row?.title).toBe("Slept 7h 30m")
    expect(row?.actualDuration).toBe(450)
    expect(row?.completedDate?.getHours()).toBe(7)
    expect(row?.startedAt?.getDate()).toBe(16)
  })

  it("does not flag a night read off a clock as an estimate", () => {
    useSleepStore.setState({ nights: { [MORNING]: night } })
    syncSleepNight(MORNING)
    expect(taskRepository.getById(sleepDoneLogId(MORNING))?.estimates ?? []).toEqual([])
  })

  it("flags a remembered night so the review can ask about it", () => {
    useSleepStore.setState({ nights: { [MORNING]: { ...night, sleptPrecision: "estimated" } } })
    syncSleepNight(MORNING)
    const estimates = taskRepository.getById(sleepDoneLogId(MORNING))?.estimates ?? []
    expect(estimates.map((e) => e.field).sort()).toEqual(["actualDuration", "completedDate", "startedAt"])
  })

  it("waits for both ends before deriving anything", () => {
    useSleepStore.setState({ nights: { [MORNING]: { date: MORNING, sleptMin: -30 } } })
    syncSleepNight(MORNING)
    expect(useTimeTrackingStore.getState().entries).toHaveLength(0)
    expect(taskRepository.getById(sleepDoneLogId(MORNING))).toBeUndefined()
  })

  it("withdraws the blocks and the row when the night is cleared", () => {
    useSleepStore.setState({ nights: { [MORNING]: night } })
    syncSleepNight(MORNING)
    useSleepStore.getState().clearNight(MORNING)
    syncSleepNight(MORNING)

    expect(useTimeTrackingStore.getState().entries).toHaveLength(0)
    expect(taskRepository.getById(sleepDoneLogId(MORNING))).toBeUndefined()
  })

  it("rewrites the row when a bedtime is corrected later", () => {
    useSleepStore.setState({ nights: { [MORNING]: night } })
    syncSleepNight(MORNING)
    useSleepStore.setState({ nights: { [MORNING]: { ...night, sleptMin: -90 } } })
    syncSleepNight(MORNING)

    expect(taskRepository.getById(sleepDoneLogId(MORNING))?.actualDuration).toBe(510)
    expect(useTimeTrackingStore.getState().entries.filter((e) => e.generatedBy?.id === MORNING)).toHaveLength(2)
  })

  it("feeds a habit linked to the Sleep tag, with no sleep-specific wiring", () => {
    const sleepHabit: WeeklyTask = {
      id: "habit-sleep",
      name: "Sleep 8 hours",
      type: TaskType.GOAL,
      goal: 8,
      unit: "hours",
      frequency: "daily",
      trackingLink: { tagIds: [SLEEP_TAG_ID], unit: "hours" },
    }
    useHabitsStore.setState({ tasks: [sleepHabit] })

    useSleepStore.setState({ nights: { [MORNING]: night } })
    syncSleepNight(MORNING)

    // Only the minutes falling on the 17th count toward the 17th: 7 hours.
    expect(useHabitsStore.getState().weeklyData[MORNING]?.[sleepHabit.id]?.value).toBeCloseTo(7, 5)
    expect(useHabitsStore.getState().weeklyData[EVENING]?.[sleepHabit.id]?.value).toBeCloseTo(0.5, 5)
  })
})

describe("taking the grid's word for a night", () => {
  const paint = () => {
    useSleepStore.setState({ nights: { [MORNING]: night } })
    syncSleepNight(MORNING, new Date("2026-09-17T09:00:00"))
  }

  /** The block a night produced on a given day. */
  const derived = (date: string) =>
    useTimeTrackingStore.getState().entries.find((e) => e.generatedBy?.id === MORNING && e.date === date)

  it("moves the wake time when the morning block is dragged later", () => {
    paint()
    useTimeTrackingStore.getState().updateEntry(derived(MORNING)!.id, { endMin: 480 })

    expect(reconcileNightFromGrid(MORNING)).toBe(true)
    expect(useSleepStore.getState().nights[MORNING]?.wokeMin).toBe(480)
    expect(taskRepository.getById(sleepDoneLogId(MORNING))?.actualDuration).toBe(510)
  })

  it("moves the bedtime when the evening block is dragged earlier", () => {
    paint()
    useTimeTrackingStore.getState().updateEntry(derived(EVENING)!.id, { startMin: 1350 })

    reconcileNightFromGrid(MORNING)
    // 10:30 PM the night before is -90 against the morning.
    expect(useSleepStore.getState().nights[MORNING]?.sleptMin).toBe(-90)
  })

  it("leaves confidence alone — moving a block says nothing about remembering it", () => {
    useSleepStore.setState({ nights: { [MORNING]: { ...night, sleptPrecision: "estimated" } } })
    syncSleepNight(MORNING)
    useTimeTrackingStore.getState().updateEntry(derived(MORNING)!.id, { endMin: 500 })

    reconcileNightFromGrid(MORNING)
    const updated = useSleepStore.getState().nights[MORNING]
    expect(updated?.sleptPrecision).toBe("estimated")
    expect(updated?.wokePrecision).toBe("definite")
  })

  it("clears the night when its blocks are deleted", () => {
    paint()
    const store = useTimeTrackingStore.getState()
    for (const date of [EVENING, MORNING]) store.removeEntry(derived(date)!.id)

    expect(reconcileNightFromGrid(MORNING)).toBe(true)
    expect(useSleepStore.getState().nights[MORNING]).toBeUndefined()
    expect(taskRepository.getById(sleepDoneLogId(MORNING))).toBeUndefined()
  })

  it("keeps the half that survives when only one block is deleted", () => {
    paint()
    useTimeTrackingStore.getState().removeEntry(derived(EVENING)!.id)

    reconcileNightFromGrid(MORNING)
    expect(useSleepStore.getState().nights[MORNING]).toMatchObject({ sleptMin: 0, wokeMin: 420 })
  })

  it("reads the outer ends when a block is split by a wakeful hour", () => {
    paint()
    // Awake 3–4 AM: the night still ran 11:30 PM to 7 AM.
    useTimeTrackingStore.getState().paintMinutes(MORNING, "activity", 180, 240, null)

    reconcileNightFromGrid(MORNING)
    expect(useSleepStore.getState().nights[MORNING]).toMatchObject({ sleptMin: -30, wokeMin: 420 })
  })

  it("says nothing when the grid already agrees", () => {
    paint()
    expect(reconcileNightFromGrid(MORNING)).toBe(false)
  })

  it("never empties a log whose nights were never painted", () => {
    // No sleep pen anywhere, so the night was recorded but never drawn.
    useTimeTrackingStore.setState({
      scopes: useTimeTrackingStore.getState().scopes.map((s) => ({ ...s, pens: s.pens.filter((p) => p.id !== "act-sleep") })),
    })
    useSleepStore.setState({ nights: { [MORNING]: night } })
    syncSleepNight(MORNING)

    expect(reconcileNightFromGrid(MORNING)).toBe(false)
    expect(useSleepStore.getState().nights[MORNING]).toMatchObject({ wokeMin: 420 })
  })

  it("does not let hand-painted sleep rewrite a stated night", () => {
    paint()
    // A nap on the Sleep pen, painted by hand: not this night's business.
    useTimeTrackingStore.getState().paintMinutes(MORNING, "activity", 840, 900, "act-sleep")

    expect(reconcileNightFromGrid(MORNING)).toBe(false)
    expect(useSleepStore.getState().nights[MORNING]?.wokeMin).toBe(420)
  })
})

/**
 * The listener, rather than the function it calls. Kept last in the file: the
 * subscription is a process-wide singleton, so once started it stays started.
 */
describe("the two-way bridge, as wired", () => {
  it("corrects the log when a sleep block is edited anywhere in the app", () => {
    renderHook(() => useSleepSync())

    useSleepStore.setState({ nights: { [MORNING]: night } })
    syncSleepNight(MORNING, new Date("2026-09-17T09:00:00"))

    const morning = useTimeTrackingStore
      .getState()
      .entries.find((e) => e.generatedBy?.id === MORNING && e.date === MORNING)!
    useTimeTrackingStore.getState().updateEntry(morning.id, { endMin: 480 })

    // No one called reconcile: the subscription noticed the blocks changed.
    expect(useSleepStore.getState().nights[MORNING]?.wokeMin).toBe(480)
  })

  it("does not loop when the log changes", () => {
    renderHook(() => useSleepSync())

    useSleepStore.setState({ nights: { [MORNING]: night } })
    syncSleepNight(MORNING)
    // Deriving blocks must not read them straight back and rewrite the night.
    expect(useSleepStore.getState().nights[MORNING]).toMatchObject({ sleptMin: -30, wokeMin: 420 })
    expect(useTimeTrackingStore.getState().entries.filter((e) => e.generatedBy?.id === MORNING)).toHaveLength(2)
  })

  it("paints nights that were already in the log when the grid mounts", () => {
    useSleepStore.setState({ nights: { [MORNING]: night } })
    // Mimic persist hydrating the log first and the grid without those blocks.
    replaceEntriesForTests([])
    expect(useSleepStore.getState().nights[MORNING]).toMatchObject({ wokeMin: 420 })
    expect(useTimeTrackingStore.getState().entries.filter((e) => e.generatedBy?.id === MORNING)).toHaveLength(0)

    renderHook(() => useSleepSync())

    expect(useTimeTrackingStore.getState().entries.filter((e) => e.generatedBy?.id === MORNING)).toHaveLength(2)
  })
})
