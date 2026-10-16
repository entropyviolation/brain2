import { describe, expect, it } from "vitest"
import { NO_LEVEL_ID, levelTotals, penLevelId, pensAtLevel, scopeLevels, scopeUsesLevels } from "./pen-levels"
import { entryFieldValue, fieldValuesPatch, fieldsForBlock, tagFields } from "./pen-fields"
import { companyHeadcount } from "./company-headcount"
import { mirrorCrossViewDetails } from "./entry-links"
import { actionValuesFor, renderPenActionTitle } from "./pen-action-format"
import { trackedFieldSumForTags } from "./tracked-time"
import type { TimeEntry } from "./time-entries"
import type { TrackScope } from "./time-tracking-store"

const location: TrackScope = {
  id: "location",
  name: "Location",
  pens: [
    { id: "usa", name: "USA", color: "#111111", levelId: "lvl-country" },
    { id: "ca", name: "California", color: "#222222", parentId: "usa", levelId: "lvl-state" },
    { id: "sd", name: "San Diego", color: "#333333", parentId: "ca", levelId: "lvl-city" },
    { id: "ob", name: "Ocean Beach", color: "#444444", parentId: "sd", levelId: "lvl-neighborhood" },
    { id: "trip", name: "Road trip", color: "#555555" },
  ],
}

const block = (over: Partial<TimeEntry>): TimeEntry => ({
  id: Math.random().toString(36).slice(2),
  date: "2026-10-15",
  scopeId: "location",
  penId: "ob",
  startMin: 600,
  endMin: 660,
  ...over,
})

describe("level categories", () => {
  it("ships Neighborhood, City, State, Country for Location", () => {
    expect(scopeLevels(location).map((l) => l.name)).toEqual(["Country", "State", "City", "Neighborhood"])
    expect(scopeUsesLevels(location)).toBe(true)
  })

  it("rolls a painted pen up to the pen at a level, and keeps unleveled time apart", () => {
    expect(pensAtLevel(location, "ob", "lvl-city").map((p) => p.name)).toEqual(["San Diego"])
    const totals = levelTotals([block({}), block({ penId: "trip", startMin: 700, endMin: 730 })], location, "lvl-state")
    expect(totals).toEqual([
      { penId: "ca", minutes: 60 },
      { penId: NO_LEVEL_ID, minutes: 30 },
    ])
  })

  it("puts the seeded Alone and Together pens on the broadest Company level", () => {
    const company: TrackScope = { id: "company", name: "Company", pens: [{ id: "co-alone", name: "Alone", color: "#000" }] }
    expect(penLevelId(company, company.pens[0])).toBe("lvl-company-kind")
  })
})

describe("pen detail fields", () => {
  const tags = [{ id: "tag-work", name: "Work", color: "#000" }]
  it("gives Work-tagged pens Project / context, and a pen its own fields", () => {
    expect(tagFields(tags[0]!).map((f) => f.name)).toEqual(["Project / context"])
    const reading = { id: "read", name: "Reading", fields: [{ id: "pages", name: "Pages read", kind: "number" as const }] }
    const rows = fieldsForBlock([reading, { id: "w", name: "Work", tags: ["tag-work"] }], tags)
    expect(rows.map((r) => [r.field.name, r.source])).toEqual([
      ["Pages read", "pen"],
      ["Project / context", "tag"],
    ])
  })

  it("keeps old Project / Book(s) / Pages values readable and mirrors them on save", () => {
    const old = { books: "Dune", pages: 12 }
    expect(fieldsForBlock([], [], old).map((r) => r.source)).toEqual(["kept", "kept"])
    expect(entryFieldValue(old, "pages")).toBe(12)
    expect(fieldValuesPatch({ pages: 30, books: "Dune", "fld-mood": "calm" })).toEqual({
      fieldValues: { "fld-mood": "calm" },
      project: undefined,
      books: "Dune",
      pages: 30,
    })
  })

  it("feeds a Done-today template and a habit sum", () => {
    const pen = {
      id: "read",
      name: "Reading",
      color: "#000",
      tags: ["tag-reading"],
      fields: [
        { id: "books", name: "Book(s)", kind: "text" as const },
        { id: "pages", name: "Pages read", kind: "number" as const },
      ],
    }
    const scope: TrackScope = { id: "activity", name: "Activity", pens: [pen] }
    const entry = block({ scopeId: "activity", penId: "read", books: "Dune", pages: 14 })
    const values = actionValuesFor(entry, pen, [entry], [scope], [])
    expect(renderPenActionTitle([{ id: "a", template: "Read" }, { id: "b", template: "Read {pages} pages of {book(s)}" }], values)).toBe(
      "Read 14 pages of Dune",
    )
    const bare = actionValuesFor(block({ scopeId: "activity", penId: "read" }), pen, [], [scope], [])
    expect(renderPenActionTitle([{ id: "a", template: "Read" }, { id: "b", template: "Read {pages} pages" }], bare)).toBe("Read")
    expect(trackedFieldSumForTags({ entries: [entry, { ...entry, id: "x", pages: 6 }], scopes: [scope] }, entry.date, ["tag-reading"], "pages")).toBe(20)
  })
})

