import { beforeEach, describe, expect, it } from "vitest"
import { ensureSelfPerson, PEOPLE_SELF_FLAG, PEOPLE_SELF_ID } from "@/lib/people-self"
import { PEOPLE_I_KNOW_LIST_ID } from "@/lib/people-i-know"
import { useTaskStore } from "@/lib/task-store"
import { resetAllStores } from "@/tests/test-utils"

describe("ensureSelfPerson", () => {
  beforeEach(() => {
    resetAllStores()
    localStorage.removeItem(PEOPLE_SELF_FLAG)
  })

  it("creates self once with the nickname me on People I Know", () => {
    expect(ensureSelfPerson()).toBe(PEOPLE_SELF_ID)
    ensureSelfPerson()
    const selves = useTaskStore.getState().tasks.filter((t) => t.id === PEOPLE_SELF_ID)
    expect(selves).toHaveLength(1)
    expect(selves[0].personProfile).toEqual({ nicknames: ["me"], self: true })
    expect(selves[0].lists).toContain(PEOPLE_I_KNOW_LIST_ID)
    expect(selves[0].type).toBe("person")
  })

  it("does not come back after a delete", () => {
    ensureSelfPerson()
    useTaskStore.getState().deleteTask(PEOPLE_SELF_ID)
    expect(ensureSelfPerson()).toBeNull()
    localStorage.removeItem(PEOPLE_SELF_FLAG)
    expect(ensureSelfPerson()).toBeNull()
    expect(useTaskStore.getState().tasks.some((t) => t.id === PEOPLE_SELF_ID)).toBe(false)
  })
})
