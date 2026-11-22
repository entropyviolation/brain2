import { describe, expect, it } from "vitest"
import { buildGroupPlan, readGroup, tripWindow } from "./group"

// Made-up names and no real places, in the shape of the person's own line (`docs/BIM_CHAT_USAGE.md` §5, failure 1).
const TRIP =
  "while in nyc i hung out with Mira, Jo (super briefly), Teo, Sam, and Wren, and met new friends Kit (whose 21st birthday it was the night of the show) and this girl Bee (short for beatrix) who is very cute and nice and from ohio but only 19 and for some reason i had a bad feeling about her even though i liked her but she let me stay at her apartment in her bed."
const PEOPLE = [
  { id: "p1", name: "Mira Lane" },
  { id: "p2", name: "Teo Park" },
  { id: "p3", name: "Sam Ortiz" },
]
const FLIGHTS = [
  { from: "SAN", to: "JFK", departDate: "2026-11-12", arriveDate: "2026-11-12", airline: "JetBlue", notes: [], missing: [] },
  { from: "JFK", to: "SAN", departDate: "2026-11-18", flightNumber: "AS25", airline: "Alaska Airlines", notes: [], missing: [] },
]
const NOW = new Date(2026, 10, 21, 19, 13)

describe("Social BIMBY: many people in one line", () => {
  it("finds everyone, matches the known ones, and reads what was said about the new ones", () => {
    const r = readGroup(TRIP, PEOPLE)!
    expect(r.people.map((p) => p.name)).toEqual(["Mira", "Jo", "Teo", "Sam", "Wren", "Kit", "Bee"])
    expect(r.people.filter((p) => p.known).map((p) => p.known!.id)).toEqual(["p1", "p2", "p3"])
    expect(r.people.find((p) => p.name === "Jo")).toMatchObject({ aside: "super briefly", met: false })
    expect(r.people.find((p) => p.name === "Kit")).toMatchObject({ met: true, birthdayOn: { age: 21, event: "the night of the show" } })
    const bee = r.people.find((p) => p.name === "Bee")!
    expect(bee).toMatchObject({ met: true, aside: "short for beatrix", age: 19, from: "ohio", stayedAt: "her apartment" })
    expect(bee.feelings).toEqual(expect.arrayContaining(["very cute", "nice", "a bad feeling"]))
    expect(r).toMatchObject({ trip: "nyc", event: "the show" })
  })

  it("dates the trip from the flights in and out", () => {
    const w = tripWindow("nyc", FLIGHTS, NOW)!
    expect(w).toMatchObject({ from: "2026-11-12", to: "2026-11-18" })
    expect(w.evidence[1]).toContain("AS25")
  })

  it("proposes a change per person, the new people, the birthday year, the hang-out with its place, and asks back", () => {
    const { plan, questions } = buildGroupPlan(readGroup(TRIP, PEOPLE)!, TRIP, NOW, { flights: FLIGHTS })
    const titles = plan.effects.map((e) => e.title)
    expect(titles.filter((t) => t.startsWith("Note on"))).toHaveLength(7)
    expect(titles.filter((t) => t.startsWith("New person"))).toEqual(["New person: Jo", "New person: Wren", "New person: Kit", "New person: Bee"])
    const kit = plan.effects.find((e) => e.title === "New person: Kit")!
    expect(kit.fields.find((f) => f.key === "relation")!.value).toBe("met in NYC, 2026-11-12 to 2026-11-18")
    const bday = plan.effects.find((e) => e.kind === "birthday")!
    expect(bday.reasoning.join(" ")).toContain("2005")
    // The day is the show's: never guessed, asked.
    expect(bday.fields.find((f) => f.key === "date")!.value).toBe("")
    const hang = plan.effects.find((e) => e.kind === "plan-entry")!
    expect(hang.fields.find((f) => f.key === "on")!.value).toBe("2026-11-12")
    expect(hang.fields.find((f) => f.key === "text")!.value).toContain("stayed at Bee's apartment")
    const bee = plan.effects.find((e) => e.title === "Note on Bee")!.fields.find((f) => f.key === "text")!.value
    expect(bee).toContain("How it felt: very cute")
    expect(questions).toHaveLength(3)
    expect(questions[0]).toMatch(/Which show was it, and what day\? Kit turned 21/)
  })

  it("leaves a line about one or two people to the one-person reading", () => {
    expect(readGroup("hung out with Mira and Teo today", PEOPLE)).toBeNull()
    expect(readGroup("I need to hang out with Kai next week", [])).toBeNull()
    expect(readGroup("starting dishes", PEOPLE)).toBeNull()
  })
})
