import { describe, expect, it } from "vitest"
import { openTargetReducer, openTargetFromEntry } from "@/components/Lists/open-target"
import { ROOT_ALL_FOLDER_ID } from "@/components/Lists/constants"

describe("openTargetReducer", () => {
  it("opens and closes a list", () => {
    let state = openTargetReducer(null, { type: "OPEN_CATEGORY", id: "list-1" })
    expect(state).toEqual({ type: "category", id: "list-1" })
    state = openTargetReducer(state, { type: "CLOSE" })
    expect(state).toBeNull()
  })

  it("opens smart list, habits, and objectives", () => {
    expect(openTargetReducer(null, { type: "OPEN_SMART", id: "daily" })).toEqual({ type: "smart", id: "daily" })
    expect(openTargetReducer(null, { type: "OPEN_HABITS", id: "habits" })).toEqual({ type: "habits", id: "habits" })
    expect(openTargetReducer(null, { type: "OPEN_OBJECTIVES" })).toEqual({ type: "objectives" })
  })

  it("opens objectives from grid entry", () => {
    expect(
      openTargetFromEntry(
        { kind: "objectives", id: "objectives" },
        { isAll: true, currentFolderId: null, rootAllFolderId: ROOT_ALL_FOLDER_ID },
      ),
    ).toEqual({ type: "objectives" })
  })
})
