/**
 * lib/kitchen-barcode.ts — One barcode, one Open Food Facts product
 *
 * A code already saved on this device resolves without the network. Otherwise
 * the product API (v2) is asked only for the name and the per-100g nutrients.
 * Status 0 and a quiet network are a miss. Nothing here uploads a photo.
 */

import { offProductToHit, type FoodHit } from "@/lib/kitchen-search"
import { useKitchenStore } from "@/lib/kitchen-store"
import type { KitchenFood } from "@/lib/kitchen-types"
import { persistKey } from "@/lib/storage-keys"

const USER_AGENT = "Brain2/0.1 (personal food log)"
const OFF_FIELDS = "code,product_name,nutriments"

export type BarcodeLookup = { found: true; hit: FoodHit } | { found: false; code: string }

interface OffProductBody {
  status?: number
  product?: {
    code?: string
    product_name?: string
    nutriments?: Record<string, number>
  }
}

function mapKey(): string {
  return persistKey("kitchen-barcodes")
}

/** Digits only. Leading zeros stay, so a UPC does not collapse. */
export function normalizeBarcode(raw: string): string {
  return raw.replace(/\D/g, "")
}

export function readBarcodeMap(): Record<string, string> {
  if (typeof localStorage === "undefined") return {}
  try {
    const parsed = JSON.parse(localStorage.getItem(mapKey()) || "") as unknown
    if (!parsed || typeof parsed !== "object") return {}
    const out: Record<string, string> = {}
    for (const [code, id] of Object.entries(parsed)) {
      const digits = normalizeBarcode(code)
      if (digits && typeof id === "string" && id) out[digits] = id
    }
    return out
  } catch {
    return {}
  }
}

function foodBarcode(food: KitchenFood): string {
  const code = (food as { barcode?: string }).barcode
  return typeof code === "string" ? normalizeBarcode(code) : ""
}

/** The local map is always written. The food record keeps the same code. */
export function rememberBarcode(code: string, foodId: string): void {
  const digits = normalizeBarcode(code)
  if (!digits || !foodId || typeof localStorage === "undefined") return
  const map = readBarcodeMap()
  map[digits] = foodId
  localStorage.setItem(mapKey(), JSON.stringify(map))
  const food = useKitchenStore.getState().foods.find((row) => row.id === foodId)
  if (!food) return
  useKitchenStore.getState().saveFood({ ...food, id: food.id, barcode: digits })
}

export function cachedBarcodeHit(raw: string, foods: readonly KitchenFood[]): FoodHit | null {
  const code = normalizeBarcode(raw)
  if (!code) return null
  const mapped = readBarcodeMap()[code]
  const food = foods.find((row) => row.id === mapped) ?? foods.find((row) => foodBarcode(row) === code)
  if (!food) return null
  return {
    id: food.id,
    name: food.name,
    per100g: food.per100g,
    gramsPerUnit: food.gramsPerUnit,
    source: food.source,
  }
}

/** Network lookup. A miss is `{ found: false }`, never a throw. */
export async function lookupBarcode(raw: string): Promise<BarcodeLookup> {
  const code = normalizeBarcode(raw)
  if (!code) return { found: false, code: "" }
  const url = new URL(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json`)
  url.searchParams.set("fields", OFF_FIELDS)
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": USER_AGENT,
      },
    })
    if (!response.ok) return { found: false, code }
    const body = (await response.json()) as OffProductBody
    if (body.status === 0 || !body.product) return { found: false, code }
    const hit = offProductToHit({
      code: body.product.code || code,
      product_name: body.product.product_name,
      nutriments: body.product.nutriments,
    })
    if (!hit) return { found: false, code }
    return { found: true, hit }
  } catch {
    return { found: false, code }
  }
}

/** Device memory first, then Open Food Facts. */
export async function resolveBarcode(raw: string, foods: readonly KitchenFood[]): Promise<BarcodeLookup> {
  const code = normalizeBarcode(raw)
  if (!code) return { found: false, code: "" }
  const cached = cachedBarcodeHit(code, foods)
  if (cached) return { found: true, hit: cached }
  return lookupBarcode(code)
}
