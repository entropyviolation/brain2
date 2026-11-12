import { describe, expect, it } from "vitest"
import { buildStreamPlan, cleanPayload, destRoute, looksLikeStream, readClock } from "./parse"

const NOW = new Date(2026, 10, 9, 13, 57)

const STREAM = `8:17 hit dab pen once right before I started washing dishes
8:17 - 9:15 doing dishes and cleaning the kitchen
coffee at around 9:15 add to drinks tracking
add to inbox: Want a plug splitter for the kitchen so that I can plug appliances in on the other side
add to shopping list: a plug splitter for the kitchen
9:19 hit dab pen again
ate 1 samosa 9:19 - 9:23 add to food tracking
Gonna eat the Samosa, maybe watch a video and then work a little bit on BRAIN2 and then try to get some stuff done for Elijah merch.
9:27- 10:05 scrolling
stretched at 10:05
https://www.instagram.com/reel/DfZkMfwE9cw/?dlrf=NTc4MTIwNjQ2YQ==
add to to do list - CALL SHELBY I NEED TO I NEED TO I GUESS TODAY IS THE BEST DAY TO DO T
Thinking very positive and proud of myself because I woke up early this morning.
10:06 - 10:57 went for a walk`

const lines = () => buildStreamPlan(STREAM, NOW).effects.map((e) => e.fields[0]!.value)

describe("readClock", () => {
  it("reads 24-hour times, and afternoon for bare 1–6", () => {
    expect(readClock("8:17 hit")?.hhmm).toBe("08:17")
    expect(readClock("1:57 pm now")?.hhmm).toBe("13:57")
    expect(readClock("around 9:15 coffee")).toMatchObject({ hhmm: "09:15", est: true })
    expect(readClock("9:27- 10:05 scrolling")).toMatchObject({ hhmm: "09:27", end: "10:05" })
  })
  it("reads since 817 only after a word", () => {
    expect(readClock("since 817 washing dishes")?.hhmm).toBe("08:17")
    expect(readClock("817 dishes")).toBeNull()
  })
})

describe("looksLikeStream", () => {
  it("is an add-to directive or several timed lines, not one ordinary chat line", () => {
    expect(looksLikeStream("add to inbox: buy milk")).toBe(true)
    expect(looksLikeStream(STREAM)).toBe(true)
    expect(looksLikeStream("coffee at 9:15")).toBe(false)
  })
})

describe("destRoute and cleanPayload", () => {
  it("maps the named places", () => {
    expect(destRoute("shopping list")).toBe("shopping")
    expect(destRoute("drinks tracking")).toBe("drink")
    expect(destRoute("to do list")).toBe("todo")
    expect(destRoute("random")).toBeNull()
  })
  it("drops clock words from a payload", () => {
    expect(cleanPayload("coffee at around 9:15")).toBe("coffee")
  })
})

describe("buildStreamPlan", () => {
  it("files each piece as an executor line with its time", () => {
    const got = lines()
    expect(got).toContain("log: dab pen at 08:17")
    expect(got).toContain("track: dishes and cleaning the kitchen 08:17-09:15")
    expect(got).toContain("intake drink: coffee at 09:15 est")
    expect(got).toContain("inbox: Want a plug splitter for the kitchen so that I can plug appliances in on the other side")
    expect(got).toContain("shopping: a plug splitter for the kitchen")
    expect(got).toContain("log: dab pen at 09:19")
    expect(got).toContain("intake food: samosa at 09:19")
    expect(got).toContain("track: scrolling 09:27-10:05")
    expect(got).toContain("https://www.instagram.com/reel/DfZkMfwE9cw/?dlrf=NTc4MTIwNjQ2YQ==")
    expect(got).toContain("track: walk 10:06-10:57")
  })
  it("keeps a plan as a note at its time, and a feeling as a mood note", () => {
    const got = lines()
    expect(got.some((l) => l.startsWith("note: planned: Gonna eat the Samosa"))).toBe(true)
    expect(got.some((l) => l.startsWith("note: mood: Thinking very positive"))).toBe(true)
  })
  it("sends a shouted request to To Do today", () => {
    expect(lines().some((l) => l.startsWith("to do today: CALL SHELBY"))).toBe(true)
  })
  it("proposes one card line per filing, all pending, with the line as an editable field", () => {
    const plan = buildStreamPlan(STREAM, NOW)
    expect(plan.effects.every((e) => e.kind === "line" && e.status === "pending")).toBe(true)
    expect(plan.effects[0]!.fields[0]).toMatchObject({ key: "line", type: "text" })
    expect(plan.trace[0]).toMatch(/Read \d+ pieces/)
  })
})
