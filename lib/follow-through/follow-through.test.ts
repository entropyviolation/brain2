import { describe, expect, it } from "vitest"
import { nextQuestion, readAnswer } from "./ask"
import { merge, proposeLinks, unplanned } from "./link"
import { followFromModel, followPrompt, type FollowAsk } from "./llm"
import { dayEnd, findings, planRealism, predictionError, realismLine } from "./learn"
import { afterFeeling, beforeFeeling, displacementIn, hedgeOf, readPieces, splitSteps, todoWhat, type ReadPiece } from "./read"
import { followRows } from "./rows"
import { allSteps, emptyLedger, type Feeling, type Ledger } from "./types"

const NOW = new Date(2026, 10, 9, 14, 0)

/** The sample day, as the Stream BIMBY would hand it over: route, time, payload. */
const DAY: ReadPiece[] = [
  { text: "8:17 hit dab pen once", route: "count", hhmm: "08:17", payload: "dab pen" },
  { text: "8:17 - 9:15 doing dishes and cleaning the kitchen", route: "activity", hhmm: "08:17", end: "09:15", payload: "dishes" },
  { text: "ate 1 samosa 9:19 - 9:23 add to food tracking", route: "food", hhmm: "09:19", payload: "samosa" },
  { text: "Gonna eat the Samosa, maybe watch a video and then work a little bit on BRAIN2 and then try to get some stuff done for Elijah merch.", route: "plan", hhmm: "09:23" },
  { text: "9:27- 10:05 scrolling", route: "activity", hhmm: "09:27", end: "10:05", payload: "scrolling" },
  { text: "add to to do list - CALL SHELBY I NEED TO I NEED TO I GUESS TODAY IS THE BEST DAY TO DO T", route: "todo", hhmm: "10:05", payload: "CALL SHELBY I NEED TO I NEED TO I GUESS TODAY IS THE BEST DAY TO DO T" },
  { text: "Thinking very positive and proud of myself because I woke up early this morning.", route: "mood", hhmm: "10:05" },
  { text: "10:06 - 10:57 went for a walk", route: "activity", hhmm: "10:06", end: "10:57", payload: "walk" },
  { text: "1:57 pm started working on BRAIN2", route: "note", hhmm: "13:57" },
]

function ledgerOf(pieces: ReadPiece[], now = NOW): Ledger {
  const r = readPieces(pieces, now, "stream")
  return proposeLinks(merge(emptyLedger(), r), now, r.displacements).ledger
}

describe("reading", () => {
  it("splits a plan into ordered steps, each with its hedge", () => {
    expect(splitSteps("Gonna eat the Samosa, maybe watch a video and then work a little bit on BRAIN2 and then try to get some stuff done for Elijah merch.")).toEqual([
      { what: "eat the Samosa", hedge: "will" },
      { what: "watch a video", hedge: "maybe" },
      { what: "work a little bit on BRAIN2", hedge: "will" },
      { what: "get some stuff done for Elijah merch", hedge: "maybe" },
    ])
    expect(hedgeOf("I need to call")).toBe("must")
  })
  it("reads resistance and importance from pleading, with no number typed", () => {
    const f = beforeFeeling("CALL SHELBY I NEED TO I NEED TO I GUESS TODAY IS THE BEST DAY")
    expect(f.resistance).toBe(3)
    expect(f.importance).toBe(4)
    expect(f.excitement).toBeUndefined()
    expect(todoWhat("CALL SHELBY I NEED TO I NEED TO I GUESS")).toBe("call shelby")
  })
  it("keeps pull and push apart: both can be stated at once", () => {
    const f = beforeFeeling("so excited to start but I'm dreading the first call")
    expect(f.excitement).toBe(4)
    expect(f.resistance).toBe(4)
  })
  it("ties satisfaction to what it is about", () => {
    expect(afterFeeling("Thinking very positive and proud of myself because I woke up early this morning.")).toEqual({ satisfaction: 4, about: "I woke up early this morning" })
  })
  it("reads a displacement", () => {
    expect(displacementIn("Didn't; ended up scrolling")).toEqual({ by: "scrolling" })
    expect(displacementIn("ended up scrolling instead of tidying")).toEqual({ by: "scrolling", missed: "tidying" })
    expect(displacementIn("went for a walk")).toBeNull()
  })
})

