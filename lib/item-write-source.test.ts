import { afterEach, describe, expect, it, vi } from "vitest"
import {
  formatItemWriteClause,
  registerItemWriteSurface,
  resetItemWriteUnknownWarnings,
  resolveItemWriteAttribution,
  setItemWriteClientForTests,
  withItemWriteSource,
} from "@/lib/item-write-source"

describe("item write source", () => {
  afterEach(() => {
    setItemWriteClientForTests(null)
  })

  it("prints the house clauses, including iOS", () => {
    expect(formatItemWriteClause({ attribution: { surface: "quick-add", client: "electron" } }, { create: true })).toBe(
      "source quick add, electron",
    )
    expect(
      formatItemWriteClause({ attribution: { surface: "list", name: "Groceries", client: "electron" } }, { create: true }),
    ).toBe("source from Groceries, electron")
    expect(
      formatItemWriteClause(
        { attribution: { surface: "quick-add", name: "Groceries", client: "electron" } },
        { create: true },
      ),
    ).toBe("source quick add, from Groceries, electron")
    expect(formatItemWriteClause({ attribution: { surface: "item-detail", client: "ios" } })).toBe("source item detail, iOS")
    expect(formatItemWriteClause({ attribution: { surface: "rule", name: "Mark owned" } })).toBe(
      "source autoapplied rule Mark owned",
    )
    expect(formatItemWriteClause({ attribution: { surface: "membership-rule", name: "Errands" } })).toBe(
      "source autoapplied rule Errands",
    )
    expect(formatItemWriteClause({ attribution: { surface: "workflow", name: "File it" } })).toBe("source workflow, File it")
    expect(formatItemWriteClause({ attribution: { surface: "unknown", client: "electron" } })).toBe("source unknown")
    expect(formatItemWriteClause({})).toBe("source recorded before sources")
    expect(formatItemWriteClause({ source: "item-detail" })).toBe("source item-detail")
  })

  it("prints a registered label, and an unregistered id as itself", () => {
    registerItemWriteSurface({ id: "night-agent", label: "night agent" })
    expect(formatItemWriteClause({ attribution: { surface: "night-agent" } })).toBe("source night agent")
    expect(formatItemWriteClause({ attribution: { surface: "not-registered" } })).toBe("source not-registered")
  })

  it("lets a nested frame override, and an explicit argument override the frame", () => {
    setItemWriteClientForTests(() => undefined)
    withItemWriteSource({ surface: "item-detail" }, () => {
      expect(resolveItemWriteAttribution().surface).toBe("item-detail")
      withItemWriteSource({ surface: "rule", name: "Owned" }, () => {
        expect(resolveItemWriteAttribution()).toEqual({ surface: "rule", name: "Owned" })
      })
      expect(resolveItemWriteAttribution({ surface: "quick-add" })).toEqual({ surface: "quick-add" })
      expect(resolveItemWriteAttribution().surface).toBe("item-detail")
    })
  })

  it("keeps an async frame until the promise settles", async () => {
    setItemWriteClientForTests(() => undefined)
    let seen = ""
    await withItemWriteSource({ surface: "bim" }, async () => {
      await Promise.resolve()
      seen = resolveItemWriteAttribution().surface
    })
    expect(seen).toBe("bim")
    expect(resolveItemWriteAttribution().surface).toBe("unknown")
  })

  it("stamps the shell when client is omitted, and keeps an explicit client", () => {
    setItemWriteClientForTests(() => "electron")
    expect(resolveItemWriteAttribution({ surface: "list", name: "Groceries" })).toEqual({
      surface: "list",
      name: "Groceries",
      client: "electron",
    })
    expect(resolveItemWriteAttribution({ surface: "item-detail", client: "ios" }).client).toBe("ios")
    setItemWriteClientForTests(() => undefined)
    expect(resolveItemWriteAttribution({ surface: "bim" })).toEqual({ surface: "bim" })
  })

  it("warns once per stack for an unknown write outside production", () => {
    setItemWriteClientForTests(() => undefined)
    resetItemWriteUnknownWarnings()
    const err = vi.spyOn(console, "error").mockImplementation(() => {})
    const write = () => resolveItemWriteAttribution()
    for (let i = 0; i < 2; i++) write()
    expect(err).toHaveBeenCalledTimes(1)
    expect(String(err.mock.calls[0][0])).toContain("source unknown")
    err.mockRestore()
  })
})
