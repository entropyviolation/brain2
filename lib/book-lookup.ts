/**
 * lib/book-lookup.ts — Cover and size for a book, fetched on purpose.
 *
 * Source: Open Library (ISBN edition, then a title search, then the Covers
 * API). The title search tries a shorter title first (a long subtitle, or a
 * trailing volume numeral) and matches the author's last name. Google Books
 * volumes fill a cover or a measurement Open Library did not return. This
 * module does not call Amazon, and it does not use the Product Advertising API.
 *
 * A hit stores the cover once as an `idb:` attachment on `BOOK_ATTR.cover`
 * (the picture bytes, not a hotlinked URL). Height, width, and thickness are
 * stored in centimeters. A miss is remembered for the session. When the
 * picture itself fails, the cloth spine stays and any measurements still land.
 * Lookup runs only from Fetch covers, a few titles at a time. A picture
 * already stored is left alone. Pictures are saved one at a time: an Open
 * Library cover id, then the ISBN cover, then a Google Books image. Google
 * image links often cannot be read from the page, and a cover id of -1 is
 * not a picture. The catalog and the cover bytes are fetched in the browser.
 * This app is a static export, so there is no server proxy. Shelf rows of
 * any type are looked up. An empty type is marked book. A task stays a task.
 */
import { blobToDataUrl, putImageDataUrl } from "@/lib/attachments"
import { BOOK_ATTR, BOOK_TYPE_ID } from "@/lib/book-types"
import { normalizeExternalId } from "@/lib/graph/external-ids"
import { itemTitle } from "@/lib/item-utils"
import type { AttributeValue, FileValue, Task } from "@/lib/types"

const USER_AGENT = "Brain2/0.1 (personal library shelf)"
const WAVE = 3
const GAP_MS = 180

export interface PhysicalSize {
  heightCm: number | null
  widthCm: number | null
  thicknessCm: number | null
}

export interface BookLookupHit extends PhysicalSize {
  found: true
  coverUrl: string | null
  isbn: string | null
  author: string | null
  pageCount: number | null
}

export type BookLookupResult = BookLookupHit | { found: false; error?: boolean }

export interface BookLookupQuery {
  isbn?: string | null
  title?: string | null
  author?: string | null
}

export interface ShelfCoverReport {
  /** Titles Open Library or Google Books recognized, with or without a picture. */
  found: number
  /** Pictures actually stored on the book. */
  covers: number
  unmatched: number
  failed: number
  skipped: number
  busy?: boolean
}

const session = new Map<string, BookLookupHit | "miss">()
let busy = false
/** One cover download at a time. A burst is what the cover host refuses. */
let imageQueue: Promise<void> = Promise.resolve()

export function bookLookupBusy(): boolean {
  return busy
}

export function bookLookupKey(query: BookLookupQuery): string {
  const isbn = normalizeExternalId("isbn", query.isbn || "")
  if (isbn) return `isbn:${isbn}`
  const title = (query.title || "").trim().toLowerCase()
  const author = (query.author || "").trim().toLowerCase()
  if (!title) return ""
  return `title:${title}|${author}`
}

export function bookLookupMissed(key: string): boolean {
  return session.get(key) === "miss"
}

export function rememberBookMiss(key: string): void {
  if (key) session.set(key, "miss")
}

/** Test hook. The session cache is otherwise process-wide. */
export function clearBookLookupSession(): void {
  session.clear()
  busy = false
  imageQueue = Promise.resolve()
}

/** Centimeters. One number is height. Three numbers are height, width, thickness. */
export function parsePhysicalDimensions(raw: string | null | undefined): PhysicalSize {
  const empty: PhysicalSize = { heightCm: null, widthCm: null, thicknessCm: null }
  if (!raw?.trim()) return empty
  const factor = unitFactor(raw)
  const nums = [...raw.matchAll(/(\d+(?:\.\d+)?)/g)].map((match) => roundCm(Number(match[1]) * factor))
  if (!nums.length || nums.some((n) => !Number.isFinite(n) || n <= 0)) return empty
  return {
    heightCm: nums[0] ?? null,
    widthCm: nums[1] ?? null,
    thicknessCm: nums[2] ?? null,
  }
}

export function parseLengthToCm(raw: string | null | undefined): number | null {
  return parsePhysicalDimensions(raw).heightCm
}

