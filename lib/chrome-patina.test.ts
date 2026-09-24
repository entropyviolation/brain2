import { describe, expect, it } from "vitest"
import {
  CHROME_COOL,
  CHROME_DRIFT_AMPLITUDE,
  CHROME_DRIFT_PERIOD_MS,
  CHROME_FACE_CLASSIC,
  CHROME_FACE_DEFAULT_SETPOINT,
  CHROME_FACE_MAX,
  CHROME_FACE_MIN,
  CHROME_INK,
  applyChromePatina,
  chromaSpan,
  chromeFaceDisplayedLevel,
  chromeFaceLevelFromSetpoint,
  chromePatinaDrift,
  chromePatinaTokens,
  clampChromeFaceSetpoint,
  contrastRatio,
  grayHex,
  isBrownish,
} from "./chrome-patina"

const WARM_HABITS_FACE = "#c5c3bc"

function everySetpointAndClock(fn: (setpoint: number, now: number) => void) {
  for (const setpoint of [0, 25, 50, 75, 100]) {
    for (let i = 0; i < 48; i++) {
      fn(setpoint, (i / 48) * CHROME_DRIFT_PERIOD_MS)
    }
  }
}

describe("chrome face set-point", () => {
  it("maps 50 to classic Win95 #c0c0c0", () => {
    expect(chromeFaceLevelFromSetpoint(CHROME_FACE_DEFAULT_SETPOINT)).toBe(CHROME_FACE_CLASSIC)
    expect(grayHex(CHROME_FACE_CLASSIC)).toBe(CHROME_COOL.face)
  })

  it("clamps non-finite and out-of-range set-points", () => {
    expect(clampChromeFaceSetpoint(Number.NaN)).toBe(50)
    expect(clampChromeFaceSetpoint(-20)).toBe(0)
    expect(clampChromeFaceSetpoint(140)).toBe(100)
  })

  it("stays inside the gunmetal band", () => {
    expect(chromeFaceLevelFromSetpoint(0)).toBe(CHROME_FACE_MIN)
    expect(chromeFaceLevelFromSetpoint(100)).toBe(CHROME_FACE_MAX)
  })
})

describe("living-metal drift", () => {
  it("is a slow sine, not a flicker", () => {
    const a = chromeFaceDisplayedLevel(50, 0)
    const oneMinute = chromeFaceDisplayedLevel(50, 60 * 1000)
    const quarter = chromeFaceDisplayedLevel(50, CHROME_DRIFT_PERIOD_MS / 4)
    expect(Math.abs(oneMinute - a)).toBeLessThan(2)
    expect(Math.abs(quarter - a)).toBeGreaterThan(3)
    expect(Math.abs(quarter - a)).toBeLessThanOrEqual(CHROME_DRIFT_AMPLITUDE + 0.001)
  })

  it("returns to the set-point every period", () => {
    const a = chromePatinaDrift(0)
    const b = chromePatinaDrift(CHROME_DRIFT_PERIOD_MS)
    expect(b).toBeCloseTo(a, 8)
    expect(chromeFaceDisplayedLevel(50, 0)).toBeCloseTo(CHROME_FACE_CLASSIC, 5)
  })

  it("uses a minutes-scale period", () => {
    expect(CHROME_DRIFT_PERIOD_MS).toBeGreaterThanOrEqual(10 * 60 * 1000)
    expect(CHROME_DRIFT_PERIOD_MS).toBeLessThanOrEqual(60 * 60 * 1000)
  })
})

describe("never brown", () => {
  it("rejects the old Habits warm pole", () => {
    expect(isBrownish(WARM_HABITS_FACE)).toBe(true)
    expect(chromaSpan(WARM_HABITS_FACE)).toBeGreaterThan(2)
  })

  it("keeps every live face true gray (chroma ~ 0, never brown)", () => {
    everySetpointAndClock((setpoint, now) => {
      const tokens = chromePatinaTokens(setpoint, now)
      for (const hex of [tokens["--chrome-face"], tokens["--chrome-mid"], tokens["--chrome-lo"], tokens["--chrome-brush"]]) {
        expect(isBrownish(hex)).toBe(false)
        expect(chromaSpan(hex)).toBeLessThanOrEqual(1)
      }
      expect(tokens["--chrome-hi"]).toBe("#ffffff")
    })
  })

  it("keeps ink readable on the face across the band", () => {
    for (const setpoint of [0, 50, 100]) {
      const face = chromePatinaTokens(setpoint, 0)["--chrome-face"]
      expect(contrastRatio(CHROME_INK, face)).toBeGreaterThan(7)
    }
  })

  it("keeps highlight/shadow bevel contrast in family", () => {
    for (const setpoint of [0, 50, 100]) {
      const tokens = chromePatinaTokens(setpoint, CHROME_DRIFT_PERIOD_MS / 4)
      expect(contrastRatio(tokens["--chrome-hi"], tokens["--chrome-lo"])).toBeGreaterThan(2.4)
      expect(contrastRatio(tokens["--chrome-mid"], tokens["--chrome-lo"])).toBeGreaterThan(1.8)
    }
  })
})

describe("applyChromePatina", () => {
  it("writes set-point, live, and the gray family onto one element", () => {
    const set = new Map<string, string>()
    applyChromePatina({ style: { setProperty: (name, value) => set.set(name, value) } }, 50, 0)
    expect(set.get("--chrome-set")).toBe("50.0")
    expect(set.get("--chrome-face")).toBe(CHROME_COOL.face)
    expect(set.get("--chrome-hi")).toBe(CHROME_COOL.hi)
    expect(set.get("--chrome-live")).toBeTruthy()
    expect(set.get("--chrome-mix")).toBeTruthy()
  })

  it("moves the live token off the set-point at peak drift", () => {
    const rest = chromePatinaTokens(50, 0)
    const peak = chromePatinaTokens(50, CHROME_DRIFT_PERIOD_MS / 4)
    expect(rest["--chrome-face"]).toBe("#c0c0c0")
    expect(peak["--chrome-face"]).not.toBe(rest["--chrome-face"])
    expect(peak["--chrome-live"]).not.toBe(rest["--chrome-set"])
    expect(isBrownish(peak["--chrome-face"])).toBe(false)
  })
})
