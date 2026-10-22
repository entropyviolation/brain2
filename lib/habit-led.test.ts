import { describe, expect, it } from "vitest"
import {
  DEFAULT_PERCENT_LED_TINT,
  PERCENT_LED_TINT_STORAGE_KEY,
  booleanLampState,
  percentBarLitCount,
  percentLedText,
  readStoredPercentLedTint,
  sanitizePercentLedTint,
  writeStoredPercentLedTint,
} from "./habit-led"

describe("habit-led", () => {
  it("keeps percent text on the same rounded % as the old bars", () => {
    expect(percentLedText(0)).toBe("0%")
    expect(percentLedText(46.4)).toBe("46%")
    expect(percentLedText(46.6)).toBe("47%")
    expect(percentLedText(100)).toBe("100%")
  })

  it("sanitizes hex tints and falls back to the instrument green", () => {
    expect(sanitizePercentLedTint("#AABBCC")).toBe("#aabbcc")
    expect(sanitizePercentLedTint("lime")).toBe(DEFAULT_PERCENT_LED_TINT)
    expect(sanitizePercentLedTint(null)).toBe(DEFAULT_PERCENT_LED_TINT)
  })

  it("reads the retired LED purple as the dusty violet default", () => {
    expect(sanitizePercentLedTint("#7E14FF")).toBe(DEFAULT_PERCENT_LED_TINT)
    localStorage.setItem(PERCENT_LED_TINT_STORAGE_KEY, "#7e14ff")
    expect(readStoredPercentLedTint()).toBe(DEFAULT_PERCENT_LED_TINT)
    localStorage.removeItem(PERCENT_LED_TINT_STORAGE_KEY)
  })

  it("pins a sanitized hex so refresh can re-read it", () => {
    writeStoredPercentLedTint("#AA33CC")
    expect(localStorage.getItem(PERCENT_LED_TINT_STORAGE_KEY)).toBe("#aa33cc")
    writeStoredPercentLedTint("#00cc88")
    expect(localStorage.getItem(PERCENT_LED_TINT_STORAGE_KEY)).toBe("#00cc88")
    localStorage.removeItem(PERCENT_LED_TINT_STORAGE_KEY)
  })

  it("lights one loading-bar lamp per 10%", () => {
    expect(percentBarLitCount(0)).toBe(0)
    expect(percentBarLitCount(50)).toBe(5)
    expect(percentBarLitCount(46)).toBe(5)
    expect(percentBarLitCount(100)).toBe(10)
    expect(percentBarLitCount(-4)).toBe(0)
  })

  it("maps boolean completion to lamp states", () => {
    expect(booleanLampState(false)).toBe("off")
    expect(booleanLampState(true)).toBe("on")
    expect(booleanLampState(false, 0.4)).toBe("partial")
    expect(booleanLampState(undefined, 0)).toBe("off")
  })
})