describe("company headcount", () => {
  const company: TrackScope = {
    id: "company",
    name: "Company",
    pens: [
      { id: "co-alone", name: "Alone", color: "#000" },
      { id: "co-together", name: "Together", color: "#111" },
      { id: "eli", name: "Elijah", color: "#222" },
      { id: "reb", name: "Rebecca", color: "#333" },
    ],
  }
  it("splits alone, named people, and with someone unknown", () => {
    const entries = [
      block({ scopeId: "company", penId: "co-alone", startMin: 0, endMin: 60 }),
      block({ scopeId: "company", penId: "eli", secondaryPenIds: ["reb"], startMin: 60, endMin: 90 }),
      block({ scopeId: "company", penId: "co-together", startMin: 90, endMin: 100 }),
      block({ scopeId: "activity", penId: "act", startMin: 100, endMin: 120 }),
    ]
    const result = companyHeadcount(entries, [company], ["2026-10-15"])
    expect(result.minutes.alone).toBe(60)
    expect(result.minutes["2"]).toBe(30)
    expect(result.minutes.someone).toBe(10)
    expect(result.notRecorded).toBe(20)
    expect(result.meanCompany).toBe(2)
  })
})

describe("cross-view details agree with the view they name", () => {
  const activity: TrackScope = {
    id: "activity",
    name: "Activity",
    pens: [{ id: "hang", name: "Hanging out", color: "#000", variants: [{ id: "v-eli", name: "Elijah", penId: "eli", scopeId: "company" }] }],
  }
  const company: TrackScope = { id: "company", name: "Company", pens: [{ id: "eli", name: "Elijah", color: "#222" }] }
  let n = 0
  const makeId = () => `new-${n++}`

  it("ticking Elijah on Hanging out paints Elijah in Company", () => {
    const hang = block({ scopeId: "activity", penId: "hang", variantIds: ["v-eli"] })
    const next = mirrorCrossViewDetails([hang], [activity, company], { date: hang.date, scopeId: "activity", startMin: 600, endMin: 660 }, makeId)
    expect(next.some((e) => e.scopeId === "company" && e.penId === "eli" && e.startMin === 600 && e.endMin === 660)).toBe(true)
  })

  it("Company · Elijah ticks Elijah on an overlapping Hanging out block", () => {
    const hang = block({ scopeId: "activity", penId: "hang" })
    const eli = block({ scopeId: "company", penId: "eli" })
    const next = mirrorCrossViewDetails([hang, eli], [activity, company], { date: eli.date, scopeId: "company", startMin: 600, endMin: 660 }, makeId)
    expect(next.find((e) => e.id === hang.id)?.variantIds).toEqual(["v-eli"])
  })
})
