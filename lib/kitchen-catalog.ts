/**
 * lib/kitchen-catalog.ts — Common foods, nutrients per 100 g, on this device
 *
 * Values follow USDA FoodData Central typical rows (Foundation / SR Legacy),
 * rounded. A search that reaches the network can replace a row. A name that
 * is not here is a food you add, or a label photo.
 */

import { nutrientsFrom, type Nutrients } from "@/lib/kitchen-nutrients"
import type { KitchenFood, KitchenRoom } from "@/lib/kitchen-types"

type Keep = Partial<Record<KitchenRoom, number>>

function food(
  id: string,
  name: string,
  per: Nutrients,
  gramsPerUnit: number,
  room: KitchenRoom,
  keepDays?: Keep,
): KitchenFood {
  return {
    id: `cat_${id}`,
    name,
    per100g: per,
    gramsPerUnit,
    source: "catalog",
    room,
    ...(keepDays ? { keepDays } : {}),
  }
}

function row(
  kcal: number,
  proteinG: number,
  carbG: number,
  fatG: number,
  fiberG: number,
  sugarG: number,
  sodiumMg: number,
  potassiumMg: number,
  calciumMg: number,
  ironMg: number,
  vitCMg: number,
  vitDMcg: number,
): Nutrients {
  return nutrientsFrom({
    kcal,
    proteinG,
    carbG,
    fatG,
    fiberG,
    sugarG,
    sodiumMg,
    potassiumMg,
    calciumMg,
    ironMg,
    vitCMg,
    vitDMcg,
  })
}

