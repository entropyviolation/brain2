/**
 * components/Editor/markdown.ts — Tiny, dependency-light markdown helpers
 *
 * Powers the `RichTextEditor` (Feature 4, Worker D). Two responsibilities:
 *
 *   1. `renderMarkdown(src)` — a minimal, *safe* markdown → HTML renderer used
 *      for the live preview. It escapes all HTML first, then re-introduces only a
 *      known-good set of tags (headings, emphasis, code, lists, blockquotes,
 *      links, rules, line breaks). No `eval`, no third-party deps, no raw HTML
 *      passthrough — so the output is safe to inject via `dangerouslySetInnerHTML`.
 *   2. Selection-aware edit transforms (`applyInlineWrap`, `applyLinePrefix`,
 *      `applyInsert`) — pure functions the toolbar uses to toggle bold/italic/
 *      code spans and list/heading/quote prefixes around a textarea selection.
 *
 * Everything here is pure + serializable (no React/DOM/store imports) so it can
 * be unit-tested directly (see `markdown.test.ts`).
 */

/** Escape the five HTML-significant characters so user text can't inject markup. */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

/** Only allow safe link schemes; anything else renders as inert text. */
function isSafeHref(href: string): boolean {
  const trimmed = href.trim()
  if (/^(https?:|mailto:)/i.test(trimmed)) return true
  // Relative / anchor links are fine; reject javascript:, data:, vbscript:, etc.
  return !/^[a-z][a-z0-9+.-]*:/i.test(trimmed)
}

/**
 * Inline markdown on an already-HTML-escaped string. Handles (in order) inline
 * code, bold, italic, strikethrough, and links. Inline code spans are protected
 * from further substitution via placeholders.
 */
