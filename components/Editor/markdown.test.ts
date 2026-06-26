import { describe, it, expect } from "vitest"
import {
  renderMarkdown,
  escapeHtml,
  applyInlineWrap,
  applyLinePrefix,
  applyInsert,
} from "./markdown"

describe("escapeHtml", () => {
  it("escapes the five significant characters", () => {
    expect(escapeHtml(`<a href="x" onclick='y'>&`)).toBe(
      "&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;",
    )
  })
})

describe("renderMarkdown — blocks", () => {
  it("returns empty string for empty/whitespace input", () => {
    expect(renderMarkdown("")).toBe("")
    expect(renderMarkdown("   \n  ")).toBe("")
  })

  it("renders ATX headings at the right level", () => {
    expect(renderMarkdown("# Title")).toBe("<h1>Title</h1>")
    expect(renderMarkdown("### Deep")).toBe("<h3>Deep</h3>")
  })

  it("renders paragraphs joining soft-wrapped lines with <br />", () => {
    expect(renderMarkdown("one\ntwo")).toBe("<p>one<br />two</p>")
  })

  it("separates paragraphs on a blank line", () => {
    expect(renderMarkdown("a\n\nb")).toBe("<p>a</p>\n<p>b</p>")
  })

  it("renders unordered lists", () => {
    expect(renderMarkdown("- a\n- b")).toBe("<ul>\n<li>a</li>\n<li>b</li>\n</ul>")
  })

  it("renders ordered lists", () => {
    expect(renderMarkdown("1. a\n2. b")).toBe("<ol>\n<li>a</li>\n<li>b</li>\n</ol>")
  })

  it("renders blockquotes", () => {
    expect(renderMarkdown("> quoted")).toBe("<blockquote>quoted</blockquote>")
  })

  it("renders horizontal rules", () => {
    expect(renderMarkdown("---")).toBe("<hr />")
  })

  it("renders fenced code blocks without inline processing or markup injection", () => {
    expect(renderMarkdown("```\n**not bold** <b>\n```")).toBe(
      "<pre><code>**not bold** &lt;b&gt;</code></pre>",
    )
  })
})

describe("renderMarkdown — inline + safety", () => {
  it("renders bold and italic", () => {
    expect(renderMarkdown("**b** and *i*")).toBe("<p><strong>b</strong> and <em>i</em></p>")
  })

  it("renders inline code and protects it from emphasis", () => {
    expect(renderMarkdown("`a*b*c`")).toBe("<p><code>a*b*c</code></p>")
  })

  it("renders safe links and neutralizes javascript: URLs", () => {
    expect(renderMarkdown("[x](https://e.com)")).toBe(
      '<p><a href="https://e.com" target="_blank" rel="noopener noreferrer">x</a></p>',
    )
    expect(renderMarkdown("[x](javascript:alert(1))")).toBe("<p>x (javascript:alert(1))</p>")
  })

  it("escapes raw HTML in text content", () => {
    expect(renderMarkdown("<script>alert(1)</script>")).toBe(
      "<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>",
    )
  })
})

describe("applyInlineWrap", () => {
  it("wraps a selection and keeps it selected", () => {
    const r = applyInlineWrap("hello", 0, 5, "**")
    expect(r.text).toBe("**hello**")
    expect([r.selectionStart, r.selectionEnd]).toEqual([2, 7])
  })

  it("inserts markers and places caret between them when nothing selected", () => {
    const r = applyInlineWrap("", 0, 0, "**")
    expect(r.text).toBe("****")
    expect([r.selectionStart, r.selectionEnd]).toEqual([2, 2])
  })

  it("toggles off when the selection is already wrapped", () => {
    const r = applyInlineWrap("**hello**", 0, 9, "**")
    expect(r.text).toBe("hello")
  })

  it("toggles off when markers sit just outside the selection", () => {
    const r = applyInlineWrap("**hello**", 2, 7, "**")
    expect(r.text).toBe("hello")
    expect([r.selectionStart, r.selectionEnd]).toEqual([0, 5])
  })
})

describe("applyLinePrefix", () => {
  it("adds a prefix to each touched line", () => {
    const r = applyLinePrefix("a\nb", 0, 3, "- ")
    expect(r.text).toBe("- a\n- b")
  })

  it("removes the prefix when every touched line already has it", () => {
    const r = applyLinePrefix("- a\n- b", 0, 7, "- ")
    expect(r.text).toBe("a\nb")
  })

  it("only affects lines within the selection", () => {
    const r = applyLinePrefix("a\nb\nc", 0, 1, "# ")
    expect(r.text).toBe("# a\nb\nc")
  })
})

describe("applyInsert", () => {
  it("replaces the selection and moves caret after the snippet", () => {
    const r = applyInsert("ac", 1, 1, "b")
    expect(r.text).toBe("abc")
    expect([r.selectionStart, r.selectionEnd]).toEqual([2, 2])
  })
})
