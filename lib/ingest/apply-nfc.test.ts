/**
 * lib/ingest/apply-nfc.test.ts — NFC tag scans
 */
import { beforeEach, describe, expect, it } from "vitest"
import { formatLocalDateKey } from "@/lib/date-utils"
import { getDefaultHabits, useHabitsStore } from "@/lib/habits-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { resetAllStores } from "@/tests/test-utils"
import { applyNfcScan } from "./apply-nfc"
import { ingestIncoming } from "./executor"
import { useIngestStore } from "./ingest-store"
import { parseMessage } from "./parse-message"
import { TaskType } from "@/lib/types"

const NOW = new Date(2026, 9, 26, 17, 42, 0)

function later(seconds: number): Date {
  return new Date(NOW.getTime() + seconds * 1000)
}

function nfcRows() {
  return useTimeTrackingStore.getState().entries.filter((entry) => entry.generatedBy?.id?.startsWith("nfc:"))
}

describe("nfc scans", () => {
  beforeEach(() => {
    resetAllStores()
    useHabitsStore.setState({ tasks: getDefaultHabits(), weeklyData: {} })
    useIngestStore.setState({ nfcTags: [], enabled: true })
  })

  it("parses nfc: and leaves a bare nfc line alone", () => {
    expect(parseMessage("nfc:vitamin-d")).toMatchObject({ kind: "nfc", payload: "vitamin-d" })
    expect(parseMessage("nfc: door")).toMatchObject({ kind: "nfc", payload: "door" })
    expect(parseMessage("nfc").kind).not.toBe("nfc")
  })

  it("refuses an unknown id and writes nothing", () => {
    const before = useTimeTrackingStore.getState().entries.length
    const result = applyNfcScan("missing", NOW)
    expect(result.status).toBe("error")
    expect(result.reply).toMatch(/No NFC tag/)
    expect(useTimeTrackingStore.getState().entries.length).toBe(before)
    expect(useIngestStore.getState().nfcTags).toEqual([])
  })

  it("ignores a second tap inside 20 seconds", () => {
    useIngestStore.getState().upsertNfcTag({
      id: "vitamin-d",
      name: "Vitamin D",
      kind: "instant",
      title: "vitamin D",
      intakeClass: "drug",
      habitId: "task-4",
      habitCredit: "done",
    })
    const first = applyNfcScan("vitamin-d", NOW)
    expect(first.status).toBe("ok")
    expect(first.reply).toContain("Logged vitamin D")
    expect(first.reply).toContain("Drink water: done")
    const again = applyNfcScan("nfc:vitamin-d", later(19))
    expect(again.status).toBe("ignored")
    expect(again.reply).toMatch(/Already logged/)
    expect(nfcRows().filter((entry) => entry.kind === "instant")).toHaveLength(1)
    const instant = nfcRows().find((entry) => entry.kind === "instant")
    expect(instant).toMatchObject({
      title: "vitamin D",
      intakeClass: "drug",
      eventKind: "intake.drug",
    })
    expect(instant?.generatedBy?.id).toMatch(/^nfc:vitamin-d:/)
    const day = formatLocalDateKey(NOW)
    expect(useHabitsStore.getState().weeklyData[day]?.["task-4"]?.completed).toBe(true)
  })

  it("adds 1 to a count habit on each accepted scan", () => {
    useIngestStore.getState().upsertNfcTag({
      id: "pages",
      name: "Pages",
      kind: "instant",
      title: "read a page",
      habitId: "task-8",
      habitCredit: "add",
    })
    expect(applyNfcScan("pages", NOW).status).toBe("ok")
    expect(applyNfcScan("pages", later(5)).status).toBe("ignored")
    expect(applyNfcScan("pages", later(21)).status).toBe("ok")
    const day = formatLocalDateKey(NOW)
    expect(useHabitsStore.getState().weeklyData[day]?.["task-8"]?.value).toBe(2)
  })

  it("alternates a door tag between left and back", () => {
    useIngestStore.getState().upsertNfcTag({
      id: "door",
      name: "Door",
      kind: "toggle",
    })
    expect(applyNfcScan("door", NOW).reply).toBe("Logged left")
    expect(useIngestStore.getState().nfcTags[0]?.lastSide).toBe("out")
    expect(applyNfcScan("door", later(10)).status).toBe("ignored")
    expect(useIngestStore.getState().nfcTags[0]?.lastSide).toBe("out")
    expect(applyNfcScan("door", later(21)).reply).toBe("Logged back")
    expect(useIngestStore.getState().nfcTags[0]?.lastSide).toBe("in")
    expect(applyNfcScan("door", later(42)).reply).toBe("Logged left")
    const titles = nfcRows()
      .filter((entry) => entry.kind === "instant")
      .map((entry) => entry.title)
    expect(titles).toEqual(["left", "back", "left"])
  })

  it("paints a shower instant and the minutes that just finished", () => {
    useIngestStore.getState().upsertNfcTag({
      id: "shower",
      name: "Shower",
      kind: "instant",
      title: "shower",
      minutes: 10,
      habitId: "task-4",
      habitCredit: "done",
    })
    const result = applyNfcScan("shower", NOW)
    expect(result.status).toBe("ok")
    expect(result.reply).toContain("10 min")
    const instant = nfcRows().find((entry) => entry.kind === "instant")
    const block = nfcRows().find((entry) => entry.kind !== "instant")
    expect(instant?.title).toBe("shower")
    expect(block).toMatchObject({
      title: "shower",
      precision: "estimated",
      startMin: 17 * 60 + 32,
      endMin: 17 * 60 + 42,
    })
    expect(block?.generatedBy?.id).toMatch(/^nfc:shower:span:/)
  })

  it("leaves a weekly habit cell alone", () => {
    useHabitsStore.setState({
      tasks: [
        ...getDefaultHabits(),
        { id: "week-1", name: "Weekly review", type: TaskType.BOOLEAN, rewardValue: 1, frequency: "weekly" },
      ],
    })
    useIngestStore.getState().upsertNfcTag({
      id: "review",
      name: "Review",
      kind: "instant",
      title: "weekly review",
      habitId: "week-1",
      habitCredit: "done",
    })
    const result = applyNfcScan("review", NOW)
    expect(result.reply).toMatch(/not daily/)
    expect(useHabitsStore.getState().weeklyData[formatLocalDateKey(NOW)]?.["week-1"]).toBeUndefined()
  })

  it("reaches the scan through a simulated BIM line", () => {
    useIngestStore.getState().upsertNfcTag({ id: "door", name: "Door", kind: "toggle" })
    const result = ingestIncoming(
      { source: { channel: "simulate", chatId: "sim" }, text: "nfc:door", receivedAt: NOW.toISOString() },
      NOW,
    )
    expect(result.status).toBe("ok")
    expect(result.reply).toBe("Logged left")
  })
})
