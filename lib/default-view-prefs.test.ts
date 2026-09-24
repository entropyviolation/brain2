import { describe, expect, it } from "vitest"
import type { List, Task } from "@/lib/types"
import {
  BUILTIN_DEFAULT_VIEW_SHOW,
  buildDefaultViewAttrCatalog,
  descriptionSnippet,
  filterDefaultViewAttrCatalog,
  formatEstimateMinutes,
  patchDefaultView,
  resolveDefaultViewDensity,
  resolveDefaultViewExtraAttributeIds,
  resolveDefaultViewShow,
  sanitizeListDefaultView,
  setDefaultViewLayoutMode,
  toggleDefaultViewChrome,
  toggleDefaultViewExtraAttribute,
} from "./default-view-prefs"

const list = (extra: Partial<List> = {}): List => ({
  id: "books",
  name: "Books",
  color: "#3B82F6",
  createdAt: new Date("2026-01-01"),
  ...extra,
})

describe("sanitizeListDefaultView", () => {
  it("treats unset and junk as no prefs", () => {
    expect(sanitizeListDefaultView(undefined)).toBeUndefined()
    expect(sanitizeListDefaultView(null)).toBeUndefined()
    expect(sanitizeListDefaultView("custom")).toBeUndefined()
    expect(sanitizeListDefaultView({})).toBeUndefined()
  })

  it("keeps a custom object and drops unknown chrome keys", () => {
    expect(
      sanitizeListDefaultView({
        custom: true,
        show: { type: false, date: false, bogus: true },
        extraAttributeIds: ["author", "", "author"],
        density: "compact",
      }),
    ).toEqual({
      custom: true,
      show: { type: false, date: false },
      extraAttributeIds: ["author"],
      density: "compact",
    })
  })
})

describe("resolveDefaultViewShow", () => {
  it("unset matches the current Default chrome", () => {
    expect(resolveDefaultViewShow(undefined)).toEqual(BUILTIN_DEFAULT_VIEW_SHOW)
    expect(resolveDefaultViewShow({ custom: false, show: { type: false } })).toEqual(BUILTIN_DEFAULT_VIEW_SHOW)
    expect(BUILTIN_DEFAULT_VIEW_SHOW).toMatchObject({
      pip: true,
      orb: true,
      type: true,
      priority: true,
      date: true,
      tags: false,
      listNames: false,
      estimate: false,
      description: false,
      attributeChips: true,
    })
  })

  it("custom hide type/date actually hides those bits", () => {
    const show = resolveDefaultViewShow({ custom: true, show: { type: false, date: false } })
    expect(show.type).toBe(false)
    expect(show.date).toBe(false)
    expect(show.pip).toBe(true)
    expect(show.orb).toBe(true)
  })
})

describe("resolveDefaultViewDensity / extras", () => {
  it("ignores compact and extra attributes until custom is on", () => {
    expect(resolveDefaultViewDensity({ density: "compact" })).toBe("comfortable")
    expect(resolveDefaultViewExtraAttributeIds({ extraAttributeIds: ["author"] })).toEqual([])
    expect(resolveDefaultViewDensity({ custom: true, density: "compact" })).toBe("compact")
    expect(resolveDefaultViewExtraAttributeIds({ custom: true, extraAttributeIds: ["author"] })).toEqual(["author"])
  })
})

describe("setDefaultViewLayoutMode", () => {
  it("Use default layout clears custom without inventing prefs", () => {
    expect(setDefaultViewLayoutMode(undefined, false)).toBeUndefined()
  })

  it("custom starts from the built-in chrome so the row does not jump", () => {
    expect(setDefaultViewLayoutMode(undefined, true)?.show).toEqual(BUILTIN_DEFAULT_VIEW_SHOW)
  })

  it("switching back to default keeps extra picks for later", () => {
    const custom = toggleDefaultViewExtraAttribute(undefined, "author", true)
    expect(custom?.custom).toBe(true)
    const back = setDefaultViewLayoutMode(custom, false)
    expect(back?.custom).toBeUndefined()
    expect(back?.extraAttributeIds).toEqual(["author"])
    expect(resolveDefaultViewExtraAttributeIds(back)).toEqual([])
  })
})

describe("patchDefaultView", () => {
  it("toggle chrome and extras stay on List.defaultView", () => {
    const hidden = toggleDefaultViewChrome(undefined, "type", false)
    expect(hidden).toMatchObject({ custom: true, show: { type: false } })
    const withAuthor = toggleDefaultViewExtraAttribute(hidden, "author", true)
    expect(withAuthor?.extraAttributeIds).toEqual(["author"])
    expect(patchDefaultView(withAuthor, { density: "compact" })?.density).toBe("compact")
  })
})

describe("formatEstimateMinutes / descriptionSnippet", () => {
  it("formats minutes the way a reading row can show them", () => {
    expect(formatEstimateMinutes(undefined)).toBe("")
    expect(formatEstimateMinutes(25)).toBe("25m")
    expect(formatEstimateMinutes(60)).toBe("1h")
    expect(formatEstimateMinutes(90)).toBe("1h 30m")
  })

  it("uses a true description, never the title again", () => {
    expect(descriptionSnippet({ description: "Dune", taskDescription: "Read the appendices" })).toBe(
      "Read the appendices",
    )
    expect(descriptionSnippet({ description: "Dune" })).toBe("")
    expect(
      descriptionSnippet({
        description: "Dune",
        notes: "A very long note that should be clipped so the reading row stays a row not a paragraph of text.",
      }),
    ).toMatch(/…$/)
  })
})

describe("buildDefaultViewAttrCatalog", () => {
  it("puts this-list attributes first and still offers vault attrs", () => {
    const books = list({ itemAttributes: [{ id: "author", name: "Author", type: "string" }] })
    const films = list({
      id: "films",
      name: "Films",
      itemAttributes: [{ id: "year", name: "Year", type: "number" }],
    })
    const items: Task[] = [
      {
        id: "b1",
        description: "Dune",
        lists: ["books"],
        stage: "list",
        completed: false,
        createdAt: new Date(),
        attributes: { author: "Herbert" },
      },
    ]
    const catalog = buildDefaultViewAttrCatalog({
      list: books,
      types: [],
      listItems: items,
      vaultLists: [books, films],
    })
    const author = catalog.findIndex((c) => c.id === "author")
    const year = catalog.findIndex((c) => c.id === "year")
    expect(author).toBeGreaterThan(-1)
    expect(year).toBeGreaterThan(-1)
    expect(author).toBeLessThan(year)
    expect(filterDefaultViewAttrCatalog(catalog, { onThisListOnly: true }).map((c) => c.id)).toEqual(["author"])
    expect(filterDefaultViewAttrCatalog(catalog, { query: "year" }).map((c) => c.id)).toEqual(["year"])
  })
})
