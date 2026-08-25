import { describe, expect, it } from "vitest"
import {
  bodyToEditorHtml,
  escapeHtmlText,
  htmlWordCount,
  looksLikeHtml,
  sanitizeDocHtml,
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
})
