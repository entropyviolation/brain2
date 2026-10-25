import { beforeEach, describe, expect, it, vi } from "vitest"
import { syncInstagramListsFromReport } from "@/lib/instagram-lists-sync"
import { findInstagramAnalysisList } from "@/lib/instagram-lists"
import type { InstagramSource } from "@/lib/instagram-report"
import { useTaskStore } from "@/lib/task-store"
import { resetAllStores } from "@/tests/test-utils"

const summary = {
  generated: "2026-10-23",
  lists: { followers: ["fan1", "both"], following: ["both", "nofb1"], nofb: ["nofb1"], fans: ["fan1"], mutuals: ["both"] },
  people: { fan1: { fr: 1700000000 }, both: { fo: 1700000000, fr: 1700000000 }, nofb1: { fo: 1700000000, lk: 2 } },
}

function source(buildId: string): InstagramSource {
  return {
    kind: "dev",
    canIngest: false,
    status: vi.fn(),
    saveUi: vi.fn(),
    summary: async () => ({ buildId, text: JSON.stringify(summary) }),
  } as unknown as InstagramSource
}

describe("syncInstagramListsFromReport", () => {
  beforeEach(() => {
    resetAllStores()
    window.localStorage.clear()
  })

  it("fills the lists, then skips the same build unless forced", async () => {
    const first = await syncInstagramListsFromReport({ source: source("b1") })
    expect(first.status).toBe("applied")
    const lists = useTaskStore.getState().lists
    const fans = findInstagramAnalysisList(lists, "fans")!
    const nofb = findInstagramAnalysisList(lists, "nofb")!
    const onList = (id: string) => useTaskStore.getState().tasks.filter((t) => t.lists?.includes(id)).length
    expect(onList(fans.id)).toBe(1)
    expect(onList(nofb.id)).toBe(1)

    expect((await syncInstagramListsFromReport({ source: source("b1") })).status).toBe("skipped")
    expect((await syncInstagramListsFromReport({ source: source("b1"), force: true })).status).toBe("applied")
    expect((await syncInstagramListsFromReport({ source: source("b2") })).status).toBe("applied")
  })

  it("reports no source", async () => {
    expect((await syncInstagramListsFromReport({ source: null })).status).toBe("none")
  })
})
