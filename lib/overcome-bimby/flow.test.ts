import { describe, expect, it } from "vitest"
import { entryDef } from "@/lib/bim-flow/entries"
import { flowDef } from "@/lib/bim-flow/flows"
import { overcomeFlow } from "./flow"

describe("overcomeFlow", () => {
  it("is registered, has its door, and is wired start to finish", () => {
    const f = flowDef("overcome").build()
    expect(f).toEqual(overcomeFlow())
    expect(f.nodes.find((n) => n.kind === "message")?.config.entry).toBe("overcome")
    expect(entryDef("overcome")?.flowId).toBe("overcome")
    const ids = new Set(f.nodes.map((n) => n.id))
    for (const e of f.edges) expect(ids.has(e.from) && ids.has(e.to)).toBe(true)
    expect(f.edges).toHaveLength(f.nodes.length - 1)
  })
})
