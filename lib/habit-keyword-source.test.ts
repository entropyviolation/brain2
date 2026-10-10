/**
 * lib/habit-keyword-source.test.ts — Exact BIM phrases, three count modes
 */
import { describe, expect, it } from "vitest"
import { TaskType } from "./types"
import { listPeriodMeasure } from "./habit-completion-pipeline"
import { readingsFromCell, trustedOutcome } from "./habit-completion-trust"
import {
  applyKeywordToCompletion,
  evaluateKeywordPeriod,
  keywordCompletionPatch,
  loggedPhraseDurationMinutes,
  matchLoggedPhrase,
  matchLoggedPhraseLine,
  type KeywordHit,
} from "./habit-keyword-source"

const start = new Date(2026, 9, 5, 0, 0, 0, 0)
const end = new Date(2026, 9, 12, 0, 0, 0, 0)

function at(day: number, hour = 12): string {
  return new Date(2026, 9, day, hour).toISOString()
}

const waterHits: KeywordHit[] = [
  { text: "drank water", at: at(6) },
  { text: "drank water", at: at(7) },
  { text: "drank water please", at: at(7, 13) },
]

function water(use: "received" | "after", hits: KeywordHit[], count?: number) {
  return evaluateKeywordPeriod({
    hits,
    phrases: ["drank water"],
    use,
    count,
    start,
    end,
  })
}

describe("BIM keyword counts", () => {
  it("counts exact drank water twice and drank water please zero times", () => {
    const result = water("received", waterHits)
    expect(result.count).toBe(2)
    expect(water("received", [{ text: "drank water please", at: at(6) }]).count).toBe(0)
  })

  it("is done after one message when the mode is true if received", () => {
    const one = water("received", [waterHits[0]!])
    expect(one.count).toBe(1)
    expect(one.done).toBe(true)
    const cell = applyKeywordToCompletion(undefined, keywordCompletionPatch(one, { use: "received" }))
    expect(trustedOutcome(["keywords"], readingsFromCell(["keywords"], cell)).met).toBe(true)
  })

  it("is not done after one and is done after two when N is 2", () => {
    const one = water("after", [waterHits[0]!], 2)
    expect(one.count).toBe(1)
    expect(one.done).toBe(false)
    const oneCell = applyKeywordToCompletion(undefined, keywordCompletionPatch(one, { use: "after", count: 2 }))
    expect(trustedOutcome(["keywords"], readingsFromCell(["keywords"], oneCell)).met).toBe(false)

    const two = water("after", waterHits, 2)
    expect(two.count).toBe(2)
    expect(two.done).toBe(true)
    const twoCell = applyKeywordToCompletion(undefined, keywordCompletionPatch(two, { use: "after", count: 2 }))
    expect(twoCell.keywordAfter).toBe(2)
    expect(trustedOutcome(["keywords"], readingsFromCell(["keywords"], twoCell)).met).toBe(true)
  })

  it("matches cleaned for {x} minutes to cleaned for 9 minutes", () => {
    expect(matchLoggedPhrase("cleaned for {x} minutes", "cleaned for 9 minutes")).toEqual({
      amount: 9,
      slots: { x: "9" },
    })
    expect(matchLoggedPhrase("cleaned for {x} minutes", "Cleaned   For  9   Minutes")?.amount).toBe(9)
    expect(matchLoggedPhrase("cleaned for {x} minutes", "I cleaned for 9 minutes today")).toBeNull()
    expect(loggedPhraseDurationMinutes("cleaned for {x} minutes", 9)).toBe(9)
    expect(loggedPhraseDurationMinutes("read {n} pages of {bookname}", 3)).toBeNull()
  })

  it("keeps a trailing clock out of the phrase and still reads the amount", () => {
    const hit = matchLoggedPhraseLine("cleaned for {x} minutes", "cleaned for 9 minutes 1:11")
    expect(hit?.amount).toBe(9)
    expect(matchLoggedPhrase("cleaned for {x} minutes", "cleaned for 9 minutes 1:11")).toBeNull()
  })

  it("logs 3 and Dune from read {n} pages of {bookname}", () => {
    const logged = evaluateKeywordPeriod({
      hits: [{ text: "read 3 pages of Dune", at: at(6) }],
      phrases: ["read"],
      use: "logged",
      pattern: "read {n} pages of {bookname}",
      start,
      end,
    })
    expect(logged.amount).toBe(3)
    expect(logged.slots.bookname).toBe("Dune")
    const cell = applyKeywordToCompletion(undefined, keywordCompletionPatch(logged, { use: "logged", pattern: "read {n} pages of {bookname}" }))
    expect(cell.keywordValue).toBe(3)
    expect(cell.keywordSlots?.bookname).toBe("Dune")
  })

  it("does not paint a hit with no timestamp onto every period", () => {
    const hit: KeywordHit = { text: "drank water" }
    const nextStart = new Date(2026, 9, 12, 0, 0, 0, 0)
    const nextEnd = new Date(2026, 9, 19, 0, 0, 0, 0)
    expect(water("received", [hit]).count).toBe(0)
    expect(water("received", [hit]).done).toBe(false)
    expect(
      evaluateKeywordPeriod({ hits: [hit], phrases: ["drank water"], use: "received", start: nextStart, end: nextEnd }).count,
    ).toBe(0)
  })

  it("leaves a list-length habit unchanged", () => {
    const clock = new Date(2026, 9, 9, 15, 0, 0)
    const finishedWeek = new Date(2026, 8, 30, 12, 0, 0)
    const early = new Date(2026, 8, 1, 12, 0, 0).toISOString()
    const items = [
      { title: "a", lists: ["texts"], createdAt: early },
      { title: "b", lists: ["texts"], createdAt: early },
      { title: "c", lists: ["texts"], createdAt: early },
      {
        title: "sent",
        lists: ["texts"],
        createdAt: early,
        sentAtByList: { texts: new Date(2026, 8, 30, 12, 0, 0).toISOString() },
      },
      { title: "joined-that-week", lists: ["texts"], createdAt: new Date(2026, 8, 29, 12, 0, 0).toISOString() },
    ]
    const habit = {
      id: "texts",
      name: "respond to all missing texts",
      type: TaskType.GOAL,
      goal: 100,
      frequency: "weekly" as const,
      completionSources: ["manual", "listSent"] as const,
      listSentLink: { listId: "texts", grace: 100, measure: "sent" as const, target: "listLength" as const },
    }
    const before = listPeriodMeasure(habit, items, finishedWeek, clock)
    const link = { ...habit.listSentLink }
    water("after", waterHits, 2)
    expect(listPeriodMeasure(habit, items, finishedWeek, clock)).toEqual(before)
    expect(habit.listSentLink).toEqual(link)
    expect(before).toMatchObject({ listLength: 5, sentInSpan: 1, leftToSend: 4, frozen: true })
  })
})
