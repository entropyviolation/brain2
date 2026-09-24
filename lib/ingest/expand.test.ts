import { describe, it, expect } from "vitest"
import {
  expandIngestText,
  remapRetiredGroceryExpansion,
  remapRetiredGroceryShortcuts,
  sanitizeShortcutAlias,
} from "./expand"

describe("expandIngestText", () => {
  it("rewrites one-letter location / habit / day notes", () => {
    expect(expandIngestText("w gym", {})).toBe("at: gym")
    expect(expandIngestText("w", {})).toBe("where")
    expect(expandIngestText("h stretch", {})).toBe("habit: stretch")
    expect(expandIngestText("h", {})).toBe("help")
    expect(expandIngestText("day: tired", {})).toBe("n day: tired")
    expect(expandIngestText("day", {})).toBe("today")
    expect(expandIngestText("tt work", {})).toBe("track: work")
  })

  it("applies custom first-token shortcuts", () => {
    expect(expandIngestText("store", { store: "groc" })).toBe("groc")
    expect(expandIngestText("store milk", { store: "groc" })).toBe("groc milk")
    expect(expandIngestText("home", { home: "at: home" })).toBe("at: home")
  })

  it("remaps legacy custom shortcuts that still expand to bare g", () => {
    expect(expandIngestText("store", { store: "g" })).toBe("groc")
    expect(expandIngestText("store milk", { store: "g" })).toBe("groc milk")
    expect(expandIngestText("shop", { shop: "g milk" })).toBe("groc milk")
  })

  it("rejects numeric shortcut aliases", () => {
    expect(sanitizeShortcutAlias("1")).toBeNull()
    expect(sanitizeShortcutAlias("store")).toBe("store")
  })
})

describe("remapRetiredGroceryExpansion", () => {
  it("rewrites bare g and g-with-payload, not gps/got/grocery", () => {
    expect(remapRetiredGroceryExpansion("g")).toBe("groc")
    expect(remapRetiredGroceryExpansion("g milk")).toBe("groc milk")
    expect(remapRetiredGroceryExpansion("g: eggs")).toBe("groc: eggs")
    expect(remapRetiredGroceryExpansion("gps: Home")).toBe("gps: Home")
    expect(remapRetiredGroceryExpansion("got milk")).toBe("got milk")
    expect(remapRetiredGroceryExpansion("grocery")).toBe("grocery")
    expect(remapRetiredGroceryExpansion("groc")).toBe("groc")
  })

  it("rewrites a shortcuts map in place of retired values", () => {
    expect(remapRetiredGroceryShortcuts({ store: "g", home: "at: home" })).toEqual({
      store: "groc",
      home: "at: home",
    })
  })
})
