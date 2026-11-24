import { describe, expect, it } from "vitest"
import { buildDumpPlan } from "./run"
import { matchTask, priorMentions } from "./match"
import { DUMP } from "./parse.test"

const NOW = new Date(2026, 10, 24, 7, 12)

describe("matching what is stored", () => {
  it("finds the open task a plan is about, not a near miss", () => {
    const tasks = [
      { id: "a", name: "Arkansas tickets" },
      { id: "b", name: "Christmas tree" },
      { id: "c", name: "Clean bathroom" },
    ]
    expect(matchTask("Book arkansas tickets", tasks)?.id).toBe("a")
    expect(matchTask("Make a christmas list", tasks)).toBeNull()
    expect(matchTask("Clean entire house", tasks)).toBeNull()
  })
  it("counts earlier days the plan was said", () => {
    const logs = [
      { text: "gotta book arkansas tickets", at: "2026-11-18T10:00:00.000Z" },
      { text: "need to book the arkansas tickets!!", at: "2026-11-21T10:00:00.000Z" },
      { text: "arkansas was fun", at: "2026-11-22T10:00:00.000Z" },
    ]
    expect(priorMentions("Book arkansas tickets", logs, NOW)).toEqual(["2026-11-18", "2026-11-21"])
  })
})

describe("the card", () => {
  it("amends a stored plan, files new ones, and ends with the patterns", () => {
    const { plan, counts, hits } = buildDumpPlan(DUMP, NOW, {
      tasks: [{ id: "ark", name: "Arkansas tickets", createdAt: "2026-11-10T12:00:00.000Z" }],
      logs: [
        { text: "gotta book arkansas tickets", at: "2026-11-18T10:00:00.000Z" },
        { text: "book arkansas tickets asap", at: "2026-11-21T10:00:00.000Z" },
      ],
    })
    expect(counts).toEqual({ amend: 1, fresh: 9 })
    const amend = plan.effects.find((e) => e.kind === "amend")!
    expect(amend.ref).toBe("ark")
    expect(amend.fields.find((f) => f.key === "urgency")?.value).toBe("4")
    const lines = plan.effects.filter((e) => e.kind === "line").map((e) => e.fields[0]!.value)
    expect(lines).toContain("to do today: Clean entire house by 2pm")
    expect(lines).toContain("to do today: Send Hannah mail")
    expect(lines).toContain("inbox: Make a christmas list")
    expect(lines).toContain("inbox: Call cap again and clear car (needs 2.5 and balls first)")
    expect(lines).toContain("intake drug: adderall")
    expect(hits.map((h) => h.pattern)).toContain("recurring-intention")
    expect(plan.effects.at(-1)!.kind).toBe("pattern")
  })
})
