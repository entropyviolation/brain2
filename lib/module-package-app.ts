/**
 * lib/module-package-app.ts — Sandboxed document for a `package-app` folder
 *
 * A new package may ship html, css, js, and assets. The frame has no
 * `allow-same-origin`, so those files cannot be fetched by URL. This module
 * inlines them into one `srcDoc`, then puts the existing `window.brain2`
 * bridge in front (`buildSrcDoc` in `lib/module-html-bridge.ts`).
 *
 * Grants are decided here, not inside `handleBridgeCall`. An uploaded `html`
 * view still passes only `htmlListIds` and `htmlCanWrite`. A package-app may
 * also see the lists the package bound on the view, and may write them unless
 * `htmlCanWrite` is explicitly false.
 */
import { buildSrcDoc, type HtmlBridgeGrants } from "@/lib/module-html-bridge"

/** Same flags as an uploaded HTML frame. Never `allow-same-origin`. */
export const PACKAGE_APP_SANDBOX =
  "allow-scripts allow-forms allow-modals allow-popups allow-downloads"

const LIST_FIELDS = [
  "categoryId",
  "matchTargetCategoryId",
  "quizSourceCategoryId",
  "daysCategoryId",
  "flightsCategoryId",
  "entriesCategoryId",
  "placesCategoryId",
] as const

export interface PackageAppGrantSource {
  categoryId?: string
  matchTargetCategoryId?: string
  quizSourceCategoryId?: string
  daysCategoryId?: string
  flightsCategoryId?: string
  entriesCategoryId?: string
  placesCategoryId?: string
  htmlListIds?: string[]
  htmlCanWrite?: boolean
  cards?: { categoryId?: string; subtract?: { categoryId?: string } }[]
}

/** Lists a package-app frame may touch. Wider than an uploaded HTML page. */
export function packageAppGrants(source: PackageAppGrantSource): HtmlBridgeGrants {
  const listIds: string[] = []
  const add = (id: string | undefined) => {
    if (!id || listIds.includes(id)) return
    listIds.push(id)
  }
  for (const key of LIST_FIELDS) add(source[key])
  for (const id of source.htmlListIds ?? []) add(id)
  for (const card of source.cards ?? []) {
    add(card.categoryId)
    add(card.subtract?.categoryId)
  }
  return { listIds, canWrite: source.htmlCanWrite !== false && listIds.length > 0 }
}

export interface PackageAppFolder {
  name?: string
  html: string
  css?: Record<string, string>
  js?: Record<string, string>
  assets?: Record<string, string>
}

/** A relative path inside the folder. Rejects schemes and `..`. */
export function normalizePackagePath(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed || trimmed.length > 240) return null
  if (/[\0\\\r\n]/.test(trimmed)) return null
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) return null
  if (trimmed.startsWith("//")) return null
  let path = trimmed.split(/[?#]/)[0]
  if (path.startsWith("./")) path = path.slice(2)
  while (path.startsWith("/")) path = path.slice(1)
  if (!path || path.endsWith("/")) return null
  const parts = path.split("/")
  if (parts.some((part) => part === "" || part === "." || part === "..")) return null
  return parts.join("/")
}

function tagAttr(tag: string, name: string): string | null {
  const match = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(tag)
  if (!match) return null
  return match[1] ?? match[2] ?? match[3] ?? ""
}

function escapeStyle(css: string): string {
  return css.replace(/<\/style/gi, "<\\/style")
}

function escapeScript(js: string): string {
  return js.replace(/<\/script/gi, "<\\/script")
}

const TEXT_ASSET_MIME: Record<string, string> = {
  svg: "image/svg+xml",
  txt: "text/plain",
  json: "application/json",
  csv: "text/csv",
  webmanifest: "application/manifest+json",
}

/** A stored asset as a `data:` URL. Binary files must already be data URLs. */
export function assetDataUrl(raw: string, assets: Record<string, string>): string | null {
  const path = normalizePackagePath(raw)
  if (!path) return null
  const value = assets[path]
  if (value == null) return null
  const trimmed = value.trim()
  if (/^(javascript|vbscript):/i.test(trimmed)) return null
  if (/^data:/i.test(trimmed)) {
    if (/^data:(text\/html|application\/xhtml\+xml)/i.test(trimmed)) return null
    return trimmed
  }
  const ext = path.split(".").pop()?.toLowerCase() ?? ""
  const mime = TEXT_ASSET_MIME[ext]
  if (!mime) return null
  return `data:${mime},${encodeURIComponent(value)}`
}

function quoteUrl(url: string): string {
  return url.split('"').join("%22").split("'").join("%27")
}

function rewriteCssUrls(css: string, assets: Record<string, string>): string {
  return css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (full, _quote, raw: string) => {
    const next = assetDataUrl(raw, assets)
    return next ? `url("${quoteUrl(next)}")` : full
  })
}