export async function lookupBook(query: BookLookupQuery, fetchImpl: typeof fetch = fetch): Promise<BookLookupResult> {
  const key = bookLookupKey(query)
  if (!key) return { found: false }
  const cached = session.get(key)
  if (cached === "miss") return { found: false }
  if (cached) return cached
  try {
    const gathered = await gatherBook(query, fetchImpl)
    if (gathered.error) return { found: false, error: true }
    if (!gathered.hit) {
      rememberBookMiss(key)
      return { found: false }
    }
    session.set(key, gathered.hit)
    return gathered.hit
  } catch {
    return { found: false, error: true }
  }
}

export async function storeCoverImage(url: string, name: string, fetchImpl: typeof fetch = fetch): Promise<string | null> {
  const blob = await readImage(fetchImpl, url)
  if (!blob) return null
  try {
    const dataUrl = await blobToDataUrl(blob)
    if (!dataUrl.startsWith("data:image/")) return null
    return await putCover(dataUrl, name || "cover")
  } catch {
    return null
  }
}

export async function fetchShelfBookCovers(
  tasks: readonly Task[],
  write: (task: Task) => void,
  fetchImpl: typeof fetch = fetch,
): Promise<ShelfCoverReport> {
  if (busy) return { found: 0, covers: 0, unmatched: 0, failed: 0, skipped: tasks.length, busy: true }
  busy = true
  const report: ShelfCoverReport = { found: 0, covers: 0, unmatched: 0, failed: 0, skipped: 0 }
  try {
    const queue = tasks.filter(needsLookup)
    report.skipped = tasks.length - queue.length
    for (let index = 0; index < queue.length; index += WAVE) {
      const wave = queue.slice(index, index + WAVE)
      const outcomes = await Promise.all(wave.map((task) => enrichTask(task, write, fetchImpl)))
      for (const outcome of outcomes) {
        if (outcome === "cover") {
          report.covers += 1
          report.found += 1
        } else report[outcome] += 1
      }
      if (index + WAVE < queue.length) await sleep(GAP_MS)
    }
    return report
  } finally {
    busy = false
  }
}

function needsLookup(task: Task): boolean {
  if (!itemTitle(task).trim()) return false
  if (coverUriOf(task)) return false
  const key = bookLookupKey(queryFromTask(task))
  return Boolean(key) && !bookLookupMissed(key)
}

async function enrichTask(task: Task, write: (task: Task) => void, fetchImpl: typeof fetch): Promise<"cover" | "found" | "unmatched" | "failed"> {
  const result = await lookupBook(queryFromTask(task), fetchImpl)
  if (!result.found) return result.error ? "failed" : "unmatched"
  const attrs: Record<string, AttributeValue> = { ...(task.attributes ?? {}) }
  let changed = false
  let savedCover = false
  if (!coverUriOf(task)) {
    for (const url of coverSources(result)) {
      const stored = await storeCoverImage(url, itemTitle(task) || "cover", fetchImpl)
      if (!stored) continue
      attrs[BOOK_ATTR.cover] = stored
      changed = true
      savedCover = true
      break
    }
  }
  changed = fillString(attrs, BOOK_ATTR.author, result.author) || changed
  changed = fillString(attrs, BOOK_ATTR.isbn, result.isbn) || changed
  changed = fillNumber(attrs, BOOK_ATTR.pageCount, result.pageCount) || changed
  changed = fillNumber(attrs, BOOK_ATTR.heightCm, result.heightCm) || changed
  changed = fillNumber(attrs, BOOK_ATTR.widthCm, result.widthCm) || changed
  changed = fillNumber(attrs, BOOK_ATTR.thicknessCm, result.thicknessCm) || changed
  if (changed) {
    write({
      ...task,
      type: task.type || BOOK_TYPE_ID,
      attributes: attrs,
    })
  }
  return savedCover ? "cover" : "found"
}

function queryFromTask(task: Task): BookLookupQuery {
  return {
    isbn: textAttr(task, BOOK_ATTR.isbn) || textAttrMatching(task, /isbn/i),
    title: itemTitle(task),
    author: textAttr(task, BOOK_ATTR.author) || textAttrMatching(task, /author/i),
  }
}

