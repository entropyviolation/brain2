import { describe, expect, it } from "vitest"
import { resolveDocHref } from "./code-docs-path"
import { docHeadingSlug, renderCodeDocMarkdown } from "./code-docs-render"

describe("code docs markdown", () => {
  it("slugs a heading the way docs links already do", () => {
    expect(docHeadingSlug("The screen stays pleasing")).toBe("the-screen-stays-pleasing")
  })

  it("keeps a relative link inside the reader and leaves the web alone", () => {
    const html = renderCodeDocMarkdown(
      "# The screen stays pleasing\n\nSee [style](DESIGN_STYLE.md#the-screen-stays-pleasing) and [web](https://example.com).\n\n![shot](screenshots/a.png)",
      "README.md",
    )
    expect(html).toContain('id="the-screen-stays-pleasing"')
    expect(html).toContain('data-doc-path="DESIGN_STYLE.md"')
    expect(html).toContain('data-doc-hash="#the-screen-stays-pleasing"')
    expect(html).toContain('href="https://example.com"')
    expect(html).toContain('src="/api/code-docs/raw/screenshots/a.png"')
    const outside = renderCodeDocMarkdown("[brand](../lib/app-brand.ts)", "README.md")
    expect(outside).toContain("data-doc-outside")
    expect(outside).not.toContain("../lib")
  })

  it("refuses a link that climbs out of docs", () => {
    expect(resolveDocHref("README.md", "../package.json")).toBeNull()
    expect(resolveDocHref("analytics/README.md", "../DESIGN_STYLE.md")?.kind).toBe("file")
  })

  it("renders a table", () => {
    const html = renderCodeDocMarkdown("| A | B |\n|---|---|\n| 1 | 2 |", "README.md")
    expect(html).toContain("<table>")
    expect(html).toContain("<td>1</td>")
  })
})
