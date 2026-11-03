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