async function gatherBook(query: BookLookupQuery, fetchImpl: typeof fetch): Promise<{ hit: BookLookupHit | null; error: boolean }> {
  const isbn = normalizeExternalId("isbn", query.isbn || "") || ""
  const title = (query.title || "").trim()
  const author = (query.author || "").trim()
  const hit = blankHit(isbn, author)
  let responses = 0
  let failures = 0

  const take = async (url: string): Promise<unknown> => {
    const result = await getJson(fetchImpl, url)
    if (result.network) {
      failures += 1
      return null
    }
    responses += 1
    return result.body
  }

  if (isbn) {
    const edition = await take(`https://openlibrary.org/isbn/${encodeURIComponent(isbn)}.json`)
    if (edition) mergeEdition(hit, edition)
  }

  let searched = false
  if (!hit.coverUrl && title) {
    searched = true
    const doc = await searchOpenLibrary(title, author, take)
    if (doc) {
      mergeSearchDoc(hit, doc)
      const editionIsbn = hit.isbn
      if (editionIsbn && editionIsbn !== isbn && !hasSize(hit)) {
        const edition = await take(`https://openlibrary.org/isbn/${encodeURIComponent(editionIsbn)}.json`)
        if (edition) mergeEdition(hit, edition)
      }
    }
  }

  if (!hit.coverUrl || !hasSize(hit)) {
    const google = googleUrl(isbn || hit.isbn || "", title, author)
    if (google) {
      const body = await take(google)
      mergeGoogle(hit, body)
    }
  }

  const catalog = Boolean(hit.pageCount || hasSize(hit) || hit.coverUrl)
  if (catalog && hit.isbn && !hit.coverUrl) hit.coverUrl = `https://covers.openlibrary.org/b/isbn/${hit.isbn}-L.jpg`
  if (catalog) return { hit, error: false }
  if (failures > 0 && responses === 0) return { hit: null, error: true }
  if (!isbn && !searched && failures > 0 && !useful(hit)) return { hit: null, error: true }
  return { hit: null, error: false }
}

function blankHit(isbn: string, author: string): BookLookupHit {
  return {
    found: true,
    coverUrl: null,
    isbn: isbn || null,
    author: author || null,
    pageCount: null,
    heightCm: null,
    widthCm: null,
    thicknessCm: null,
  }
}

function useful(hit: BookLookupHit): boolean {
  return Boolean(hit.coverUrl || hit.pageCount || hit.heightCm || hit.widthCm || hit.thicknessCm)
}

function hasSize(hit: PhysicalSize): boolean {
  return hit.heightCm != null || hit.widthCm != null || hit.thicknessCm != null
}

function mergeEdition(hit: BookLookupHit, body: unknown): void {
  const edition = asRecord(body)
  if (!edition) return
  const coverId = firstCoverId(edition.covers)
  if (!hit.coverUrl && coverId) hit.coverUrl = coverIdUrl(coverId)
  if (hit.pageCount == null && typeof edition.number_of_pages === "number" && edition.number_of_pages > 0) {
    hit.pageCount = Math.round(edition.number_of_pages)
  }
  if (!hasSize(hit)) fillSize(hit, parsePhysicalDimensions(typeof edition.physical_dimensions === "string" ? edition.physical_dimensions : ""))
  if (!hasSize(hit) && typeof edition.pagination === "string") {
    const marked = edition.pagination.match(/(\d+(?:\.\d+)?)\s*(?:cm|mm|inches|inch|in)\b/i)
    if (marked) fillSize(hit, parsePhysicalDimensions(marked[0]))
  }
  if (!hit.isbn) {
    const isbn13 = stringList(edition.isbn_13)[0]
    const isbn10 = stringList(edition.isbn_10)[0]
    hit.isbn = normalizeExternalId("isbn", isbn13 || isbn10 || "") || null
  }
}

function mergeSearchDoc(hit: BookLookupHit, doc: Record<string, unknown>): void {
  const coverId = firstCoverId([doc.cover_i])
  if (!hit.coverUrl && coverId) hit.coverUrl = coverIdUrl(coverId)
  if (hit.pageCount == null && typeof doc.number_of_pages_median === "number" && doc.number_of_pages_median > 0) {
    hit.pageCount = Math.round(doc.number_of_pages_median)
  }
  if (!hit.author) {
    const names = stringList(doc.author_name)
    if (names[0]) hit.author = names[0]
  }
  if (!hit.isbn) {
    for (const code of stringList(doc.isbn)) {
      const normalized = normalizeExternalId("isbn", code)
      if (normalized) {
        hit.isbn = normalized
        break
      }
    }
  }
}

