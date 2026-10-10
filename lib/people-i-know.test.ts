import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { getBuiltinItemTypes } from "@/lib/item-types"
import { createListItem } from "@/lib/item-utils"
import {
  companyBlocksForPerson,
  ensurePeopleIKnowList,
  findPeopleIKnowList,
  readPersonPipelines,
  withCompanyPen,
  withCompanyTimeblock,
  withoutPipeline,
} from "@/lib/people-i-know"
import { PERSON_TYPE_ID } from "@/lib/person-types"
import { useTaskStore } from "@/lib/task-store"
import type { Task } from "@/lib/types"

describe("People I Know", () => {
  beforeEach(() => {
    resetAllStores()
  })

  it("seeds a protected list and the Person type", () => {
    const id = ensurePeopleIKnowList()
    const list = findPeopleIKnowList(useTaskStore.getState().lists)
    expect(list?.id).toBe(id)
    expect(list?.name).toBe("People I Know")
    expect(list?.peopleList).toBe(true)
    expect(list?.itemTypeId).toBe(PERSON_TYPE_ID)
    expect(list?.scheduleable).toBe(false)
    useTaskStore.getState().deleteList(id)
    expect(findPeopleIKnowList(useTaskStore.getState().lists)?.id).toBe(id)
    expect(getBuiltinItemTypes().some((type) => type.id === PERSON_TYPE_ID)).toBe(true)
    expect(ensurePeopleIKnowList()).toBe(id)
  })

  it("adopts a list already named People I Know", () => {
    useTaskStore.getState().addList({
      id: "custom-people",
      name: "People I Know",
      color: "#111111",
      createdAt: new Date(),
    })
    expect(ensurePeopleIKnowList()).toBe("custom-people")
    const list = useTaskStore.getState().lists.find((row) => row.id === "custom-people")
    expect(list?.peopleList).toBe(true)
    expect(list?.itemTypeId).toBe(PERSON_TYPE_ID)
    expect(useTaskStore.getState().lists.filter((row) => row.peopleList)).toHaveLength(1)
  })

  it("attaches a pen and a timeblock once, and keeps a later kind", () => {
    const person = { ...createListItem("Ada", ["people-i-know"]), id: "ada" } as Task
    person.personPipelines = [{ id: "later", kind: "calls", phone: "555" }]
    const withPen = withCompanyPen(withCompanyPen(person, "co-alone", "pen-1"), "co-alone", "pen-2")
    const withBlock = withCompanyTimeblock(withPen, "block-1", "block-row")
    const rows = readPersonPipelines(withBlock.personPipelines)
    expect(rows.map((row) => row.kind)).toEqual(["calls", "company-pen", "company-timeblock"])
    expect(rows.find((row) => row.kind === "calls")).toMatchObject({ phone: "555" })
    const cleared = withoutPipeline(withoutPipeline(withoutPipeline(withBlock, "later"), "pen-1"), "block-row")
    expect(cleared.personPipelines).toBeUndefined()
  })

  it("selects company blocks by pen color and keeps a stored timeblock row", () => {
    const person = withCompanyTimeblock(
      withCompanyPen({ ...createListItem("Ada", []), id: "ada" } as Task, "co-together", "pen-1"),
      "explicit",
      "block-row",
    )
    const blocks = companyBlocksForPerson(person.personPipelines, [
      { id: "painted", date: "2026-10-09", penId: "co-together", scopeId: "company", startMin: 600 },
      { id: "explicit", date: "2026-10-08", penId: "co-alone", scopeId: "company", startMin: 540 },
      { id: "elsewhere", date: "2026-10-10", penId: "co-together", scopeId: "activity", startMin: 600 },
    ])
    expect(blocks.map((row) => row.id)).toEqual(["painted"])
    expect(readPersonPipelines(person.personPipelines).map((row) => row.kind)).toEqual([
      "company-pen",
      "company-timeblock",
    ])
  })
})
