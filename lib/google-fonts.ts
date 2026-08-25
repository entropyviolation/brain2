/**
 * lib/google-fonts.ts — Curated Google Fonts catalog for the Docs editor
 *
 * Pure helpers: an allow-listed set of Google Font families plus loaders that
 * inject a single `<link>` stylesheet. Font names are validated before use so
 * untrusted document attributes can't inject CSS or arbitrary URLs.
 */

/** Popular Google Fonts available in the Docs font picker. */
export const GOOGLE_FONTS = [
  "Arial",
  "Roboto",
  "Open Sans",
  "Lato",
  "Montserrat",
  "Source Sans 3",
  "Nunito",
  "Raleway",
  "Poppins",
  "Inter",
  "Work Sans",
  "Ubuntu",
  "Noto Sans",
  "Oswald",
  "Merriweather",
  "Playfair Display",
  "Lora",
  "PT Serif",
  "Libre Baskerville",
  "Crimson Text",
  "EB Garamond",
  "Cormorant Garamond",
  "Roboto Slab",
  "Source Serif 4",
  "Bitter",
  "Inconsolata",
  "Roboto Mono",
  "Source Code Pro",
  "Fira Code",
  "Space Mono",
  "Pacifico",
  "Dancing Script",
  "Caveat",
  "Permanent Marker",
  "Bebas Neue",
  "Anton",
  "Comfortaa",
  "Quicksand",
  "Josefin Sans",
  "Mulish",
  "Manrope",
  "DM Sans",
  "Figtree",
  "Outfit",
  "Sora",
] as const

export type GoogleFontName = (typeof GOOGLE_FONTS)[number]

const SYSTEM_FONTS = new Set(["Arial", "Courier New", "Times New Roman", "Georgia", "Verdana", "Tahoma"])

const FONT_SET = new Set<string>(GOOGLE_FONTS)

/** True when `name` is in the curated allow-list (case-sensitive). */
export function isAllowedFont(name: string | null | undefined): name is GoogleFontName {
  return !!name && FONT_SET.has(name)
}

/** CSS `font-family` stack for a known font; falls back to system UI. */
export function fontFamilyCss(name: string | null | undefined): string {
  if (!isAllowedFont(name)) return 'var(--w95-font, Tahoma, "MS Sans Serif", sans-serif)'
  if (SYSTEM_FONTS.has(name) || name === "Arial") {
    return `"${name}", Tahoma, "MS Sans Serif", sans-serif`
  }
  return `"${name}", Tahoma, "MS Sans Serif", sans-serif`
}

/** Google Fonts CSS2 URL for one or more allow-listed families (skips system fonts). */
export function googleFontsStylesheetUrl(families: string[]): string | null {
  const unique = [...new Set(families.filter(isAllowedFont).filter((f) => !SYSTEM_FONTS.has(f) && f !== "Arial"))]
  if (unique.length === 0) return null
  const params = unique
    .map((f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}:ital,wght@0,400;0,700;1,400;1,700`)
    .join("&")
  return `https://fonts.googleapis.com/css2?${params}&display=swap`
}

const loadedHrefs = new Set<string>()

/** Inject a Google Fonts stylesheet once (client-only; no-op on the server). */
export function ensureGoogleFontsLoaded(families: string[]): void {
  if (typeof document === "undefined") return
  const href = googleFontsStylesheetUrl(families)
  if (!href || loadedHrefs.has(href)) return
  // Prefer merging into one link when possible; for simplicity append if missing.
  const existing = document.querySelector(`link[data-cogs-gfonts="${href}"]`)
  if (existing) {
    loadedHrefs.add(href)
    return
  }
  const link = document.createElement("link")
  link.rel = "stylesheet"
  link.href = href
  link.setAttribute("data-cogs-gfonts", href)
  document.head.appendChild(link)
  loadedHrefs.add(href)
}

/** Extract `{font:Name}` markers from markdown so the preview can preload them. */
export function extractFontMarkers(markdown: string): string[] {
  const found = new Set<string>()
  const re = /\{font:([^}]+)\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(markdown))) {
    const name = m[1].trim()
    if (isAllowedFont(name)) found.add(name)
  }
  return [...found]
}
