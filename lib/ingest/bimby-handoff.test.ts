import { describe, expect, it } from "vitest"
import { parseHandoff } from "./bimby-handoff"

const NOTE = `computer work 1 hr from 11:40 - 12:40 timeblock with note 'working on brain2, specifically bim and bimby chat inputs and routes but also some work with documents including new awesome context menu'`

describe("parseHandoff", () => {
  it("passes the words after the colon verbatim", () => {
    expect(parseHandoff(`send this to tracking bimby: ${NOTE}`)).toEqual({ target: "tracking", payload: NOTE })
    expect(parseHandoff(`Please route that to the Tracking BIMBY - ${NOTE}`)?.payload).toBe(NOTE)
    expect(parseHandoff(`to tracking bimby: ${NOTE}`)?.payload).toBe(NOTE)
    expect(parseHandoff(`tell tracking helper: walked 30 min`)?.payload).toBe("walked 30 min")
  })
  it("leaves other lines alone", () => {
    expect(parseHandoff("send this to bob: hi")).toBeNull()
    expect(parseHandoff("tracking: walked")).toBeNull()
    expect(parseHandoff("log: send this to tracking bimby")).toBeNull()
    expect(parseHandoff("send this to tracking bimby")).toBeNull()
  })
})
