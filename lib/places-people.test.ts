import { describe, expect, it } from "vitest"
import { parseCoordPair, partForLevelName, penForCoordinate } from "./pen-place"
import { isPersonPen, planPeopleItems, planPeopleSync, variantPerson } from "./people-sync"
import { mirrorCrossViewDetails } from "./entry-links"
import { cadenceSentence, personTimeStats } from "./person-time"
import type { TimeEntry } from "./time-entries"
import type { TrackScope } from "./time-tracking-store"

describe("pen places", () => {
  const pens = [
    { id: "home", name: "Home", place: { lat: 32.75, lng: -117.25, address: "123 Main" } },
    { id: "gym", name: "Gym", place: { coords: [{ id: "c1", lat: 32.8, lng: -117.2, radiusM: 200 }] } },
    { id: "ob", name: "Ocean Beach", place: { zip: "92107", zipLat: 32.745, zipLng: -117.245 } },
  ]
  it("matches a fix to an address pin or attached coordinate before a zip area", () => {
    expect(penForCoordinate(pens, 32.7501, -117.2501)?.penId).toBe("home")
    expect(penForCoordinate(pens, 32.8012, -117.2005)?.penId).toBe("gym")
    expect(penForCoordinate(pens, 32.74, -117.24)).toMatchObject({ penId: "ob", kind: "zip" })
    expect(penForCoordinate(pens, 40, -100)).toBeNull()
  })
  it("reads pairs and maps level names to address parts", () => {
    expect(parseCoordPair("32.7495, -117.2470")).toEqual({ lat: 32.7495, lng: -117.247 })
    expect(parseCoordPair("hello")).toBeNull()
    const parts = { neighborhood: "Ocean Beach", city: "San Diego", state: "California", country: "United States" }
    expect(["Country", "State", "City", "Neighborhood", "Province"].map((n) => partForLevelName(n, parts))).toEqual([
      "United States",
      "California",
      "San Diego",
      "Ocean Beach",
      "California",
    ])
  })
})

const company: TrackScope = {
  id: "company",
  name: "Company",
  pens: [
    { id: "co-alone", name: "Alone", color: "#000" },
    { id: "co-together", name: "Together", color: "#111" },
    { id: "reb", name: "Rebecca", color: "#222" },
  ],
}
const activity: TrackScope = {
  id: "activity",
  name: "Activity",
  pens: [
    { id: "social", name: "Social", color: "#333", variantLabel: "Who with?", variants: [{ id: "v-eli", name: "Elijah", penId: "act-eli" }] },
    { id: "act-eli", name: "Elijah", color: "#444", parentId: "social" },
  ],
}

describe("people sync", () => {
  it("makes Company pens for who-details and who-details for Company people", () => {
    const plan = planPeopleSync([activity, company])
    expect(plan.createCompany).toEqual(["Elijah"])
    expect(plan.addDetail).toEqual([{ scopeId: "activity", penId: "social", companyPenId: "reb" }])
    expect(isPersonPen(company, company.pens[0]!)).toBe(false)
  })

  it("joins People I Know items by pipeline, then name, else creates one", () => {
    const people = [{ id: "t1", title: "rebecca" }]
    expect(planPeopleItems([company], people, () => [])).toEqual({ join: [{ taskId: "t1", penId: "reb" }], create: [] })
    expect(planPeopleItems([company], people, () => ["reb"])).toEqual({ join: [], create: [] })
  })

  it("reads a local Social detail as the same-named Company person, and mirrors it", () => {
    const withEli: TrackScope = { ...company, pens: [...company.pens, { id: "eli", name: "Elijah", color: "#555" }] }
    const scopes = [activity, withEli]
    expect(variantPerson(scopes, "activity", activity.pens[0], activity.pens[0]!.variants![0]!)).toBe("eli")
    const social: TimeEntry = { id: "s", date: "2026-10-10", scopeId: "activity", penId: "social", variantIds: ["v-eli"], startMin: 600, endMin: 660 }
    const next = mirrorCrossViewDetails([social], scopes, { date: social.date, scopeId: "activity", startMin: 600, endMin: 660 }, () => "new")
    expect(next.some((e) => e.scopeId === "company" && e.penId === "eli")).toBe(true)
    const coEli: TimeEntry = { id: "c", date: "2026-10-10", scopeId: "company", penId: "eli", startMin: 600, endMin: 660 }
    const bare = { ...social, variantIds: [] }
    const back = mirrorCrossViewDetails([bare, coEli], scopes, { date: coEli.date, scopeId: "company", startMin: 600, endMin: 660 }, () => "n2")
    expect(back.find((e) => e.id === "s")?.variantIds).toEqual(["v-eli"])
  })
})

describe("time together", () => {
  it("unions Company and Social minutes, finds where and what, and the rhythm", () => {
    const withEli: TrackScope = { ...company, pens: [...company.pens, { id: "eli", name: "Elijah", color: "#555" }] }
    const location: TrackScope = { id: "location", name: "Location", pens: [{ id: "park", name: "Park", color: "#0a0" }] }
    const e = (o: Partial<TimeEntry>): TimeEntry => ({ id: Math.random().toString(36), date: "2026-10-01", scopeId: "company", penId: "eli", startMin: 600, endMin: 660, ...o })
    const entries = [
      e({}),
      e({ scopeId: "activity", penId: "social", variantIds: ["v-eli"], startMin: 630, endMin: 690 }),
      e({ scopeId: "location", penId: "park", startMin: 600, endMin: 690 }),
      e({ date: "2026-10-08", secondaryPenIds: ["reb"], penId: "co-together" }),
      e({ date: "2026-10-08", penId: "reb", secondaryPenIds: ["eli"], startMin: 700, endMin: 720 }),
    ]
    const stats = personTimeStats(entries, [activity, withEli, location], ["eli"], "2026-10-15")
    expect(stats.totalMinutes).toBe(90 + 20)
    expect(stats.days).toBe(2)
    expect(stats.places[0]?.name).toBe("Park")
    expect(stats.activities[0]?.name).toBe("Social")
    expect(stats.others[0]?.name).toBe("Rebecca")
    expect(stats.cadenceDays).toBe(7)
    expect(stats.sinceLast).toBe(7)
    expect(cadenceSentence(7)).toBe("About weekly.")
  })
})
