import { describe, expect, it } from "vitest"
import type { Subtask, Task } from "@/lib/types"
import {
  addLine,
  admitSession,
  parkSession,
  parkedLong,
  resumeParked,
  runAgain,
  allLines,
  cannotStartReason,
  closeSession,
  emptySession,
  endSession,
  extendSession,
  finishLine,
  keptRefs,
  migrateSessionPlan,
  sessionTimeLogs,
  lineFocusStep,
  lineMinutes,
  lineSeconds,
  missingPrereqs,
  moveLine,
  nextLine,
  orderByPrereqs,
  pauseSession,
  remainingSec,
  resumeSession,
  sessionFit,
  sessionPace,
  setLineOutcome,
  startSession,
  tierReached,
  type SessionPlan,
} from "./session-plan"

const T0 = new Date(2026, 9, 15, 20, 0, 0)
const at = (min: number) => new Date(T0.getTime() + min * 60_000)

function s(id: string, extra: Partial<Subtask> = {}): Subtask {
  return { id, description: id, completed: false, ...extra }
}
function t(id: string, extra: Partial<Task> = {}): Task {
  return { id, description: id, stage: "scheduled", createdAt: T0, completed: false, lists: [], ...extra }
}

// Finish CDs tonight: back + inside holder; plus inbox processing.
const tasks = (): Task[] => [
  t("cds", {
    subtasks: [
      s("back", {
        subtasks: [
          s("remove extra text", { estimatedDuration: 15 }),
          s("save and export", { estimatedDuration: 10, dependsOn: ["remove extra text"] }),
          s("add spines", { estimatedDuration: 30 }),
        ],
      }),
      s("inside holder", { subtasks: [s("confirm wood", { estimatedDuration: 5 }), s("confirm hidden message")] }),
    ],
  }),
  t("inbox", { estimatedDuration: 30 }),
  t("vinyl", { dependencies: ["cds"], estimatedDuration: 60 }),
]

function draft(): SessionPlan {
  const ts = tasks()
  let plan = emptySession(T0, 180)
  plan = addLine(plan, "min", { taskId: "cds", stepId: "back" }, ts)
  plan = addLine(plan, "goal", { taskId: "cds", stepId: "inside holder" }, ts)
  plan = addLine(plan, "exceptional", { taskId: "inbox" }, ts)
  return plan
}

describe("drafting a session", () => {
  it("adds lines per tier and sums open minutes from the live tree", () => {
    const plan = draft()
    expect(allLines(plan).map(({ tier }) => tier)).toEqual(["min", "goal", "exceptional"])
    expect(lineMinutes(plan.tiers.min[0], tasks())).toBe(55)
    expect(lineMinutes(plan.tiers.goal[0], tasks())).toBe(5)
  })

  it("refuses a step whose task or ancestor is already in, and a parent replaces its children", () => {
    const ts = tasks()
    let plan = draft()
    expect(addLine(plan, "goal", { taskId: "cds", stepId: "add spines" }, ts)).toBe(plan)
    plan = addLine(plan, "min", { taskId: "cds" }, ts)
    expect(allLines(plan).filter(({ line }) => line.taskId === "cds").map(({ line }) => line.stepId)).toEqual([undefined])
  })

  it("adding a line already there moves it", () => {
    const ts = tasks()
    let plan = draft()
    plan = addLine(plan, "min", { taskId: "inbox" }, ts)
    expect(plan.tiers.exceptional).toHaveLength(0)
    expect(plan.tiers.min.map((l) => l.taskId)).toEqual(["cds", "inbox"])
    plan = moveLine(plan, plan.tiers.min[1].id, "goal", 0)
    expect(plan.tiers.goal[0].taskId).toBe("inbox")
  })

  it("fit gauge: running totals against the duration, scaled by pace", () => {
    const fit = sessionFit(draft(), tasks())
    expect(fit.map((f) => f.cumulative)).toEqual([55, 60, 90])
    expect(fit[0].band).toBe("fits")
    expect(fit[1].unestimated).toBe(1)
    const slow = sessionFit(draft(), tasks(), 3)
    expect(slow[2].band).toBe("over")
  })

  it("needs Bare minimum estimated before Start", () => {
    const ts = tasks()
    expect(cannotStartReason(draft(), ts)).toBeNull()
    let plan = emptySession(T0, 60)
    expect(cannotStartReason(plan, ts)).toMatch(/Bare minimum/)
    plan = addLine(plan, "min", { taskId: "cds", stepId: "confirm hidden message" }, ts)
    expect(cannotStartReason(plan, ts)).toMatch(/Estimate/)
  })

  it("orders prerequisites first and names missing ones", () => {
    const ts = tasks()
    let plan = emptySession(T0, 180)
    plan = addLine(plan, "min", { taskId: "cds", stepId: "save and export" }, ts)
    expect(missingPrereqs(plan, ts)).toEqual([{ lineId: plan.tiers.min[0].id, needs: "remove extra text" }])
    plan = addLine(plan, "goal", { taskId: "cds", stepId: "remove extra text" }, ts)
    plan = orderByPrereqs(plan, ts)
    expect(plan.tiers.min.map((l) => l.stepId)).toEqual(["remove extra text", "save and export"])
    expect(plan.tiers.goal).toHaveLength(0)

    let cross = emptySession(T0, 180)
    cross = addLine(cross, "min", { taskId: "vinyl" }, ts)
    expect(missingPrereqs(cross, ts)[0].needs).toBe("cds")
  })
})

