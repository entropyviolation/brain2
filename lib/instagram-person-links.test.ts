import { beforeEach, describe, expect, it } from "vitest"
import { createPersonFromInstagram, linkInstagramToPerson, personForInstagram, unlinkInstagramFromPerson } from "@/lib/instagram-person-links"
import { readAccountRequest } from "@/lib/instagram-report"
import { personRecords } from "@/lib/people-i-know"
import { useTaskStore } from "@/lib/task-store"
import { resetAllStores } from "@/tests/test-utils"

const people = () => personRecords(useTaskStore.getState().tasks, useTaskStore.getState().lists)

describe("instagram person links", () => {
  beforeEach(() => resetAllStores())

  it("creates a person, moves the handle to another, and unlinks", () => {
    const a = createPersonFromInstagram("@Ada_L", "Ada")!
    expect(personForInstagram(people(), "ada_l")?.id).toBe(a)
    const b = createPersonFromInstagram("bo")!
    linkInstagramToPerson(b, "ada_l")
    expect(personForInstagram(people(), "ada_l")?.id).toBe(b)
    expect(people().find((p) => p.id === a)?.personProfile?.instagram).toBeUndefined()
    unlinkInstagramFromPerson(b, "ada_l")
    expect(personForInstagram(people(), "ada_l")).toBeNull()
  })

  it("reads only well-formed account requests", () => {
    expect(readAccountRequest({ brain2Instagram: "account", action: "attach", handle: "@ada", personId: "p1" })).toEqual({ type: "attach", handle: "ada", personId: "p1" })
    expect(readAccountRequest({ brain2Instagram: "account", action: "attach", handle: "ada" })).toBeNull()
    expect(readAccountRequest({ action: "opened", handle: "ada" })).toBeNull()
  })
})
