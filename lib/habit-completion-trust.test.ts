/**
 * lib/habit-completion-trust.test.ts — Trust order for completion sources
 */
import { describe, expect, it } from "vitest"
import { TaskType } from "./types"
import {
  patchIsHandEdit,
  readingsFromCell,
  textEditNeedsHeavySync,
  trustedOutcome,
  type SourceReading,
} from "./habit-completion-trust"
import type { HabitCompletionSourceId } from "./types"

function reading(state: SourceReading["state"], value?: number): SourceReading {
  return value === undefined ? { state } : { state, value }
}

describe("trustedOutcome", () => {
  const disagree: Partial<Record<HabitCompletionSourceId, SourceReading>> = {
    manual: reading("unmet", 0),
    sleep: reading("met"),
    tags: reading("empty"),
  }

  it("lets the highest-trust source win when two disagree", () => {
    expect(trustedOutcome(["manual", "sleep"], disagree)).toEqual({
      winner: "manual",
      met: false,
      value: 0,
    })
    expect(trustedOutcome(["sleep", "manual"], disagree)).toEqual({
      winner: "sleep",
      met: true,
      value: undefined,
    })
  })

  it("skips empty sources and uses the next one that has an opinion", () => {
    expect(trustedOutcome(["tags", "sleep", "manual"], disagree)).toEqual({
      winner: "sleep",
      met: true,
      value: undefined,
    })
  })

  it("follows a single source", () => {
    expect(trustedOutcome(["coverage"], { coverage: reading("met", 80) })).toEqual({
      winner: "coverage",
      met: true,
      value: 80,
    })
  })

  it("stays unmet when nothing is trusted or every source is empty", () => {
    expect(trustedOutcome([], { manual: reading("met") })).toEqual({ winner: null, met: false })
    expect(trustedOutcome(["tags", "keywords"], { tags: reading("empty"), keywords: reading("empty") })).toEqual({
      winner: null,
      met: false,
    })
  })
})

describe("readingsFromCell", () => {
  it("treats a bare hand tick as manual and a sleep flag as sleep", () => {
    const order: HabitCompletionSourceId[] = ["manual", "sleep"]
    expect(readingsFromCell(order, { completed: true }).manual?.state).toBe("met")
    expect(readingsFromCell(order, { completed: true, sleepCompleted: true }).manual?.state).toBe("empty")
    expect(readingsFromCell(order, { completed: true, sleepCompleted: true }).sleep?.state).toBe("met")
    expect(
      readingsFromCell(order, { handCompleted: false, sleepCompleted: true, completed: true }).manual?.state,
    ).toBe("unmet")
  })

  it("does not let tracked minutes pretend to be a hand entry", () => {
    const readings = readingsFromCell(["manual", "tags"], {
      value: 20,
      manualValue: 0,
      trackedValue: 20,
      trackedCompleted: true,
      goal: 15,
    }, 15)
    expect(readings.manual?.state).toBe("empty")
    expect(readings.tags?.state).toBe("met")
  })
})

describe("text edit weight", () => {
  it("skips heavy sync while a filled note is still filled", () => {
    const text = { type: TaskType.TEXT }
    expect(textEditNeedsHeavySync(text, { text: "hello" }, "hello there")).toBe(false)
    expect(textEditNeedsHeavySync(text, undefined, "a")).toBe(true)
    expect(textEditNeedsHeavySync(text, { text: "a" }, "  ")).toBe(true)
    expect(textEditNeedsHeavySync({ type: TaskType.BOOLEAN }, { completed: true }, "x")).toBe(true)
  })

  it("recognizes a hand tick and ignores an auto cell", () => {
    expect(patchIsHandEdit({ text: "note" })).toBe(true)
    expect(patchIsHandEdit({ completed: true })).toBe(true)
    expect(patchIsHandEdit({ value: 3, goal: 10 })).toBe(true)
    expect(patchIsHandEdit({ completed: true, sleepCompleted: true })).toBe(false)
    expect(patchIsHandEdit({ keywordLogged: true, value: 20 })).toBe(false)
  })
})