describe("follow-through verdicts", () => {
  const l = ledgerOf(DAY)
  const step = (word: string) => allSteps(l).find((s) => s.what.toLowerCase().includes(word))!
  it("done as planned: the samosa, typed a few minutes out of order", () => {
    expect(step("samosa").verdict).toBe("done")
  })
  it("done late: BRAIN2 started four and a half hours after the plan", () => {
    expect(step("brain2").verdict).toBe("late")
    expect(step("brain2").delayMin).toBe(274)
  })
  it("still open: merch and the call; nothing is invented for them", () => {
    expect(step("merch").verdict).toBe("open")
    expect(step("shelby").verdict).toBe("open")
    expect(step("video").verdict).toBe("open")
  })
  it("unplanned: the walk and the scrolling; not the dab pen, not the dishes done before any plan", () => {
    expect(unplanned(l, "2026-11-09").map((a) => a.what).sort()).toEqual(["scrolling", "walk"])
  })
  it("every link is only proposed until confirmed", () => {
    expect(allSteps(l).every((s) => s.standing === "proposed")).toBe(true)
  })
  it("displaced: said outright, it takes the next open step", () => {
    const d = ledgerOf([
      { text: "gonna tidy the room then call mom", route: "plan", hhmm: "09:00" },
      { text: "9:10 - 9:50 scrolling", route: "activity", hhmm: "09:10", end: "09:50", payload: "scrolling" },
      { text: "Didn't; ended up scrolling", route: "note", hhmm: "09:50" },
    ])
    expect(allSteps(d)[0]).toMatchObject({ verdict: "displaced", displacedBy: "scrolling" })
    expect(allSteps(d)[1]!.verdict).toBe("open")
  })
  it("a refused action is never proposed again", () => {
    const r = readPieces(DAY, NOW, "stream")
    const first = proposeLinks(merge(emptyLedger(), r), NOW).ledger
    const samosa = allSteps(first).find((s) => s.what.includes("Samosa"))!
    const refused: Ledger = { ...first, intentions: first.intentions.map((i) => ({ ...i, steps: i.steps.map((s) => (s.id === samosa.id ? { ...s, verdict: "open" as const, actionId: undefined, refused: [samosa.actionId!] } : s)) })) }
    expect(allSteps(proposeLinks(refused, NOW).ledger).find((s) => s.id === samosa.id)!.verdict).toBe("open")
  })
  it("reading the same stream twice lands on the same records", () => {
    const r = readPieces(DAY, NOW, "stream")
    const twice = merge(merge(emptyLedger(), r), r)
    expect(twice.intentions.length).toBe(r.intentions.length)
    expect(twice.actions.length).toBe(r.actions.length)
  })
  it("the day's end puts the plan next to what happened", () => {
    const text = dayEnd(l, "2026-11-09")
    expect(text).toContain("eat the Samosa — done as planned at 09:19")
    expect(text).toContain("work a little bit on BRAIN2 — done late at 13:57, 4.6 h after the plan")
    expect(text).toContain("Unplanned:")
    expect(text).toContain("2 of 5 planned steps done.")
  })
})

describe("questions", () => {
  it("asks pull then push for a fresh plan, one tap each", () => {
    const l = ledgerOf([{ text: "gonna call the bank then tidy", route: "plan", hhmm: "13:50" }])
    const q = nextQuestion(l, NOW)!
    expect(q.kind).toBe("pull")
    expect(q.choices[3]).toEqual({ label: "3 high", text: "pull 3: call the bank" })
    expect(readAnswer(q.choices[3]!.text)).toEqual({ kind: "pull", value: 3, what: "call the bank" })
  })
  it("asks what pulled you away before anything else", () => {
    const l = ledgerOf([
      { text: "gonna tidy the room", route: "plan", hhmm: "09:00" },
      { text: "Didn't; ended up scrolling", route: "note", hhmm: "09:50" },
    ])
    expect(nextQuestion(l, NOW)!.kind).toBe("away")
    expect(readAnswer("away: phone | tidy the room")).toEqual({ kind: "away", reason: "phone", what: "tidy the room" })
  })
  it("asks how a block was only soon after it ends", () => {
    const l = ledgerOf([{ text: "12:00 - 13:30 deep work", route: "activity", hhmm: "12:00", end: "13:30", payload: "deep work" }])
    expect(nextQuestion(l, NOW)!.kind).toBe("after")
    expect(nextQuestion(l, new Date(2026, 10, 9, 20, 0))).toBeNull()
  })
  it("does not ask what was already said", () => {
    const l = ledgerOf([{ text: "CALL SHELBY I NEED TO I NEED TO", route: "todo", hhmm: "13:50", payload: "CALL SHELBY I NEED TO I NEED TO" }])
    // Resistance was read from the words, so only the pull is a gap.
    expect(nextQuestion(l, NOW)!.kind).toBe("pull")
  })
})