describe("running a session", () => {
  it("counts down, pauses, resumes and extends", () => {
    let plan = startSession(draft(), tasks(), T0)
    expect(remainingSec(plan, at(10))).toBe(170 * 60)
    plan = pauseSession(plan, at(10))
    expect(remainingSec(plan, at(30))).toBe(170 * 60)
    plan = resumeSession(plan, at(30))
    expect(remainingSec(plan, at(40))).toBe(160 * 60)
    plan = extendSession(plan, 15, at(40))
    expect(remainingSec(plan, at(40))).toBe(175 * 60)
    expect(plan.durationMin).toBe(195)
  })

  it("the current line collects its own time and the focus step comes from the Just Start picker", () => {
    const ts = tasks()
    let plan = startSession(draft(), ts, T0)
    const first = plan.tiers.min[0]
    expect(plan.activeLineId).toBe(first.id)
    expect(first.estMin).toBe(55)
    const focus = lineFocusStep(first, ts)
    expect(focus?.kind === "step" && focus.step.id).toBe("remove extra text")
    expect(lineSeconds(plan, first, at(12))).toBe(12 * 60)
    plan = finishLine(plan, first.id, ts, at(50))
    expect(plan.tiers.min[0]).toMatchObject({ actualSec: 50 * 60 })
    expect(plan.activeLineId).toBe(plan.tiers.goal[0].id)
  })

  it("tier reached, points, review outcomes and kept lines", () => {
    const ts = tasks()
    let plan = startSession(draft(), ts, T0)
    plan = finishLine(plan, plan.tiers.min[0].id, ts, at(60))
    expect(tierReached(plan, ts)).toBe("min")
    plan = endSession(plan, ts, at(90))
    expect(plan.phase).toBe("review")
    expect(plan.reachedTier).toBe("min")
    plan = setLineOutcome(plan, plan.tiers.goal[0].id, "keep")
    const closed = closeSession(plan, ts, { bareMin: 1, goal: 10, exceptional: 50 }, " good night ")
    expect(closed).toMatchObject({ phase: "done", points: 1, note: "good night" })
    expect(keptRefs(closed, ts)).toEqual([{ tier: "goal", taskId: "cds", stepId: "inside holder" }])
  })

  it("nextLine skips blocked lines", () => {
    const ts = tasks()
    let plan = emptySession(T0, 120)
    plan = addLine(plan, "min", { taskId: "vinyl" }, ts)
    plan = addLine(plan, "min", { taskId: "inbox" }, ts)
    expect(nextLine(plan, ts)?.taskId).toBe("inbox")
  })

  it("pace is the median actual ÷ estimate of finished lines, 1 with little history", () => {
    const line = (est: number, min: number) => ({ id: `${est}-${min}`, taskId: "x", estMin: est, actualSec: min * 60, doneAt: "x" })
    const hist: SessionPlan = { ...emptySession(T0), tiers: { min: [line(10, 30), line(10, 20), line(10, 40)], goal: [], exceptional: [] } }
    expect(sessionPace([])).toBe(1)
    expect(sessionPace([hist])).toBe(3)
  })
})

describe("slice Q: excellent → exceptional", () => {
  it("renames the third tier and the reached tier on old blobs", () => {
    const old = { ...emptySession(T0), tiers: { min: [], goal: [], excellent: [{ id: "l1", taskId: "a" }] }, reachedTier: "excellent" }
    const plan = migrateSessionPlan(old)!
    expect(plan.tiers.exceptional).toHaveLength(1)
    expect("excellent" in plan.tiers).toBe(false)
    expect(plan.reachedTier).toBe("exceptional")
  })

  it("passes new blobs and nulls through", () => {
    const plan = emptySession(T0)
    expect(migrateSessionPlan(plan)).toEqual(plan)
    expect(migrateSessionPlan(null)).toBeNull()
  })
})

