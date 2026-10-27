import { describe, expect, it } from "vitest"
import {
  dayInPeriod,
  peopleDuring,
  peopleNotSeenButMessaged,
  periodChain,
  placesWithOnePerson,
  projectVault,
  triplesForDay,
  triplesForPeriod,
  unlinkedCaptures,
  type SpineScope,
  type SpineVault,
} from "@/lib/graph/vault-graph"

const company: SpineScope = {
  id: "company",
  pens: [
    { id: "sam", name: "Sam", color: "#111" },
    { id: "ada", name: "Ada", color: "#222" },
  ],
}

const location: SpineScope = {
  id: "location",
  pens: [{ id: "park", name: "Park", color: "#0a0" }],
}

const texts: SpineScope = {
  id: "iphone-texts",
  pens: [{ id: "text-sam", name: "Sam", color: "#333", personId: "p-sam" }],
}

function block(partial: SpineVault["entries"] extends readonly (infer E)[] | undefined ? E : never) {
  return partial
}

describe("day spine", () => {
  const vault: SpineVault = {
    scopes: [company, location, texts],
    entries: [
      { id: "c1", date: "2026-10-27", scopeId: "company", penId: "sam", startMin: 600, endMin: 660 },
      { id: "l1", date: "2026-10-27", scopeId: "location", penId: "park", startMin: 600, endMin: 660 },
      { id: "sleep", date: "2026-10-27", scopeId: "activity", penId: "sleep-pen", startMin: 0, endMin: 60, generatedBy: { kind: "sleep", id: "2026-10-27" } },
    ],
    items: [
      { id: "note", title: "Milk", captureOrigin: { kind: "telegram" }, createdAt: "2026-10-27T15:00:00", links: [] },
      { id: "linked", title: "Linked", captureOrigin: { kind: "telegram" }, createdAt: "2026-10-27", links: [{ relation: "related", targetId: "note" }] },
      { id: "done", title: "Call", completed: true, completedDate: "2026-10-27" },
      { id: "trip", title: "Coast", scheduledDate: "2026-10-27", deadline: "2026-10-28" },
      { id: "p-sam", title: "Sam", type: "person", personPipelines: [{ kind: "company-pen", penId: "sam" }] },
    ],
    reviews: [{ period: "week", periodKey: "2026-10-26_2026-11-01" }],
    events: [{ id: "m1", at: "2026-10-27T18:00:00", status: "applied", itemIds: ["note"] }],
  }

  const graph = projectVault(vault)

  it("nests the day under week, month, season, and year", () => {
    expect(periodChain("2026-10-27")).toEqual({
      day: "day:2026-10-27",
      week: "week:2026-10-26_2026-11-01",
      month: "month:2026-10",
      season: "season:2026-Q4",
      year: "year:2026",
    })
    const nest = graph.triples.filter((triple) => triple.p === "nested-in" && triple.s === "day:2026-10-27")
    expect(nest.map((triple) => triple.o)).toEqual(["week:2026-10-26_2026-11-01"])
    expect(nest[0].order).toBe("derived")
    expect(dayInPeriod("2026-10-27", "season:2026-Q4")).toBe(true)
    expect(dayInPeriod("2026-10-27", "month:2026-11")).toBe(false)
  })

  it("names the order on painted, sleep, completion, and review edges", () => {
    const withSam = graph.triples.find((triple) => triple.p === "with-person" && triple.o === "item:p-sam")
    expect(withSam?.order).toBe("recorded")
    const sleep = graph.triples.find((triple) => triple.p === "generated-by")
    expect(sleep).toMatchObject({ o: "stream:sleep", order: "observed" })
    expect(graph.triples.some((triple) => triple.p === "completed-on" && triple.s === "item:done" && triple.order === "recorded")).toBe(true)
    expect(graph.triples.some((triple) => triple.p === "reviews" && triple.o.startsWith("week:") && triple.order === "recorded")).toBe(true)
  })

  it("answers co-time, one-person places, and unlinked captures", () => {
    const during = peopleDuring(graph, { start: "2026-10-27", end: "2026-10-28", person: "Sam" })
    expect(during.n).toBe(1)
    expect(during.places).toEqual(["pen:park"])
    const places = placesWithOnePerson(graph)
    expect(places).toHaveLength(1)
    expect(places[0]).toMatchObject({ place: "pen:park", person: "item:p-sam", n: 1 })
    const loose = unlinkedCaptures(graph)
    expect(loose.map((triple) => triple.s)).toEqual(["item:note"])
    expect(triplesForDay(graph.triples, "2026-10-27").some((triple) => triple.p === "produced")).toBe(true)
    expect(triplesForPeriod(graph.triples, "week:2026-10-26_2026-11-01").length).toBeGreaterThan(0)
  })

  it("finds a person messaged each of four weeks and not seen in 90 days", () => {
    const dates = ["2026-10-06", "2026-10-13", "2026-10-20", "2026-10-27"]
    const quiet = projectVault({
      scopes: [texts],
      entries: dates.map((date, index) =>
        block({ id: `t${index}`, date, scopeId: "iphone-texts", penId: "text-sam", startMin: 9 * 60, endMin: 9 * 60 }),
      ),
      items: [{ id: "p-sam", title: "Sam", type: "person" }],
    })
    const found = peopleNotSeenButMessaged(quiet, { asOf: "2026-10-27" })
    expect(found.messagesProjected).toBe(true)
    expect(found.people.map((row) => row.person)).toEqual(["item:p-sam"])

    const seen = projectVault({
      scopes: [company, texts],
      entries: [
        ...dates.map((date, index) =>
          block({ id: `t${index}`, date, scopeId: "iphone-texts", penId: "text-sam", startMin: 9 * 60, endMin: 9 * 60 }),
        ),
        { id: "visit", date: "2026-10-20", scopeId: "company", penId: "sam", startMin: 600, endMin: 660 },
      ],
      items: [{ id: "p-sam", title: "Sam", type: "person", personPipelines: [{ kind: "company-pen", penId: "sam" }] }],
    })
    expect(peopleNotSeenButMessaged(seen, { asOf: "2026-10-27" }).people).toEqual([])
  })

  it("reports the message gap when no text or call block is projected", () => {
    const empty = projectVault({ items: [{ id: "p", title: "Sam", type: "person" }] })
    expect(peopleNotSeenButMessaged(empty, { asOf: "2026-10-27" })).toMatchObject({ people: [], messagesProjected: false })
  })
})
