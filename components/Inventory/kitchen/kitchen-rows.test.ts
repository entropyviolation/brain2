/**
 * Kitchen shelf rows — diorama lots, phone groups, and the name filter.
 */
import { describe, expect, it } from "vitest"
import { nutrientsFrom } from "@/lib/kitchen-nutrients"
import type { KitchenFood, KitchenStock } from "@/lib/kitchen-types"
import {
  addedToRoomLine,
  describeKitchenPick,
  filterShelfRows,
  groupShelfRows,
  plannedMealLine,
  roomFromPick,
  SHELF_ROOMS,
  shelfRowsToDioramaLots,
  stockAddDraft,
  stockToShelfRows,
} from "./kitchen-rows"

const honey: KitchenFood = {
  id: "mine",
  name: "Honey",
  per100g: nutrientsFrom({}),
  gramsPerUnit: 21,
  source: "custom",
}

function lot(partial: Pick<KitchenStock, "id" | "foodId" | "room" | "amount" | "unit"> & Partial<KitchenStock>): KitchenStock {
  return { boughtOn: "2026-10-01", ...partial }
}

const stock: KitchenStock[] = [
  lot({ id: "oats", foodId: "cat_oats", room: "pantry", amount: 400, unit: "g" }),
  lot({ id: "honey", foodId: "mine", room: "pantry", amount: 250, unit: "ml" }),
  lot({ id: "eggs", foodId: "cat_egg", room: "fridge", amount: 6, unit: "count" }),
  lot({ id: "peas", foodId: "cat_peas", room: "freezer", amount: 1.25, unit: "count" }),
  lot({ id: "unknown", foodId: "missing", room: "spice", amount: 1, unit: "count" }),
  lot({ id: "gone", foodId: "cat_oats", room: "pantry", amount: 10, unit: "g", finished: true }),
  lot({ id: "empty", foodId: "cat_oats", room: "fridge", amount: 0, unit: "g" }),
]

describe("kitchen shelf rows", () => {
  const rows = stockToShelfRows(stock, [honey])

  it("turns living stock into diorama lots and phone groups", () => {
    expect(rows.map((row) => [row.id, row.name, row.roomLabel, row.amountLabel])).toEqual([
      ["oats", "Oats, rolled", "Pantry", "400 g"],
      ["honey", "Honey", "Pantry", "250 ml"],
      ["eggs", "Egg", "Fridge", "6"],
      ["peas", "Peas", "Freezer", "1.3"],
      ["unknown", "Food", "Spice cabinet", "1"],
    ])
    expect(shelfRowsToDioramaLots(rows)).toEqual([
      { id: "oats", room: "pantry", name: "Oats, rolled" },
      { id: "honey", room: "pantry", name: "Honey" },
      { id: "eggs", room: "fridge", name: "Egg" },
      { id: "peas", room: "freezer", name: "Peas" },
      { id: "unknown", room: "spice", name: "Food" },
    ])
    expect(groupShelfRows(rows).map((group) => [group.room, group.rows.map((row) => row.id)])).toEqual([
      ["pantry", ["oats", "honey"]],
      ["fridge", ["eggs"]],
      ["freezer", ["peas"]],
      ["spice", ["unknown"]],
    ])
  })

  it("filters by name, case-insensitive, and describes a pick", () => {
    expect(filterShelfRows(rows, "  OAT ").map((row) => row.id)).toEqual(["oats"])
    expect(filterShelfRows(rows, "egg").map((row) => row.id)).toEqual(["eggs"])
    expect(filterShelfRows(rows, "   ")).toEqual(rows)
    expect(filterShelfRows(rows, "biscuit")).toEqual([])
    expect(describeKitchenPick({ kind: "lot", id: "honey" }, rows)).toBe("Honey · Pantry · 250 ml")
    expect(describeKitchenPick({ kind: "room", room: "freezer" }, rows)).toBe("Freezer")
    expect(describeKitchenPick({ kind: "lot", id: "gone" }, rows)).toBeNull()
    expect(plannedMealLine(0)).toBeNull()
    expect(plannedMealLine(1)).toBe("1 meal on the plan")
    expect(plannedMealLine(3)).toBe("3 meals on the plan")
  })

  it("drafts a count lot for a named room and a plain status line", () => {
    expect(SHELF_ROOMS).toEqual(["pantry", "fridge", "freezer", "spice"])
    expect(stockAddDraft("  Oats ", "pantry", "", "2026-10-28")).toEqual({
      name: "Oats",
      room: "pantry",
      amount: 1,
      unit: "count",
      boughtOn: "2026-10-28",
    })
    expect(stockAddDraft("Oats", "fridge", "2.5", "2026-10-28")).toMatchObject({ amount: 2.5, unit: "count", room: "fridge" })
    expect(stockAddDraft("   ", "pantry", "1", "2026-10-28")).toBeNull()
    expect(stockAddDraft("Oats", "pantry", "0", "2026-10-28")).toBeNull()
    expect(stockAddDraft("Oats", "spice", "nope", "2026-10-28")).toBeNull()
    expect(addedToRoomLine("Oats", "pantry")).toBe("Oats are in the pantry.")
    expect(addedToRoomLine(" Cinnamon ", "spice")).toBe("Cinnamon are in the spice cabinet.")
    expect(addedToRoomLine("Peas", "freezer")).toBe("Peas are in the freezer.")
    expect(roomFromPick({ kind: "room", room: "spice" }, rows)).toBe("spice")
    expect(roomFromPick({ kind: "lot", id: "eggs" }, rows)).toBe("fridge")
    expect(roomFromPick({ kind: "lot", id: "gone" }, rows)).toBeNull()
    expect(roomFromPick(null, rows)).toBeNull()
  })
})
