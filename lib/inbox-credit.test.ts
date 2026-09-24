import { beforeEach, describe, expect, it } from "vitest"
import { resetLocalStorage } from "@/tests/test-utils"
import { usePointsStore } from "@/lib/points-store"
import {
  INBOX_CLEAR_BONUS,
  INBOX_HANDLE_POINTS,
  creditInboxBatchHandling,
  creditInboxHandling,
  inboxHandleLabel,
  shouldAwardInboxClear,
} from "./inbox-credit"

describe("shouldAwardInboxClear", () => {
  it("fires only when the last open idea is handled", () => {
    expect(shouldAwardInboxClear(3, 2)).toBe(false)
    expect(shouldAwardInboxClear(1, 0)).toBe(true)
    expect(shouldAwardInboxClear(0, 0)).toBe(false)
    expect(shouldAwardInboxClear(2, 0)).toBe(true)
  })
})

describe("creditInboxHandling", () => {
  beforeEach(() => {
    resetLocalStorage()
    usePointsStore.setState({ pointsHistory: [] })
  })

  it("awards 1 point for addressing an idea", () => {
    creditInboxHandling({ taskId: "a", title: "Call mom", openBefore: 4, openAfter: 3 })
    const rows = usePointsStore.getState().pointsHistory
    expect(rows).toHaveLength(1)
    expect(rows[0]?.points).toBe(INBOX_HANDLE_POINTS)
    expect(rows[0]?.taskDescription).toBe(inboxHandleLabel("Call mom"))
  })

  it("credits one point per deleted idea and a single clear bonus", () => {
    creditInboxBatchHandling(
      [
        { taskId: "a", title: "One" },
        { taskId: "b", title: "Two" },
      ],
      2,
      0,
    )
    const rows = usePointsStore.getState().pointsHistory
    expect(rows.filter((r) => r.points === INBOX_HANDLE_POINTS)).toHaveLength(2)
    expect(rows.filter((r) => r.taskDescription === "Inbox cleared")).toHaveLength(1)
    expect(rows.filter((r) => r.points === INBOX_CLEAR_BONUS)).toHaveLength(1)
  })

  it("adds the 50-point clear bonus when the inbox hits zero", () => {
    creditInboxHandling({ taskId: "last", title: "Done", openBefore: 1, openAfter: 0 })
    const rows = usePointsStore.getState().pointsHistory
    expect(rows.map((r) => r.points).sort()).toEqual([INBOX_HANDLE_POINTS, INBOX_CLEAR_BONUS].sort())
    expect(rows.some((r) => r.taskDescription === "Inbox cleared")).toBe(true)
  })
})
