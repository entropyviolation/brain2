/**
 * lib/file-extract.ts — Best-effort text extraction for attached files
 *
 * Pulls searchable plain text out of a `FileValue` (data URL today) or a raw
 * `File` so it can be stored into `FileValue.extractedText` and indexed by
 * `lib/search.ts`. The function is intentionally environment-aware and
 * dependency-light so it never bloats the static web bundle:
 *
 *   - **Text-like files** (text/\*, json, xml) are decoded inline — works in the
 *     browser and Node, no heavy parser required.
 *   - **PDFs** route to a main-process extractor when running under Electron
 *     (the optional `window.desktop.extractPdfText` IPC bridge, see
 *     `electron/`). In the plain web build that bridge is absent, so PDF
 *     extraction degrades gracefully to `""` rather than pulling a multi-MB
 *     PDF parser into the client bundle.
 *   - **Anything else** (images, binaries) yields `""`.
 *
 * Best-effort by contract: every failure path resolves to `""` and never
 * throws, so callers can fire-and-forget without guarding the UI. The heavier
 * call sites (the upload field) dynamically `import()` this module so it stays
 * out of the initial bundle.
 */
import type { FileValue } from "@/lib/types"

/** Minimal shape of the optional Electron desktop bridge we rely on. */
export interface DesktopFileBridge {
  /** Extract text from a PDF given as a data URL. Resolves to "" on failure. */
  extractPdfText?: (dataUrl: string) => Promise<string>
}

/** Resolve the Electron desktop bridge if present (no-op in the browser). */
export function getDesktopFileBridge(): DesktopFileBridge | undefined {
  if (typeof window === "undefined") return undefined
  return (window as unknown as { desktop?: DesktopFileBridge }).desktop
}

export const PDF_MIME = "application/pdf"

function isFileValue(input: FileValue | File): input is FileValue {
  return typeof (input as FileValue).uri === "string"
}

function getMime(input: FileValue | File): string {
  return (isFileValue(input) ? input.mime : input.type) || ""
}

function getName(input: FileValue | File): string {
  return input.name || ""
}

/** True for files whose bytes are directly human-readable as UTF-8 text. */
function isTextLike(mime: string, name: string): boolean {
  if (/^text\//i.test(mime)) return true
  if (mime === "application/json" || mime === "application/xml") return true
  if (/\+(?:json|xml)$/i.test(mime)) return true
  return /\.(?:txt|md|markdown|csv|tsv|json|xml|ya?ml|log)$/i.test(name)
}

/** True for files we should treat as PDFs (by mime or extension). */
function isPdf(mime: string, name: string): boolean {
  return mime === PDF_MIME || /\.pdf$/i.test(name)
}

/** Decode a base64 string to raw bytes (browser `atob` or Node `Buffer`). */
function base64ToBytes(b64: string): Uint8Array {
  if (typeof atob === "function") {
    const bin = atob(b64)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return bytes
  }
  // Node fallback (tests, server). Guarded so the browser bundle never needs it.
  const g = globalThis as { Buffer?: { from(s: string, enc: string): Uint8Array } }
  if (g.Buffer) return g.Buffer.from(b64, "base64")
  return new Uint8Array()
}

/** Extract the UTF-8 text payload of a `data:` URL (base64 or percent-encoded). */
function dataUrlToText(dataUrl: string): string {
  const comma = dataUrl.indexOf(",")
  if (comma === -1 || !dataUrl.startsWith("data:")) return ""
  const meta = dataUrl.slice(5, comma)
  const data = dataUrl.slice(comma + 1)
  if (/;base64/i.test(meta)) {
    const bytes = base64ToBytes(data)
    return new TextDecoder().decode(bytes)
  }
  try {
    return decodeURIComponent(data)
  } catch {
    return data
  }
}

/** Read a File/FileValue as UTF-8 text (best effort). */
async function readAsText(input: FileValue | File): Promise<string> {
  if (isFileValue(input)) return dataUrlToText(input.uri)
  // Raw File: prefer the Blob.text() shortcut, fall back to FileReader.
  if (typeof input.text === "function") return input.text()
  return new Promise<string>((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ""))
    reader.onerror = () => resolve("")
    reader.readAsText(input)
  })
}

/** Resolve a File/FileValue to a `data:` URL for crossing the IPC boundary. */
async function toDataUrl(input: FileValue | File): Promise<string> {
  if (isFileValue(input)) return input.uri
  return new Promise<string>((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ""))
    reader.onerror = () => resolve("")
    reader.readAsDataURL(input)
  })
}

/**
 * Whether `extractText` is expected to yield content for this file. Cheap check
 * the upload UI uses to decide whether to bother extracting at all.
 */
export function canExtractText(input: FileValue | File): boolean {
  const mime = getMime(input)
  const name = getName(input)
  if (isTextLike(mime, name)) return true
  if (isPdf(mime, name)) return !!getDesktopFileBridge()?.extractPdfText
  return false
}

/**
 * Best-effort plain-text extraction. Never throws — resolves to `""` when the
 * file type is unsupported in the current environment or extraction fails.
 */
export async function extractText(input: FileValue | File): Promise<string> {
  const mime = getMime(input)
  const name = getName(input)

  if (isTextLike(mime, name)) {
    try {
      return (await readAsText(input)).trim()
    } catch {
      return ""
    }
  }

  if (isPdf(mime, name)) {
    const bridge = getDesktopFileBridge()
    if (bridge?.extractPdfText) {
      try {
        const dataUrl = await toDataUrl(input)
        if (!dataUrl) return ""
        const text = await bridge.extractPdfText(dataUrl)
        return (text || "").trim()
      } catch {
        return ""
      }
    }
    // Browser build: no bundled PDF parser. Degrade gracefully.
    return ""
  }

  return ""
}
