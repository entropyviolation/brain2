/**
 * lib/kitchen-search.ts — Food search on this device, then a public food API
 *
 * Local catalog and foods you saved come first. A retired food stays out of
 * this list. USDA FoodData Central is next
 * (`DEMO_KEY`, or `NEXT_PUBLIC_USDA_FDC_API_KEY` when you have a key). If that
 * call fails or comes back empty, Open Food Facts is the next try. A brand
 * stays on the first name. A miss tries a shorter food name before giving up.
 * "Glazed" alone is not the food glaze. Both networks map onto the same
 * per-100g record.
 */

import { searchCatalog } from "@/lib/kitchen-catalog"
import { cleanNutrient, hasNutrients, nutrientsFrom, type NutrientKey, type Nutrients } from "@/lib/kitchen-nutrients"
import type { FoodSource, KitchenFood } from "@/lib/kitchen-types"

export interface FoodHit {
  id: string
  name: string
  per100g: Nutrients
  gramsPerUnit: number
  source: FoodSource
  /** Keys the source actually printed. Missing keys are not in this list. */
  present?: NutrientKey[]
}

const USDA_IDS: Record<number, NutrientKey> = {
  1008: "kcal",
  2047: "kcal",
  2048: "kcal",
  208: "kcal",
  1003: "proteinG",
  203: "proteinG",
  1005: "carbG",
  205: "carbG",
  1004: "fatG",
  204: "fatG",
  1079: "fiberG",
  291: "fiberG",
  2000: "sugarG",
  269: "sugarG",
  1093: "sodiumMg",
  307: "sodiumMg",
  1092: "potassiumMg",
  306: "potassiumMg",
  1087: "calciumMg",
  301: "calciumMg",
  1089: "ironMg",
  303: "ironMg",
  1162: "vitCMg",
  401: "vitCMg",
  1114: "vitDMcg",
  324: "vitDMcg",
  328: "vitDMcg",
  1258: "satFatG",
  606: "satFatG",
  1292: "monoFatG",
  645: "monoFatG",
  1293: "polyFatG",
  646: "polyFatG",
  1257: "transFatG",
  605: "transFatG",
  1253: "cholesterolMg",
  601: "cholesterolMg",
  1009: "starchG",
  209: "starchG",
  1235: "addedSugarG",
  539: "addedSugarG",
  1106: "vitAMcg",
  320: "vitAMcg",
  1109: "vitEMg",
  323: "vitEMg",
  1185: "vitKMcg",
  430: "vitKMcg",
  1165: "thiaminMg",
  404: "thiaminMg",
  1166: "riboflavinMg",
  405: "riboflavinMg",
  1167: "niacinMg",
  406: "niacinMg",
  1170: "pantothenicMg",
  410: "pantothenicMg",
  1175: "vitB6Mg",
  415: "vitB6Mg",
  1177: "folateMcg",
  1190: "folateMcg",
  417: "folateMcg",
  1178: "vitB12Mcg",
  418: "vitB12Mcg",
  1180: "cholineMg",
  421: "cholineMg",
  1090: "magnesiumMg",
  304: "magnesiumMg",
  1091: "phosphorusMg",
  305: "phosphorusMg",
  1095: "zincMg",
  309: "zincMg",
  1103: "seleniumMcg",
  317: "seleniumMcg",
  1098: "copperMg",
  312: "copperMg",
  1101: "manganeseMg",
  315: "manganeseMg",
  1107: "betaCaroteneMcg",
  321: "betaCaroteneMcg",
  1123: "luteinMcg",
  338: "luteinMcg",
  1221: "histidineG",
  512: "histidineG",
  1212: "isoleucineG",
  503: "isoleucineG",
  1213: "leucineG",
  504: "leucineG",
  1214: "lysineG",
  505: "lysineG",
  1215: "methionineG",
  506: "methionineG",
  1217: "phenylalanineG",
  508: "phenylalanineG",
  1210: "threonineG",
  502: "threonineG",
  1211: "tryptophanG",
  501: "tryptophanG",
  1219: "valineG",
  510: "valineG",
  1222: "alanineG",
  513: "alanineG",
  1220: "arginineG",
  511: "arginineG",
  1223: "asparticG",
  514: "asparticG",
  1216: "cystineG",
  507: "cystineG",
  1224: "glutamicG",
  515: "glutamicG",
  1225: "glycineG",
  516: "glycineG",
  1226: "prolineG",
  517: "prolineG",
  1228: "serineG",
  519: "serineG",
  1218: "tyrosineG",
  509: "tyrosineG",
}

