/**
 * lib/doc-export.ts — Print / Save-as-PDF for a Docs note
 *
 * Opens a print window with the document HTML and Google Fonts loaded. The
 * browser's print dialog is how the user saves a PDF (no extra native engine).
 */
import { fontFamilyCss, googleFontsStylesheetUrl, isAllowedFont } from "@/lib/google-fonts"
import { escapeHtmlText } from "@/lib/doc-html"

export function fontsUsedInHtml(html: string): string[] {
  const found = new Set<string>()
  const re = /font-family:\s*["']?([^"';,]+)/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    const name = m[1].trim().replace(/^["']|["']$/g, "")
    if (isAllowedFont(name)) found.add(name)
  }
  return [...found]
}

export function buildPrintableDocumentHtml(opts: {
  title: string
  html: string
  font?: string
}): string {
  const pageFont = opts.font && isAllowedFont(opts.font) ? opts.font : "Merriweather"
  const families = [pageFont, ...fontsUsedInHtml(opts.html)]
  const stylesheet = googleFontsStylesheetUrl(families)
  const title = escapeHtmlText(opts.title || "Untitled document")
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  ${stylesheet ? `<link rel="stylesheet" href="${stylesheet}" />` : ""}
  <style>
    @page { margin: 0.75in; }
    html, body { background: #fff; color: #111; }
    body {
      font-family: ${fontFamilyCss(pageFont)};
      font-size: 16px;
      line-height: 1.55;
      max-width: 800px;
      margin: 0 auto;
    }
    h1 { font-size: 1.85em; line-height: 1.25; margin: 0.85em 0 0.35em; }
    h2 { font-size: 1.45em; line-height: 1.25; margin: 0.85em 0 0.35em; }
    h3 { font-size: 1.2em; line-height: 1.25; margin: 0.85em 0 0.35em; }
    p { margin: 0 0 0.65em; }
    ul, ol { margin: 0 0 0.75em; padding-left: 1.85em; }
    img { max-width: 100%; height: auto; }
    a { color: #000080; }
    blockquote { margin: 0 0 0.65em; padding: 4px 12px; border-left: 3px solid #808080; }
  </style>
</head>
<body>${opts.html}</body>
</html>`
}

/** Open a print window so the user can Save as PDF. */
export function exportDocumentAsPdf(opts: { title: string; html: string; font?: string }): void {
  if (typeof window === "undefined") return
  const w = window.open("", "_blank", "noopener,noreferrer")
  if (!w) {
    window.alert("Allow pop-ups to export this document as a PDF.")
    return
  }
  const markup = buildPrintableDocumentHtml(opts)
  w.document.open()
  w.document.write(markup)
  w.document.close()
  const print = () => {
    try {
      w.focus()
      w.print()
    } catch {
      /* user cancelled or window closed */
    }
  }
  w.onafterprint = () => {
    try {
      w.close()
    } catch {
      /* ignore */
    }
  }
  if (w.document.readyState === "complete") {
    window.setTimeout(print, 350)
  } else {
    w.onload = () => window.setTimeout(print, 350)
    window.setTimeout(print, 800)
  }
}