function mergeGoogle(hit: BookLookupHit, body: unknown): void {
  const info = asRecord(asRecord(firstItem(body))?.volumeInfo)
  if (!info) return
  if (!hit.coverUrl) {
    const links = asRecord(info.imageLinks)
    const url = links ? googleImage(links) : null
    if (url) hit.coverUrl = url
  }
  if (hit.pageCount == null && typeof info.pageCount === "number" && info.pageCount > 0) {
    hit.pageCount = Math.round(info.pageCount)
  }
  if (!hit.author) {
    const names = stringList(info.authors)
    if (names[0]) hit.author = names[0]
  }
  if (!hit.isbn) {
    const ids = Array.isArray(info.industryIdentifiers) ? info.industryIdentifiers : []
    const ranked = ids
      .map((row) => asRecord(row))
      .filter((row): row is Record<string, unknown> => !!row)
      .sort((a, b) => (a.type === "ISBN_13" ? -1 : 1) - (b.type === "ISBN_13" ? -1 : 1))
    for (const row of ranked) {
      const normalized = normalizeExternalId("isbn", typeof row.identifier === "string" ? row.identifier : "")
      if (normalized) {
        hit.isbn = normalized
        break
      }
    }
  }
  if (!hasSize(hit)) {
    const dimensions = asRecord(info.dimensions)
    if (dimensions) {
      fillSize(hit, {
        heightCm: parseLengthToCm(typeof dimensions.height === "string" ? dimensions.height : ""),
        widthCm: parseLengthToCm(typeof dimensions.width === "string" ? dimensions.width : ""),
        thicknessCm: parseLengthToCm(typeof dimensions.thickness === "string" ? dimensions.thickness : ""),
      })
    }
  }
}

function googleUrl(isbn: string, title: string, author: string): string {
  const q = isbn ? `isbn:${isbn}` : title ? [`intitle:${title}`, author ? `inauthor:${author}` : ""].filter(Boolean).join(" ") : ""
  if (!q) return ""
  const url = new URL("https://www.googleapis.com/books/v1/volumes")
  url.searchParams.set("q", q)
  url.searchParams.set("maxResults", "1")
  return url.toString()
}

