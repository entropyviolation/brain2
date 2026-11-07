import { describe, expect, it } from "vitest"
import { infoText, isInfoRequest } from "./info"
import { builtinBlueprints } from "./registry"
import { parseInfoAsk } from "@/lib/ingest/bimby-handoff"

describe("isInfoRequest", () => {
  it("takes a bare info and nothing longer", () => {
    for (const t of ["info", " Info? ", "/info", "bimby info", "information"]) expect(isInfoRequest(t), t).toBe(true)
    for (const t of ["info about my day", "I need info", "show info on rent"]) expect(isInfoRequest(t), t).toBe(false)
  })
})

describe("infoText", () => {
  it("names every BIMBY, says its job, and what it writes", () => {
    for (const b of builtinBlueprints().filter((x) => /BIMBY$/.test(x.name))) {
      const t = infoText(b)
      expect(t, b.id).toContain(b.name)
      expect(t, b.id).toContain(b.purpose)
      expect(t, b.id).toMatch(/writes nothing|proposes/i)
    }
  })

  it("lists hand-written examples when it has them", () => {
    const b = builtinBlueprints().find((x) => x.id === "habit-helper")!
    expect(infoText(b)).toContain("Try saying:")
  })
})

describe("BIM chat asks", () => {
  it("finds a BIMBY by name", async () => {
    expect(await parseInfoAsk("tracking bimby info")).toContain("Tracking BIMBY")
    expect(await parseInfoAsk("info on the lists bimby")).toContain("Lists BIMBY")
    expect(await parseInfoAsk("what is the overcome bimby?")).toContain("Overcome BIMBY")
  })
  it("ignores everything else", async () => {
    expect(await parseInfoAsk("info")).toBeNull()
    expect(await parseInfoAsk("info on the zebra bimby")).toBeNull()
  })
})
