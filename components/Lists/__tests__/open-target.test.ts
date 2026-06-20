import { describe, expect, it } from "vitest"
import { openTargetReducer } from "@/components/Lists/open-target"

describe("openTargetReducer", () => {
  it("opens and closes a list", () => {
    let state = openTargetReducer(null, { type: "OPEN_CATEGORY", id: "list-1" })
    expect(state).toEqual({ type: "category", id: "list-1" })
    state = openTargetReducer(state, { type: "CLOSE" })
    expect(state).toBeNull()
  })

  it("opens smart list and habits", () => {
    expect(openTargetReducer(null, { type: "OPEN_SMART", id: "daily" })).toEqual({ type: "smart", id: "daily" })
    expect(openTargetReducer(null, { type: "OPEN_HABITS", id: "habits" })).toEqual({ type: "habits", id: "habits" })
  })
})
