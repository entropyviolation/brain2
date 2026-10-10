import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import {
  BOUBA_LIFT_PX,
  CORNERS_LEFT_ALONE,
  DEFAULT_CORNER_MIX,
  DEFAULT_CORNER_PRESET,
  DEFAULT_CORNER_RADII,
  applyCornerMix,
  cornerRadiusPx,
  cornerTokens,
} from "./corner-mix"

describe("default corner preset", () => {
  it("is named default and restores every stored literal at mix 50", () => {
    expect(DEFAULT_CORNER_PRESET).toBe("default")
    expect(DEFAULT_CORNER_MIX).toBe(50)
    expect(cornerTokens(50)).toEqual(DEFAULT_CORNER_RADII)
    expect(cornerTokens(50)["--radius"]).toBe("0.75rem")
    expect(cornerTokens(50.02)["--radius"]).toBe("0.75rem")
    expect(cornerTokens(50)["--r-tw"]).toBe("0.25rem")
    expect(cornerTokens(50)["--r-2"]).toBe("2px")
    expect(cornerTokens(50)["--r-3"]).toBe("3px")
    expect(cornerTokens(50)["--r-0"]).toBe("0px")
  })

  it("writes those literals onto an element at the default mix", () => {
    const set = new Map<string, string>()
    applyCornerMix({ style: { setProperty: (name, value) => set.set(name, value) } }, 50)
    expect(set.get("--radius")).toBe("0.75rem")
    expect(set.get("--r-2")).toBe("2px")
    expect(set.get("--corner-mix")).toBe("50.00")
  })

  it("rounds toward bouba and points toward kiki, passing through the snapshot", () => {
    expect(cornerRadiusPx("2px", 0)).toBe(2 + BOUBA_LIFT_PX)
    expect(cornerRadiusPx("2px", 50)).toBe(2)
    expect(cornerRadiusPx("2px", 100)).toBe(0)
    expect(cornerRadiusPx("0px", 0)).toBe(BOUBA_LIFT_PX)
    expect(cornerRadiusPx("0.75rem", 50)).toBe(12)
    expect(cornerTokens(0)["--r-2"]).toBe("14px")
    expect(cornerTokens(100)["--radius"]).toBe("0px")
  })

  it("leaves circles and pills out of the preset", () => {
    expect(CORNERS_LEFT_ALONE).toContain("50%")
    expect(CORNERS_LEFT_ALONE).toContain("999px")
    expect(Object.values(DEFAULT_CORNER_RADII).join(" ")).not.toContain("50%")
  })

  it("keeps the later 11px and 20px literals, and moves them at the poles", () => {
    expect(cornerTokens(50)["--r-11"]).toBe("11px")
    expect(cornerTokens(50)["--r-20px"]).toBe("20px")
    expect(cornerTokens(50)["--r-20"]).toBe("0.2rem")
    expect(cornerTokens(50)["--radius"]).toBe("0.75rem")
    expect(cornerRadiusPx("11px", 0)).toBe(23)
    expect(cornerRadiusPx("11px", 100)).toBe(0)
    expect(cornerRadiusPx("20px", 0)).toBe(32)
    expect(cornerRadiusPx("20px", 100)).toBe(0)
    expect(cornerTokens(0)["--r-1"]).toBe("13px")
    expect(cornerTokens(100)["--r-1"]).toBe("0px")
    expect(cornerTokens(0)["--r-10"]).toBe("22px")
    expect(cornerTokens(100)["--r-10"]).toBe("0px")
  })

  it("routes the corners the first census missed through those tokens", () => {
    const root = process.cwd()
    const swatch = readFileSync(join(root, "components/header-tracking/header-tracking.css"), "utf8")
    expect(swatch).toMatch(/\.htk-swatch\s*\{[^}]*border-radius:\s*var\(--r-1,\s*1px\)/)
    const grad = readFileSync(join(root, "components/Modules/workspace/gradsearch/styles.ts"), "utf8")
    expect(grad).toContain("border-radius: var(--r-11, 11px)")
    expect(grad).toContain("border-radius: var(--r-14, 14px)")
    expect(grad).toContain("border-radius: var(--r-20px, 20px)")
    expect(grad).not.toContain("--radius: 14px")
    expect(grad).toContain("border-radius: 50%")
    const tidy = readFileSync(join(root, "components/Modules/workspace/housecleaning/tidy.css"), "utf8")
    expect(tidy).toContain("border-radius:var(--r-10, 10px)")
    expect(tidy).not.toContain("--r:10px")
    const win = readFileSync(join(root, "app/win95.css"), "utf8")
    expect(win).toContain("--r-11: 11px")
    expect(win).toContain("--r-20px: 20px")
    expect(win).toContain("--r-20: 0.2rem")
    expect(win).toContain("body.win95-app .rounded-none")
  })
})
