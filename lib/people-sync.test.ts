import { describe, expect, it } from "vitest"
import { planPeopleItems } from "@/lib/people-sync"

const pen = (id: string, name: string) => ({ id, name, color: "#000", levelId: "lvl-company-person" })
const scopes = (pens: ReturnType<typeof pen>[]) => [{ id: "company", pens }]

describe("planPeopleItems", () => {
  it("creates one item for two same-named Company pens", () => {
    const plan = planPeopleItems(scopes([pen("a", "dom"), pen("b", "Dom")]), [], () => [])
    expect(plan.create).toEqual([{ name: "dom", penId: "a", penIds: ["a", "b"] }])
  })

  it("joins an existing same-named person instead of creating", () => {
    const plan = planPeopleItems(scopes([pen("a", "dom")]), [{ id: "t1", title: "Dom" }], () => [])
    expect(plan.join).toEqual([{ taskId: "t1", penId: "a" }])
    expect(plan.create).toEqual([])
  })
})
