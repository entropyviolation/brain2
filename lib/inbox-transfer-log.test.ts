/**
 * Inbox → Tracking log. Each idea keeps its own createdAt.
 * Clipped duration and clock chips come back onto the note.
 */
import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { formatLocalDateKey } from "@/lib/date-utils"
import { applyDiscreteLog, applyTransferredLogLine } from "@/lib/ingest/apply-discrete-event"
import { minutesPastMidnight } from "@/lib/ingest/times"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import type { Task } from "@/lib/types"
import {
  inboxLogLine,
  inboxSubmissionTime,
  stripLeadingLogToken,
  transferInboxIdeasToLog,
} from "./inbox-transfer-log"

const NOW = new Date(2026, 9, 9, 22, 32, 0)
const SEP24_229 = new Date(2026, 8, 24, 2, 29, 41)
const SEP24_724 = new Date(2026, 8, 24, 19, 24, 0)

function idea(id: string, description: string, extra: Partial<Task> = {}): Task {
  return {
    id,
    description,
    stage: "inbox",
    createdAt: SEP24_229,
    completed: false,
    lists: [],
    estimatedDuration: 1,
    ...extra,
  }
}

function penName(penId: string | undefined): string {
  if (!penId) return ""
  for (const scope of useTimeTrackingStore.getState().scopes) {
    const pen = scope.pens.find((row) => row.id === penId)
    if (pen) return pen.name
  }
  return ""
}

beforeEach(() => {
  resetAllStores()
})

describe("inbox log text", () => {
  it("strips a leading log token the way log ingest does", () => {
    expect(stripLeadingLogToken("log need candy")).toBe("need candy")
    expect(stripLeadingLogToken("log: need candy")).toBe("need candy")
    expect(stripLeadingLogToken("log- need candy")).toBe("need candy")
    expect(stripLeadingLogToken("LOG: Need candy")).toBe("Need candy")
    expect(stripLeadingLogToken("logical plan")).toBe("logical plan")
    expect(stripLeadingLogToken("need candy")).toBe("need candy")
    expect(inboxLogLine(idea("a", "log need candy"))).toBe("need candy")
    expect(inboxLogLine(idea("b", "log: need candy"))).toBe("need candy")
    expect(inboxLogLine(idea("c", "need candy"))).toBe("need candy")
  })

  it("restores a clipped 60m chip and keeps a duration already in the title", () => {
    expect(inboxLogLine(idea("a", "total exercise", { estimatedDuration: 60 }))).toBe("total exercise 60m")
    expect(inboxLogLine(idea("b", "total exercise 60m", { estimatedDuration: 60 }))).toBe("total exercise 60m")
    expect(inboxLogLine(idea("c", "log: total exercise", { estimatedDuration: 60 }))).toBe("total exercise 60m")
    expect(inboxLogLine(idea("d", "workout 1h", { estimatedDuration: 60 }))).toBe("workout 1h")
    expect(inboxLogLine(idea("e", "nap", { estimatedDuration: 1 }))).toBe("nap")
  })

  it("restores a clipped clock and prefers a stored line that still has the token", () => {
    expect(
      inboxLogLine(
        idea("a", "Woke up around called elijah had deviled eggs and scroll", { scheduledTime: "15:00" }),
      ),
    ).toBe("Woke up around called elijah had deviled eggs and scroll 15:00")
    expect(inboxLogLine(idea("b", "left at 3pm", { scheduledTime: "15:00" }))).toBe("left at 3pm")
    expect(
      inboxLogLine(
        idea("c", "total exercise", {
          estimatedDuration: 60,
          body: "total exercise 60m",
        }),
      ),
    ).toBe("total exercise 60m")
    expect(
      inboxLogLine(idea("d", "total exercise", { estimatedDuration: 60, scheduledTime: "15:00" })),
    ).toBe("total exercise 15:00 60m")
  })

  it("reads createdAt and refuses a missing clock", () => {
    expect(inboxSubmissionTime(SEP24_229)?.getTime()).toBe(SEP24_229.getTime())
    expect(inboxSubmissionTime(SEP24_229.toISOString())?.getTime()).toBe(SEP24_229.getTime())
    expect(inboxSubmissionTime(undefined)).toBeNull()
    expect(inboxSubmissionTime(new Date(Number.NaN))).toBeNull()
    const days = Math.round(
      (new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate()).getTime() -
        new Date(SEP24_229.getFullYear(), SEP24_229.getMonth(), SEP24_229.getDate()).getTime()) /
        86_400_000,
    )
    expect(days).toBe(15)
  })
})