export const KITCHEN_CATALOG: KitchenFood[] = [
  food("banana", "Banana", row(89, 1.1, 22.8, 0.3, 2.6, 12.2, 1, 358, 5, 0.3, 8.7, 0), 118, "pantry", { pantry: 5, fridge: 7 }),
  food("apple", "Apple", row(52, 0.3, 13.8, 0.2, 2.4, 10.4, 1, 107, 6, 0.1, 4.6, 0), 182, "fridge", { fridge: 21, pantry: 7 }),
  food("orange", "Orange", row(47, 0.9, 11.8, 0.1, 2.4, 9.4, 0, 181, 40, 0.1, 53.2, 0), 130, "fridge", { fridge: 14 }),
  food("strawberries", "Strawberries", row(32, 0.7, 7.7, 0.3, 2, 4.9, 1, 153, 16, 0.4, 58.8, 0), 150, "fridge", { fridge: 5 }),
  food("blueberries", "Blueberries", row(57, 0.7, 14.5, 0.3, 2.4, 10, 1, 77, 6, 0.3, 9.7, 0), 150, "fridge", { fridge: 5 }),
  food("avocado", "Avocado", row(160, 2, 8.5, 14.7, 6.7, 0.7, 7, 485, 12, 0.6, 10, 0), 150, "fridge", { fridge: 5 }),
  food("tomato", "Tomato", row(18, 0.9, 3.9, 0.2, 1.2, 2.6, 5, 237, 10, 0.3, 13.7, 0), 120, "fridge", { fridge: 7, pantry: 5 }),
  food("broccoli", "Broccoli", row(34, 2.8, 6.6, 0.4, 2.6, 1.7, 33, 316, 47, 0.7, 89.2, 0), 100, "fridge", { fridge: 5 }),
  food("spinach", "Spinach", row(23, 2.9, 3.6, 0.4, 2.2, 0.4, 79, 558, 99, 2.7, 28.1, 0), 30, "fridge", { fridge: 5 }),
  food("lettuce", "Lettuce", row(15, 1.4, 2.9, 0.2, 1.3, 0.8, 28, 194, 36, 0.9, 9.2, 0), 50, "fridge", { fridge: 5 }),
  food("carrot", "Carrot", row(41, 0.9, 9.6, 0.2, 2.8, 4.7, 69, 320, 33, 0.3, 5.9, 0), 60, "fridge", { fridge: 21 }),
  food("bell-pepper", "Bell pepper", row(26, 1, 6, 0.3, 2.1, 4.2, 4, 211, 7, 0.4, 127.7, 0), 120, "fridge", { fridge: 7 }),
  food("cucumber", "Cucumber", row(15, 0.7, 3.6, 0.1, 0.5, 1.7, 2, 147, 16, 0.3, 2.8, 0), 100, "fridge", { fridge: 7 }),
  food("onion", "Onion", row(40, 1.1, 9.3, 0.1, 1.7, 4.2, 4, 146, 23, 0.2, 7.4, 0), 110, "pantry", { pantry: 30 }),
  food("potato", "Potato", row(77, 2, 17.5, 0.1, 2.1, 0.8, 6, 425, 12, 0.8, 19.7, 0), 170, "pantry", { pantry: 21 }),
  food("sweet-potato", "Sweet potato", row(86, 1.6, 20.1, 0.1, 3, 4.2, 55, 337, 30, 0.6, 2.4, 0), 130, "pantry", { pantry: 14 }),
  food("corn", "Corn", row(86, 3.3, 19, 1.4, 2.7, 6.3, 15, 270, 2, 0.5, 6.8, 0), 100, "fridge", { fridge: 5, freezer: 240 }),
  food("peas", "Peas", row(81, 5.4, 14.5, 0.4, 5.7, 5.7, 5, 244, 25, 1.5, 40, 0), 100, "freezer", { freezer: 240, fridge: 5 }),
  food("egg", "Egg", row(143, 12.6, 0.7, 9.5, 0, 0.4, 142, 138, 56, 1.8, 0, 2), 50, "fridge", { fridge: 28 }),
  food("chicken", "Chicken breast, cooked", row(165, 31, 0, 3.6, 0, 0, 74, 256, 15, 1, 0, 0.1), 120, "fridge", { fridge: 2, freezer: 180 }),
  food("turkey", "Turkey breast, cooked", row(135, 30, 0, 0.7, 0, 0, 52, 293, 10, 0.6, 0, 0.1), 120, "fridge", { fridge: 2, freezer: 180 }),
  food("beef", "Ground beef, cooked", row(250, 25.8, 0, 15.4, 0, 0, 72, 318, 18, 2.6, 0, 0.1), 100, "fridge", { fridge: 2, freezer: 120 }),
  food("salmon", "Salmon, cooked", row(208, 20.4, 0, 13.4, 0, 0, 59, 363, 9, 0.3, 0, 11), 120, "fridge", { fridge: 2, freezer: 180 }),
  food("shrimp", "Shrimp, cooked", row(99, 24, 0.2, 0.3, 0, 0, 111, 259, 70, 0.5, 0, 0.1), 85, "freezer", { freezer: 180, fridge: 2 }),
  food("tofu", "Tofu", row(76, 8, 1.9, 4.8, 0.3, 0.6, 7, 121, 350, 5.4, 0.1, 0), 100, "fridge", { fridge: 7 }),
  food("milk", "Milk, whole", row(61, 3.2, 4.8, 3.3, 0, 5.1, 43, 132, 113, 0, 0, 0.1), 244, "fridge", { fridge: 7 }),
  food("yogurt", "Yogurt, plain", row(61, 3.5, 4.7, 3.3, 0, 4.7, 46, 155, 121, 0.1, 0.5, 0.1), 170, "fridge", { fridge: 14 }),
  food("greek-yogurt", "Greek yogurt, nonfat", row(59, 10.2, 3.6, 0.4, 0, 3.2, 36, 141, 110, 0.1, 0, 0), 170, "fridge", { fridge: 14 }),
  food("cheddar", "Cheddar", row(403, 23, 3.1, 33, 0, 0.5, 653, 76, 710, 0.2, 0, 0.6), 28, "fridge", { fridge: 30 }),
  food("mozzarella", "Mozzarella", row(280, 28, 3.1, 17, 0, 1, 627, 76, 505, 0.2, 0, 0.4), 28, "fridge", { fridge: 14 }),
  food("cottage", "Cottage cheese", row(98, 11.1, 3.4, 4.3, 0, 2.7, 315, 104, 83, 0.1, 0, 0.1), 110, "fridge", { fridge: 10 }),
  food("butter", "Butter", row(717, 0.9, 0.1, 81.1, 0, 0.1, 11, 24, 24, 0, 0, 1.5), 14, "fridge", { fridge: 30, freezer: 180 }),
  food("oats", "Oats, rolled", row(379, 13.2, 67.7, 6.5, 10.1, 1, 6, 362, 52, 4.3, 0, 0), 40, "pantry", { pantry: 365 }),
  food("rice-white", "Rice, white, cooked", row(130, 2.7, 28.2, 0.3, 0.4, 0.1, 1, 35, 10, 0.2, 0, 0), 150, "fridge", { fridge: 4, pantry: 2 }),
  food("rice-brown", "Rice, brown, cooked", row(123, 2.7, 25.6, 1, 1.6, 0.2, 1, 86, 3, 0.6, 0, 0), 150, "fridge", { fridge: 4 }),
  food("quinoa", "Quinoa, cooked", row(120, 4.4, 21.3, 1.9, 2.8, 0.9, 7, 172, 17, 1.5, 0, 0), 150, "fridge", { fridge: 4 }),
  food("pasta", "Pasta, cooked", row(131, 5, 25, 1.1, 1.8, 0.6, 1, 44, 7, 0.5, 0, 0), 140, "fridge", { fridge: 4 }),
  food("bread", "Bread, white", row(265, 9, 49, 3.2, 2.7, 5, 491, 115, 144, 3.6, 0, 0), 28, "pantry", { pantry: 5, freezer: 90 }),
  food("bread-wheat", "Bread, whole wheat", row(247, 13, 41, 4.2, 6.9, 6, 400, 248, 107, 2.5, 0, 0), 28, "pantry", { pantry: 5, freezer: 90 }),
  food("tortilla", "Flour tortilla", row(312, 8.2, 51.8, 8, 2.4, 2.4, 511, 120, 90, 2.5, 0, 0), 45, "pantry", { pantry: 7, freezer: 180 }),
  food("black-beans", "Black beans, cooked", row(132, 8.9, 23.7, 0.5, 8.7, 0.3, 1, 355, 27, 2.1, 0, 0), 170, "pantry", { pantry: 3, fridge: 4 }),
  food("lentils", "Lentils, cooked", row(116, 9, 20.1, 0.4, 7.9, 1.8, 2, 369, 19, 3.3, 1.5, 0), 170, "fridge", { fridge: 4 }),
  food("chickpeas", "Chickpeas, cooked", row(164, 8.9, 27.4, 2.6, 7.6, 4.8, 7, 291, 49, 2.9, 1.3, 0), 160, "fridge", { fridge: 4 }),
  food("peanut-butter", "Peanut butter", row(588, 25, 20, 50, 6, 9.2, 17, 649, 49, 1.9, 0, 0), 32, "pantry", { pantry: 180 }),
  food("almonds", "Almonds", row(579, 21.2, 21.6, 49.9, 12.5, 4.4, 1, 733, 269, 3.7, 0, 0), 28, "pantry", { pantry: 180 }),
  food("olive-oil", "Olive oil", row(884, 0, 0, 100, 0, 0, 2, 1, 1, 0.6, 0, 0), 14, "pantry", { pantry: 365 }),
  food("flour", "Flour, all-purpose", row(364, 10.3, 76.3, 1, 2.7, 0.3, 2, 107, 15, 4.6, 0, 0), 120, "pantry", { pantry: 180 }),
  food("sugar", "Sugar", row(387, 0, 100, 0, 0, 100, 1, 2, 1, 0, 0, 0), 12, "pantry", { pantry: 3650 }),
  food("honey", "Honey", row(304, 0.3, 82.4, 0, 0.2, 82.1, 4, 52, 6, 0.4, 0.5, 0), 21, "pantry", { pantry: 3650 }),
  food("cocoa", "Cocoa powder", row(228, 19.6, 57.9, 13.7, 37, 1.8, 21, 1524, 128, 13.9, 0, 0), 5, "pantry", { pantry: 365 }),
  food("mayonnaise", "Mayonnaise", row(680, 1, 0.6, 75, 0, 0.6, 635, 20, 8, 0.2, 0, 0.2), 15, "fridge", { fridge: 60 }),
  food("ketchup", "Ketchup", row(112, 1.7, 26, 0.3, 0.3, 22, 907, 315, 15, 0.4, 4.1, 0), 17, "fridge", { fridge: 180, pantry: 30 }),
  food("soy-sauce", "Soy sauce", row(53, 8.1, 4.9, 0.1, 0.8, 0.4, 5493, 435, 33, 2.4, 0, 0), 15, "fridge", { fridge: 180 }),
  food("lemon", "Lemon juice", row(22, 0.4, 6.9, 0.2, 0.3, 2.5, 1, 103, 6, 0.1, 38.7, 0), 15, "fridge", { fridge: 7 }),
  food("garlic", "Garlic", row(149, 6.4, 33.1, 0.5, 2.1, 1, 17, 401, 181, 1.7, 31.2, 0), 3, "pantry", { pantry: 60 }),
  food("salt", "Salt", row(0, 0, 0, 0, 0, 0, 38758, 8, 24, 0.3, 0, 0), 1, "spice", { spice: 3650 }),
  food("pepper", "Black pepper", row(251, 10.4, 64, 3.3, 25.3, 0.6, 20, 1329, 443, 9.7, 0, 0), 1, "spice", { spice: 730 }),
  food("cinnamon", "Cinnamon", row(247, 4, 80.6, 1.2, 53.1, 2.2, 10, 431, 1002, 8.3, 3.8, 0), 1, "spice", { spice: 730 }),
]

