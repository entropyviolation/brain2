/**
 * lib/ingest/apply-glossary.test.ts
 */
import { describe, expect, it } from "vitest"
import { tryApplyGlossary, applyMainInfo, applyAllCommands } from "./apply-glossary"

describe("tryApplyGlossary", () => {
  it("serves main info via applyMainInfo (BIM)", () => {
    const r = applyMainInfo()
    expect(r.status).toBe("ok")
    expect(r.reply).toContain("BIM")
    expect(r.reply).toContain("Brain2 Ingestion Messenger")
    expect(r.reply).toContain("{prefix} info")
    expect(r.reply).toContain("all commands")
  })

  it("matches all commands", () => {
    const r = tryApplyGlossary("all commands")
    expect(r?.status).toBe("ok")
    expect(r?.reply).toContain("groc")
    expect(r?.reply).toContain("log:")
  })

  it("matches prefix info and commands", () => {
    const info = tryApplyGlossary("groc info")
    expect(info?.reply).toMatch(/Grocery/i)
    const cmds = tryApplyGlossary("log commands")
    expect(cmds?.reply).toMatch(/log:/i)
    const mon = tryApplyGlossary("monitor info")
    expect(mon?.reply).toMatch(/currently/i)
  })

  it("ignores bare info (verb path)", () => {
    expect(tryApplyGlossary("info")).toBeNull()
  })

  it("all commands glossary is complete", () => {
    const r = applyAllCommands()
    expect(r.reply).toContain("all nighter")
    expect(r.reply).toContain("needed:")
    expect(r.reply).toContain("switched to")
  })
})