interface UsdaNutrient {
  nutrientId?: number
  nutrientNumber?: string | number
  nutrientName?: string
  unitName?: string
  value?: number
  amount?: number
  nutrient?: { id?: number; number?: string | number; name?: string; unitName?: string }
}

interface UsdaFood {
  fdcId?: number
  description?: string
  dataType?: string
  servingSize?: number
  servingSizeUnit?: string
  foodNutrients?: UsdaNutrient[]
}

export function usdaApiKey(): string {
  const fromEnv = typeof process !== "undefined" ? process.env.NEXT_PUBLIC_USDA_FDC_API_KEY : ""
  return (fromEnv || "DEMO_KEY").trim() || "DEMO_KEY"
}

function applyUnit(key: NutrientKey, value: number, unitName: string): number {
  const unit = unitName.toUpperCase().replace("µG", "MCG")
  if (key === "kcal") {
    if (unit === "KJ") return value / 4.184
    return value
  }
  if (key.endsWith("Mcg")) {
    if (unit === "MG") return value * 1000
    if (unit === "G") return value * 1_000_000
    if (unit === "IU" && key === "vitDMcg") return value * 0.025
    if (unit === "IU" && key === "vitAMcg") return value * 0.3
    return value
  }
  if (key.endsWith("Mg")) {
    if (unit === "UG" || unit === "MCG") return value / 1000
    if (unit === "G") return value * 1000
    return value
  }
  if (key.endsWith("G")) {
    if (unit === "MG") return value / 1000
    if (unit === "UG" || unit === "MCG") return value / 1_000_000
    return value
  }
  return value
}

function omegaBucket(name: string): "omega3G" | "omega6G" | null {
  const n = name.toLowerCase()
  if (/n-6|omega-6/.test(n)) return "omega6G"
  if (/n-3|omega-3|\bepa\b|\bdha\b/.test(n)) return "omega3G"
  return null
}

export function usdaFoodToHit(food: UsdaFood): FoodHit | null {
  const id = food.fdcId
  const name = food.description?.trim()
  if (!id || !name) return null
  const unit = (food.servingSizeUnit || "").toLowerCase()
  const size = Number(food.servingSize)
  const branded = food.dataType === "Branded"
  const scale = branded && size > 0 && (unit === "g" || unit === "ml") ? 100 / size : 1
  const partial: Partial<Nutrients> = {}
  const present: NutrientKey[] = []
  let omega3Lock = false
  let omega6Lock = false
  for (const nutrient of food.foodNutrients ?? []) {
    const number = Number(nutrient.nutrientId ?? nutrient.nutrientNumber ?? nutrient.nutrient?.id ?? nutrient.nutrient?.number)
    const nutrientName = nutrient.nutrientName || nutrient.nutrient?.name || ""
    const unitName = nutrient.unitName || nutrient.nutrient?.unitName || ""
    const raw = Number(nutrient.value ?? nutrient.amount)
    if (!Number.isFinite(raw) || raw < 0) continue
    const namedOmega = /total omega-3/i.test(nutrientName) ? "omega3G" : /total omega-6/i.test(nutrientName) ? "omega6G" : null
    const bucket = namedOmega || omegaBucket(nutrientName)
    if (bucket === "omega3G" && !omega3Lock) {
      const next = cleanNutrient((partial.omega3G ?? 0) + applyUnit("omega3G", raw, unitName) * scale)
      partial.omega3G = next
      if (!present.includes("omega3G")) present.push("omega3G")
      if (namedOmega) omega3Lock = true
      continue
    }
    if (bucket === "omega6G" && !omega6Lock) {
      const next = cleanNutrient((partial.omega6G ?? 0) + applyUnit("omega6G", raw, unitName) * scale)
      partial.omega6G = next
      if (!present.includes("omega6G")) present.push("omega6G")
      if (namedOmega) omega6Lock = true
      continue
    }
    const key = USDA_IDS[number]
    if (!key || partial[key] != null) continue
    partial[key] = cleanNutrient(applyUnit(key, raw, unitName) * scale)
    present.push(key)
  }
  const per100g = nutrientsFrom(partial)
  if (!hasNutrients(per100g)) return null
  const gramsPerUnit = branded && size > 0 && (unit === "g" || unit === "ml") ? size : 100
  return { id: `usda_${id}`, name, per100g, gramsPerUnit, source: "usda", present }
}

function offMg(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  if (value < 5) return value * 1000
  return value
}

function offVitD(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  if (value < 0.0002) return value * 1_000_000
  if (value < 0.05) return value * 1000
  return value
}

