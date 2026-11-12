import { beforeEach, describe, expect, it } from "vitest"
import { undoLastAction } from "@/lib/action-history"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { resetAllStores } from "@/tests/test-utils"
import { acceptBlocks, buildContext, isHelperBlock } from "./accept"
import { assemble } from "./assemble"
import { SHIPPED_TESTS } from "./tests"
import { tokenize } from "./tokens"

const friday = SHIPPED_TESTS[0]!
const blocks = () => assemble(friday.wiring!, tokenize(friday.text).tokens, friday.text, buildContext(new Date(friday.now))).blocks
const rows = (scope: string) => useTimeTrackingStore.getState().entries.filter((e) => e.scopeId === scope)

describe("acceptBlocks", () => {
  beforeEach(() => resetAllStores())

  it("writes Activity and Location rows, stamped, as one undo step", () => {
    const r = acceptBlocks(blocks())
    expect(r.ok).toBe(true)
    expect(r.wrote).toBe(7)
    expect(rows("activity")).toHaveLength(7)
    expect(rows("location")).toHaveLength(3) // Ocean Beach, plus Home for dishes and trash
    const walk = rows("activity").find((e) => e.startMin === 16 * 60 + 30)!
    expect(isHelperBlock(walk)).toBe(true)
    expect(walk.createdBy?.surface).toBe("tracking-helper")
    expect(walk.notes).toContain("Created from Tracking helper.")
    expect(walk.precision).toBeUndefined() // a fuzzy edge is not an assumed block
    expect(walk.endCertainty).toBe("estimated")
    expect(walk.startCertainty).toBeUndefined()
    expect(undoLastAction()).toBe(true)
    expect(rows("activity")).toHaveLength(0)
    expect(rows("location")).toHaveLength(0)
  })

  it("refuses time painted by hand unless forced", () => {
    const pen = useTimeTrackingStore.getState().scopes.find((s) => s.id === "activity")!.pens[0]!.id
    useTimeTrackingStore.getState().paintMinutes("2026-10-30", "activity", 16 * 60 + 40, 16 * 60 + 50, pen)
    const first = acceptBlocks(blocks().slice(0, 1))
    expect(first.ok).toBe(false)
    expect(first.refused[0]!.why).toBe("OVER TIME YOU PAINTED")
    expect(acceptBlocks(blocks().slice(0, 1), { force: true }).ok).toBe(true)
  })

  it("will not write a block that has no span", () => {
    const b = { ...blocks()[0]!, endMin: null }
    expect(acceptBlocks([b]).refused[0]!.why).toBe("NEEDS A START AND END")
  })
})

import { awaitingFromBim, type HelperLine } from "./store"

describe("awaitingFromBim", () => {
  const block = (id: string) => ({ id }) as never
  const line = (o: Partial<HelperLine>): HelperLine => ({ id: "l", who: "helper", text: "", at: "", ...o })
  it("counts only open blocks on lines that came from BIM chat", () => {
    const lines = [
      line({ fromBim: true, blocks: [block("a"), block("b")], decided: { a: "added" } }),
      line({ blocks: [block("c")], decided: {} }),
    ]
    expect(awaitingFromBim(lines)).toBe(1)
  })
})

import { useHabitsStore } from "@/lib/habits-store"
import { TaskType, type WeeklyTask } from "@/lib/types"
import { readCounts, readTagWords } from "./count"

describe("tags and the daily habit", () => {
  const SAID = "12:07 - 12:23 was practicing guitar which should count as practicing an instrument which should also be tagged music and count for the daily habit"
  beforeEach(() => resetAllStores())

  it("reads tags from the words", () => {
    expect(readTagWords(SAID)).toEqual(["music"])
    expect(readTagWords("should be tagged music and focus, and count for the habit")).toEqual(["music", "focus"])
  })

  it("finds the habit, tags the block, and credits the habit", () => {
    useHabitsStore.getState().addTask({ id: "h-inst", name: "Practice an instrument", type: TaskType.BOOLEAN, frequency: "daily" } as WeeklyTask)
    const habit = useHabitsStore.getState().tasks.find((t) => t.id === "h-inst")!
    const base = { id: "g", day: "2026-11-07", activity: "practicing guitar", startMin: 727, endMin: 743, startCert: "exact" as const, endCert: "exact" as const, notes: "music, daily habit", from: SAID }
    const ctx = buildContext(new Date("2026-11-07T14:27:00"))
    const b = { ...base, ...readCounts(base, ctx.habits ?? []) }
    expect(b.tags).toEqual(["music"])
    expect(b.habit?.id).toBe(habit.id)
    expect(b.notes).toBe("")
    expect(acceptBlocks([b]).ok).toBe(true)
    const e = rows("activity")[0]!
    const tags = useTimeTrackingStore.getState().tags
    const names = (e.tagIds ?? []).map((id) => tags.find((t) => t.id === id)?.name.toLowerCase())
    expect(names).toContain("music")
    const linked = useHabitsStore.getState().tasks.find((t) => t.id === habit.id)!
    expect(linked.trackingLink?.tagIds?.length).toBeGreaterThan(0)
    expect((e.tagIds ?? []).some((id) => linked.trackingLink!.tagIds.includes(id))).toBe(true)
  })
})