function rewriteHtmlRefs(html: string, assets: Record<string, string>): string {
  return html.replace(/\b(src|href|poster)\s*=\s*("([^"]*)"|'([^']*)')/gi, (full, name: string, _quoted: string, dq?: string, sq?: string) => {
    const raw = dq ?? sq ?? ""
    const next = assetDataUrl(raw, assets)
    if (!next) return full
    const q = dq !== undefined ? '"' : "'"
    return `${name}=${q}${quoteUrl(next)}${q}`
  })
}

function injectBefore(html: string, closeTag: RegExp, snippet: string): string {
  const close = closeTag.exec(html)
  if (!close) return snippet + html
  return html.slice(0, close.index) + snippet + html.slice(close.index)
}

/**
 * Inline the folder, then install the bridge. `sandbox` is the iframe
 * attribute; it is not written into the document.
 */
export function buildPackageSrcDoc(
  folder: PackageAppFolder,
  cfg: { kv: Record<string, string>; grants: HtmlBridgeGrants },
): { srcDoc: string; sandbox: typeof PACKAGE_APP_SANDBOX } {
  const css = folder.css ?? {}
  const js = folder.js ?? {}
  const assets = folder.assets ?? {}
  const usedCss = new Set<string>()
  const usedJs = new Set<string>()
  let html = folder.html

  html = html.replace(/<link\b[^>]*>/gi, (tag) => {
    const stylesheet = /rel\s*=\s*["']?stylesheet["']?/i.test(tag) || /type\s*=\s*["']text\/css["']/i.test(tag)
    if (!stylesheet) return tag
    const href = tagAttr(tag, "href")
    const path = href ? normalizePackagePath(href) : null
    if (!path || !(path in css)) return tag
    usedCss.add(path)
    return `<style>${escapeStyle(rewriteCssUrls(css[path], assets))}</style>`
  })

  html = html.replace(/<script\b([^>]*)>\s*<\/script>/gi, (full, attrs: string) => {
    const src = tagAttr(`<script${attrs}>`, "src")
    if (!src) return full
    const path = normalizePackagePath(src)
    if (!path || !(path in js)) return full
    usedJs.add(path)
    return `<script>${escapeScript(js[path])}</script>`
  })

  const extraCss = Object.keys(css)
    .filter((path) => !usedCss.has(path))
    .map((path) => `<style>${escapeStyle(rewriteCssUrls(css[path], assets))}</style>`)
    .join("")
  if (extraCss) html = injectBefore(html, /<\/head>/i, extraCss)

  const extraJs = Object.keys(js)
    .filter((path) => !usedJs.has(path))
    .map((path) => `<script>${escapeScript(js[path])}</script>`)
    .join("")
  if (extraJs) html = injectBefore(html, /<\/body>/i, extraJs)

  html = rewriteHtmlRefs(html, assets)
  return { srcDoc: buildSrcDoc(html, cfg), sandbox: PACKAGE_APP_SANDBOX }
}
