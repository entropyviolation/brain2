import { describe, expect, it } from "vitest"
import type { FriendMission } from "@/lib/friend-mission"
import {
  bondProgress,
  formatCountdown,
  formatRelativeTime,
  friendBadges,
  friendPointsTotal,
  friendStreak,
  groupMissionsByDay,
  journalLogEntries,
  pinnedMission,
  sourceMixPercents,
  titleLoveMatchCount,
  todayLamp,
} from "@/lib/friend-stats"

function mission(partial: Partial<FriendMission> & Pick<FriendMission, "id" | "status">): FriendMission {
  return {
    animalId: "hedgehog",
    displayName: "Hedgy",
    offeredAt: "2026-09-23T12:00:00.000Z",
    title: "Brush",
    line: "Brush?",
    blurb: "",
    source: "habit",
    taskId: "t1",
    stepId: null,
    stepTitle: "",
    kind: "mission",
    points: 0,
    effect: "plain",
    acceptedAt: "",
    deadline: "",
    declineReason: "",
    log: [],
    ...partial,
  }
}

const now = new Date(2026, 8, 23, 19, 0, 0)

describe("friend stats", () => {
  it("adds lifetime points and wears into bond levels of 20", () => {
    expect(friendPointsTotal([mission({ id: "a", status: "done", points: 12 }), mission({ id: "b", status: "offered", points: 9 })])).toBe(12)
    expect(bondProgress(0, 0)).toMatchObject({ level: 1, into: 0, fill: 0 })
    expect(bondProgress(42, 3)).toMatchObject({ level: 3, score: 45, into: 5, need: 20 })
  })

  it("counts a streak through today or yesterday and stops at a gap", () => {
    const done = (id: string, day: number, hour = 15) =>
      mission({
        id,
        status: "done",
        points: 4,
        offeredAt: new Date(2026, 8, day, hour).toISOString(),
        log: [{ at: new Date(2026, 8, day, hour).toISOString(), note: "done" }],
      })
    expect(friendStreak([done("a", 23), done("b", 22), done("c", 21)], now)).toBe(3)
    expect(friendStreak([done("b", 22), done("c", 21)], now)).toBe(2)
    expect(friendStreak([done("c", 21)], now)).toBe(0)
    expect(friendStreak([done("a", 23, 9), done("b", 23, 18)], now)).toBe(1)
  })

  it("earns badges from the log and wear count", () => {
    const rows = [
      mission({
        id: "a",
        status: "done",
        stepTitle: "Start brush",
        log: [{ at: new Date(2026, 8, 23, 9, 30).toISOString(), note: "done", detail: "Brush" }],
      }),
    ]
    const badges = friendBadges(rows, 10, now)
    expect(badges.find((badge) => badge.id === "first-mission")?.earned).toBe(true)
    expect(badges.find((badge) => badge.id === "first-step")?.earned).toBe(true)
    expect(badges.find((badge) => badge.id === "worn-10")?.earned).toBe(true)
    expect(badges.find((badge) => badge.id === "before-noon")?.earned).toBe(true)
    expect(badges.find((badge) => badge.id === "streak-3")?.earned).toBe(false)
  })

  it("turns source weights into shares that add to 100", () => {
    expect(sourceMixPercents({ habitWeight: 18, todoWeight: 52, nextActionsWeight: 30 })).toEqual({
      habit: 18,
      todo: 52,
      next: 30,
    })
    const even = sourceMixPercents({ habitWeight: 1, todoWeight: 1, nextActionsWeight: 1 })
    expect(even.habit + even.todo + even.next).toBe(100)
    expect(sourceMixPercents({ habitWeight: 0, todoWeight: 0, nextActionsWeight: 0 })).toEqual({
      habit: 0,
      todo: 0,
      next: 0,
    })
  })

  it("pins an offered mission ahead of an accepted one and lights today", () => {
    const offered = mission({ id: "o", status: "offered" })
    const accepted = mission({
      id: "a",
      status: "accepted",
      deadline: new Date(2026, 8, 23, 23, 59).toISOString(),
    })
    expect(pinnedMission([offered, accepted], now)?.id).toBe("o")
    expect(todayLamp([accepted], now)).toBe("accepted")
    expect(todayLamp([mission({ id: "d", status: "done", log: [{ at: now.toISOString(), note: "done" }] })], now)).toBe("finished")
  })

  it("formats countdown and relative time, and groups the journal by day", () => {
    expect(formatCountdown(new Date(now.getTime() + (5 * 60 + 12) * 60_000).toISOString(), now)).toBe("5h 12m")
    expect(formatRelativeTime(new Date(now.getTime() - 2 * 3_600_000).toISOString(), now)).toBe("2h ago")
    const rows = [
      mission({ id: "t", status: "offered", offeredAt: now.toISOString() }),
      mission({ id: "y", status: "done", offeredAt: new Date(2026, 8, 22, 8).toISOString() }),
    ]
    expect(groupMissionsByDay(rows, now).map((group) => group.label)).toEqual(["Today", "Yesterday"])
  })

  it("drops the decline log line when the row already shows that reason", () => {
    const row = mission({
      id: "d",
      status: "declined",
      declineReason: "Asked for another",
      log: [
        { at: now.toISOString(), note: "offered" },
        { at: now.toISOString(), note: "declined", detail: "Asked for another" },
      ],
    })
    expect(journalLogEntries(row).map((entry) => entry.note)).toEqual(["offered"])
    expect(titleLoveMatchCount(["read a chapter", "walk the dog"], ["read"])).toBe(1)
  })
})