function googleImage(links: Record<string, unknown>): string | null {
  for (const key of ["extraLarge", "large", "medium", "small", "thumbnail", "smallThumbnail"]) {
    const value = links[key]
    if (typeof value === "string" && value.trim()) return value.trim().replace(/^http:\/\//i, "https://")
  }
  return null
}

function fillSize(hit: PhysicalSize, size: PhysicalSize): void {
  if (hit.heightCm == null) hit.heightCm = size.heightCm
  if (hit.widthCm == null) hit.widthCm = size.widthCm
  if (hit.thicknessCm == null) hit.thicknessCm = size.thicknessCm
}

async function getJson(fetchImpl: typeof fetch, url: string): Promise<{ network: true } | { network: false; body: unknown }> {
  try {
    const response = await fetchImpl(url, { headers: { Accept: "application/json", "User-Agent": USER_AGENT } })
    if (!response.ok) return { network: false, body: null }
    return { network: false, body: await response.json() }
  } catch {
    return { network: true }
  }
}

/** Open Library id, then ISBN covers (10 and 13), then a Google image link. */
function coverSources(hit: BookLookupHit): string[] {
  const urls: string[] = []
  const add = (url: string | null | undefined) => {
    const next = url?.trim()
    if (!next || urls.includes(next)) return
    urls.push(next)
  }
  if (hit.coverUrl && !isGoogleCover(hit.coverUrl)) add(hit.coverUrl)
  for (const isbn of isbnCoverCandidates(hit.isbn)) add(isbnCoverUrl(isbn))
  add(hit.coverUrl)
  return urls
}

function coverIdUrl(id: number): string {
  return `https://covers.openlibrary.org/b/id/${id}-L.jpg`
}

function isbnCoverUrl(isbn: string): string {
  return `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`
}

function isbnCoverCandidates(isbn: string | null): string[] {
  if (!isbn) return []
  const raw = isbn.replace(/[^0-9Xx]/g, "").toUpperCase()
  if (raw.length !== 10 && raw.length !== 13) return []
  const wider = raw.length === 10 ? isbn10To13(raw) : null
  return wider && wider !== raw ? [raw, wider] : [raw]
}

function isbn10To13(isbn10: string): string | null {
  if (!/^\d{9}[\dX]$/.test(isbn10)) return null
  const core = `978${isbn10.slice(0, 9)}`
  let sum = 0
  for (let i = 0; i < 12; i++) sum += Number(core[i]) * (i % 2 === 0 ? 1 : 3)
  return `${core}${(10 - (sum % 10)) % 10}`
}

function isGoogleCover(url: string): boolean {
  return /(?:books\.google|googleusercontent|gstatic)\./i.test(url)
}

/** `-1` is Open Library's empty cover. It is not a picture. */
function firstCoverId(value: unknown): number | null {
  if (typeof value === "number") return value > 0 ? value : null
  if (!Array.isArray(value)) return null
  for (const entry of value) {
    if (typeof entry === "number" && entry > 0) return entry
  }
  return null
}

/** One picture at a time. A burst of cover downloads is what the cover host refuses. */
function oneImageAtATime<T>(job: () => Promise<T>): Promise<T> {
  const run = imageQueue.then(job, job)
  imageQueue = run.then(
    () => sleep(GAP_MS),
    () => sleep(GAP_MS),
  )
  return run
}

async function putCover(dataUrl: string, name: string): Promise<string | null> {
  try {
    return await putImageDataUrl(dataUrl, name)
  } catch {
    await sleep(GAP_MS)
    try {
      return await putImageDataUrl(dataUrl, name)
    } catch {
      return null
    }
  }
}

async function readImage(fetchImpl: typeof fetch, url: string): Promise<Blob | null> {
  return oneImageAtATime(async () => {
    const first = await fetchImageBlob(fetchImpl, url)
    if (first.blob || !first.retry) return first.blob
    await sleep(400)
    const second = await fetchImageBlob(fetchImpl, url)
    return second.blob
  })
}

async function fetchImageBlob(fetchImpl: typeof fetch, url: string): Promise<{ blob: Blob | null; retry: boolean }> {
  try {
    const response = await fetchImpl(url)
    if (response.status === 429 || response.status === 503) return { blob: null, retry: true }
    if (!response.ok) return { blob: null, retry: false }
    const raw = await response.blob()
    const bytes = new Uint8Array(await raw.arrayBuffer())
    const type = sniffImage(bytes)
    if (!type || bytes.byteLength < 400) return { blob: null, retry: false }
    return { blob: new Blob([bytes], { type }), retry: false }
  } catch {
    return { blob: null, retry: true }
  }
}

function sniffImage(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg"
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png"
  if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return "image/gif"
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp"
  }
  return null
}

function coverUriOf(task: Task): string | null {
  const value = task.attributes?.[BOOK_ATTR.cover]
  if (typeof value === "string" && value.trim()) return value.trim()
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const uri = (value as FileValue).uri
    if (typeof uri === "string" && uri.trim()) return uri.trim()
  }
  return null
}

function textAttr(task: Task, id: string): string {
  const value = task.attributes?.[id]
  return typeof value === "string" ? value.trim() : ""
}

function textAttrMatching(task: Task, pattern: RegExp): string {
  for (const [key, value] of Object.entries(task.attributes ?? {})) {
    if (!pattern.test(key) || typeof value !== "string") continue
    const text = value.trim()
    if (text) return text
  }
  return ""
}

function fillString(attrs: Record<string, AttributeValue>, id: string, value: string | null): boolean {
  if (!value?.trim()) return false
  const current = attrs[id]
  if (typeof current === "string" && current.trim()) return false
  if (current != null && current !== "") return false
  attrs[id] = value.trim()
  return true
}

function fillNumber(attrs: Record<string, AttributeValue>, id: string, value: number | null): boolean {
  if (value == null || !(value > 0)) return false
  const current = attrs[id]
  if (typeof current === "number" && current > 0) return false
  if (typeof current === "string" && Number(current) > 0) return false
  attrs[id] = value
  return true
}

function unitFactor(raw: string): number {
  const text = raw.toLowerCase()
  if (/inch|"/.test(text) || /\bin\b/.test(text)) return 2.54
  if (/\bmm\b/.test(text)) return 0.1
  return 1
}

function roundCm(value: number): number {
  return Math.round(value * 100) / 100
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is string => typeof entry === "string" && entry.trim() !== "")
}

const SEARCH_FIELDS = "title,author_name,isbn,cover_i,number_of_pages_median"

