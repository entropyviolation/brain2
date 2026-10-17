import { beforeEach, describe, expect, it } from "vitest"
import { PEOPLE_I_KNOW_LIST_ID } from "@/lib/people-i-know"
import { PEOPLE_SELF_FLAG, PEOPLE_SELF_ID, ensureSelfPerson, isSelfPerson } from "@/lib/people-self"
import { cleanPersonProfile } from "@/lib/person-profile"
import { useTaskStore } from "@/lib/task-store"
import { resetAllStores } from "@/tests/test-utils"

function selves() {
  return useTaskStore.getState().tasks.filter((task) => isSelfPerson(task))
}

describe("ensureSelfPerson", () => {
  beforeEach(() => {
    resetAllStores()
    localStorage.removeItem(PEOPLE_SELF_FLAG)
  })

  it("creates Self once on People I Know", () => {
    expect(ensureSelfPerson()).toBe(PEOPLE_SELF_ID)
    expect(ensureSelfPerson()).toBe(PEOPLE_SELF_ID)
    const [self] = selves()
    expect(selves()).toHaveLength(1)
    expect(self.title).toBe("self")
    expect(self.lists).toContain(PEOPLE_I_KNOW_LIST_ID)
    expect(self.personProfile).toEqual({ nicknames: ["me"], self: true })
    expect(localStorage.getItem(PEOPLE_SELF_FLAG)).toBe("1")
  })

  it("is not recreated after it is deleted", () => {
    ensureSelfPerson()
    useTaskStore.getState().deleteTask(PEOPLE_SELF_ID)
    expect(ensureSelfPerson()).toBeNull()
    localStorage.removeItem(PEOPLE_SELF_FLAG)
    expect(ensureSelfPerson()).toBeNull()
    expect(selves()).toHaveLength(0)
  })

  it("is not duplicated when a hub merge brings it back with the same id", () => {
    ensureSelfPerson()
    const self = selves()[0]
    useTaskStore.getState().setTasks([...useTaskStore.getState().tasks.filter((t) => t.id !== self.id), { ...self }])
    localStorage.removeItem(PEOPLE_SELF_FLAG)
    expect(ensureSelfPerson()).toBe(PEOPLE_SELF_ID)
    expect(selves()).toHaveLength(1)
  })

  it("keeps the self mark through cleanPersonProfile", () => {
    expect(cleanPersonProfile({ self: true, nicknames: ["me"] })?.self).toBe(true)
    expect(cleanPersonProfile({ self: false as unknown as true })).toBeUndefined()
  })
})
