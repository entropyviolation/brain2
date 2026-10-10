import { describe, it, expect } from "vitest"
import type { ModuleInstance } from "@/lib/modules-store"
import { seedHouseCleaning, type HouseCleaningState } from "@/lib/house-cleaning"
import { planTidyModuleLists } from "@/lib/module-list-import-tidy"
import {
  hasTidyRecordItems,
  houseRecordsFromItems,
  resolveHouseCleaning,
} from "@/lib/house-cleaning-items"

function mod(house: HouseCleaningState): ModuleInstance {
  return {
    id: "mod-tidy",
    type: "custom",
    title: "Tidy",
    kind: "workspace",
    config: { houseCleaning: house },
  }
}

describe("house-cleaning-items", () => {
  it("projects chores and needed back from imported Items", () => {
    const house = seedHouseCleaning(1_700_000_000_000)
    const module = mod(house)
    const plan = planTidyModuleLists(module, house)
    expect(hasTidyRecordItems(module.id, plan.items)).toBe(true)

    const records = houseRecordsFromItems(module.id, plan.items, plan.lists)
    expect(records).not.toBeNull()
    expect(records!.tasks.length).toBe(house.tasks.length)
    expect(records!.needed.length).toBe(house.needed.length)
    const dishes = records!.tasks.find((t) => t.id === "seed-kitchen-0")
    expect(dishes?.title).toBe("Do dishes")
    expect(dishes?.importance).toBe("crucial")
    expect(dishes?.estMin).toBe(15)
    expect(records!.areas.some((a) => a.id === "kitchen" && a.name === "Kitchen")).toBe(true)
  })

  it("resolveHouseCleaning prefers Item records over config chores", () => {
    const house = seedHouseCleaning(1_700_000_000_000)
    const module = mod(house)
    const plan = planTidyModuleLists(module, house)
    const edited = plan.items.map((item) =>
      item.id.includes("seed-kitchen-0")
        ? { ...item, title: "Do dishes (edited)", description: "Do dishes (edited)" }
        : item,
    )
    const resolved = resolveHouseCleaning(module, edited, plan.lists)
    expect(resolved.tasks.find((t) => t.id === "seed-kitchen-0")?.title).toBe("Do dishes (edited)")
    expect(resolved.filters).toEqual(house.filters)
    expect(resolved.theme).toBe(house.theme)
  })

  it("falls back to config when no Items exist", () => {
    const house = seedHouseCleaning(1)
    const module = mod(house)
    const resolved = resolveHouseCleaning(module, [], [])
    expect(resolved.tasks.map((t) => t.id)).toEqual(house.tasks.map((t) => t.id))
    expect(resolved.tasks[0]?.title).toBe(house.tasks[0]?.title)
    expect(hasTidyRecordItems(module.id, [])).toBe(false)
  })
})
