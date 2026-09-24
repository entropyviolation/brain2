/**
 * lib/ingest/apply-plan-text.test.ts
 */
import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { localDayKey } from "@/lib/reviews-store"
import { applyPlanForNow, applyReadPlanToday } from "./apply-plan-text"

const NOW = new Date(2026, 8, 21, 18, 48, 0)
const DAY = localDayKey(NOW)

beforeEach(() => {
  resetAllStores()
})

describe("applyPlanForNow", () => {
  it("rejects empty payload", () => {
    const result = applyPlanForNow("  ", NOW)
    expect(result.status).toBe("error")
    expect(result.kind).toBe("plan-now")
    if (result.status === "error") {
      expect(result.reply).toBe("Send the plan after plan for rn:")
    }
  })

  it("appends a day plan entry", () => {
    const result = applyPlanForNow("Deep work AM\nWalk", NOW)
    expect(result.status).toBe("ok")
    expect(result.kind).toBe("plan-now")
    if (result.status === "ok") {
      expect(result.reply).toContain("Plan")
      expect(result.reply).toContain(DAY)
      expect(result.summary).toBe(`Plan for ${DAY} from text`)
    }
  })
})

describe("applyReadPlanToday", () => {
  it("says when empty", () => {
    const result = applyReadPlanToday(NOW, "latest")
    expect(result.status).toBe("ok")
    expect(result.kind).toBe("read-plan")
    if (result.status === "ok") {
      expect(result.reply).toBe("No plan for today yet.")
    }
  })

  it("formats latest vs all", () => {
    applyPlanForNow("first block", new Date(2026, 8, 21, 9, 0, 0))
    applyPlanForNow("second block", NOW)

    const latest = applyReadPlanToday(NOW, "latest")
    expect(latest.status).toBe("ok")
    if (latest.status === "ok") {
      expect(latest.reply).toContain("second block")
      expect(latest.reply).not.toContain("first block")
    }

    const all = applyReadPlanToday(NOW, "all")
    expect(all.status).toBe("ok")
    if (all.status === "ok") {
      expect(all.reply).toContain("first block")
      expect(all.reply).toContain("second block")
      expect(all.reply).toMatch(/second block[\s\S]*first block|first block[\s\S]*second block/)
    }
  })
})
