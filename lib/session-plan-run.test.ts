/** Run view picks (2026-10-22): Random task, Next shortest task, ▶ and ■ on a line. */
import { describe, expect, it } from "vitest"
import type { Subtask, Task } from "@/lib/types"
import { addLine, allLines, emptySession, finishLine, lineSeconds, pauseSession, pickableLines, playLine, randomLine, remainingSec, shortestLine, startSession, stopLine } from "./session-plan"

const T0 = new Date(2026, 9, 22, 9, 0, 0)
const at = (min: number) => new Date(T0.getTime() + min * 60_000)
const s = (id: string, extra: Partial<Subtask> = {}): Subtask => ({ id, description: id, completed: false, ...extra })
const t = (id: string, extra: Partial<Task> = {}): Task => ({ id, description: id, stage: "scheduled", createdAt: T0, completed: false, lists: [], ...extra })

const tasks = (): Task[] => [
  t("rug", { estimatedDuration: 10 }),
  t("couch", { estimatedDuration: 5 }),
  t("wall", { subtasks: [s("left", { estimatedDuration: 20 }), s("right", { estimatedDuration: 25 })] }),
  t("mystery"), // no estimate
  t("later", { estimatedDuration: 1, dependencies: ["rug"] }), // waits on rug
]

function running() {
  const ts = tasks()
  let plan = emptySession(T0, 120)
  plan = addLine(plan, "min", { taskId: "rug" }, ts)
  plan = addLine(plan, "min", { taskId: "couch" }, ts)
  plan = addLine(plan, "goal", { taskId: "wall" }, ts)
  plan = addLine(plan, "goal", { taskId: "mystery" }, ts)
  plan = addLine(plan, "exceptional", { taskId: "later" }, ts)
  return { ts, plan: startSession(plan, ts, T0) }
}

const idOf = (plan: ReturnType<typeof running>["plan"], taskId: string) => allLines(plan).find(({ line }) => line.taskId === taskId)!.line.id

describe("pickable lines", () => {
  it("leaves out done, blocked and excluded lines", () => {
    const { ts, plan } = running()
    const ids = pickableLines(plan, ts, [idOf(plan, "couch")]).map((l) => l.taskId)
    expect(ids).toEqual(["rug", "wall", "mystery"])
  })
})

describe("Next shortest task", () => {
  it("takes the fewest minutes left, unestimated last", () => {
    const { ts, plan } = running()
    expect(shortestLine(plan, ts)?.taskId).toBe("couch")
    expect(shortestLine(plan, ts, [idOf(plan, "couch")])?.taskId).toBe("rug")
    expect(shortestLine(plan, ts, [idOf(plan, "couch"), idOf(plan, "rug"), idOf(plan, "wall")])?.taskId).toBe("mystery")
  })

  it("is undefined when nothing is open", () => {
    const { ts, plan } = running()
    const every = allLines(plan).map(({ line }) => line.id)
    expect(shortestLine(plan, ts, every)).toBeUndefined()
  })
})

describe("Random task", () => {
  it("picks from the pickable lines only", () => {
    const { ts, plan } = running()
    expect(randomLine(plan, ts, [], () => 0)?.taskId).toBe("rug")
    expect(randomLine(plan, ts, [], () => 0.999)?.taskId).toBe("mystery") // never the blocked "later"
    expect(randomLine(plan, ts, allLines(plan).map(({ line }) => line.id))).toBeUndefined()
  })
})

describe("▶ and ■ on a line", () => {
  it("play makes a line current and runs a paused clock", () => {
    const { plan } = running()
    const paused = pauseSession(plan, at(5))
    const played = playLine(paused, idOf(plan, "wall"), at(10))
    expect(played.activeLineId).toBe(idOf(plan, "wall"))
    expect(played.clock?.running).toBe(true)
    expect(remainingSec(played, at(10))).toBe(115 * 60) // the paused five minutes are not spent
    expect(lineSeconds(played, allLines(played).find(({ line }) => line.taskId === "wall")!.line, at(13))).toBe(180)
  })

  it("stop keeps the line's time, lets go of it, and leaves the clock running", () => {
    const { ts, plan } = running()
    const rug = idOf(plan, "rug")
    const stopped = stopLine(plan, at(4))
    expect(stopped.activeLineId).toBeUndefined()
    expect(stopped.clock?.running).toBe(true)
    expect(allLines(stopped).find(({ line }) => line.id === rug)!.line.actualSec).toBe(240)
    // Not done, so it can still be picked.
    expect(pickableLines(stopped, ts).some((l) => l.id === rug)).toBe(true)
    expect(finishLine(playLine(stopped, rug, at(6)), rug, ts, at(8)).tiers.min[0].actualSec).toBe(360)
  })
})
