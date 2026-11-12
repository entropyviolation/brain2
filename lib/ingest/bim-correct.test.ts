import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { loadRouteVerdicts, taughtExamples, taughtRoute } from "@/lib/bim-flow/route-verdicts"
import { sendToBim, useBimChatStore } from "./bim-chat"
import { parseCorrectedWhen, parseCorrection } from "./bim-correct"
import { useIngestStore } from "./ingest-store"

// A Monday, 15:00.
const WAS = new Date(2026, 10, 9, 15, 0)
const iso = (d: Date | null) => (d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}` : null)
const when = (words: string) => iso(parseCorrectedWhen(words, WAS))
const kind = (line: string) => parseCorrection(line, WAS)?.kind ?? null

describe("parseCorrectedWhen", () => {
  it("a day keeps the hour, a clock keeps the day", () => {
    expect(when("yesterday")).toBe("2026-11-08 15:00")
    expect(when("the day before yesterday")).toBe("2026-11-07 15:00")
    expect(when("2 days ago")).toBe("2026-11-07 15:00")
    expect(when("at 3:30pm")).toBe("2026-11-09 15:30")
    expect(when("9:15")).toBe("2026-11-09 09:15")
  })

  it("reads a day and a clock together, weekdays, and US dates", () => {
    expect(when("yesterday at 3pm")).toBe("2026-11-08 15:00")
    expect(when("last night at 22:30")).toBe("2026-11-08 22:30")
    expect(when("on friday")).toBe("2026-11-06 15:00")
    expect(when("monday")).toBe("2026-11-02 15:00")
    expect(when("11/7/26 at 14:00")).toBe("2026-11-07 14:00")
  })

  it("is null for words that are not a time", () => {
    expect(when("coffee today please")).toBeNull()
    expect(when("3")).toBeNull()
    expect(when("")).toBeNull()
  })
})

describe("parseCorrection", () => {
  it("reads each kind of fix", () => {
    expect(kind("no, yesterday")).toBe("when")
    expect(kind("no that was yesterday at 3pm")).toBe("when")
    expect(kind("actually it was at 14:00")).toBe("when")
    expect(kind("wrong, I meant 2 days ago")).toBe("when")
    expect(kind("that wasn't a question")).toBe("is-log")
    expect(kind("no, I wasn't asking")).toBe("is-log")
    expect(kind("just log it")).toBe("is-log")
    expect(kind("that was a question")).toBe("is-ask")
    expect(kind("no, I was asking")).toBe("is-ask")
    expect(kind("scrap that")).toBe("undo")
    expect(kind("never mind")).toBe("undo")
    expect(kind("don't log that")).toBe("undo")
    expect(kind("no")).toBe("unsure")
    expect(kind("wrong")).toBe("unsure")
    expect(kind("that's wrong")).toBe("unsure")
    expect(kind("leave it")).toBe("leave")
  })

  it("leaves ordinary lines alone", () => {
    expect(kind("no coffee today")).toBeNull()
    expect(kind("actually I went to the gym")).toBeNull()
    expect(kind("yesterday")).toBeNull()
    expect(kind("at 3pm")).toBeNull()
    expect(kind("no?")).toBeNull()
    expect(kind("wait for the bus")).toBeNull()
    expect(kind("undo")).toBeNull()
  })
})

describe("BIM chat corrections", () => {
  const t0 = new Date(2026, 10, 9, 15, 0)
  const later = (ms: number) => new Date(t0.getTime() + ms)
  const raws = () => useIngestStore.getState().events.map((e) => e.raw)

  beforeEach(() => {
    resetAllStores()
    useBimChatStore.getState().clear()
  })

  it("with no last turn, a correction is just a line", async () => {
    const line = await sendToBim("no, yesterday", t0)
    expect(line.route).toBeUndefined()
  })

  it("moves the last write to the corrected time", async () => {
    const first = await sendToBim("log: shower", t0)
    expect(first.status).toBe("ok")
    const line = await sendToBim("no, yesterday at 2pm", later(60_000))
    expect(line.route).toBe("CORRECT · code")
    expect(line.text).toMatch(/^Moved to Sun, Nov 8, 14:00\./)
    // The executor filed it at the corrected clock, not the send time.
    expect(line.text).toContain("2:00 PM")
    // Undone, then the same executor line filed again.
    expect(raws().slice(0, 2)).toEqual(["log: shower", "undo"])
    // A second fix moves the moved write.
    const again = await sendToBim("actually it was at 9:30", later(120_000))
    expect(again.text).toMatch(/^Moved to Sun, Nov 8, 09:30\./)
  })

  it("will not move a write into the future, or move nothing", async () => {
    await sendToBim("log: shower", t0)
    const future = await sendToBim("no, at 23:00", later(60_000))
    expect(future.text).toMatch(/has not happened yet/)
    expect(raws()).toEqual(["log: shower"])

    useBimChatStore.getState().clear()
    await sendToBim("ping", t0)
    const nothing = await sendToBim("no, yesterday", later(60_000))
    expect(nothing.text).toMatch(/nothing to move/)
  })

  it("undoes the last write on words", async () => {
    await sendToBim("log: shower", t0)
    const line = await sendToBim("scrap that", later(60_000))
    expect(line.text).toMatch(/^Undone\./)
    // The turn is spent: a second "scrap that" is a line, not a second undo.
    const second = await sendToBim("scrap that", later(120_000))
    expect(second.route).toBeUndefined()
  })

  it("a bare no says what was done and offers keys; leave it changes nothing", async () => {
    await sendToBim("log: shower", t0)
    const line = await sendToBim("no", later(60_000))
    expect(line.text).toMatch(/^I filed "log: shower"/)
    expect(line.choices?.map((c) => c.label)).toEqual(["undo it", "it was a question", "leave it"])
    const left = await sendToBim("leave it", later(120_000))
    expect(left.text).toBe("Okay, left as it is.")
    expect(raws()).toEqual(["log: shower"])
  })

  it("an old turn is not corrected", async () => {
    await sendToBim("log: shower", t0)
    const line = await sendToBim("no, yesterday", later(31 * 60_000))
    expect(line.route).toBeUndefined()
  })

  it("'that wasn't a question' files the line and teaches the router", async () => {
    // LLM off: the ladder says "Question, not filed".
    const first = await sendToBim("is the laundry done?", t0)
    expect(raws()).toHaveLength(1)
    expect(useIngestStore.getState().events[0]!.status).not.toBe("applied")
    void first
    const line = await sendToBim("that wasn't a question", later(60_000))
    expect(line.text).toMatch(/^Filed it/)
    expect(raws()[0]).toBe("log: is the laundry done?")
    expect(loadRouteVerdicts()[0]).toMatchObject({ text: "is the laundry done?", shouldBe: "log" })
    expect(taughtRoute("Is the laundry done")).toBe("log")
    expect(taughtExamples()).toEqual(["LINE: is the laundry done? → log"])
    // And now that it is filed, it can be moved.
    const moved = await sendToBim("no, yesterday", later(120_000))
    expect(moved.text).toMatch(/^Moved to Sun, Nov 8, 15:00\./)
  })

  it("'that was a question' undoes the write, teaches the router, and asks it", async () => {
    await sendToBim("log: when is the dentist", t0)
    const line = await sendToBim("no, that was a question", later(60_000))
    expect(line.text).toMatch(/^Undone, and I will take those words as a question/)
    expect(taughtRoute("log: when is the dentist")).toBe("ask")
  })
})
