import { describe, expect, it } from "vitest"
import { CREATABLE_ATTRIBUTE_TYPES } from "./attribute-type-catalog"
import {
  ATTRIBUTE_DEMO_SCHEMA,
  attributeDemoItem,
  demoPdf,
  storeAttributeDemoAssets,
} from "./attribute-demo"

describe("attribute demo", () => {
  it("covers every attribute type the creator offers", () => {
    const types = new Set(ATTRIBUTE_DEMO_SCHEMA.map((d) => d.type))
    for (const type of CREATABLE_ATTRIBUTE_TYPES) expect(types).toContain(type)
    const modes = ATTRIBUTE_DEMO_SCHEMA.filter((d) => d.type === "datetime").map((d) => d.datetimeMode)
    expect(modes.sort()).toEqual(["date", "datetime", "time"])
  })

  it("fills a value for every stored attribute, with notes and resources", async () => {
    const put = async (id: string) => `idb:${id}`
    const assets = await storeAttributeDemoAssets(put, new Date(2026, 9, 13))
    const item = attributeDemoItem(assets, { relatedItemId: "book-1", shelfListId: "reading" })
    for (const def of ATTRIBUTE_DEMO_SCHEMA) {
      if (def.type === "formula") continue
      expect(item.attributes?.[def.id], def.id).toBeDefined()
    }
    expect(item.itemAttributeDefinitions?.length).toBe(1)
    expect(item.noteLog?.length).toBe(3)
    expect(item.resources?.map((r) => r.name)).toContain("library-receipt.pdf")
  })

  it("generates a PDF a viewer can read", async () => {
    const text = await demoPdf(["Hello"]).text()
    expect(text.startsWith("%PDF-1.4")).toBe(true)
    expect(text).toContain("(Hello) Tj")
    expect(text.trim().endsWith("%%EOF")).toBe(true)
  })
})
