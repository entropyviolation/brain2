import { beforeEach, describe, expect, it, vi } from "vitest"
import { cachedBarcodeHit, lookupBarcode, rememberBarcode, resolveBarcode } from "@/lib/kitchen-barcode"
import { nutrientsFrom } from "@/lib/kitchen-nutrients"
import { useKitchenStore } from "@/lib/kitchen-store"

function resetKitchen() {
  localStorage.clear()
  useKitchenStore.setState({ foods: [], recipes: [], stock: [], plates: [] })
}

describe("kitchen barcode lookup", () => {
  beforeEach(() => {
    resetKitchen()
    vi.unstubAllGlobals()
  })

  it("maps an Open Food Facts product", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        status: 1,
        product: {
          code: "3017620422003",
          product_name: "Nutella",
          nutriments: { "energy-kcal_100g": 539, proteins_100g: 6.3, fat_100g: 30.9 },
        },
      }),
    }))
    vi.stubGlobal("fetch", fetchMock)
    const result = await lookupBarcode("3017620422003")
    expect(result.found).toBe(true)
    if (!result.found) return
    expect(result.hit.name).toBe("Nutella")
    expect(result.hit.source).toBe("off")
    expect(result.hit.id).toBe("off_3017620422003")
    expect(result.hit.per100g.kcal).toBe(539)
    const url = String(fetchMock.mock.calls[0][0])
    expect(url).toContain("/api/v2/product/3017620422003")
    expect(url).toContain("fields=code%2Cproduct_name%2Cnutriments")
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(new Headers(init.headers).get("User-Agent")).toMatch(/Brain2/)
  })

  it("returns a miss when the product status is 0", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ status: 0, status_verbose: "product not found" }),
    }))
    vi.stubGlobal("fetch", fetchMock)
    await expect(lookupBarcode("0000000000000")).resolves.toEqual({ found: false, code: "0000000000000" })
  })

  it("returns a miss when the network fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("offline")
    }))
    await expect(lookupBarcode("12345670")).resolves.toEqual({ found: false, code: "12345670" })
  })

  it("resolves a remembered code without a second request", async () => {
    const food = useKitchenStore.getState().saveFood({
      name: "Oats",
      per100g: nutrientsFrom({ kcal: 380, proteinG: 13 }),
      gramsPerUnit: 40,
      source: "label",
    })
    rememberBarcode("012345678905", food.id)
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    const hit = cachedBarcodeHit("012345678905", useKitchenStore.getState().foods)
    expect(hit?.id).toBe(food.id)
    expect(hit?.name).toBe("Oats")
    const resolved = await resolveBarcode("012345678905", useKitchenStore.getState().foods)
    expect(resolved.found).toBe(true)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
