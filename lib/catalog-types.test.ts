import { describe, it, expect } from "vitest"
import {
  FURNITURE_TYPE_ID,
  RESOURCE_TYPE_ID,
  SHOPPING_TYPE_ID,
  getFurnitureTypeDefinition,
  getResourceTypeDefinition,
  getShoppingTypeDefinition,
  withCatalogTypes,
} from "@/lib/catalog-types"

describe("catalog starter types", () => {
  it("furniture is details-only with a photo hero", () => {
    const def = getFurnitureTypeDefinition()
    expect(def.id).toBe(FURNITURE_TYPE_ID)
    expect(def.kind).toBe("catalog")
    expect(def.detailPanels).toEqual(["details"])
    expect(def.detailLayout?.heroImageAttrId).toBe("photo")
    expect(def.capabilities?.scheduleable).toBeFalsy()
  })

  it("resource includes a body panel", () => {
    const def = getResourceTypeDefinition()
    expect(def.id).toBe(RESOURCE_TYPE_ID)
    expect(def.detailPanels).toContain("body")
  })

  it("shopping item has quantity and purchased", () => {
    const def = getShoppingTypeDefinition()
    expect(def.id).toBe(SHOPPING_TYPE_ID)
    expect(def.attributes?.some((a) => a.id === "purchased")).toBe(true)
    expect(def.capabilities?.completable).toBe(true)
  })

  it("withCatalogTypes is idempotent", () => {
    const once = withCatalogTypes([])
    const twice = withCatalogTypes(once)
    expect(twice).toHaveLength(once.length)
  })
})
