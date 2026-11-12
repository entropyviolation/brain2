import { describe, expect, it } from "vitest"
import { readHabitLog, readsAsHabitLog } from "./auto"
import { fixtureCtx } from "./tests"

const ctx = fixtureCtx("2026-11-11T18:00:00")
const yes = (text: string, opts?: { multiOnly?: boolean }) => readsAsHabitLog(text, ctx, opts)

describe("readsAsHabitLog", () => {
  it("takes a list of habits done", () => {
    expect(yes("drank water, stretched")).toBe(true)
    expect(yes("i did stretch and drank water and read the news")).toBe(true)
    expect(readHabitLog("stretched, drank water, called mom", ctx)).toMatchObject({ clauses: 3, named: 2, habits: ["stretch", "water"] })
  })
  it("takes one habit only with an amount and nothing else said", () => {
    expect(yes("read 10 pages")).toBe(true)
    expect(yes("walked 30 minutes")).toBe(true)
    expect(yes("stretched")).toBe(false)
    expect(yes("didn't read 10 pages")).toBe(false)
    expect(yes("read 10 pages of the report for work")).toBe(false)
  })
  it("leaves a line that only brushes a habit's words", () => {
    expect(yes("bought water at the store, then drove home")).toBe(false)
    expect(yes("stretched, called mom, paid rent, emailed sam, booked flights")).toBe(false)
    expect(yes("feeling tired and sad")).toBe(false)
  })
  it("leaves questions, commands and clocks to their own lanes", () => {
    expect(yes("did i drink water, stretch?")).toBe(false)
    expect(yes("log: drank water, stretched")).toBe(false)
    expect(yes("drank water at 9:15, stretched")).toBe(false)
    expect(yes("drank water at 9pm, stretched")).toBe(false)
    expect(yes("drank water\nstretched")).toBe(false)
  })
  it("refuses a one-habit line when BIM's own did command would take it", () => {
    expect(yes("did read 10 pages", { multiOnly: true })).toBe(false)
    expect(yes("did stretch, drank water", { multiOnly: true })).toBe(true)
  })
  it("takes nothing when there are no daily habits", () => {
    expect(readsAsHabitLog("drank water, stretched", { now: ctx.now, habits: [] })).toBe(false)
  })
})
