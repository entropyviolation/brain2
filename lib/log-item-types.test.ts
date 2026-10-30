import { describe, expect, it } from "vitest"
import { getBuiltinItemTypes, mergeTypeRegistry } from "@/lib/item-types"
import {
  LOG_COUNT_TYPE_ID,
  LOG_DRINK_TYPE_ID,
  LOG_DRUG_TYPE_ID,
  LOG_FOOD_TYPE_ID,
  LOG_INTAKE_TYPE_ID,
  LOG_NOTE_TYPE_ID,
  LOG_SPEND_TYPE_ID,
  LOG_SUBTYPE_IDS,
  LOG_SWITCH_TYPE_ID,
  getLogSubtypeDefinitions,
  withLogItemTypes,
} from "@/lib/log-item-types"
import { LOG_TYPE_ID, THOUGHT_PROCESS_TYPE_ID, getThoughtProcessTypeDefinition } from "@/lib/tracking-item-types"
import type { ItemTypeDefinition } from "@/lib/types"

const ENTRY_IDS = [
  LOG_DRINK_TYPE_ID,
  LOG_DRUG_TYPE_ID,
  LOG_INTAKE_TYPE_ID,
  LOG_NOTE_TYPE_ID,
  LOG_SWITCH_TYPE_ID,
  LOG_SPEND_TYPE_ID,
] as const

describe("log item types", () => {
  it("registers eight catalog subtypes under Log, and parents the Thought Process seed", () => {
    const defs = getLogSubtypeDefinitions()
    expect(defs.map((type) => type.id)).toEqual([...LOG_SUBTYPE_IDS])
    for (const type of defs) {
      expect(type.parentTypeId).toBe(LOG_TYPE_ID)
      expect(type.kind).toBe("catalog")
      expect(type.detailPanels).toEqual(["details"])
      expect(type.capabilities).toEqual({})
    }
    const byId = new Map(defs.map((type) => [type.id, type]))
    expect(byId.get(LOG_FOOD_TYPE_ID)?.name).toBe("Food")
    expect(byId.get(LOG_FOOD_TYPE_ID)?.description).toContain("FoodDetailDialog")
    expect(byId.get(LOG_COUNT_TYPE_ID)?.name).toBe("Count")
    expect(byId.get(LOG_COUNT_TYPE_ID)?.description).toContain("count store")
    expect(byId.get(LOG_NOTE_TYPE_ID)?.name).toBe("Log note")
    expect(byId.get(LOG_NOTE_TYPE_ID)?.id).toBe("log-note")
    expect(byId.get(LOG_SPEND_TYPE_ID)?.name).toBe("Spent")
    for (const id of ENTRY_IDS) expect(byId.get(id)?.description).toContain("EntryDialog")

    const types = getBuiltinItemTypes()
    const ids = types.map((type) => type.id)
    for (const id of LOG_SUBTYPE_IDS) expect(ids).toContain(id)
    expect(getThoughtProcessTypeDefinition().parentTypeId).toBe("log")
    expect(types.find((type) => type.id === THOUGHT_PROCESS_TYPE_ID)?.parentTypeId).toBe(LOG_TYPE_ID)
    expect(types.find((type) => type.id === THOUGHT_PROCESS_TYPE_ID)?.kind).toBe("catalog")
    expect(types.find((type) => type.id === LOG_TYPE_ID)?.name).toBe("Log")
    expect(types.find((type) => type.id === LOG_TYPE_ID)?.kind).toBe("catalog")
    expect(withLogItemTypes(types)).toBe(types)

    const partial = withLogItemTypes([getLogSubtypeDefinitions()[0]!])
    expect(partial.map((type) => type.id)).toEqual([LOG_FOOD_TYPE_ID, ...LOG_SUBTYPE_IDS.filter((id) => id !== LOG_FOOD_TYPE_ID)])
  })

  it("keeps a stored Log name and only fills a missing Thought Process parent", () => {
    const storedLog: ItemTypeDefinition = {
      id: LOG_TYPE_ID,
      name: "Journal",
      kind: "catalog",
      builtin: true,
      attributes: [{ id: "custom", name: "Custom", type: "string" }],
      detailPanels: ["details", "notes"],
      rules: [],
    }
    const storedThought: ItemTypeDefinition = {
      id: THOUGHT_PROCESS_TYPE_ID,
      name: "Strand",
      kind: "catalog",
      builtin: true,
      description: "kept strand",
      color: "#111111",
      attributes: [{ id: "kept", name: "Kept", type: "string" }],
      displayedAttributes: ["kept"],
      detailPanels: ["details"],
      capabilities: { completable: true },
      rules: [{ id: "r", name: "r", trigger: "validate", action: { kind: "block", message: "no" } }],
    }
    const merged = mergeTypeRegistry([storedLog, storedThought])
    const log = merged.find((type) => type.id === LOG_TYPE_ID)
    expect(log?.name).toBe("Journal")
    expect(log?.kind).toBe("catalog")
    expect(log?.attributes).toEqual(storedLog.attributes)
    expect(log?.detailPanels).toEqual(["details", "notes"])
    expect(log?.rules).toEqual([])
    expect(log?.parentTypeId).toBeUndefined()

    const thought = merged.find((type) => type.id === THOUGHT_PROCESS_TYPE_ID)
    expect(thought).toEqual({ ...storedThought, parentTypeId: "log" })

    const keptParent: ItemTypeDefinition = { ...storedThought, parentTypeId: "custom-parent" }
    const again = mergeTypeRegistry([keptParent])
    expect(again.find((type) => type.id === THOUGHT_PROCESS_TYPE_ID)).toEqual(keptParent)
  })
})
