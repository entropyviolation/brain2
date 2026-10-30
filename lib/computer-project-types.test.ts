import { describe, expect, it } from "vitest"
import { getBuiltinItemTypes } from "@/lib/item-types"
import {
  COMPUTER_PROJECT_ATTR,
  COMPUTER_PROJECT_TYPE_ID,
  getComputerProjectTypeDefinition,
  withComputerProjectType,
} from "@/lib/computer-project-types"
import { OPERATION_TYPE_ID } from "@/lib/operation-types"

describe("computer project type", () => {
  it("is a system subtype of operation and ships on the builtin registry", () => {
    const def = getComputerProjectTypeDefinition()
    expect(def.id).toBe(COMPUTER_PROJECT_TYPE_ID)
    expect(def.parentTypeId).toBe(OPERATION_TYPE_ID)
    expect(def.kind).toBe("system")
    expect(def.attributes?.map((attr) => attr.id)).toEqual(
      expect.arrayContaining([COMPUTER_PROJECT_ATTR.repo, COMPUTER_PROJECT_ATTR.stack, COMPUTER_PROJECT_ATTR.next]),
    )
    const types = getBuiltinItemTypes()
    expect(types.some((type) => type.id === COMPUTER_PROJECT_TYPE_ID)).toBe(true)
    expect(withComputerProjectType(types)).toBe(types)
  })
})
