import { describe, expect, it } from "vitest"
import {
  CHROME_COOL,
  CHROME_FACE_CLASSIC,
  CHROME_FACE_SWATCHES,
  CHROME_INK,
  CHROME_NEUTRAL_STOPS,
  DEFAULT_CHROME_TOKENS,
  applyChromePatina,
  chromaSpan,
  chromeFaceRgb,
  chromePatinaTokens,
  clampChromeFaceSetpoint,
  contrastRatio,
  grayHex,
  isBrownish,
} from "./chrome-patina"

const WARM_HABITS_FACE = "#c5c3bc"
/** Retired warmth endpoints. The path must not use these as poles. */
const RETIRED_WARM = [204, 188, 172]
const RETIRED_COOL = [172, 188, 204]

const REQUIRED_FACES = ["#c0c0c0", "#c0bfba", "#999686", "#b7bcbf", "#999683", "#9a9889", "#c0c1b9", "#b8bbc0"]

describe("warmth swatches", () => {
  it("maps 50 to the stored classic palette", () => {
    expect(chromeFaceRgb(50)).toEqual([CHROME_FACE_CLASSIC, CHROME_FACE_CLASSIC, CHROME_FACE_CLASSIC])
    expect(grayHex(CHROME_FACE_CLASSIC)).toBe(CHROME_COOL.face)
    const tokens = chromePatinaTokens(50)
    expect(tokens["--chrome-face"]).toBe("#c0c0c0")
    expect(tokens["--chrome-mid"]).toBe(CHROME_COOL.mid)
    expect(tokens["--chrome-lo"]).toBe(CHROME_COOL.lo)
    expect(tokens["--chrome-brush"]).toBe(CHROME_COOL.brush)
    expect(tokens["--chrome-hi"]).toBe("#ffffff")
    expect(tokens["--chrome-frame"]).toBe("#0a0a0a")
    for (const [token, rgb] of Object.entries(CHROME_NEUTRAL_STOPS)) {
      const hex = `#${rgb.map((n) => n.toString(16).padStart(2, "0")).join("")}`
      expect(tokens[token as keyof typeof tokens]).toBe(hex)
      expect(DEFAULT_CHROME_TOKENS[token as keyof typeof DEFAULT_CHROME_TOKENS]).toBe(hex)
    }
    expect(tokens["--chrome-sheen"]).toBe("#d4d8dc")
    expect(tokens["--chrome-shade"]).toBe("#969a9e")
  })

  it("hits the documented design-ref faces and leaves the retired red/blue endpoints", () => {
    const faces = CHROME_FACE_SWATCHES.map((swatch) => swatch.face)
    for (const hex of REQUIRED_FACES) expect(faces).toContain(hex)
    const byMix = Object.fromEntries(CHROME_FACE_SWATCHES.map((swatch) => [swatch.mix, swatch.face]))
    expect(byMix[0]).toBe("#999683")
    expect(byMix[8]).toBe("#999686")
    expect(byMix[16]).toBe("#9a9889")
    expect(byMix[32]).toBe("#c0c1b9")
    expect(byMix[40]).toBe("#c0bfba")
    expect(byMix[50]).toBe("#c0c0c0")
    expect(byMix[75]).toBe("#b7bcbf")
    expect(byMix[100]).toBe("#b8bbc0")
    for (const mix of Object.keys(byMix).map(Number)) {
      expect(chromePatinaTokens(mix)["--chrome-face"]).toBe(byMix[mix])
    }
    expect(chromeFaceRgb(0)).not.toEqual(RETIRED_WARM)
    expect(chromeFaceRgb(100)).not.toEqual(RETIRED_COOL)
    expect(chromeFaceRgb(0)).toEqual([0x99, 0x96, 0x83])
    expect(chromeFaceRgb(100)).toEqual([0xb8, 0xbb, 0xc0])
    expect(faces).not.toContain("#ccbcac")
    expect(faces).not.toContain("#acbccc")
    expect(faces).not.toContain(WARM_HABITS_FACE)
    expect(isBrownish(WARM_HABITS_FACE)).toBe(true)
  })

  it("walks only from one documented face to the next", () => {
    const knots = [...CHROME_FACE_SWATCHES].sort((a, b) => a.mix - b.mix)
    for (let i = 0; i < knots.length - 1; i++) {
      const from = knots[i]
      const to = knots[i + 1]
      const mid = (from.mix + to.mix) / 2
      const face = chromePatinaTokens(mid)["--chrome-face"]
      const [ar, ag, ab] = from.face.slice(1).match(/../g)!.map((h) => parseInt(h, 16))
      const [br, bg, bb] = to.face.slice(1).match(/../g)!.map((h) => parseInt(h, 16))
      const [r, g, b] = face.slice(1).match(/../g)!.map((h) => parseInt(h, 16))
      expect(r).toBeGreaterThanOrEqual(Math.min(ar, br) - 1)
      expect(r).toBeLessThanOrEqual(Math.max(ar, br) + 1)
      expect(g).toBeGreaterThanOrEqual(Math.min(ag, bg) - 1)
      expect(g).toBeLessThanOrEqual(Math.max(ag, bg) + 1)
      expect(b).toBeGreaterThanOrEqual(Math.min(ab, bb) - 1)
      expect(b).toBeLessThanOrEqual(Math.max(ab, bb) + 1)
      expect(face).not.toBe("#ccbcac")
      expect(face).not.toBe("#acbccc")
    }
  })

  it("gives each pole the companions of that swatch", () => {
    const olive = chromePatinaTokens(0)
    const classic = chromePatinaTokens(50)
    const cool = chromePatinaTokens(100)
    expect(olive["--chrome-sheen"]).toBe("#b9b6a3")
    expect(olive["--chrome-shade"]).toBe("#5c5948")
    expect(olive["--chrome-hi"]).toBe("#c6c3b0")
    expect(cool["--chrome-sheen"]).toBe("#c2c3c5")
    expect(cool["--chrome-hi"]).toBe("#f1f0f5")
    expect(olive["--chrome-sheen"]).not.toBe(classic["--chrome-sheen"])
    expect(cool["--chrome-sheen"]).not.toBe(classic["--chrome-sheen"])
    expect(olive["--chrome-ink-soft"]).toBe("#404040")
    expect(cool["--chrome-ink-deep"]).toBe("#3a3a3a")
  })

  it("clamps non-finite and out-of-range warmth", () => {
    expect(clampChromeFaceSetpoint(Number.NaN)).toBe(50)
    expect(clampChromeFaceSetpoint(-20)).toBe(0)
    expect(clampChromeFaceSetpoint(140)).toBe(100)
  })
})

