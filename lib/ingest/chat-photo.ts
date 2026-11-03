/**
 * lib/ingest/chat-photo.ts — a picked image file → the attachment BIM chat sends
 *
 * Telegram hands the executor a photo as a data URL; BIM chat does the same.
 * The long edge is capped and the file re-encoded as JPEG so a 12 MP camera
 * shot does not bloat the held copy. If the canvas is missing or the decode
 * fails, the original bytes go through unchanged.
 */
import type { IncomingAttachment } from "./types"

const MAX_EDGE = 2000

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ""))
    reader.onerror = () => reject(reader.error ?? new Error("Could not read that photo"))
    reader.readAsDataURL(file)
  })
}

function decode(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("decode"))
    img.src = dataUrl
  })
}

export async function chatPhotoFromFile(file: File): Promise<IncomingAttachment> {
  const raw = await readAsDataUrl(file)
  const name = file.name || "photo.jpg"
  try {
    if (typeof document === "undefined") throw new Error("no canvas")
    const img = await decode(raw)
    const w = img.naturalWidth || img.width
    const h = img.naturalHeight || img.height
    const scale = Math.min(1, MAX_EDGE / Math.max(w, h))
    const canvas = document.createElement("canvas")
    canvas.width = Math.max(1, Math.round(w * scale))
    canvas.height = Math.max(1, Math.round(h * scale))
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("no canvas")
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return { kind: "photo", mime: "image/jpeg", name: name.replace(/\.[^.]+$/, "") + ".jpg", dataUrl: canvas.toDataURL("image/jpeg", 0.86) }
  } catch {
    return { kind: "photo", mime: file.type || "image/jpeg", name, dataUrl: raw }
  }
}