describe("sessionTimeLogs", () => {
  const ran = (actualSec: number, logs: Task["timeLogs"] = []) => {
    const tasks = [t("a", { timeLogs: logs })]
    let plan = addLine(emptySession(T0), "min", { taskId: "a" }, tasks)
    plan = { ...plan, startedAt: T0.toISOString(), endedAt: at(60).toISOString() }
    plan = { ...plan, tiers: { ...plan.tiers, min: plan.tiers.min.map((l) => ({ ...l, actualSec })) } }
    return { plan, tasks }
  }

  it("writes one log per line that ran a minute or more", () => {
    const { plan, tasks } = ran(25 * 60)
    const out = sessionTimeLogs(plan, tasks)
    expect(out).toHaveLength(1)
    expect(out[0].entry.durationMinutes).toBe(25)
    expect(out[0].entry.date).toBe("2026-10-15")
    expect(sessionTimeLogs(ran(20).plan, tasks)).toHaveLength(0)
  })

  it("takes off what the pen clock already logged in the window", () => {
    const clock = { id: "tl-1", date: "2026-10-15", startTime: "20:05", durationMinutes: 20 }
    expect(sessionTimeLogs(ran(25 * 60, [clock]).plan, ran(25 * 60, [clock]).tasks)[0].entry.durationMinutes).toBe(5)
    const before = { ...clock, startTime: "19:00" }
    const r = ran(25 * 60, [before])
    expect(sessionTimeLogs(r.plan, r.tasks)[0].entry.durationMinutes).toBe(25)
  })

  it("never writes a line twice", () => {
    const first = ran(25 * 60)
    const entry = sessionTimeLogs(first.plan, first.tasks)[0].entry
    const tasks = [t("a", { timeLogs: [entry] })]
    expect(sessionTimeLogs(first.plan, tasks)).toHaveLength(0)
  })
})

describe("slice H: park and resume", () => {
  it("parking keeps the line and the time left; the time away is not counted", () => {
    const ts = tasks()
    let plan = startSession(draft(), ts, T0)
    plan = finishLine(plan, plan.tiers.min[0].id, ts, at(40))
    const line = plan.activeLineId
    plan = parkSession(plan, at(50))
    expect(plan).toMatchObject({ phase: "parked", activeLineId: line, clock: { running: false, baseSec: 130 * 60 } })
    expect(plan.activeSince).toBeUndefined()
    expect(remainingSec(plan, at(500))).toBe(130 * 60)
    expect(lineSeconds(plan, plan.tiers.goal[0], at(500))).toBe(10 * 60)
    plan = resumeParked(plan, ts, at(500))
    expect(plan).toMatchObject({ phase: "run", activeLineId: line })
    expect(plan.parkedAt).toBeUndefined()
    expect(remainingSec(plan, at(510))).toBe(120 * 60)
    expect(lineSeconds(plan, plan.tiers.goal[0], at(510))).toBe(20 * 60)
  })

  it("parked over a day offers a fresh clock on the same lines", () => {
    const ts = tasks()
    let plan = parkSession(startSession(draft(), ts, T0), at(30))
    expect(parkedLong(plan, at(60))).toBe(false)
    expect(parkedLong(plan, at(30 + 25 * 60))).toBe(true)
    plan = resumeParked(plan, ts, at(30 + 25 * 60), "fresh")
    expect(remainingSec(plan, at(30 + 25 * 60))).toBe(180 * 60)
    expect(plan.tiers.min[0].actualSec).toBe(30 * 60)
  })

  it("resume moves on when the remembered line was finished meanwhile", () => {
    const ts = tasks()
    let plan = parkSession(startSession(draft(), ts, T0), at(10))
    const done = ts.map((t) => (t.id === "cds" ? { ...t, subtasks: t.subtasks!.map((st) => (st.id === "back" ? { ...st, completed: true } : st)) } : t))
    plan = resumeParked(plan, done, at(20))
    expect(plan.activeLineId).toBe(plan.tiers.goal[0].id)
  })

  it("two sessions cannot run at once: going live parks the other", () => {
    const ts = tasks()
    const a = startSession(draft(), ts, T0)
    const b = startSession(draft(), ts, at(5))
    const { open, parked } = admitSession([a], b, at(5))
    expect(open.map((p) => p.phase)).toEqual(["parked", "run"])
    expect(parked.map((p) => p.id)).toEqual([a.id])
    // A draft does not bump anything.
    expect(admitSession(open, emptySession(at(6)), at(6)).parked).toEqual([])
    // Resuming the parked one parks the other.
    const back = admitSession(open, resumeParked(open[0], ts, at(7)), at(7))
    expect(back.open.filter((p) => p.phase === "run").map((p) => p.id)).toEqual([a.id])
  })

  it("Run again is a fresh draft with the same lines", () => {
    const ts = tasks()
    const closed = closeSession(endSession(startSession(draft(), ts, T0), ts, at(60)), ts, { bareMin: 1, goal: 2, exceptional: 3 })
    const again = runAgain(closed, at(100))
    expect(again).toMatchObject({ phase: "draft", clock: null, title: closed.title, durationMin: 180 })
    expect(again.id).not.toBe(closed.id)
    expect(allLines(again).map(({ line, tier }) => [tier, line.taskId, line.stepId])).toEqual(
      allLines(closed).map(({ line, tier }) => [tier, line.taskId, line.stepId]),
    )
    expect(allLines(again).every(({ line }) => !line.estMin && !line.actualSec && !line.doneAt)).toBe(true)
  })
})
