import { describe, expect, it } from "vitest"
import { sanitizeFriendMission, type FriendMission } from "@/lib/friend-mission"
import type { List, Task, WeeklyTask } from "@/lib/types"
import { declinedThisWeek, geniusCandidates, geniusForFace, geniusPick, inArea } from "./pool"
import type { AreaVault } from "./read"
import { starterGeniuses } from "./starters"
import type { Genius } from "./types"

const NOW = new Date("2026-11-24T18:00:00Z")
const task = (id: string, extra: Partial<Task> = {}): Task => ({ id, title: id, lists: [], completed: false, stage: "list", ...extra }) as unknown as Task
const vault = (tasks: Task[], habits: WeeklyTask[] = []): AreaVault => ({ tasks, lists: [{ id: "album", name: "Album" } as List], habits, weeklyData: {}, goals: [], objectives: [], now: NOW })
const muse = (extra: Partial<Genius> = {}): Genius => {
  const g = starterGeniuses(NOW.toISOString()).find((x) => x.id === "genius-muse")!
  return { ...g, animalId: "pack-crow", bindings: { ...g.bindings, listIds: ["album"] }, ...extra }
}
const mission = (taskId: string, status: FriendMission["status"], declineReason = "no"): FriendMission =>
  sanitizeFriendMission({ id: `m-${taskId}`, taskId, status, declineReason, offeredAt: "2026-11-23T10:00:00Z" })!

describe("genius pool", () => {
  it("finds the active genius by its face card", () => {
    expect(geniusForFace([muse()], "pack-crow")?.id).toBe("genius-muse")
    expect(geniusForFace([muse({ status: "resting" })], "pack-crow")).toBeNull()
    expect(geniusForFace([muse()], "")).toBeNull()
  })
  it("a habit counts only when bound", () => {
    const g = muse({ bindings: { objectiveIds: [], goalIds: [], listIds: [], habitIds: ["h1"], rootItemIds: [] } })
    expect(inArea(g, { id: "habit:h1" }, new Set())).toBe(true)
    expect(inArea(g, { id: "habit:h2" }, new Set())).toBe(false)
  })
  it("never offers a task outside its area; falls back to open area steps", () => {
    const tasks = [task("mix", { lists: ["album"] }), task("taxes", { lists: ["money"] })]
    const c = geniusCandidates(muse(), tasks, [], vault(tasks), { now: NOW })
    expect(c.map((x) => x.id)).toEqual(["mix"])
    for (let i = 0; i < 20; i++) {
      const pick = geniusPick({ genius: muse(), tasks, folders: [], vault: vault(tasks), log: [], rng: () => i / 20 })
      expect(pick.taskId).toBe("mix")
    }
  })
  it("an empty area is a real answer, not a made-up task", () => {
    const pick = geniusPick({ genius: muse(), tasks: [], folders: [], vault: vault([]), log: [] })
    expect(pick).toMatchObject({ kind: "empty", taskId: null })
    expect(pick.line).toMatch(/no open step/i)
    const unbound = geniusPick({ genius: starterGeniuses()[0]!, tasks: [], folders: [], vault: vault([]), log: [] })
    expect(unbound.line).toMatch(/not tied/i)
  })
  it("a task declined this week weighs less; 'asked for another' does not count", () => {
    expect(declinedThisWeek([mission("mix", "declined")], "mix", NOW)).toBe(true)
    expect(declinedThisWeek([mission("mix", "declined", "Asked for another")], "mix", NOW)).toBe(false)
    const tasks = [task("mix", { lists: ["album"] }), task("lyrics", { lists: ["album"] })]
    let mix = 0
    for (let i = 0; i < 100; i++) {
      const pick = geniusPick({ genius: muse(), tasks, folders: [], vault: vault(tasks), log: [mission("mix", "declined")], rng: () => (i + 0.5) / 100 })
      if (pick.taskId === "mix") mix++
    }
    expect(mix).toBeLessThan(35)
  })
})

describe("missions know their genius", () => {
  it("an old row loads without a genius; a new one keeps it", () => {
    expect(sanitizeFriendMission({ id: "m1" })!.geniusId).toBeUndefined()
    expect(sanitizeFriendMission({ id: "m1", geniusId: "genius-muse" })!.geniusId).toBe("genius-muse")
    expect(sanitizeFriendMission({ id: "m1", geniusId: 4 })!.geniusId).toBeUndefined()
  })
})
