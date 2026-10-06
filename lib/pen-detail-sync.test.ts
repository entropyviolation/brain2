import { describe, expect, it } from "vitest"
import type { TrackPen } from "@/lib/time-tracking-store"
import { syncScopeDetails, type DetailMint } from "@/lib/pen-detail-sync"

function mint(): DetailMint {
  let n = 0
  return (kind) => `${kind}-${++n}`
}

describe("syncScopeDetails", () => {
  it("turns a new detail into a pen that counts as the parent", () => {
    const exercise: TrackPen = {
      id: "exercise",
      name: "Exercise",
      color: "#f59e0b",
      variants: [{ id: "walk", name: "Walk", color: "#22c55e" }],
    }
    const { pens } = syncScopeDetails([exercise], mint())
    const walk = pens.find((pen) => pen.name === "Walk")
    expect(walk?.parentId).toBe("exercise")
    expect(pens.find((pen) => pen.id === "exercise")?.variants?.[0]).toMatchObject({
      id: "walk",
      penId: walk?.id,
      name: "Walk",
    })
  })

  it("shows pens that count as this one as its details", () => {
    const usa: TrackPen = { id: "usa", name: "USA", color: "#2563eb" }
    const california: TrackPen = { id: "ca", name: "California", color: "#f59e0b", parentId: "usa" }
    const { pens } = syncScopeDetails([usa, california], mint())
    expect(pens.find((pen) => pen.id === "usa")?.variants).toEqual([
      expect.objectContaining({ name: "California", penId: "ca", color: "#f59e0b" }),
    ])
  })

  it("merges a same-name detail and pen into one counts-as link", () => {
    const computer: TrackPen = {
      id: "computer",
      name: "Computer work",
      color: "#2563eb",
      variants: [{ id: "var-cogs", name: "cogs", color: "#64748b" }],
    }
    const cogs: TrackPen = { id: "pen-cogs", name: "Cogs", color: "#0ea5e9" }
    const { pens, droppedVariantIds } = syncScopeDetails([computer, cogs], mint())
    expect(droppedVariantIds).toEqual([])
    expect(pens.filter((pen) => pen.name.toLowerCase() === "cogs")).toHaveLength(1)
    expect(pens.find((pen) => pen.id === "pen-cogs")).toMatchObject({ parentId: "computer", color: "#0ea5e9" })
    expect(pens.find((pen) => pen.id === "computer")?.variants).toEqual([
      expect.objectContaining({ id: "var-cogs", penId: "pen-cogs", name: "Cogs", color: "#0ea5e9" }),
    ])
  })

  it("does not steal a pen that already counts as someone else", () => {
    const computer: TrackPen = {
      id: "computer",
      name: "Computer work",
      color: "#2563eb",
      variants: [{ id: "var-cogs", name: "Cogs" }],
    }
    const focus: TrackPen = { id: "focus", name: "Focus", color: "#111111" }
    const cogs: TrackPen = { id: "pen-cogs", name: "Cogs", color: "#0ea5e9", parentId: "focus" }
    const { pens } = syncScopeDetails([computer, focus, cogs], mint())
    expect(pens.find((pen) => pen.id === "pen-cogs")?.parentId).toBe("focus")
    expect(pens.filter((pen) => pen.name === "Cogs")).toHaveLength(1)
    expect(pens.find((pen) => pen.id === "computer")?.variants?.[0].penId).toBeUndefined()
  })

  it("drops a detail whose pen moved under a different parent", () => {
    const usa: TrackPen = {
      id: "usa",
      name: "USA",
      color: "#2563eb",
      variants: [{ id: "var-ca", name: "California", penId: "ca" }],
    }
    const mexico: TrackPen = { id: "mx", name: "Mexico", color: "#16a34a" }
    const california: TrackPen = { id: "ca", name: "California", color: "#f59e0b", parentId: "mx" }
    const { pens, droppedVariantIds } = syncScopeDetails([usa, mexico, california], mint())
    expect(droppedVariantIds).toEqual(["var-ca"])
    expect(pens.find((pen) => pen.id === "usa")?.variants).toBeUndefined()
    expect(pens.find((pen) => pen.id === "mx")?.variants?.[0]).toMatchObject({ penId: "ca", name: "California" })
  })

  it("is idempotent", () => {
    const exercise: TrackPen = { id: "exercise", name: "Exercise", color: "#f59e0b" }
    const walk: TrackPen = { id: "walk", name: "Walk", color: "#22c55e", parentId: "exercise" }
    const once = syncScopeDetails([exercise, walk], mint())
    const twice = syncScopeDetails(once.pens, mint())
    expect(twice.droppedVariantIds).toEqual([])
    expect(twice.pens).toHaveLength(once.pens.length)
    expect(twice.pens.find((pen) => pen.id === "exercise")?.variants).toHaveLength(1)
  })
})