describe("model answers are checked", () => {
  const ask: FollowAsk = { lines: [{ index: 3, text: "Gonna eat the samosa, maybe watch a video." }], openSteps: [{ id: "s1", what: "tidy" }], actions: [{ id: "a1", label: "09:27 scrolling" }] }
  it("numbers what is sent", () => {
    expect(followPrompt(ask)).toContain("OPEN STEPS:\n1. tidy")
  })
  it("keeps hints by piece, leaves out -1, and drops pairs that name nothing real", () => {
    const { hints, pairings, dropped } = followFromModel({ lines: [{ n: 1, steps: [{ what: "eat the samosa", hedge: "will" }], resistance: -1, excitement: 2 }, { n: 7 }], outcomes: [{ step: 1, action: 1, verdict: "displaced" }, { step: 4, action: 1, verdict: "done" }] }, ask)
    expect(hints.get(3)).toMatchObject({ excitement: 2, resistance: undefined })
    expect(pairings).toEqual([{ stepId: "s1", actionId: "a1", verdict: "displaced" }])
    expect(dropped.length).toBe(2)
  })
  it("a step the line does not carry falls back to the rules' split", () => {
    const r = readPieces([{ text: "Gonna eat the samosa, maybe watch a video.", route: "plan", hhmm: "09:00", hint: { steps: [{ what: "go to the gym", hedge: "will" }] } }], NOW, "stream")
    expect(r.intentions[0]!.steps.map((s) => s.what)).toEqual(["eat the samosa", "watch a video"])
  })
})

describe("findings count only what is confirmed", () => {
  function history(): Ledger {
    let l = emptyLedger()
    for (let d = 1; d <= 6; d++) {
      const now = new Date(2026, 9, d, 18, 0)
      const r = readPieces(
        [
          { text: "need to call the bank then tidy the desk", route: "plan", hhmm: "09:00" },
          { text: "9:30 - 9:45 called the bank", route: "activity", hhmm: "09:30", end: "09:45", payload: "call the bank" },
        ],
        now,
        "stream",
      )
      l = proposeLinks(merge(l, r), now).ledger
    }
    return l
  }
  it("says not enough yet while links are only proposed", () => {
    expect(planRealism(history()).ready).toBe(false)
    expect(realismLine(history(), 4)).toBeNull()
  })
  it("gives plan realism and prediction error once confirmed", () => {
    const l = history()
    const feelings: Feeling[] = []
    const confirmed: Ledger = {
      ...l,
      intentions: l.intentions.map((i) => ({
        ...i,
        steps: i.steps.map((s) => {
          if (s.actionId) {
            feelings.push({ id: `b${s.id}`, at: i.at, day: i.day, phase: "before", stepId: s.id, resistance: 4, words: "", by: "asked", standing: "confirmed" })
            feelings.push({ id: `a${s.id}`, at: i.at, day: i.day, phase: "after", actionId: s.actionId, satisfaction: 3, words: "", by: "asked", standing: "confirmed" })
          }
          return { ...s, standing: "confirmed" as const, verdict: s.verdict === "open" ? ("dropped" as const) : s.verdict }
        }),
      })),
    }
    const full = { ...confirmed, feelings }
    const real = planRealism(full)
    expect(real.ready).toBe(true)
    expect(real.share).toBe(0.5)
    expect(realismLine(full, 4)).toContain("more like a 2-step day")
    expect(predictionError(full)[0]!.text).toContain("Of 6 things you resisted strongly and then did, 6 sat fine or better")
    expect(findings(full).some((f) => f.id === "cost" && f.ready)).toBe(true)
  })
})

describe("rows for analyses", () => {
  it("writes one row per step with its verdict as the source", () => {
    const rows = followRows(ledgerOf(DAY))
    expect(rows.find((r) => r.text.startsWith("eat the Samosa"))!.source).toBe("done · proposed")
    expect(rows.some((r) => r.source === "unplanned" && r.text.startsWith("walk"))).toBe(true)
    expect(rows.some((r) => r.source.startsWith("feeling after") && r.text.startsWith("great about"))).toBe(true)
  })
})