export function offProductToHit(product: {
  code?: string
  product_name?: string
  nutriments?: Record<string, number>
}): FoodHit | null {
  const name = product.product_name?.trim()
  const code = product.code?.trim()
  const n = product.nutriments
  if (!name || !code || !n) return null
  const per100g = nutrientsFrom({
    kcal: n["energy-kcal_100g"],
    proteinG: n.proteins_100g,
    carbG: n.carbohydrates_100g,
    fatG: n.fat_100g,
    fiberG: n.fiber_100g,
    sugarG: n.sugars_100g,
    sodiumMg: offMg(Number(n.sodium_100g)),
    potassiumMg: offMg(Number(n.potassium_100g)),
    calciumMg: offMg(Number(n.calcium_100g)),
    ironMg: offMg(Number(n.iron_100g)),
    vitCMg: offMg(Number(n["vitamin-c_100g"])),
    vitDMcg: offVitD(Number(n["vitamin-d_100g"])),
    satFatG: n["saturated-fat_100g"],
    monoFatG: n["monounsaturated-fat_100g"],
    polyFatG: n["polyunsaturated-fat_100g"],
    omega3G: n["omega-3-fat_100g"],
    omega6G: n["omega-6-fat_100g"],
    transFatG: n["trans-fat_100g"],
    cholesterolMg: offMg(Number(n.cholesterol_100g)),
    starchG: n.starch_100g,
    addedSugarG: n["added-sugars_100g"],
    sugarAlcoholG: n.polyols_100g,
    vitAMcg: offVitD(Number(n["vitamin-a_100g"])),
    vitEMg: offMg(Number(n["vitamin-e_100g"])),
    vitKMcg: offVitD(Number(n["vitamin-k_100g"])),
    thiaminMg: offMg(Number(n["vitamin-b1_100g"])),
    riboflavinMg: offMg(Number(n["vitamin-b2_100g"])),
    niacinMg: offMg(Number(n["vitamin-pp_100g"])),
    pantothenicMg: offMg(Number(n["pantothenic-acid_100g"])),
    vitB6Mg: offMg(Number(n["vitamin-b6_100g"])),
    folateMcg: offVitD(Number(n["vitamin-b9_100g"])),
    vitB12Mcg: offVitD(Number(n["vitamin-b12_100g"])),
    cholineMg: offMg(Number(n.choline_100g)),
    magnesiumMg: offMg(Number(n.magnesium_100g)),
    phosphorusMg: offMg(Number(n.phosphorus_100g)),
    zincMg: offMg(Number(n.zinc_100g)),
    seleniumMcg: offVitD(Number(n.selenium_100g)),
    copperMg: offMg(Number(n.copper_100g)),
    manganeseMg: offMg(Number(n.manganese_100g)),
    betaCaroteneMcg: offVitD(Number(n["beta-carotene_100g"])),
    luteinMcg: offVitD(Number(n["lutein-zeaxanthin_100g"])),
    histidineG: n.histidine_100g,
    isoleucineG: n.isoleucine_100g,
    leucineG: n.leucine_100g,
    lysineG: n.lysine_100g,
    methionineG: n.methionine_100g,
    phenylalanineG: n.phenylalanine_100g,
    threonineG: n.threonine_100g,
    tryptophanG: n.tryptophan_100g,
    valineG: n.valine_100g,
    alanineG: n.alanine_100g,
    arginineG: n.arginine_100g,
    asparticG: n["aspartic-acid_100g"],
    cystineG: n.cystine_100g,
    glutamicG: n["glutamic-acid_100g"],
    glycineG: n.glycine_100g,
    prolineG: n.proline_100g,
    serineG: n.serine_100g,
    tyrosineG: n.tyrosine_100g,
  })
  if (!hasNutrients(per100g)) return null
  return { id: `off_${code}`, name, per100g, gramsPerUnit: 100, source: "off" }
}

async function searchUsda(query: string): Promise<FoodHit[]> {
  const url = new URL("https://api.nal.usda.gov/fdc/v1/foods/search")
  url.searchParams.set("query", query)
  url.searchParams.set("pageSize", "8")
  url.searchParams.set("api_key", usdaApiKey())
  url.searchParams.set("dataType", "Foundation,SR Legacy,Branded")
  const response = await fetch(url)
  if (!response.ok) throw new Error(String(response.status))
  const body = (await response.json()) as { foods?: UsdaFood[] }
  const hits: FoodHit[] = []
  for (const food of body.foods ?? []) {
    const hit = usdaFoodToHit(food)
    if (hit) hits.push(hit)
  }
  return hits
}

