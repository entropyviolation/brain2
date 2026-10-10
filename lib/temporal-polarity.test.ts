import { describe, expect, it } from "vitest"
import {
  TEMPORAL_POLARITIES,
  TEMPORAL_POLARITY_HELP,
  TEMPORAL_POLARITY_LABEL,
  temporalAttr,
  type TemporalPolarity,
} from "@/lib/temporal-polarity"

describe("temporal-polarity", () => {
  it("labels and help cover every polarity", () => {
    for (const polarity of TEMPORAL_POLARITIES) {
      expect(TEMPORAL_POLARITY_LABEL[polarity].length).toBeGreaterThan(0)
      expect(TEMPORAL_POLARITY_HELP[polarity].length).toBeGreaterThan(0)
      expect(temporalAttr(polarity)).toBe(polarity)
    }
  })

  it("exposes exactly three polarities", () => {
    const keys = Object.keys(TEMPORAL_POLARITY_LABEL) as TemporalPolarity[]
    expect(keys.sort()).toEqual([...TEMPORAL_POLARITIES].sort())
  })
})