const BY_ID = new Map(KITCHEN_CATALOG.map((food) => [food.id, food]))

export function catalogFood(id: string): KitchenFood | null {
  return BY_ID.get(id) ?? null
}

const STOP = new Set(["raw", "cooked", "with", "and", "the", "plain", "whole", "nonfat"])

function words(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2 && !STOP.has(word))
}

function wordEq(a: string, b: string): boolean {
  if (a === b) return true
  if (a.endsWith("s") && a.slice(0, -1) === b) return true
  if (b.endsWith("s") && b.slice(0, -1) === a) return true
  return false
}

/** One catalog food when the name is unmistakable. Two equal hits stay unmatched. */
export function matchCatalog(name: string): KitchenFood | null {
  const q = name.trim().toLowerCase()
  if (!q) return null
  const exact = KITCHEN_CATALOG.find((food) => food.name.toLowerCase() === q)
  if (exact) return exact
  const qWords = words(q)
  if (!qWords.length) return null
  const scored = KITCHEN_CATALOG.map((food) => {
    const fWords = words(food.name)
    const score = qWords.filter((word) => fWords.some((other) => wordEq(word, other))).length
    return { food, score }
  })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.food.name.length - b.food.name.length)
  if (!scored.length) return null
  if (scored.length > 1 && scored[0].score === scored[1].score) return null
  return scored[0].food
}

export function searchCatalog(query: string): KitchenFood[] {
  const q = query.trim().toLowerCase()
  if (q.length < 1) return []
  return KITCHEN_CATALOG.filter((food) => food.name.toLowerCase().includes(q)).slice(0, 12)
}
