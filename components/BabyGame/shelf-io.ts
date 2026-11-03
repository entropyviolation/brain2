/**
 * components/BabyGame/shelf-io.ts — Getting a PDF onto a friend's bookshelf, and its words back off it
 *
 * The browser half of `lib/baby-game/shelf.ts`. A dropped PDF (or .txt / .md) is read page by page with pdfjs,
 * which loads only when a book is shelved. The file and its text go to the app's attachment store
 * (`lib/attachments.ts`, IndexedDB); the save keeps only the `Book` metadata.
 */

import { deleteAttachment, getAttachment, putAttachment } from "@/lib/attachments"
import type { Book } from "@/lib/baby-game/shelf"

export const BOOK_ACCEPT = ".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
/** Past this many characters only the start is kept; a friend reads about 2,400 a sitting. */
const MAX_CHARS = 400_000

async function pdfPages(file: File): Promise<{ pages: string[]; title?: string }> {
  const pdfjs = await import("pdfjs-dist")
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
  const pages: string[] = []
  let total = 0
  for (let n = 1; n <= doc.numPages && total < MAX_CHARS; n++) {
    const content = await (await doc.getPage(n)).getTextContent()
    const text = content.items.map((i) => ("str" in i ? i.str : "")).join(" ").replace(/\s+/g, " ").trim()
    pages.push(text)
    total += text.length + 1
  }
  let title: string | undefined
  try {
    const meta = (await doc.getMetadata()) as { info?: { Title?: string } }
    title = meta.info?.Title?.trim() || undefined
  } catch {
    // no metadata is fine
  }
  return { pages, title }
}

/** Read a file into a shelf-ready book. Throws with a plain message when there are no words to read. */
export async function bookFromFile(file: File): Promise<Omit<Book, "at" | "readings" | "addedDay" | "spine">> {
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name)
  let pages: string[]
  let title: string | undefined
  if (isPdf) ({ pages, title } = await pdfPages(file))
  else pages = (await file.text()).split(/\f|\n{3,}/).map((p) => p.replace(/\s+/g, " ").trim())
  const pageStarts: number[] = []
  let text = ""
  for (const p of pages) {
    pageStarts.push(text.length)
    text += (text ? " " : "") + p
  }
  text = text.slice(0, MAX_CHARS)
  if (text.replace(/\s/g, "").length < 40) throw new Error("No words came out of that file. A scanned PDF needs its text recognized first.")
  const id = `bk_${crypto.randomUUID()}`
  const fileUri = await putAttachment(`${id}_file`, file, { name: file.name, mime: file.type || (isPdf ? "application/pdf" : "text/plain") })
  const textUri = await putAttachment(`${id}_text`, new Blob([text], { type: "text/plain" }), { name: `${file.name}.txt`, mime: "text/plain" })
  textCache.set(textUri, text)
  const fromName = file.name.replace(/\.(pdf|txt|md)$/i, "").replace(/[_-]+/g, " ").trim()
  return { id, title: (title && title.length < 90 ? title : fromName).slice(0, 90) || "Untitled", fileUri, textUri, chars: text.length, pageStarts }
}

const textCache = new Map<string, string>()

/** A shelved book's words, or null if the store lost them. */
export async function bookText(book: Pick<Book, "textUri">): Promise<string | null> {
  const hit = textCache.get(book.textUri)
  if (hit) return hit
  try {
    const rec = await getAttachment(book.textUri)
    if (!rec) return null
    const text = await rec.blob.text()
    textCache.set(book.textUri, text)
    return text
  } catch {
    return null
  }
}

/** Open the original file in a new tab. */
export async function openBookFile(book: Pick<Book, "fileUri">): Promise<void> {
  const rec = await getAttachment(book.fileUri)
  if (!rec) return
  const url = URL.createObjectURL(rec.blob)
  window.open(url, "_blank", "noopener")
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/** Forget a book's file and words. */
export async function dropBookFiles(book: Pick<Book, "fileUri" | "textUri">): Promise<void> {
  textCache.delete(book.textUri)
  await Promise.allSettled([deleteAttachment(book.fileUri), deleteAttachment(book.textUri)])
}
