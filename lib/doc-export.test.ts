/**
 * lib/doc-export.test.ts — printable HTML for Save as PDF
 */
import { describe, expect, it } from "vitest"
import { buildPrintableDocumentHtml, fontsUsedInHtml } from "@/lib/doc-export"

describe("doc-export", () => {
  it("extracts allow-listed fonts from inline styles", () => {
    expect(fontsUsedInHtml(`<span style="font-family: Roboto, sans-serif">x</span>`)).toEqual(["Roboto"])
    expect(fontsUsedInHtml(`<span style="font-family: Comic Sans">x</span>`)).toEqual([])
  })

  it("builds a printable document with the title and body", () => {
    const html = buildPrintableDocumentHtml({
      title: "Q3 <plan>",
      html: "<h1>Hello</h1>",
      font: "Merriweather",
    })
    expect(html).toContain("Q3 &lt;plan&gt;")
    expect(html).toContain("<h1>Hello</h1>")
    expect(html).toContain("Merriweather")
    expect(html).toContain("@page")
  })
})
