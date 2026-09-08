import { describe, expect, it } from "vitest"
import {
  GOOGLE_FONTS,
  extractFontMarkers,
  fontFamilyCss,
  googleFontsStylesheetUrl,
  isAllowedFont,
} from "@/lib/google-fonts"

describe("google-fonts", () => {
  it("allow-lists curated families only", () => {
    expect(isAllowedFont("Roboto")).toBe(true)
    expect(isAllowedFont("Times New Roman")).toBe(true)
    expect(isAllowedFont("Not A Real Font")).toBe(false)
    expect(GOOGLE_FONTS.length).toBeGreaterThan(20)
  })

  it("builds a Google Fonts CSS2 URL for web fonts", () => {
    const url = googleFontsStylesheetUrl(["Roboto", "Arial", "Evil"])
    expect(url).toContain("fonts.googleapis.com/css2?")
    expect(url).toContain("Roboto")
    expect(url).not.toContain("Arial")
    expect(url).not.toContain("Evil")
  })

  it("returns null when only system fonts are requested", () => {
    expect(googleFontsStylesheetUrl(["Arial"])).toBeNull()
    expect(googleFontsStylesheetUrl(["Times New Roman", "Courier New"])).toBeNull()
  })

  it("extracts font markers from markdown", () => {
    expect(extractFontMarkers("Hello {font:Lora}world{/font} and {font:Bogus}x{/font}")).toEqual([
      "Lora",
    ])
  })

  it("returns a CSS font-family stack", () => {
    expect(fontFamilyCss("Merriweather")).toContain("Merriweather")
    expect(fontFamilyCss("nope")).toContain("Tahoma")
  })
})
