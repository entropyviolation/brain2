import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { migrateSessionBlob, useSessionPlanStore } from "./session-plan-store"
import { emptySession, sessionPace, type SessionPlan } from "./session-plan"

const T0 = new Date(2026, 9, 15, 20, 0, 0)

function running(id: string): SessionPlan {
  return { ...emptySession(T0), id, phase: "run", startedAt: T0.toISOString(), clock: { running: true, startedAt: T0.toISOString(), baseSec: 3600 } }
}

describe("session store (slice H)", () => {
  beforeEach(() => resetAllStores())

  it("migrates a v0 blob: current moves into open, excellent becomes exceptional", () => {
    const v0 = {
      current: { ...emptySession(T0), id: "cur", tiers: { min: [], goal: [], excellent: [{ id: "l1", taskId: "a" }] } },
      history: [{ ...emptySession(T0), id: "old", phase: "done", reachedTier: "excellent", tiers: { min: [], goal: [], excellent: [] } }],
      kept: [{ tier: "excellent", taskId: "a" }],
    }
    const out = migrateSessionBlob(v0)
    expect(out.open.map((p) => p.id)).toEqual(["cur"])
    expect(out.open[0].tiers.exceptional).toHaveLength(1)
    expect(out.focusId).toBe("cur")
    expect(out.history[0].reachedTier).toBe("exceptional")
    expect(out.kept).toEqual([{ tier: "exceptional", taskId: "a" }])
    expect("current" in out).toBe(false)
  })

  it("migrates a v1 blob, and an empty one", () => {
    const v1 = { current: running("live"), history: [], kept: [] }
    const out = migrateSessionBlob(v1)
    expect(out.open).toHaveLength(1)
    expect(out.open[0]).toMatchObject({ id: "live", phase: "run" })
    expect(out.focusId).toBe("live")
    expect(migrateSessionBlob(undefined)).toEqual({ open: [], focusId: null, history: [], kept: [] })
    expect(migrateSessionBlob({ current: null, history: [], kept: [] }).open).toEqual([])
  })

  it("passes a v2 blob through and never leaves two live", () => {
    const out = migrateSessionBlob({ open: [running("a"), running("b"), emptySession(T0)], focusId: "b", history: [], kept: [] })
    expect(out.open.filter((p) => p.phase === "run").map((p) => p.id)).toEqual(["b"])
    expect(out.open.find((p) => p.id === "a")?.phase).toBe("parked")
    expect(out.focusId).toBe("b")
  })

  it("two sessions cannot run at once: put parks the running one", () => {
    const store = useSessionPlanStore.getState()
    store.put(running("a"))
    const bumped = store.put(running("b"))
    expect(bumped.map((p) => p.id)).toEqual(["a"])
    const open = useSessionPlanStore.getState().open
    expect(open.filter((p) => p.phase === "run").map((p) => p.id)).toEqual(["b"])
  })

  it("focus drops an empty draft left behind; archive closes into history", () => {
    const store = useSessionPlanStore.getState()
    const draft = emptySession(T0)
    store.put(draft)
    store.focus(draft.id)
    store.put(running("a"))
    store.focus("a")
    expect(useSessionPlanStore.getState().open.map((p) => p.id)).toEqual(["a"])
    store.archive({ ...running("a"), phase: "done" }, [])
    expect(useSessionPlanStore.getState()).toMatchObject({ open: [], focusId: null })
    expect(useSessionPlanStore.getState().history).toHaveLength(1)
  })

  it("analytics reads history only: open sessions never move the pace", () => {
    const line = (est: number, min: number) => ({ id: `${est}-${min}-${Math.random()}`, taskId: "x", estMin: est, actualSec: min * 60, doneAt: "x" })
    const slow: SessionPlan = { ...emptySession(T0), phase: "done", tiers: { min: [line(10, 30), line(10, 30), line(10, 30)], goal: [], exceptional: [] } }
    const fast: SessionPlan = { ...running("p"), phase: "parked", tiers: { min: [line(10, 5), line(10, 5), line(10, 5), line(10, 5)], goal: [], exceptional: [] } }
    useSessionPlanStore.setState({ history: [slow] })
    useSessionPlanStore.getState().put(fast)
    expect(sessionPace(useSessionPlanStore.getState().history)).toBe(3)
  })
})
