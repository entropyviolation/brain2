import { beforeEach, describe, expect, it } from "vitest"
import { FLIGHT_ATTR, FLIGHT_TYPE_ID } from "@/lib/flight-types"
import { useTaskStore } from "@/lib/task-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import type { Task } from "@/lib/types"
import { usePlanRunStore } from "./store"
import type { PlanItem } from "./types"

const item = (id: string, title: string, extra: Partial<PlanItem> = {}): PlanItem => ({ id, title, subtasks: [], pace: "steady", ...extra })
const t = (iso: string) => new Date(iso)

function seedTask(): void {
  const cds = { id: "cds", description: "Finish CDs", title: "Finish CDs", type: "task", completed: false, lists: [], createdAt: new Date() } as unknown as Task
  useTaskStore.getState().addTask(cds)
}

describe("plan run effects", () => {
  beforeEach(() => {
    usePlanRunStore.getState().end()
    useTaskStore.setState({ tasks: [], lists: [] })
  })

  it("finishing a coffee row logs one intake from the plan BIMBY, once", () => {
    const s = usePlanRunStore.getState()
    s.begin([item("c", "make more coffee", { link: { kind: "intake", label: "coffee", intakeClass: "drink" } })], [], "x", t("2026-11-02T07:00:00"))
    s.complete("c", t("2026-11-02T07:05:00"))
    expect(usePlanRunStore.getState().run!.items[0]!.effects).toEqual(["Logged intake: coffee"])
    usePlanRunStore.getState().reopen("c")
    usePlanRunStore.getState().complete("c", t("2026-11-02T07:09:00"))
    expect(usePlanRunStore.getState().run!.items[0]!.effects).toHaveLength(1)
    const rows = JSON.stringify(useTimeTrackingStore.getState())
    expect(rows).toContain("plan-bimby")
    expect(rows).toContain("Auto-created from the task")
  })

  it("play and pause on a confirmed task link logs time on that task", () => {
    seedTask()
    const s = usePlanRunStore.getState()
    s.begin([item("f", "finish cds", { link: { kind: "task", taskId: "cds", title: "Finish CDs", confirmed: true } })], [], "x", t("2026-11-02T07:00:00"))
    s.play("f", t("2026-11-02T07:00:00"))
    usePlanRunStore.getState().pause("f", t("2026-11-02T07:42:00"))
    const task = useTaskStore.getState().tasks.find((x) => x.id === "cds")!
    expect(task.timeLogs?.[0]).toMatchObject({ durationMinutes: 42, taskId: "cds" })
    expect(task.actualDuration).toBe(42)
    expect(usePlanRunStore.getState().run!.items[0]!.effects[0]).toBe("Logged 42 min on Finish CDs")
  })

  it("an unconfirmed task link logs nothing", () => {
    seedTask()
    const s = usePlanRunStore.getState()
    s.begin([item("f", "finish cds", { link: { kind: "task", taskId: "cds", title: "Finish CDs", confirmed: false } })], [], "x", t("2026-11-02T07:00:00"))
    s.play("f", t("2026-11-02T07:00:00"))
    usePlanRunStore.getState().pause("f", t("2026-11-02T07:42:00"))
    expect(useTaskStore.getState().tasks.find((x) => x.id === "cds")!.timeLogs ?? []).toHaveLength(0)
  })

  it("a pasted confirmation files a Flight item in a flight list and finishes the row", () => {
    const s = usePlanRunStore.getState()
    s.begin([item("b", "book ny flights", { link: { kind: "flight" } })], [], "x", t("2026-11-02T07:00:00"))
    expect(usePlanRunStore.getState().run!.items[0]!.needsConfirmation).toBe(true)
    const said = usePlanRunStore.getState().fileConfirmation("b", "Your confirmation code: K7QZ2P\nDelta DL 402 JFK to LAX", t("2026-11-02T07:10:00"))
    expect(said).toMatch(/^Filed .*JFK → LAX/)
    const flight = useTaskStore.getState().tasks.find((x) => x.type === FLIGHT_TYPE_ID)!
    expect(flight.attributes?.[FLIGHT_ATTR.bookingNumber]).toBe("K7QZ2P")
    expect(useTaskStore.getState().lists.some((l) => l.itemTypeId === FLIGHT_TYPE_ID && flight.lists.includes(l.id))).toBe(true)
    const row = usePlanRunStore.getState().run!.items[0]!
    expect(row.state).toBe("done")
    expect(row.needsConfirmation).toBe(false)
  })
})