describe("transferInboxIdeasToLog", () => {
  it("stamps each idea at its own createdAt and removes it only after the write", () => {
    const tasks = [
      idea("early", "total exercise", { createdAt: SEP24_229, estimatedDuration: 60 }),
      idea("late", "log need candy", { createdAt: SEP24_724 }),
      idea("stay", "leave me", { createdAt: new Date(2026, 8, 24, 12, 0, 0) }),
      idea("quiet", "still here", { monkeyBrain: true, createdAt: new Date(2026, 8, 24, 3, 36, 0) }),
    ]
    const seen: { line: string; at: number }[] = []
    const result = transferInboxIdeasToLog(tasks, ["early", "late"], (line, at) => {
      seen.push({ line, at: at.getTime() })
      expect(at.getTime()).not.toBe(NOW.getTime())
      const applied = applyTransferredLogLine(line, at)
      return applied.status === "ok"
    })
    expect(seen).toEqual([
      { line: "total exercise 60m", at: SEP24_229.getTime() },
      { line: "need candy", at: SEP24_724.getTime() },
    ])
    expect(result.transferredIds).toEqual(["early", "late"])
    expect(result.tasks.map((task) => task.id)).toEqual(["stay", "quiet"])
    const entries = useTimeTrackingStore.getState().entries
    const exercise = entries.find((entry) => entry.title === "total exercise 60m")
    const candy = entries.find((entry) => entry.title === "need candy")
    expect(exercise).toMatchObject({
      date: "2026-09-24",
      startMin: 2 * 60 + 29,
      endMin: 2 * 60 + 29,
      kind: "instant",
      eventKind: "total exercise 60m",
    })
    expect(penName(exercise?.penId)).toBe("Text log")
    expect(candy).toMatchObject({
      date: formatLocalDateKey(SEP24_724),
      startMin: minutesPastMidnight(SEP24_724),
      kind: "instant",
    })
    expect(entries.every((entry) => entry.date !== formatLocalDateKey(NOW))).toBe(true)
    expect(entries.every((entry) => entry.startMin !== minutesPastMidnight(NOW))).toBe(true)
  })

  it("does not peel 60m into a range or move the minute to a clock chip", () => {
    const at = SEP24_229
    const peeled = applyDiscreteLog("total exercise 60m", at)
    expect(peeled.status).toBe("ok")
    const range = useTimeTrackingStore.getState().entries.find((entry) => entry.title === "total exercise")
    expect(range?.kind).not.toBe("instant")

    useTimeTrackingStore.setState({ entries: [] })
    const kept = applyTransferredLogLine("Woke up around called elijah 15:00", at)
    expect(kept.status).toBe("ok")
    const row = useTimeTrackingStore.getState().entries.find((entry) => entry.title?.includes("15:00"))
    expect(row).toMatchObject({
      title: "Woke up around called elijah 15:00",
      date: "2026-09-24",
      startMin: 2 * 60 + 29,
      kind: "instant",
    })
  })

  it("leaves the row when the write fails, the line is empty, or there is no original time", () => {
    const tasks = [
      idea("ok", "need candy"),
      idea("nope", "boom"),
      idea("blank", "log:"),
      idea("undated", "no clock", { createdAt: new Date(Number.NaN) }),
      idea("filed", "already out", { stage: "list" }),
    ]
    const result = transferInboxIdeasToLog(tasks, ["ok", "nope", "blank", "undated", "filed"], (line) => {
      if (line === "boom") return false
      return applyTransferredLogLine(line, SEP24_229).status === "ok"
    })
    expect(result.transferredIds).toEqual(["ok"])
    expect(result.tasks.map((task) => task.id)).toEqual(["nope", "blank", "undated", "filed"])
    expect(useTimeTrackingStore.getState().entries.map((entry) => entry.title)).toEqual(["need candy"])
  })

  it("does not remove a row when the writer throws", () => {
    const tasks = [idea("a", "need candy")]
    const result = transferInboxIdeasToLog(tasks, ["a"], () => {
      throw new Error("disk")
    })
    expect(result.transferredIds).toEqual([])
    expect(result.tasks).toBe(tasks)
    expect(useTimeTrackingStore.getState().entries).toHaveLength(0)
  })
})
