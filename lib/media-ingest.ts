/**
 * lib/media-ingest.ts — Turn a dropped or chosen File into Photo / Document
 * attributes. Bytes go to the attachments store; the item keeps `idb:` refs.
 * Best effort: a failed preview never blocks the add.
 */
import { putAttachment } from "@/lib/attachments"
import { DOCUMENT_ATTR } from "@/lib/document-types"
import { extractText } from "@/lib/file-extract"
import { PHOTO_ATTR } from "@/lib/photo-types"
import type { AttributeValue, FileValue } from "@/lib/types"

type Attrs = Record<string, AttributeValue>

const EXCERPT_CHARS = 700

function fileValue(uri: string, f: File): FileValue {
  return { id: crypto.randomUUID(), name: f.name, mime: f.type, uri, size: f.size }
}

export function titleFromFileName(name: string): string {
  return name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || name
}

export async function photoAttrsFromFile(file: File): Promise<Attrs> {
  const uri = await putAttachment(`img_${crypto.randomUUID()}`, file, { name: file.name, mime: file.type })
  const attrs: Attrs = { [PHOTO_ATTR.image]: uri, [PHOTO_ATTR.takenAt]: new Date(file.lastModified).toISOString() }
  try {
    const bmp = await createImageBitmap(file)
    attrs[PHOTO_ATTR.width] = bmp.width
    attrs[PHOTO_ATTR.height] = bmp.height
    bmp.close()
  } catch {}
  return attrs
}

async function pdfPreview(file: File): Promise<{ cover?: Blob; text: string; pages: number } | null> {
  try {
    const pdfjs = await import("pdfjs-dist")
    pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
    const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
    const page = await doc.getPage(1)
    const base = page.getViewport({ scale: 1 })
    const viewport = page.getViewport({ scale: 360 / base.width })
    const canvas = document.createElement("canvas")
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext("2d")
    let cover: Blob | undefined
    if (ctx) {
      await page.render({ canvasContext: ctx, viewport } as never).promise
      cover = await new Promise<Blob | undefined>((r) => canvas.toBlob((b) => r(b ?? undefined), "image/jpeg", 0.8))
    }
    const content = await page.getTextContent()
    const text = content.items.map((i) => ("str" in i ? i.str : "")).join(" ").replace(/\s+/g, " ").trim()
    return { cover, text, pages: doc.numPages }
  } catch {
    return null
  }
}

export async function documentAttrsFromFile(file: File): Promise<Attrs> {
  const uri = await putAttachment(`doc_${crypto.randomUUID()}`, file, { name: file.name, mime: file.type })
  const attrs: Attrs = { [DOCUMENT_ATTR.file]: fileValue(uri, file) }
  let excerpt = ""
  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
    const pv = await pdfPreview(file)
    if (pv) {
      excerpt = pv.text
      attrs[DOCUMENT_ATTR.pages] = pv.pages
      if (pv.cover) {
        attrs[DOCUMENT_ATTR.cover] = await putAttachment(`img_${crypto.randomUUID()}`, pv.cover, {
          name: `${file.name}.jpg`,
          mime: "image/jpeg",
        })
      }
    }
  } else {
    excerpt = (await extractText(file)).replace(/^#+\s*/gm, "").replace(/\s+/g, " ")
  }
  if (excerpt) attrs[DOCUMENT_ATTR.excerpt] = excerpt.slice(0, EXCERPT_CHARS)
  return attrs
}
