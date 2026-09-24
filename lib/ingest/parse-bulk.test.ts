import { describe, expect, it } from "vitest"
import { looksLikeListDump, parseBulkBuckets, parseDueBeforeHeader } from "./parse-bulk"

const NOW = new Date(2026, 8, 19, 17, 42, 0)

describe("parseDueBeforeHeader", () => {
  it("reads a calendar day and leaves a named before-list alone", () => {
    const day = parseDueBeforeHeader("before 9/30:", NOW)
    expect(day?.getFullYear()).toBe(2026)
    expect(day?.getMonth()).toBe(8)
    expect(day?.getDate()).toBe(30)
    expect(parseDueBeforeHeader("before 9/12:", NOW)?.getFullYear()).toBe(2027)
    expect(parseDueBeforeHeader("before elijah gets home:", NOW)).toBeNull()
    expect(parseDueBeforeHeader("before Friday:", NOW)).toBeInstanceOf(Date)
  })
})

describe("parseBulkBuckets", () => {
  it("stamps a before-date onto the list that follows", () => {
    const buckets = parseBulkBuckets("before 9/30:\nbefore elijah gets home:\nclean house\nclean couch", NOW)
    expect(buckets).toHaveLength(1)
    expect(buckets[0].listName).toBe("before elijah gets home")
    expect(buckets[0].lines).toEqual(["clean house", "clean couch"])
    expect(buckets[0].dueBefore?.getDate()).toBe(30)
  })

  it("keeps a doubled grocery header as folder plus list", () => {
    const buckets = parseBulkBuckets("Grocery list: grocery list:\neggs\nrice\nbutter", NOW)
    expect(buckets[0]).toMatchObject({
      folderPath: ["Grocery list"],
      listName: "grocery list",
      lines: ["eggs", "rice", "butter"],
    })
  })

  it("recognizes a list dump", () => {
    expect(looksLikeListDump("before elijah gets home:\nclean house", NOW)).toBe(true)
    expect(looksLikeListDump("clean house\nclean couch", NOW)).toBe(false)
    expect(looksLikeListDump("Chores: milk", NOW)).toBe(false)
  })
})