async function searchOff(query: string): Promise<FoodHit[]> {
  const url = new URL("https://world.openfoodfacts.org/cgi/search.pl")
  url.searchParams.set("search_terms", query)
  url.searchParams.set("search_simple", "1")
  url.searchParams.set("action", "process")
  url.searchParams.set("json", "1")
  url.searchParams.set("page_size", "6")
  url.searchParams.set("fields", "code,product_name,nutriments")
  const response = await fetch(url)
  if (!response.ok) throw new Error(String(response.status))
  const body = (await response.json()) as { products?: { code?: string; product_name?: string; nutriments?: Record<string, number> }[] }
  const hits: FoodHit[] = []
  for (const product of body.products ?? []) {
    const hit = offProductToHit(product)
    if (hit) hits.push(hit)
  }
  return hits
}

const SPELLING: Record<string, string> = {
  mozzerella: "mozzarella",
  mozerella: "mozzarella",
  mozzarela: "mozzarella",
}

const BRAND_NAME: Record<string, string[]> = {
  kewpie: ["kewpie mayonnaise", "mayonnaise"],
  glaze: ["sugar glaze"],
}

function pushName(out: string[], name: string): void {
  const next = name.trim().replace(/\s+/g, " ")
  if (next.length < 2) return
  if (out.some((item) => item.toLowerCase() === next.toLowerCase())) return
  out.push(next)
}

/** The typed food, then the same words with a trailing parenthesis removed. */
export function localFoodNames(query: string): string[] {
  const q = query.trim().replace(/\s+/g, " ")
  const out: string[] = []
  pushName(out, q)
  const bare = q.replace(/\s*\([^)]*\)\s*$/, "").replace(/[,\s]+$/, "").trim()
  pushName(out, bare)
  return out
}

/**
 * Names for a network search. The typed words stay first, brand included.
 * A shorter food name and a corrected spelling are tried only after that.
 */
export function foodSearchNames(query: string): string[] {
  const out = localFoodNames(query)
  const key = (out[0] ?? "").toLowerCase()
  for (const extra of BRAND_NAME[key] ?? []) pushName(out, extra)
  const spell = SPELLING[key]
  if (spell) pushName(out, spell)
  const bare = (out.find((name) => !name.includes("(")) ?? key).split(/\s+/).filter(Boolean)
  if (bare.length >= 3) pushName(out, `${bare[0]} ${bare[bare.length - 1]}`)
  return out
}

/** A glazed ham is a verb. A sugar glaze is the food. */
export function keepFoodHits(query: string, hits: FoodHit[]): FoodHit[] {
  const q = query.trim().toLowerCase()
  if (q !== "glaze" && q !== "sugar glaze") return hits
  return hits.filter((hit) => {
    const name = hit.name.toLowerCase()
    if (/\bglaze\b/.test(name)) return true
    return !/\bglazed\b|\bglazing\b/.test(name)
  })
}

export function searchLocalFoods(query: string, custom: readonly KitchenFood[]): FoodHit[] {
  const names = localFoodNames(query)
  if (!names.length) return []
  const hits: FoodHit[] = []
  const seen = new Set<string>()
  const push = (food: { id: string; name: string; per100g: FoodHit["per100g"]; gramsPerUnit: number; source: FoodHit["source"] }) => {
    const key = food.name.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    hits.push(food)
  }
  for (const name of names) {
    const q = name.toLowerCase()
    for (const food of custom) {
      if (food.retired || !food.name.toLowerCase().includes(q)) continue
      push({
        id: food.id,
        name: food.name,
        per100g: food.per100g,
        gramsPerUnit: food.gramsPerUnit,
        source: food.source,
      })
    }
    for (const food of searchCatalog(q)) {
      push({
        id: food.id,
        name: food.name,
        per100g: food.per100g,
        gramsPerUnit: food.gramsPerUnit,
        source: "catalog",
      })
    }
  }
  return hits.slice(0, 12)
}

/** Network search. The next name is tried when a name comes back empty. */
export async function searchFoodsOnline(query: string): Promise<FoodHit[]> {
  const names = foodSearchNames(query)
  if (!names.length) return []
  if (process.env.VITEST) return []
  for (const name of names) {
    let usda: FoodHit[] = []
    try {
      usda = keepFoodHits(name, await searchUsda(name))
    } catch {
      usda = []
    }
    if (usda.length) return usda
    try {
      const off = keepFoodHits(name, await searchOff(name))
      if (off.length) return off
    } catch {
      /* The next name still gets a turn. */
    }
  }
  return []
}
