import { describe, expect, it } from "vitest"
import {
  CHINESE_LENS_LINE,
  CLINICAL_EDUCATION_LINE,
  CYCLE_LENSES,
  CYCLE_PHASES,
  ESOTERIC_LENS_LINE,
  cycleLensParagraphs,
} from "./cycle-lens-copy"

describe("cycle lens copy", () => {
  it("gives every phase all three lenses, with real length", () => {
    expect(CYCLE_LENSES.map((lens) => lens.label)).toEqual(["Clinical", "Chinese medicine", "Esoteric"])
    const chinese: string[] = []
    for (const phase of CYCLE_PHASES) {
      for (const lens of CYCLE_LENSES) {
        const paragraphs = cycleLensParagraphs(phase, lens.id)
        const text = paragraphs.join("\n")
        expect(paragraphs.length).toBeGreaterThan(0)
        if (phase === "unknown") {
          expect(text.toLowerCase()).toContain("does not have enough bleed history")
          expect(text.length).toBeGreaterThan(80)
        } else {
          expect(paragraphs.length).toBeGreaterThanOrEqual(3)
          expect(text.length).toBeGreaterThan(500)
        }
        if (lens.id === "chinese") chinese.push(text)
      }
    }
    const tradition = chinese.join("\n")
    expect(tradition).toContain("Blood")
    expect(tradition).toContain("Kidney yin")
    expect(tradition).toContain("Kidney yang")
    expect(tradition).toContain("Liver qi")
    expect(tradition).toContain("pen qi")
    expect(CLINICAL_EDUCATION_LINE).toMatch(/not a diagnosis/)
    expect(CLINICAL_EDUCATION_LINE).toMatch(/fertility guarantee/)
    expect(CHINESE_LENS_LINE).toMatch(/Not a prescription/)
    expect(ESOTERIC_LENS_LINE).toMatch(/not a scientific claim/)
    const all = JSON.stringify({ tradition, CLINICAL_EDUCATION_LINE, ESOTERIC_LENS_LINE }).toLowerCase()
    expect(all).not.toMatch(/orgasm|intercourse|sexual/)
  })
})
