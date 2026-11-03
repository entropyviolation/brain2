import { describe, expect, it } from "vitest"
import { getBuiltinItemTypes } from "@/lib/item-types"
import { LOG_TYPE_ID } from "@/lib/tracking-item-types"
import { TIMEBLOCK_TYPE_ID, getTimeblockTypeDefinition, withTimeblockType } from "@/lib/timeblock-types"

describe("timeblock type", () => {
  it("is its own catalog type and ships on the builtin registry", () => {
    const def = getTimeblockTypeDefinition()
    expect(def.id).toBe(TIMEBLOCK_TYPE_ID)
    expect(def.id).toBe("timeblock")
    expect(def.name).toBe("Timeblock")
    expect(def.kind).toBe("catalog")
    expect(def.parentTypeId).toBeUndefined()
    expect(def.detailPanels).toEqual(["details"])
    expect(def.capabilities).toEqual({})
    expect(def.description).toContain("EntryDialog")

    const types = getBuiltinItemTypes()
    const found = types.find((type) => type.id === TIMEBLOCK_TYPE_ID)
    expect(found?.parentTypeId).not.toBe(LOG_TYPE_ID)
    expect(found?.kind).toBe("catalog")
    expect(withTimeblockType(types)).toBe(types)
    expect(withTimeblockType([]).map((type) => type.id)).toEqual([TIMEBLOCK_TYPE_ID])
  })
})
