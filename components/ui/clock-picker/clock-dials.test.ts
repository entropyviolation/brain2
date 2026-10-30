import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import manifest from "./backgrounds/manifest.json"
import { clockDials, loadDial } from "./clock-dials"

describe("clock dials", () => {
  it("does not statically import the paintings", () => {
    const source = readFileSync(path.resolve("components/ui/clock-picker/clock-dials.ts"), "utf8")
    expect(source).not.toMatch(/^import \w+ from ["'][^"']+\.png["']/m)
  })

  it("lists every manifest dial before any image has loaded", () => {
    const dials = clockDials()
    expect(dials.map((dial) => dial.id)).toEqual(manifest.map((entry) => entry.id))
    expect(dials.find((dial) => dial.id === "ceramic")?.placement).toBe("face")
    expect(dials.find((dial) => dial.id === "winged-kitten")?.placement).toBe("center")
    expect(dials.find((dial) => dial.id === "winged-kitten")?.src ?? "").toBe("")
  })

  it("loads only the dial that was asked for", async () => {
    const src = await loadDial("ceramic")
    expect(src).toEqual(expect.any(String))
    expect(src!.length).toBeGreaterThan(0)
    const dials = clockDials()
    expect(dials.find((dial) => dial.id === "ceramic")?.src).toBe(src)
    expect(dials.find((dial) => dial.id === "winged-kitten")?.src ?? "").toBe("")
    expect(await loadDial("missing")).toBeNull()
    expect(await loadDial("ceramic")).toBe(src)
  })
})
