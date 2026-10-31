import { beforeEach, describe, expect, it } from "vitest"
import { setItemWriteClientForTests, withItemWriteSource } from "@/lib/item-write-source"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"

const DAY = "2026-10-31"

describe("createdBy on painted blocks", () => {
  beforeEach(() => {
    useTimeTrackingStore.setState({ entries: [] })
    setItemWriteClientForTests(() => "ios")
  })

  it("stamps a hand stroke as the user on this shell", () => {
    useTimeTrackingStore.getState().paintMinutes(DAY, "activity", 540, 600, "act-work")
    expect(useTimeTrackingStore.getState().entriesFor(DAY, "activity")[0]?.createdBy).toEqual({
      surface: "user",
      client: "ios",
    })
  })

  it("stamps the open write frame, such as BIM", () => {
    withItemWriteSource({ surface: "bim" }, () =>
      useTimeTrackingStore.getState().paintMinutes(DAY, "activity", 540, 600, "act-work"),
    )
    expect(useTimeTrackingStore.getState().entriesFor(DAY, "activity")[0]?.createdBy?.surface).toBe("bim")
  })
})
