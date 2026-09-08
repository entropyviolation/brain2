import { describe, expect, it } from "vitest"
import {
  bodyToEditorHtml,
  escapeHtmlText,
  htmlWordCount,
  looksLikeHtml,
  sanitizeDocHtml,
  applyInlineStyleToSelection,
  documentPreviewText,
} from "@/lib/doc-html"

describe("doc-html", () => {
  it("detects HTML vs markdown", () => {
    expect(looksLikeHtml("<p>Hi</p>")).toBe(true)
    expect(looksLikeHtml("# Title")).toBe(false)
  })

  it("converts legacy markdown bodies to HTML", () => {
    const html = bodyToEditorHtml("# Hello\n\n- one\n- two")
    expect(html).toContain("<h1>")
    expect(html).toContain("<ul>")
    expect(html).toContain("<li>")
  })

  it("passes through HTML bodies sanitized", () => {
    const html = bodyToEditorHtml('<p onclick="alert(1)">Hi<script>x</script></p>')
    expect(html).toContain("Hi")
    expect(html).not.toContain("onclick")
    expect(html).not.toContain("<script")
  })

  it("keeps safe images and strips dangerous src", () => {
    const ok = sanitizeDocHtml('<img src="data:image/png;base64,abc" alt="a" />')
    expect(ok).toContain("data:image/png")
    const bad = sanitizeDocHtml('<img src="javascript:alert(1)" />')
    expect(bad).not.toContain("javascript:")
  })

  it("counts words and escapes text", () => {
    expect(htmlWordCount("<p>one two</p>")).toBe(2)
    expect(escapeHtmlText(`<a & "b">`)).toContain("&lt;")
  })

  it("keeps image width attributes", () => {
    const html = sanitizeDocHtml('<img src="data:image/png;base64,abc" width="320" alt="a" />')
    expect(html).toContain("width")
  })

  it("builds a truncated plain-text preview", () => {
    expect(documentPreviewText("<h1>Hello</h1><p>world</p>")).toBe("Hello world")
    expect(documentPreviewText("<p>abcdefghij</p>", 6)).toBe("abcdef…")
  })

  it("applies font to mixed heading and paragraph blocks without changing tags", () => {
    const root = document.createElement("div")
    document.body.appendChild(root)
    root.innerHTML = "<h1>Title</h1><p>Body text</p><h2>Sub</h2>"
    const h1 = root.querySelector("h1")!
    const h2 = root.querySelector("h2")!
    const range = document.createRange()
    range.setStart(h1.firstChild!, 0)
    range.setEnd(h2.firstChild!, 3)
    const sel = window.getSelection()!
    sel.removeAllRanges()
    sel.addRange(range)

    const ok = applyInlineStyleToSelection({ fontFamily: '"Roboto", sans-serif' })
    expect(ok).toBe(true)
    expect(root.querySelector("h1")?.tagName).toBe("H1")
    expect(root.querySelector("p")?.tagName).toBe("P")
    expect(root.querySelector("h2")?.tagName).toBe("H2")
    expect(root.querySelector("h1")?.innerHTML).toMatch(/font-family/i)
    expect(root.querySelector("p")?.innerHTML).toMatch(/font-family/i)
    expect(root.querySelector("h2")?.innerHTML).toMatch(/font-family/i)
    expect(root.querySelector("h1")?.textContent).toBe("Title")
    expect(root.querySelector("p")?.textContent).toBe("Body text")
    document.body.removeChild(root)
  })
})