describe("readable metal", () => {
  it("keeps ink readable on every documented face", () => {
    for (const swatch of CHROME_FACE_SWATCHES) {
      expect(contrastRatio(CHROME_INK, swatch.face)).toBeGreaterThan(7)
    }
  })

  it("keeps highlight and shadow in family at the poles and at classic", () => {
    for (const position of [0, 50, 100]) {
      const tokens = chromePatinaTokens(position)
      expect(contrastRatio(tokens["--chrome-hi"], tokens["--chrome-lo"])).toBeGreaterThan(2.4)
      expect(contrastRatio(tokens["--chrome-mid"], tokens["--chrome-lo"])).toBeGreaterThan(1.8)
    }
  })

  it("keeps classic chroma at zero and gives the olive pole a visible span", () => {
    expect(chromaSpan(chromePatinaTokens(50)["--chrome-face"])).toBe(0)
    expect(chromaSpan(chromePatinaTokens(0)["--chrome-face"])).toBeGreaterThan(8)
    expect(chromaSpan(chromePatinaTokens(100)["--chrome-face"])).toBeGreaterThan(0)
  })
})

describe("applyChromePatina", () => {
  it("writes the stored default family onto one element", () => {
    const set = new Map<string, string>()
    applyChromePatina({ style: { setProperty: (name, value) => set.set(name, value) } }, 50)
    expect(set.get("--chrome-set")).toBe("50.0")
    expect(set.get("--chrome-face")).toBe(CHROME_COOL.face)
    expect(set.get("--chrome-hi")).toBe(CHROME_COOL.hi)
    expect(set.get("--chrome-live")).toBe("50.0")
    expect(set.get("--chrome-mix")).toBe("0.0000")
    expect(set.get("--chrome-sheen")).toBe("#d4d8dc")
  })

  it("moves the live face onto the olive swatch at the warm pole", () => {
    const rest = chromePatinaTokens(50)
    const warm = chromePatinaTokens(0)
    expect(rest["--chrome-face"]).toBe("#c0c0c0")
    expect(warm["--chrome-face"]).toBe("#999683")
    expect(warm["--chrome-mid"]).not.toBe(rest["--chrome-mid"])
    expect(warm["--chrome-brush"]).not.toBe(rest["--chrome-brush"])
  })
})
