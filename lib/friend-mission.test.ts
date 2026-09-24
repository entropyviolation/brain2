import { describe, expect, it } from "vitest"
import {
  endOfLocalDay,
  friendBreakdownSteps,
  friendFirstStep,
  friendMissionItemId,
  friendMissionLogSentence,
  isBeforeDeadline,
  sanitizeFriendMission,
} from "./friend-mission"

describe("friendMissionItemId", () => {
  it("returns a world item id and ignores habits and whims", () => {
    expect(friendMissionItemId("task-1")).toBe("task-1")
    expect(friendMissionItemId("habit:abc")).toBeNull()
    expect(friendMissionItemId("whim:doodle")).toBeNull()
    expect(friendMissionItemId(null)).toBeNull()
  })
})

describe("friend mission day and log", () => {
  it("names a breakdown and a first step from the title", () => {
    expect(friendBreakdownSteps("Water the plants").map((step) => step.description)).toEqual([
      "Set out Water the plants",
      "Water the plants",
      "Close Water the plants",
    ])
    expect(friendFirstStep("Water the plants").description).toBe("Start Water the plants")
  })

  it("keeps accepted missions and their journal when loading old rows", () => {
    const row = sanitizeFriendMission({
      id: "m1",
      status: "accepted",
      title: "Water the plants",
      deadline: "2026-09-23T06:59:59.999Z",
      log: [{ at: "2026-09-23T00:00:00.000Z", note: "accepted", detail: "Until the end of today." }],
    })
    expect(row?.status).toBe("accepted")
    expect(row?.log[0]?.note).toBe("accepted")
    expect(friendMissionLogSentence(row!.log[0]!)).toMatch(/Accepted/)
    const end = new Date(endOfLocalDay(new Date("2026-09-23T15:00:00")))
    expect(end.getHours()).toBe(23)
    expect(isBeforeDeadline(row?.deadline, new Date("2026-09-22T12:00:00"))).toBe(true)
  })
})
