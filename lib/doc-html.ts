/**
 * lib/doc-html.ts — HTML helpers for the Docs WYSIWYG editor
 *
 * Docs store rich HTML in `Item.body` (Notion/Docs-style). Older markdown notes
 * are detected and converted once on load via `renderMarkdown`. `sanitizeDocHtml`
 * allow-lists tags/attrs so paste + PDF ingest stay safe for contenteditable.
 */
import { renderMarkdown } from "@/components/Editor/markdown"
import { isAllowedFont } from "@/lib/google-fonts"

const BLOCK_TAGS = new Set([
  "P",
  "DIV",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "LI",
  "BLOCKQUOTE",
  "PRE",
])

const ALLOWED_TAGS = new Set([
  "P",
  "DIV",
  "BR",
  "SPAN",
  "STRONG",
  "B",
  "EM",
  "I",
  "U",
  "S",
  "STRIKE",
  "DEL",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "UL",
  "OL",
  "LI",
  "BLOCKQUOTE",
  "A",
  "IMG",
  "HR",
  "CODE",
  "PRE",
  "SUB",
  "SUP",
  "FONT",
])

const ALLOWED_ATTRS = new Set([
  "href",
  "src",
  "alt",
  "title",
  "style",
  "target",
  "rel",
  "class",
  "colspan",
  "rowspan",
])

/** True when `src` looks like already-authored HTML (vs markdown). */
export function looksLikeHtml(src: string): boolean {
  const t = src.trim()
  if (!t) return false
  return /^<[a-z][\s\S]*>/i.test(t)
}

/** Convert legacy markdown bodies (or empty) into editor HTML. */
export function bodyToEditorHtml(body: string | undefined | null): string {
  const raw = body ?? ""
  if (!raw.trim()) return "<p><br></p>"
  if (looksLikeHtml(raw)) return sanitizeDocHtml(raw)
  const rendered = renderMarkdown(raw)
  return rendered ? sanitizeDocHtml(rendered) : "<p><br></p>"
}

/** Escape text for insertion into HTML. */
export function escapeHtmlText(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function isSafeHref(href: string): boolean {
  const t = href.trim()
  if (/^(https?:|mailto:)/i.test(t)) return true
  if (t.startsWith("#") || t.startsWith("/")) return true
  return !/^[a-z][a-z0-9+.-]*:/i.test(t)
}

function isSafeSrc(src: string): boolean {
  const t = src.trim()
  return /^(https?:|data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,)/i.test(t)
}

function scrubStyle(style: string): string {
  // Drop expressions / urls that aren't http(s)/data images.
  return style
    .replace(/expression\s*\(/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/url\s*\(\s*['"]?\s*(?!https?:|data:image)/gi, "url(")
}

/**
 * Allow-list sanitize for Docs HTML. Runs in the browser via DOMParser when
 * available; falls back to a crude strip on the server/tests without DOM.
 */
export function sanitizeDocHtml(html: string): string {
  if (typeof DOMParser === "undefined") {
    return html.replace(/<script[\s\S]*?<\/script>/gi, "")
  }
  const doc = new DOMParser().parseFromString(`<div id="root">${html}</div>`, "text/html")
  const root = doc.getElementById("root")
  if (!root) return "<p><br></p>"

  const walk = (node: Node) => {
    const children = [...node.childNodes]
    for (const child of children) {
      if (child.nodeType === Node.COMMENT_NODE) {
        child.parentNode?.removeChild(child)
        continue
      }
      if (child.nodeType !== Node.ELEMENT_NODE) continue
      const el = child as HTMLElement
      const tag = el.tagName.toUpperCase()
      if (!ALLOWED_TAGS.has(tag)) {
        // Unwrap unknown elements (keep children).
        while (el.firstChild) el.parentNode?.insertBefore(el.firstChild, el)
        el.parentNode?.removeChild(el)
        continue
      }
      // Scrub attributes.
      for (const attr of [...el.attributes]) {
        const name = attr.name.toLowerCase()
        if (name.startsWith("on") || !ALLOWED_ATTRS.has(name)) {
          el.removeAttribute(attr.name)
          continue
        }
        if (name === "href" && !isSafeHref(attr.value)) el.removeAttribute(attr.name)
        if (name === "src" && !isSafeSrc(attr.value)) el.removeAttribute(attr.name)
        if (name === "style") el.setAttribute("style", scrubStyle(attr.value))
        if (name === "target") el.setAttribute("rel", "noopener noreferrer")
      }
      if (tag === "A" && el.hasAttribute("href")) {
        el.setAttribute("target", "_blank")
        el.setAttribute("rel", "noopener noreferrer")
      }
      walk(el)
    }
  }
  walk(root)
  const out = root.innerHTML.trim()
  return out || "<p><br></p>"
}

/** Plain-text word count from HTML. */
export function htmlWordCount(html: string): number {
  if (typeof DOMParser === "undefined") {
    return (html.replace(/<[^>]+>/g, " ").match(/\S+/g) ?? []).length
  }
  const doc = new DOMParser().parseFromString(html, "text/html")
  const text = doc.body.textContent ?? ""
  return (text.match(/\S+/g) ?? []).length
}

export const DOC_FONT_SIZES = [10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48] as const

/** Apply inline CSS to the current selection (Google Docs–style highlight formatting). */
export function applyInlineStyleToSelection(styles: Partial<CSSStyleDeclaration>): boolean {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return false
  const range = sel.getRangeAt(0)

  if (range.collapsed) {
    // Insert a styled span so subsequent typing picks up the style.
    const span = document.createElement("span")
    Object.assign(span.style, styles)
    span.appendChild(document.createTextNode("\u200b"))
    range.insertNode(span)
    const next = document.createRange()
    next.setStart(span.firstChild!, 1)
    next.collapse(true)
    sel.removeAllRanges()
    sel.addRange(next)
    return true
  }

  try {
    const span = document.createElement("span")
    Object.assign(span.style, styles)
    const contents = range.extractContents()
    span.appendChild(contents)
    range.insertNode(span)
    sel.removeAllRanges()
    const after = document.createRange()
    after.selectNodeContents(span)
    sel.addRange(after)
    return true
  } catch {
    // Partial-node selection: fall back to insertHTML.
    const fragment = range.cloneContents()
    const holder = document.createElement("div")
    holder.appendChild(fragment)
    const styleAttr = Object.entries(styles)
      .filter(([, v]) => v != null && v !== "")
      .map(([k, v]) => `${k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}:${v}`)
      .join(";")
    const html = `<span style="${styleAttr}">${holder.innerHTML}</span>`
    document.execCommand("insertHTML", false, html)
    return true
  }
}

/** Apply font-family to the nearest heading block containing the caret/selection. */
export function applyFontToNearestHeading(font: string): boolean {
  if (!isAllowedFont(font)) return false
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return false
  let node: Node | null = sel.anchorNode
  while (node && node !== document.body) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement
      if (/^H[1-6]$/.test(el.tagName)) {
        el.style.fontFamily = `"${font}", sans-serif`
        return true
      }
    }
    node = node.parentNode
  }
  // No heading — promote selection to H2 with this font, or style inline.
  document.execCommand("formatBlock", false, "h2")
  return applyInlineStyleToSelection({ fontFamily: `"${font}", sans-serif` })
}

/** Find the block element for the current selection (for toolbar state). */
export function selectionBlockTag(): string | null {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return null
  let node: Node | null = sel.anchorNode
  while (node && node !== document.body) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = (node as HTMLElement).tagName
      if (BLOCK_TAGS.has(tag)) return tag.toLowerCase()
    }
    node = node.parentNode
  }
  return null
}