function renderInline(escaped: string): string {
  const codeSpans: string[] = []
  let text = escaped.replace(/`([^`]+)`/g, (_m, code: string) => {
    const token = `\u0000CODE${codeSpans.length}\u0000`
    codeSpans.push(`<code>${code}</code>`)
    return token
  })

  // Links: [label](href) — label may contain other inline marks (applied later).
  text = text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label: string, href: string) => {
    if (!isSafeHref(href)) return `${label} (${href})`
    return `<a href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`
  })

  text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
  text = text.replace(/__([^_]+)__/g, "<strong>$1</strong>")
  text = text.replace(/(^|[^*])\*([^*\s][^*]*?)\*/g, "$1<em>$2</em>")
  text = text.replace(/(^|[^_])_([^_\s][^_]*?)_/g, "$1<em>$2</em>")
  text = text.replace(/~~([^~]+)~~/g, "<del>$1</del>")

  // Restore protected code spans.
  text = text.replace(/\u0000CODE(\d+)\u0000/g, (_m, i: string) => codeSpans[Number(i)] ?? "")
  return text
}

/**
 * Minimal markdown → safe HTML. Supports: fenced code blocks (```), ATX
 * headings (# … ######), blockquotes (>), ordered + unordered lists, horizontal
 * rules (--- / ***), and paragraphs with inline emphasis/code/links. Returns an
 * empty string for empty input.
 */
export function renderMarkdown(src: string): string {
  if (!src || !src.trim()) return ""
  const lines = src.replace(/\r\n?/g, "\n").split("\n")
  const out: string[] = []

  let i = 0
  let listType: "ul" | "ol" | null = null

  const closeList = () => {
    if (listType) {
      out.push(`</${listType}>`)
      listType = null
    }
  }

  while (i < lines.length) {
    const line = lines[i]

    // Fenced code block.
    const fence = line.match(/^\s*```(.*)$/)
    if (fence) {
      closeList()
      const body: string[] = []
      i++
      while (i < lines.length && !/^\s*```/.test(lines[i])) {
        body.push(escapeHtml(lines[i]))
        i++
      }
      i++ // skip closing fence (or run off the end)
      out.push(`<pre><code>${body.join("\n")}</code></pre>`)
      continue
    }

    // Blank line ends the current block.
    if (!line.trim()) {
      closeList()
      i++
      continue
    }

    // Horizontal rule.
    if (/^\s*([-*_])\1\1+\s*$/.test(line)) {
      closeList()
      out.push("<hr />")
      i++
      continue
    }

    // Heading.
    const heading = line.match(/^\s*(#{1,6})\s+(.*)$/)
    if (heading) {
      closeList()
      const level = heading[1].length
      out.push(`<h${level}>${renderInline(escapeHtml(heading[2].trim()))}</h${level}>`)
      i++
      continue
    }

    // Blockquote (collapses consecutive > lines into one block).
    if (/^\s*>\s?/.test(line)) {
      closeList()
      const quote: string[] = []
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        quote.push(renderInline(escapeHtml(lines[i].replace(/^\s*>\s?/, ""))))
        i++
      }
      out.push(`<blockquote>${quote.join("<br />")}</blockquote>`)
      continue
    }

    // Unordered list item.
    if (/^\s*[-*+]\s+/.test(line)) {
      if (listType !== "ul") {
        closeList()
        out.push("<ul>")
        listType = "ul"
      }
      out.push(`<li>${renderInline(escapeHtml(line.replace(/^\s*[-*+]\s+/, "")))}</li>`)
      i++
      continue
    }

    // Ordered list item.
    if (/^\s*\d+\.\s+/.test(line)) {
      if (listType !== "ol") {
        closeList()
        out.push("<ol>")
        listType = "ol"
      }
      out.push(`<li>${renderInline(escapeHtml(line.replace(/^\s*\d+\.\s+/, "")))}</li>`)
      i++
      continue
    }

    // Paragraph: gather consecutive plain lines, join with <br />.
    closeList()
    const para: string[] = []
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^\s*(#{1,6}\s|>|[-*+]\s|\d+\.\s|```)/.test(lines[i]) &&
      !/^\s*([-*_])\1\1+\s*$/.test(lines[i])
    ) {
      para.push(renderInline(escapeHtml(lines[i].trim())))
      i++
    }
    out.push(`<p>${para.join("<br />")}</p>`)
  }

  closeList()
  return out.join("\n")
}

/** A textarea selection transform result: new text + new selection bounds. */
export interface EditResult {
  text: string
  selectionStart: number
  selectionEnd: number
}

/**
 * Toggle an inline `marker` (e.g. `**`, `*`, `` ` ``) around the selection. If
 * the selection is already wrapped, the markers are removed (toggle off). With
 * an empty selection, the markers are inserted and the caret placed between them.
 */
export function applyInlineWrap(
  text: string,
  start: number,
  end: number,
  marker: string,
): EditResult {
  const selected = text.slice(start, end)
  const before = text.slice(0, start)
  const after = text.slice(end)

  // Toggle off: selection itself is wrapped, or wrapping markers sit just outside.
  if (selected.startsWith(marker) && selected.endsWith(marker) && selected.length >= marker.length * 2) {
    const inner = selected.slice(marker.length, selected.length - marker.length)
    return { text: before + inner + after, selectionStart: start, selectionEnd: start + inner.length }
  }
  if (
    before.endsWith(marker) &&
    after.startsWith(marker) &&
    selected.length > 0
  ) {
    const newBefore = before.slice(0, before.length - marker.length)
    const newAfter = after.slice(marker.length)
    return {
      text: newBefore + selected + newAfter,
      selectionStart: newBefore.length,
      selectionEnd: newBefore.length + selected.length,
    }
  }

  const wrapped = marker + selected + marker
  const caret = start + marker.length
  return {
    text: before + wrapped + after,
    selectionStart: selected ? start + marker.length : caret,
    selectionEnd: selected ? start + marker.length + selected.length : caret,
  }
}

/**
 * Toggle a line `prefix` (e.g. `"# "`, `"- "`, `"> "`) on every line touched by
 * the selection. If all touched lines already have it, it's removed.
 */
export function applyLinePrefix(
  text: string,
  start: number,
  end: number,
  prefix: string,
): EditResult {
  const lineStart = text.lastIndexOf("\n", start - 1) + 1
  let lineEnd = text.indexOf("\n", end)
  if (lineEnd === -1) lineEnd = text.length

  const block = text.slice(lineStart, lineEnd)
  const blockLines = block.split("\n")
  const allHave = blockLines.every((l) => l.startsWith(prefix))
  const updated = blockLines
    .map((l) => (allHave ? l.slice(prefix.length) : prefix + l))
    .join("\n")

  return {
    text: text.slice(0, lineStart) + updated + text.slice(lineEnd),
    selectionStart: lineStart,
    selectionEnd: lineStart + updated.length,
  }
}

/** Insert `snippet` at the selection, replacing it; caret lands after the snippet. */
export function applyInsert(text: string, start: number, end: number, snippet: string): EditResult {
  const next = text.slice(0, start) + snippet + text.slice(end)
  const caret = start + snippet.length
  return { text: next, selectionStart: caret, selectionEnd: caret }
}
