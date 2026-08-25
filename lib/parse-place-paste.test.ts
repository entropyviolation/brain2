import { describe, it, expect } from "vitest"
import { parsePlacePasteLine, parsePlacePasteBlock } from "./parse-place-paste"

describe("parsePlacePasteLine", () => {
  it("splits em-dash name — address", () => {
    const p = parsePlacePasteLine(
      "Mayta — Av. Mariscal La Mar 1285, Miraflores 15027, Lima, Peru",
    )
    expect(p.name).toBe("Mayta")
    expect(p.address).toMatch(/Mariscal La Mar/)
  })

  it("handles en-dash and hyphen", () => {
    expect(parsePlacePasteLine("Cosme – Av. Tudela 160").name).toBe("Cosme")
    expect(parsePlacePasteLine("CLON - Av. Grau 203A").address).toMatch(/Grau/)
  })

  it("keeps plain names", () => {
    expect(parsePlacePasteLine("Belém Tower")).toEqual({
      name: "Belém Tower",
      raw: "Belém Tower",
    })
  })
})

describe("parsePlacePasteBlock", () => {
  it("parses a restaurant list", () => {
    const block = `Mayta — Av. Mariscal La Mar 1285, Miraflores 15027, Lima, Peru
Shizen Restaurante Nikkei — Av. Los Conquistadores 999, San Isidro 15074, Lima, Peru
Demo — Jirón Domeyer 282, Barranco 15063, Lima, Peru`
    const rows = parsePlacePasteBlock(block)
    expect(rows).toHaveLength(3)
    expect(rows.map((r) => r.name)).toEqual([
      "Mayta",
      "Shizen Restaurante Nikkei",
      "Demo",
    ])
  })
})
