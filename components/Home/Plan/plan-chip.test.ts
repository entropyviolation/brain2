import { describe, expect, it } from "vitest"
import { PLAN_DEFAULT_EVENT_COLOR, resolvePlanColor } from "./plan-chip"

describe("resolvePlanColor", () => {
  it("defaults to mint, never orange", () => {
    expect(resolvePlanColor()).toBe(PLAN_DEFAULT_EVENT_COLOR)
    expect(resolvePlanColor("")).toBe("#8cd4a5")
  })

  it("keeps a user hex and remaps the old SHOW peach", () => {
    expect(resolvePlanColor("#8b7ecc")).toBe("#8b7ecc")
    expect(resolvePlanColor("#e89b6c")).toBe("#7eb8b2")
  })
})