/** Shorter title first: a specific subtitle, then a trailing volume numeral, then the full title. */
function searchTitleVariants(title: string): string[] {
  const full = title.trim()
  const shorter: string[] = []
  const colon = full.split(/\s*:\s+/)
  const head = colon.length > 1 ? colon[0].trim() : full
  if (colon.length > 1 && head.toLowerCase() !== full.toLowerCase()) {
    const words = head.split(/\s+/).filter(Boolean)
    const specific = (words.length >= 2 && head.length >= 12) || (words.length === 1 && head.length >= 4)
    if (specific) shorter.push(head)
  }
  const roman = head.replace(/\s+(?:i{1,3}|iv|vi{0,3}|ix|x)$/i, "").trim()
  if (roman.length >= 4 && roman.toLowerCase() !== head.toLowerCase() && roman.toLowerCase() !== full.toLowerCase()) {
    shorter.push(roman)
  }
  const seen = new Set<string>()
  const unique: string[] = []
  for (const variant of [...shorter, full]) {
    const key = variant.toLowerCase()
    if (!variant || seen.has(key)) continue
    seen.add(key)
    unique.push(variant)
  }
  return unique
}

function authorLastName(author: string): string {
  const parts = author
    .replace(/\([^)]*\)/g, " ")
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
  while (parts.length > 1 && /^(jr|sr|phd|md|ed|eds)\.?$/i.test(parts[parts.length - 1])) parts.pop()
  return parts[parts.length - 1] || ""
}

function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
}

function authorMatches(doc: Record<string, unknown>, last: string): boolean {
  const want = fold(last).replace(/[^a-z0-9]/g, "")
  if (!want) return true
  return stringList(doc.author_name).some((name) =>
    fold(name)
      .split(/\s+/)
      .some((token) => token.replace(/[^a-z0-9]/g, "") === want),
  )
}

function titleScore(wanted: string, got: string): number {
  const a = fold(wanted).replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim()
  const b = fold(got).replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim()
  if (!a || !b) return 0
  if (a === b) return 5
  if (b.startsWith(`${a} `)) return 4
  const words = a.split(" ").filter((word) => word.length > 3)
  if (words.length >= 2 && words.every((word) => b.includes(word))) return 3
  return 0
}

function chooseSearchDoc(docs: readonly Record<string, unknown>[], title: string, last: string): Record<string, unknown> | null {
  const ranked = docs
    .map((doc) => ({
      doc,
      score: titleScore(title, typeof doc.title === "string" ? doc.title : ""),
      author: authorMatches(doc, last),
      cover: firstCoverId([doc.cover_i]) != null,
    }))
    .filter((row) => row.score > 0 && row.author)
    .sort((a, b) => Number(b.cover) - Number(a.cover) || b.score - a.score)
  return ranked[0]?.doc ?? null
}

function docList(body: unknown): Record<string, unknown>[] {
  const docs = asRecord(body)?.docs
  if (!Array.isArray(docs)) return []
  return docs.map((doc) => asRecord(doc)).filter((doc): doc is Record<string, unknown> => !!doc)
}

async function searchOpenLibrary(
  title: string,
  author: string,
  take: (url: string) => Promise<unknown>,
): Promise<Record<string, unknown> | null> {
  const last = authorLastName(author)
  const variants = searchTitleVariants(title)
  let fallback: Record<string, unknown> | null = null
  for (const variant of variants) {
    const params = new URLSearchParams({ title: variant, limit: "8", fields: SEARCH_FIELDS })
    if (last) params.set("author", last)
    const doc = chooseSearchDoc(docList(await take(`https://openlibrary.org/search.json?${params}`)), variant, last)
    if (doc && firstCoverId([doc.cover_i])) return doc
    if (!fallback && doc) fallback = doc
  }
  const qTitle = variants[0] || title
  if (qTitle) {
    const params = new URLSearchParams({
      q: [qTitle, last].filter(Boolean).join(" "),
      limit: "8",
      fields: SEARCH_FIELDS,
    })
    if (last) params.set("author", last)
    const doc = chooseSearchDoc(docList(await take(`https://openlibrary.org/search.json?${params}`)), qTitle, last)
    if (doc && firstCoverId([doc.cover_i])) return doc
    if (!fallback && doc) fallback = doc
  }
  return fallback
}

function firstItem(body: unknown): unknown {
  const items = asRecord(body)?.items
  return Array.isArray(items) ? items[0] : null
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
