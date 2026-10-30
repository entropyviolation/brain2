/**
 * Spine color and which face receives the cover. No WebGL.
 */
import { describe, expect, it } from "vitest"
import { hexToRgb, rgbToHex, sampleCoverColor, spineKind, spineTones, surfaceTakesCoverArt } from "./shelf-spine"

function pixels(width: number, height: number, fill: (x: number, y: number) => [number, number, number, number]): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = fill(x, y)
      const i = (y * width + x) * 4
      data[i] = r
      data[i + 1] = g
      data[i + 2] = b
      data[i + 3] = a
    }
  }
  return data
}

describe("shelf spine", () => {
  it("puts the cover photograph on the front only", () => {
    expect(surfaceTakesCoverArt("front")).toBe(true)
    for (const surface of ["spine", "back", "pages", "board"] as const) {
      expect(surfaceTakesCoverArt(surface)).toBe(false)
    }
  })

  it("picks cloth, paper, or leather from the book seed", () => {
    expect(spineKind(0)).toBe("cloth")
    expect(spineKind(1)).toBe("paper")
    expect(spineKind(2)).toBe("leather")
    expect(spineKind(3)).toBe("cloth")
  })

  it("samples a solid cover and a picture inside a white margin", () => {
    expect(sampleCoverColor(new Uint8ClampedArray(0), 0, 0)).toBeNull()
    const solid = sampleCoverColor(pixels(4, 4, () => [200, 32, 40, 255]), 4, 4)
    expect(solid).toEqual({ r: 200, g: 32, b: 40 })

    const framed = sampleCoverColor(
      pixels(10, 10, (x, y) => (x >= 2 && x <= 7 && y >= 2 && y <= 7 ? [0, 160, 40, 255] : [250, 250, 250, 255])),
      10,
      10,
    )
    expect(framed).not.toBeNull()
    expect(framed!.g).toBeGreaterThan(framed!.r)
    expect(framed!.g).toBeGreaterThan(framed!.b)
    expect(framed!.g).toBeGreaterThan(80)
  })

  it("keeps a spine in the cover's color, with a different band and readable ink", () => {
    const red = spineTones({ r: 180, g: 42, b: 48 })
    expect(red.cloth).toBe(rgbToHex({ r: 180, g: 42, b: 48 }))
    expect(red.band).not.toBe(red.cloth)
    const shade = hexToRgb(red.shade)
    const band = hexToRgb(red.band)
    expect(shade.r).toBeGreaterThan(shade.g)
    expect(shade.r).toBeGreaterThan(shade.b)
    expect(band.r).toBeGreaterThan(band.g)
    expect(band.r).toBeGreaterThan(band.b)
    expect(red.ink).toBe("#f4ecdf")

    const pale = spineTones({ r: 220, g: 210, b: 190 })
    expect(pale.ink).toBe("#2a2118")
    expect(hexToRgb(pale.cloth).r).toBeGreaterThan(hexToRgb(pale.shade).r)
  })
})
