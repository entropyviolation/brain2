import { describe, expect, it } from "vitest"
import { readReportRequest } from "@/lib/texts-report"

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
