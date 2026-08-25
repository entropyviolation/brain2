/**
 * lib/doc-links.ts — URL detection / normalization for Docs hyperlinks
 *
 * Powers Google Docs–style linking: auto-linkify typed/pasted URLs, normalize
 * bare domains to https://, and decide when clipboard text is “just a URL”.
 */
import { escapeHtmlText } from "@/lib/doc-html"

/** Loose URL / domain / www / mailto matcher (trailing punctuation stripped by callers). */
const URL_CANDIDATE =
  /^(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+|mailto:[^\s<>"']+|[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+(?:\/[^\s<>"']*)?)$/i

const URL_IN_TEXT =
  /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+|mailto:[^\s<>"']+)/gi

const TRAILING_PUNCT = /[),.;:!?]+$/

export function stripTrailingPunct(raw: string): { core: string; trail: string } {
  const m = raw.match(TRAILING_PUNCT)
  if (!m) return { core: raw, trail: "" }
  return { core: raw.slice(0, -m[0].length), trail: m[0] }
}

/** True when the whole string is a single URL-like token (after trim). */
export function isPlainUrl(text: string): boolean {
  const t = text.trim()
  if (!t || /\s/.test(t)) return false
  const { core } = stripTrailingPunct(t)
  return URL_CANDIDATE.test(core)
}

/** Add https:// for bare www./domains; leave mailto/http alone. */
export function normalizeHref(raw: string): string {
  const t = raw.trim()
  if (!t) return ""
  if (/^mailto:/i.test(t) || /^https?:\/\//i.test(t)) return t
  if (/^\/\//.test(t)) return `https:${t}`
  return `https://${t}`
}

export function isSafeDocHref(href: string): boolean {
  const t = href.trim()
  if (/^(https?:|mailto:)/i.test(t)) return true
  if (t.startsWith("#") || t.startsWith("/")) return true
  return !/^[a-z][a-z0-9+.-]*:/i.test(t)
}

/**
 * Turn plain text that is only a URL into an anchor. Returns null when the
 * clipboard isn't a lone URL (caller should use normal paste).
 */
export function urlOnlyToAnchorHtml(text: string, displayText?: string): string | null {
  const trimmed = text.trim()
  if (!isPlainUrl(trimmed)) return null
  const { core, trail } = stripTrailingPunct(trimmed)
  const href = normalizeHref(core)
  if (!isSafeDocHref(href)) return null
  const label = escapeHtmlText((displayText?.trim() || core))
  return `<a href="${escapeHtmlText(href)}" target="_blank" rel="noopener noreferrer">${label}</a>${escapeHtmlText(trail)}`
}

/** Linkify http(s)/www/mailto tokens inside a larger plain-text paste. */
export function linkifyPlainText(text: string): string {
  URL_IN_TEXT.lastIndex = 0
  let out = ""
  let last = 0
  let m: RegExpExecArray | null
  while ((m = URL_IN_TEXT.exec(text))) {
    out += escapeHtmlText(text.slice(last, m.index))
    const { core, trail } = stripTrailingPunct(m[0])
    const href = normalizeHref(core)
    if (isSafeDocHref(href)) {
      out += `<a href="${escapeHtmlText(href)}" target="_blank" rel="noopener noreferrer">${escapeHtmlText(core)}</a>${escapeHtmlText(trail)}`
    } else {
      out += escapeHtmlText(m[0])
    }
    last = m.index + m[0].length
  }
  out += escapeHtmlText(text.slice(last))
  // Preserve newlines as <br>
  return out.replace(/\n/g, "<br>")
}

/**
 * If `word` (text immediately before the caret) is a URL, return the href and
 * how many characters of `word` (from the start) are the linkable core.
 */
export function trailingUrlToLink(word: string): { href: string; coreLength: number; label: string } | null {
  if (!word || /\s/.test(word)) return null
  const { core } = stripTrailingPunct(word)
  if (!URL_CANDIDATE.test(core)) return null
  const href = normalizeHref(core)
  if (!isSafeDocHref(href)) return null
  return { href, coreLength: core.length, label: core }
}

/**
 * Read the word immediately before the caret in a text node (for auto-linkify).
 */
export function wordBeforeCaret(range: Range): { word: string; startOffset: number; textNode: Text } | null {
  if (!range.collapsed) return null
  const node = range.startContainer
  if (node.nodeType !== Node.TEXT_NODE) return null
  const textNode = node as Text
  const offset = range.startOffset
  const before = textNode.data.slice(0, offset)
  const m = before.match(/(\S+)$/)
  if (!m) return null
  return { word: m[1], startOffset: offset - m[1].length, textNode }
}

/** Find the nearest ancestor `<a>` for a node. */
export function closestAnchor(node: Node | null, root: Node): HTMLAnchorElement | null {
  let cur: Node | null = node
  while (cur && cur !== root) {
    if (cur.nodeType === Node.ELEMENT_NODE && (cur as Element).tagName === "A") {
      return cur as HTMLAnchorElement
    }
    cur = cur.parentNode
  }
  return null
}
