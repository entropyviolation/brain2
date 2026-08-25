import { describe, expect, it } from "vitest"
import {
  isPlainUrl,
  linkifyPlainText,
  normalizeHref,
  trailingUrlToLink,
  urlOnlyToAnchorHtml,
} from "@/lib/doc-links"

describe("doc-links", () => {
  it("detects plain URLs and bare domains", () => {
    expect(isPlainUrl("https://example.com/path")).toBe(true)
    expect(isPlainUrl("www.example.com")).toBe(true)
    expect(isPlainUrl("example.com")).toBe(true)
    expect(isPlainUrl("mailto:a@b.com")).toBe(true)
    expect(isPlainUrl("not a url")).toBe(false)
    expect(isPlainUrl("two words.com here")).toBe(false)
  })

  it("normalizes hrefs", () => {
    expect(normalizeHref("www.x.com")).toBe("https://www.x.com")
    expect(normalizeHref("example.com")).toBe("https://example.com")
    expect(normalizeHref("https://a.com")).toBe("https://a.com")
    expect(normalizeHref("mailto:a@b.com")).toBe("mailto:a@b.com")
  })

  it("builds an anchor for URL-only clipboard text", () => {
    const html = urlOnlyToAnchorHtml("https://example.com")
    expect(html).toContain('href="https://example.com"')
    expect(html).toContain(">https://example.com</a>")
    expect(urlOnlyToAnchorHtml("hello")).toBeNull()
  })

  it("uses optional display text when provided", () => {
    const html = urlOnlyToAnchorHtml("https://example.com", "Docs home")
    expect(html).toContain(">Docs home</a>")
  })

  it("linkifies URLs inside plain text", () => {
    const html = linkifyPlainText("See www.example.com please")
    expect(html).toContain('href="https://www.example.com"')
    expect(html).toContain("See ")
    expect(html).toContain(" please")
  })

  it("detects trailing typed URLs for auto-linkify", () => {
    expect(trailingUrlToLink("https://x.com")).toEqual({
      href: "https://x.com",
      coreLength: "https://x.com".length,
      label: "https://x.com",
    })
    expect(trailingUrlToLink("example.com.")).toMatchObject({
      href: "https://example.com",
      coreLength: "example.com".length,
    })
    expect(trailingUrlToLink("not-a-url")).toBeNull()
  })
})
