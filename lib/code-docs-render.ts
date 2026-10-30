/**
 * lib/code-docs-render.ts — Markdown for the code-documentation reader.
 *
 * GitHub-style tables and fenced code stay. Heading ids match the slugs
 * already used in `docs/` links. Relative links and images stay inside the
 * reader. Script tags and inline event handlers are dropped.
 */
import { Marked, type Tokens } from "marked"
import { codeDocRawUrl, resolveDocHref } from "@/lib/code-docs-path"

export function docHeadingSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/[`*_~[\]]/g, "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&[a-z]+;/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;")
}

function stripDanger(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/\s(on\w+|formaction)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
}

export function rewriteDocLinks(html: string, fromFile: string): string {
  return html.replace(/\s(href|src)\s*=\s*("([^"]*)"|'([^']*)')/gi, (full, attr: string, _quoted: string, dq?: string, sq?: string) => {
    const url = (dq ?? sq ?? "").trim()
    const name = attr.toLowerCase()
    const resolved = resolveDocHref(fromFile, url)
    if (!resolved || resolved.kind === "hash") {
      if (!resolved && name === "href") return ` href="#doc" data-doc-outside="1" title="Outside the docs folder"`
      return full
    }
    if (resolved.kind === "external") {
      if (name === "href") return ` ${attr}="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer"`
      return full
    }
    if (name === "src") return ` src="${codeDocRawUrl(resolved.path)}${resolved.hash}"`
    return ` href="#doc" data-doc-path="${escapeAttr(resolved.path)}" data-doc-hash="${escapeAttr(resolved.hash)}"`
  })
}

type HeadingThis = { parser: { parseInline: (tokens: Tokens.Generic[]) => string } }

export function renderCodeDocMarkdown(src: string, fromFile: string): string {
  const seen = new Map<string, number>()
  const marked = new Marked()
  marked.use({
    gfm: true,
    renderer: {
      heading(this: HeadingThis, token: Tokens.Heading) {
        const plain = token.text.replace(/[`*_~[\]]/g, "")
        let slug = docHeadingSlug(plain) || "section"
        const n = seen.get(slug) ?? 0
        seen.set(slug, n + 1)
        if (n > 0) slug = `${slug}-${n}`
        const inner = this.parser.parseInline(token.tokens)
        return `<h${token.depth} id="${slug}">${inner}</h${token.depth}>\n`
      },
    },
  })
  const html = marked.parse(src, { async: false }) as string
  return rewriteDocLinks(stripDanger(html), fromFile)
}
