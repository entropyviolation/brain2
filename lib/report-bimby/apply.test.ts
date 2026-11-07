import { beforeEach, describe, expect, it } from "vitest"
import { readCycleMarks } from "@/lib/cycle-marks"
import { INVENTORY_QTY_ATTR, findInventoryList } from "@/lib/ingest/apply-inventory"
import { useTaskStore } from "@/lib/task-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { acceptAll, acceptEffect, rejectEffect } from "./decide"
import { parseReport } from "./parse"
import { buildPlan } from "./plan"
import { storeDeps, tryReport } from "./run"
import { useReportStore } from "./store"

const MSG = "started my period today. have been working on baby animal game for a while, and before that mostly watching youtube videos and scrolling. had a coffee earlier and also took 1 adderall, only 3 left now."

function adderallQty(): number | undefined {
  const list = findInventoryList()
  const item = useTaskStore.getState().tasks.find((t) => t.lists?.includes(list?.id ?? "") && /adderall/i.test(t.description ?? ""))
  return item ? Number(item.attributes?.[INVENTORY_QTY_ATTR]) : undefined
}

describe("Report BIMBY end to end", () => {
  beforeEach(() => {
    useReportStore.setState({ plans: {}, order: [] })
  })

  it("writes nothing until an effect is accepted, then writes with edited fields", async () => {
    const now = new Date()
    now.setHours(18, 0, 0, 0)
    const reply = await tryReport(MSG, now)
    expect(reply?.reportId).toBeTruthy()
    const plan = useReportStore.getState().plans[reply!.reportId]!
    expect(adderallQty()).toBeUndefined()
    expect(Object.keys(readCycleMarks())).not.toContain(plan.effects[0]!.fields[0]!.value)

    const inv = plan.effects.find((e) => e.kind === "inventory")!
    useReportStore.getState().setField(plan.id, inv.id, "qty", "2")
    acceptEffect(plan.id, inv.id)
    expect(adderallQty()).toBe(2)

    const cycle = plan.effects.find((e) => e.kind === "cycle")!
    acceptEffect(plan.id, cycle.id)
    expect(readCycleMarks()[cycle.fields[0]!.value]?.bleeding).toBe(true)

    const blocks = plan.effects.filter((e) => e.kind === "timeblock")
    rejectEffect(plan.id, blocks[1]!.id)
    acceptAll(plan.id)
    const after = useReportStore.getState().plans[plan.id]!
    expect(after.effects.find((e) => e.id === blocks[1]!.id)!.status).toBe("rejected")
    expect(after.effects.filter((e) => e.kind !== "timeblock" || e.id !== blocks[1]!.id).every((e) => e.status === "applied")).toBe(true)
    const painted = useTimeTrackingStore.getState().entries.filter((e) => e.scopeId === "activity" && e.generatedBy?.kind === "llm")
    expect(painted).toHaveLength(1)
    expect(painted[0]!.endMin - painted[0]!.startMin).toBe(180)
  })

  it("refuses a bad edit and keeps the effect retryable", () => {
    const plan = buildPlan("took 1 adderall", parseReport("took 1 adderall"), new Date(), storeDeps(null))
    useReportStore.getState().put(plan)
    const inv = plan.effects[0]!
    useReportStore.getState().setField(plan.id, inv.id, "qty", "-4")
    acceptEffect(plan.id, inv.id)
    const got = useReportStore.getState().plans[plan.id]!.effects[0]!
    expect(got.status).toBe("failed")
    expect(got.result).toMatch(/0 or more/)
  })
})
