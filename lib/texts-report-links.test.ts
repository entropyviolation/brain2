import { describe, expect, it } from "vitest"
import { readReportRequest, textsCardFor } from "@/lib/texts-report"

describe("readReportRequest", () => {
  it("reads ready, link, unlink and open-person", () => {
    expect(readReportRequest({ source: "texts-report", type: "ready" })).toEqual({ type: "ready" })
    expect(readReportRequest({ source: "texts-report", type: "link", personId: "p1", handles: ["+15551234567", 3] })).toEqual({
      type: "link",
      personId: "p1",
      handles: ["+15551234567"],
    })
    expect(readReportRequest({ source: "texts-report", type: "open-person", personId: "p1" })).toEqual({ type: "open-person", personId: "p1" })
  })

  it("ignores anything else", () => {
    expect(readReportRequest({ type: "ready" })).toBeNull()
    expect(readReportRequest({ source: "texts-report", type: "link", personId: "p1", handles: [] })).toBeNull()
    expect(readReportRequest({ source: "texts-report", type: "delete", personId: "p1" })).toBeNull()
    expect(readReportRequest("ready")).toBeNull()
  })
})

describe("report requests added for people", () => {
  it("reads create-person, refreshing and index", () => {
    expect(readReportRequest({ source: "texts-report", type: "create-person", name: " Ana ", handles: ["+15551234567"] })).toEqual({
      type: "create-person",
      name: "Ana",
      handles: ["+15551234567"],
    })
    expect(readReportRequest({ source: "texts-report", type: "create-person", name: "", handles: ["+1"] })).toBeNull()
    expect(readReportRequest({ source: "texts-report", type: "refreshing" })).toEqual({ type: "refreshing" })
    expect(
      readReportRequest({ source: "texts-report", type: "index", people: [{ ent: "p01", name: "Ana", handles: ["+15551234567"] }, { bad: 1 }] }),
    ).toEqual({ type: "index", people: [{ ent: "p01", name: "Ana", handles: ["+15551234567"] }] })
  })
})

describe("textsCardFor", () => {
  const rows = [{ ent: "p01", name: "Ana", handles: ["+15551234567", "ana@x.co"] }]
  it("finds the card for any saved number, in any spelling", () => {
    expect(textsCardFor(["(555) 123-4567"], rows)?.ent).toBe("p01")
    expect(textsCardFor(["ANA@x.co"], rows)?.ent).toBe("p01")
    expect(textsCardFor(["5550000000"], rows)).toBeNull()
    expect(textsCardFor([], rows)).toBeNull()
  })
})

describe("readReportRequest sections", () => {
  it("keeps well-formed sections and drops the rest", () => {
    expect(
      readReportRequest({ source: "texts-report", type: "sections", sections: [{ id: "volume", label: "Volume" }, { id: 3 }, null] }),
    ).toEqual({ type: "sections", sections: [{ id: "volume", label: "Volume" }] })
    expect(readReportRequest({ source: "texts-report", type: "section", id: "calls" })).toEqual({ type: "section", id: "calls" })
    expect(readReportRequest({ source: "texts-report", type: "section" })).toBeNull()
  })
})
