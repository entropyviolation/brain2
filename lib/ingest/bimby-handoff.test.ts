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
  it("hands a list to the Habits BIMBY, with or without a colon", () => {
    const said = "i did skincare, stretched, drank water, unfollowed 1 person"
    expect(parseHandoff(`Tell habits bimby ${said}`)).toEqual({ target: "habits", payload: said })
    expect(parseHandoff(`tell the habits bimby that ${said}`)?.payload).toBe(said)
    expect(parseHandoff(`tell habit helper: ${said}`)).toEqual({ target: "habits", payload: said })
    expect(parseHandoff(`habits bimby: ${said}`)?.target).toBe("habits")
    expect(parseHandoff("send this to tracking bimby walked 30 min")).toEqual({ target: "tracking", payload: "walked 30 min" })
  })
  it("needs bimby or helper said when there is no colon", () => {
    expect(parseHandoff("tell habits i did skincare")).toBeNull()
    expect(parseHandoff("tell tracking chat i walked")).toBeNull()
  })
  it("leaves other lines alone", () => {
    expect(parseHandoff("send this to bob: hi")).toBeNull()
    expect(parseHandoff("tracking: walked")).toBeNull()
    expect(parseHandoff("log: send this to tracking bimby")).toBeNull()
    expect(parseHandoff("send this to tracking bimby")).toBeNull()
  })
})
