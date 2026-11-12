/**
 * lib/pharmacy-sync.test.ts — One dose is one dose, whichever door reports it
 */
import { beforeEach, describe, expect, it } from "vitest"
import { applyNfcScan } from "@/lib/ingest/apply-nfc"
import { applyIntake } from "@/lib/ingest/apply-discrete-event"
import { useIngestStore } from "@/lib/ingest/ingest-store"
import { useHabitsStore } from "@/lib/habits-store"
import { habitKey, usePharmacyStore } from "@/lib/pharmacy-store"
import { startPharmacySync, syncPharmacyHabits, syncPharmacyIntake } from "@/lib/pharmacy-sync"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { TaskType, type WeeklyTask } from "@/lib/types"
import { resetAllStores } from "@/tests/test-utils"

const NOW = new Date(2026, 10, 7, 9, 0, 0)
const DAY = "2026-11-07"

function chlorophyll(): WeeklyTask {
  return { id: "h-chl", name: "Chlorophyll", type: TaskType.BOOLEAN, categoryId: "c", frequency: "daily" } as unknown as WeeklyTask
}

function bottle(name: string, extra = {}) {
  const item = usePharmacyStore.getState().addItem({ name, capacity: 60, count: 60, ...extra }, NOW)
  if (!item) throw new Error("no item")
  return item
}

function count(id: string): number {
  return usePharmacyStore.getState().items.find((row) => row.id === id)?.count ?? -1
}

describe("pharmacy store draws", () => {
  beforeEach(() => {
    resetAllStores()
    usePharmacyStore.setState({ items: [], ledger: {}, log: [] })
  })

  it("takes a key once, gives back a smaller value, and refunds a removed source", () => {
    const rx = bottle("Adderall")
    const { draw, refund } = usePharmacyStore.getState()
    draw(rx.id, "intake:e1", 2, DAY, "intake", NOW)
    draw(rx.id, "intake:e1", 2, DAY, "intake", NOW)
    expect(count(rx.id)).toBe(58)
    draw(rx.id, "intake:e1", 1, DAY, "intake", NOW)
    expect(count(rx.id)).toBe(59)
    refund("intake:e1", NOW)
    expect(count(rx.id)).toBe(60)
    expect(usePharmacyStore.getState().ledger).toEqual({})
  })

  it("never goes under zero", () => {
    const rx = bottle("Adderall", { capacity: 3, count: 1 })
    usePharmacyStore.getState().draw(rx.id, "intake:e1", 5, DAY, "intake", NOW)
    expect(count(rx.id)).toBe(0)
  })

  it("a habit draws only what Intake lines of that day did not", () => {
    const rx = bottle("Adderall")
    const { draw, reconcileHabit } = usePharmacyStore.getState()
    reconcileHabit(rx.id, "h", DAY, 2, NOW)
    expect(count(rx.id)).toBe(58)
    draw(rx.id, "intake:e1", 1, DAY, "intake", NOW)
    usePharmacyStore.getState().reconcileHabit(rx.id, "h", DAY, 2, NOW)
    expect(count(rx.id)).toBe(58)
    expect(usePharmacyStore.getState().ledger[habitKey("h", DAY)].units).toBe(1)
    usePharmacyStore.getState().reconcileHabit(rx.id, "h", DAY, 0, NOW)
    expect(count(rx.id)).toBe(59)
  })
})

describe("pharmacy sync", () => {
  beforeEach(() => {
    resetAllStores()
    usePharmacyStore.setState({ items: [], ledger: {}, log: [] })
    useTimeTrackingStore.setState({ entries: [] })
    useHabitsStore.setState({ tasks: [chlorophyll()], weeklyData: {} })
    useIngestStore.setState({ nfcTags: [], enabled: true })
  })

  it("an Intake line with the bottle's name takes its count", () => {
    const rx = bottle("Adderall")
    applyIntake("2 Adderall", NOW, "drug")
    syncPharmacyIntake(useTimeTrackingStore.getState().entries)
    expect(count(rx.id)).toBe(58)
    syncPharmacyIntake(useTimeTrackingStore.getState().entries)
    expect(count(rx.id)).toBe(58)
  })

  it("deleting the Intake line gives the doses back", () => {
    const rx = bottle("Adderall")
    applyIntake("2 Adderall", NOW, "drug")
    const before = useTimeTrackingStore.getState().entries
    syncPharmacyIntake(before)
    useTimeTrackingStore.setState({ entries: [] })
    syncPharmacyIntake([], before)
    expect(count(rx.id)).toBe(60)
  })

  it("a linked habit takes 2 when done and gives them back when cleared", () => {
    const rx = bottle("Chlorophyll", { habitId: "h-chl", habitPer: 2, habitSince: DAY })
    const prev = useHabitsStore.getState().weeklyData
    useHabitsStore.setState({ weeklyData: { [DAY]: { "h-chl": { completed: true } } } })
    syncPharmacyHabits(prev)
    expect(count(rx.id)).toBe(58)
    syncPharmacyHabits(prev)
    expect(count(rx.id)).toBe(58)
    const done = useHabitsStore.getState().weeklyData
    useHabitsStore.setState({ weeklyData: { [DAY]: { "h-chl": { completed: false } } } })
    syncPharmacyHabits(done)
    expect(count(rx.id)).toBe(60)
  })

  it("does not draw habit days before the link", () => {
    const rx = bottle("Chlorophyll", { habitId: "h-chl", habitPer: 2, habitSince: DAY })
    useHabitsStore.setState({ weeklyData: { "2026-11-01": { "h-chl": { completed: true } } } })
    syncPharmacyHabits()
    expect(count(rx.id)).toBe(60)
  })

  it("an NFC tap bound to the bottle and the habit takes one dose, not two", () => {
    const rx = bottle("Chlorophyll", { habitId: "h-chl", habitPer: 1, habitSince: DAY })
    const stop = startPharmacySync()
    useIngestStore.getState().upsertNfcTag({
      id: "chlorophyll",
      name: "Chlorophyll",
      kind: "instant",
      title: "Chlorophyll",
      intakeClass: "drug",
      quantity: 1,
      habitId: "h-chl",
      habitCredit: "done",
      pharmacyId: rx.id,
    })
    const result = applyNfcScan("chlorophyll", NOW)
    expect(result.status).toBe("ok")
    syncPharmacyHabits()
    expect(count(rx.id)).toBe(59)
    expect(result.reply).toMatch(/Chlorophyll: 59 left/)
    stop()
  })
})
