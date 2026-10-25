import { describe, expect, it } from "vitest"
import { personTimePenIds } from "@/lib/people-i-know"
import { personMinuteMasks } from "@/lib/person-time"

describe("synced calls do not count as time together", () => {
  const person = { id: "p1", title: "Ana Ruiz", description: "", personPipelines: undefined }

  it("adds no phone pens", () => {
    expect(personTimePenIds(person)).toEqual([])
  })

  it("marks no call minutes", () => {
    const scopes = [{ id: "iphone-calls", name: "iPhone Calls", pens: [] }]
    const entries = [
      { id: "a", date: "2026-10-20", scopeId: "iphone-calls", penId: "iphone-call-ana-ruiz", startMin: 600, endMin: 615 },
    ]
    const masks = personMinuteMasks(entries as never, scopes as never, ["iphone-call-ana-ruiz"])
    expect([...masks.keys()]).toEqual([])
  })
})
