import { describe, expect, it } from "vitest"
import { personTimePenIds } from "@/lib/people-i-know"
import { personMinuteMasks } from "@/lib/person-time"
import { phonePenId } from "./ids"

describe("synced calls count as time together", () => {
  const person = { id: "p1", title: "Ana Ruiz", description: "", personPipelines: undefined }

  it("adds the person's iPhone Calls pen", () => {
    expect(personTimePenIds(person)).toEqual(["iphone-call-ana-ruiz"])
    expect(phonePenId("call", "Ana Ruiz")).toBe("iphone-call-ana-ruiz")
  })

  it("marks call minutes on their pen only", () => {
    const scopes = [{ id: "iphone-calls", name: "iPhone Calls", pens: [] }]
    const entries = [
      { id: "a", date: "2026-10-20", scopeId: "iphone-calls", penId: "iphone-call-ana-ruiz", startMin: 600, endMin: 615 },
      { id: "b", date: "2026-10-20", scopeId: "iphone-calls", penId: "iphone-call-bo", startMin: 700, endMin: 720 },
      { id: "c", date: "2026-10-21", scopeId: "iphone-calls", penId: "iphone-call-ana-ruiz", kind: "instant", startMin: 60, endMin: 60 },
    ]
    const masks = personMinuteMasks(entries as never, scopes as never, personTimePenIds(person))
    expect([...masks.keys()]).toEqual(["2026-10-20"])
    expect(masks.get("2026-10-20")!.reduce((n, v) => n + v, 0)).toBe(15)
  })
})
