import { beforeEach, describe, expect, it } from "vitest"
import { resetLocalStorage } from "@/tests/test-utils"
import {
  INBOX_RECENT_LISTS_KEY,
  readInboxRecentListIds,
  recentListIdsFromItems,
  rememberInboxListIds,
  suggestedInboxListIds,
} from "./inbox-recent-lists"

describe("inbox recent lists", () => {
  beforeEach(() => {
    resetLocalStorage()
  })

  it("remembers newly used ids in front of older ones", () => {
    expect(rememberInboxListIds(["work"])).toEqual(["work"])
    expect(rememberInboxListIds(["home", "work"])).toEqual(["home", "work"])
    expect(readInboxRecentListIds()).toEqual(["home", "work"])
    expect(JSON.parse(localStorage.getItem(INBOX_RECENT_LISTS_KEY) ?? "[]")).toEqual(["home", "work"])
  })

  it("ranks list ids from newest items first", () => {
    const ids = recentListIdsFromItems([
      { lists: ["old"], createdAt: new Date("2026-01-01") },
      { lists: ["new", "old"], createdAt: new Date("2026-09-01") },
    ])
    expect(ids).toEqual(["new", "old"])
  })

  it("suggests remembered ids that still exist, then item recency", () => {
    expect(
      suggestedInboxListIds(["gone", "work"], ["home", "work"], ["work", "home", "errands"], 6),
    ).toEqual(["work", "home"])
  })
})
