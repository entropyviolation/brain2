/**
 * lib/pdf-to-html.test.ts — PDF run → HTML font mapping
 */
import { describe, expect, it } from "vitest"
import { pdfHeightToPx, pdfRunsToHtml } from "@/lib/pdf-to-html"
import { mapPdfFontToAllowed } from "@/lib/google-fonts"

describe("pdf font mapping", () => {
  it("maps common PDF PostScript names onto allow-listed families", () => {
    expect(mapPdfFontToAllowed("TimesNewRomanPS-BoldMT").family).toBe("Times New Roman")
    expect(mapPdfFontToAllowed("TimesNewRomanPS-BoldMT").bold).toBe(true)
    expect(mapPdfFontToAllowed("Helvetica-Oblique").family).toBe("Arial")
    expect(mapPdfFontToAllowed("Helvetica-Oblique").italic).toBe(true)
    expect(mapPdfFontToAllowed("Courier").family).toBe("Courier New")
    expect(mapPdfFontToAllowed("Georgia-BoldItalic").family).toBe("Georgia")
    expect(mapPdfFontToAllowed("Georgia-BoldItalic").bold).toBe(true)
    expect(mapPdfFontToAllowed("Georgia-BoldItalic").italic).toBe(true)
  })

  it("emits styled spans while keeping heading vs paragraph tags", () => {
    const { html, dominantFont } = pdfRunsToHtml([
      { str: "Title", x: 0, y: 200, h: 28, fontName: "TimesNewRomanPS-BoldMT" },
      { str: "Hello body", x: 0, y: 160, h: 12, fontName: "TimesNewRomanPSMT" },
      { str: "More body", x: 0, y: 140, h: 12, fontName: "TimesNewRomanPSMT" },
      { str: "Even more", x: 0, y: 120, h: 12, fontName: "TimesNewRomanPSMT" },
    ])
    expect(html).toContain("<h1>")
    expect(html).toContain("<p>")
    expect(html).toMatch(/font-family/)
    expect(html).toMatch(/Times New Roman/)
    expect(dominantFont).toBe("Times New Roman")
  })

  it("clamps converted PDF sizes", () => {
    expect(pdfHeightToPx(6)).toBe(10)
    expect(pdfHeightToPx(12)).toBe(16)
    expect(pdfHeightToPx(80)).toBe(48)
  })
})
