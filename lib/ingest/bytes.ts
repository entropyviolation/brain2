/**
 * lib/ingest/bytes.ts — data-URL helpers for Telegram media
 */

export function dataUrlMime(dataUrl: string): string {
  if (!dataUrl.startsWith("data:")) return "application/octet-stream"
  const comma = dataUrl.indexOf(",")
  const meta = dataUrl.slice(5, comma < 0 ? dataUrl.length : comma)
  return meta.split(";")[0] || "application/octet-stream"
}

export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(",")
  if (comma < 0 || !dataUrl.startsWith("data:")) return new Uint8Array()
  const meta = dataUrl.slice(5, comma)
  const data = dataUrl.slice(comma + 1)
  if (/;base64/i.test(meta)) return base64ToBytes(data)
  try {
    return new TextEncoder().encode(decodeURIComponent(data))
  } catch {
    return new TextEncoder().encode(data)
  }
}

export function bytesToDataUrl(bytes: Uint8Array, mime: string): string {
  return `data:${mime || "application/octet-stream"};base64,${bytesToBase64(bytes)}`
}

export function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64")
  }
  let binary = ""
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!)
  return btoa(binary)
}

export function base64ToBytes(b64: string): Uint8Array {
  if (typeof Buffer !== "undefined") return new Uint8Array(Buffer.from(b64, "base64"))
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}
