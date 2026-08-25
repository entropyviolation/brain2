/**
 * lib/letterboxd-parse.ts — Letterboxd CSV / export-folder parser
 *
 * Letterboxd has no public personal API. A data export is a **folder** (or zip)
 * with many CSVs — watchlist.csv, watched.csv, ratings.csv, diary.csv,
 * likes/films.csv, lists/*, plus noise (profile, comments, deleted, orphaned).
 * We ingest the film catalog files and merge by title.
 */
import { normalizeFilmTitle } from "@/lib/filmrecs-types"

export type LetterboxdExportKind =
  | "watchlist"
  | "likes"
  | "ratings"
  | "diary"
  | "watched"
  | "empty"
  | "unknown"
  | "bundle"

export interface LetterboxdFilmRow {
  title: string
  year: number | null
  rating: number | null
  url: string | null
  tags: string[]
  watchedDate: string | null
  liked: boolean
  watched: boolean
  queued: boolean
  exportKind: LetterboxdExportKind
}

export interface LetterboxdParseResult {
  kind: LetterboxdExportKind
  films: LetterboxdFilmRow[]
  columns: string[]
  count: number
}

export interface LetterboxdFileInput {
  /** Relative path inside the export, e.g. `likes/films.csv` or `watchlist.csv`. */
  path: string
  text: string
}

export interface LetterboxdFileStat {
  path: string
  kind: LetterboxdExportKind
  count: number
}

/** Merged multi-file Letterboxd data export. */
export interface LetterboxdExportBundle {
  kind: "bundle"
  films: LetterboxdFilmRow[]
  files: LetterboxdFileStat[]
  skipped: string[]
  count: number
  /** Best-effort label from folder name / profile. */
  label?: string
}

function normHeader(h: string): string {
  return (h || "").toLowerCase().replace(/[^a-z0-9]+/g, "")
}

const HEADER_MAP: Record<string, string> = {
  name: "title",
  title: "title",
  filmname: "title",
  year: "year",
  releasedyear: "year",
  rating: "rating",
  yourrating: "rating",
  memberrating: "rating",
  letterboxduri: "url",
  uri: "url",
  url: "url",
  date: "date",
  watcheddate: "watched_date",
  dateday: "watched_date",
  tags: "tags",
  tag: "tags",
  review: "review",
  rewatch: "rewatch",
}

/** Apply catalog files in this order so later files enrich earlier rows. */
const MERGE_ORDER: LetterboxdExportKind[] = ["watched", "watchlist", "ratings", "diary", "likes"]

export function parseRating(raw: unknown): number | null {
  if (raw == null || raw === "") return null
  const s = String(raw).trim()
  const n = Number.parseFloat(s)
  if (Number.isFinite(n)) {
    if (n > 0 && n <= 5) return n
    if (n > 5 && n <= 10) return Math.round(n) / 2
  }
  if (s.includes("★") || s.includes("½")) {
    const full = (s.match(/★/g) || []).length
    const half = s.includes("½") ? 0.5 : 0
    return full || half ? full + half : null
  }
  return null
}

export function detectExportKind(filename = "", headers: string[] = [], sample = ""): LetterboxdExportKind {
  const blob = `${filename} ${sample}`.toLowerCase()
  const norms = new Set(headers.map(normHeader))
  if (norms.has("rewatch") || norms.has("review")) return "diary"
  if (norms.has("rating") && norms.has("letterboxduri") && norms.has("date")) {
    if (norms.has("watcheddate") || norms.has("rewatch")) return "diary"
    return "ratings"
  }
  if (/(watchlist)/.test(blob)) return "watchlist"
  if (/\blikes?\b|\bliked\b/.test(blob)) return "likes"
  if (/\bratings?\b|\brated\b/.test(blob)) return "ratings"
  if (/\bdiary\b|\blogged\b/.test(blob)) return "diary"
  if (/\bwatched\b/.test(blob)) return "watched"
  if (norms.has("rating")) return "ratings"
  return "watchlist"
}

/**
 * Classify a path inside a Letterboxd export folder.
 * Returns `skip` for profile/comments/deleted/orphaned/non-film likes files.
 */
export function classifyLetterboxdPath(path: string): LetterboxdExportKind | "skip" {
  const p = path.replace(/\\/g, "/").replace(/^\.?\//, "").toLowerCase()
  if (
    /(^|\/)deleted\//.test(p) ||
    /(^|\/)orphaned\//.test(p) ||
    /(^|\/)profile\.csv$/.test(p) ||
    /(^|\/)comments\.csv$/.test(p) ||
    /(^|\/)reviews\.csv$/.test(p) ||
    /(^|\/)likes\/(lists|reviews)\.csv$/.test(p)
  ) {
    return "skip"
  }
  if (/(^|\/)likes\/films\.csv$/.test(p) || /(^|\/)likes\.csv$/.test(p)) return "likes"
  if (/(^|\/)watchlist\.csv$/.test(p)) return "watchlist"
  if (/(^|\/)watched\.csv$/.test(p)) return "watched"
  if (/(^|\/)ratings\.csv$/.test(p)) return "ratings"
  if (/(^|\/)diary\.csv$/.test(p)) return "diary"
  // Custom lists (e.g. lists/want-to-watch.csv) → treat as queue
  if (/(^|\/)lists\/[^/]+\.csv$/.test(p)) return "watchlist"
  return "skip"
}

/** RFC-style CSV split that handles quoted commas and "" escapes. */
export function parseCsvText(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ""
  let q = false
  const src = text.replace(/^\ufeff/, "")
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (q) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          cell += '"'
          i++
        } else q = false
      } else cell += c
    } else if (c === '"') q = true
    else if (c === ",") {
      row.push(cell)
      cell = ""
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++
      row.push(cell)
      if (row.some((x) => x !== "")) rows.push(row)
      row = []
      cell = ""
    } else cell += c
  }
  row.push(cell)
  if (row.some((x) => x !== "")) rows.push(row)
  return rows
}

export function parseLetterboxdCsv(text: string, filename = ""): LetterboxdParseResult {
  const rows = parseCsvText(text)
  if (!rows.length) return { kind: "empty", films: [], columns: [], count: 0 }

  const headers = rows[0]
  const mapped = headers.map((h) => HEADER_MAP[normHeader(h)] ?? null)
  const pathKind = filename ? classifyLetterboxdPath(filename) : "skip"
  const kind: LetterboxdExportKind =
    pathKind !== "skip" ? pathKind : detectExportKind(filename, headers, text.slice(0, 400))

  const films: LetterboxdFilmRow[] = []
  const seen = new Set<string>()

  for (const row of rows.slice(1)) {
    if (!row.some((cell) => (cell || "").trim())) continue
    const item: LetterboxdFilmRow = {
      title: "",
      year: null,
      rating: null,
      url: null,
      tags: [],
      watchedDate: null,
      liked: false,
      watched: false,
      queued: false,
      exportKind: kind,
    }
    for (let i = 0; i < mapped.length; i++) {
      const key = mapped[i]
      const val = (row[i] || "").trim()
      if (!key || !val) continue
      if (key === "title") item.title = val
      else if (key === "year") {
        const m = val.match(/(19|20)\d{2}/)
        if (m) item.year = Number.parseInt(m[0], 10)
      } else if (key === "rating") item.rating = parseRating(val)
      else if (key === "url") item.url = val
      else if (key === "tags") item.tags = val.split(/[,;]/).map((t) => t.trim()).filter(Boolean)
      else if (key === "date" || key === "watched_date") item.watchedDate = val
    }
    if (!item.title) {
      for (const cell of row) {
        const t = (cell || "").trim()
        if (t && !/^\d{4}$/.test(t) && !/^https?:\/\//i.test(t)) {
          item.title = t
          break
        }
      }
    }
    if (!item.title) continue
    // likes/lists.csv and similar Content-only rows aren't films
    if (/^https?:\/\//i.test(item.title) && item.year == null) continue
    const k = normalizeFilmTitle(item.title)
    if (seen.has(k)) continue
    seen.add(k)

    item.liked =
      kind === "likes" || (item.rating != null && item.rating >= 4 && kind === "ratings")
    item.watched = kind === "watched" || kind === "diary" || kind === "ratings" || kind === "likes"
    item.queued = kind === "watchlist"
    films.push(item)
  }

  return { kind, films, columns: headers, count: films.length }
}

function mergeFilmRow(into: LetterboxdFilmRow, from: LetterboxdFilmRow): LetterboxdFilmRow {
  return {
    title: into.title,
    year: into.year ?? from.year,
    rating: from.rating ?? into.rating,
    url: from.url || into.url,
    tags: [...new Set([...into.tags, ...from.tags])],
    watchedDate: from.watchedDate || into.watchedDate,
    liked: into.liked || from.liked,
    watched: into.watched || from.watched,
    queued: into.queued || from.queued,
    exportKind: "bundle",
  }
}

function folderLabelFromPaths(paths: string[]): string | undefined {
  for (const path of paths) {
    const parts = path.replace(/\\/g, "/").split("/").filter(Boolean)
    if (parts.length >= 2) {
      const root = parts[0]
      const withDate = root.match(/^letterboxd-(.+?)-\d{4}-\d{2}-\d{2}/i)
      if (withDate) return withDate[1]
      const bare = root.match(/^letterboxd-(.+)$/i)
      if (bare) return bare[1]
    }
  }
  return undefined
}

/**
 * Parse a full Letterboxd export folder (or a multi-file selection) into one
 * deduped catalog. Skips deleted/orphaned/profile/comments noise.
 */
export function parseLetterboxdExportBundle(files: LetterboxdFileInput[]): LetterboxdExportBundle {
  const skipped: string[] = []
  const parsedFiles: { path: string; kind: LetterboxdExportKind; result: LetterboxdParseResult }[] = []

  for (const file of files) {
    const path = file.path || "unknown.csv"
    if (!/\.csv$/i.test(path)) {
      skipped.push(path)
      continue
    }
    let kind = classifyLetterboxdPath(path)
    // Flat multi-select may lose folder context (likes/films.csv → films.csv).
    if (kind === "skip") {
      const base = path.replace(/\\/g, "/").split("/").pop() || path
      if (/^films\.csv$/i.test(base)) kind = "likes"
    }
    if (kind === "skip") {
      skipped.push(path)
      continue
    }
    const result = parseLetterboxdCsv(file.text, path)
    if (result.kind === "empty" || !result.films.length) {
      skipped.push(path)
      continue
    }
    parsedFiles.push({ path, kind, result: { ...result, kind } })
  }

  // Stable merge order
  parsedFiles.sort((a, b) => MERGE_ORDER.indexOf(a.kind) - MERGE_ORDER.indexOf(b.kind))

  const byTitle = new Map<string, LetterboxdFilmRow>()
  for (const { result } of parsedFiles) {
    for (const row of result.films) {
      const key = normalizeFilmTitle(row.title)
      const prev = byTitle.get(key)
      byTitle.set(key, prev ? mergeFilmRow(prev, row) : { ...row, exportKind: "bundle" })
    }
  }

  const films = [...byTitle.values()]
  return {
    kind: "bundle",
    films,
    files: parsedFiles.map((f) => ({ path: f.path, kind: f.kind, count: f.result.count })),
    skipped,
    count: films.length,
    label: folderLabelFromPaths(files.map((f) => f.path)),
  }
}

/** Read a FileList / File[] (folder pick or multi-select) into parse inputs. */
export async function readLetterboxdFiles(fileList: ArrayLike<File>): Promise<LetterboxdFileInput[]> {
  const files = Array.from(fileList)
  const out: LetterboxdFileInput[] = []
  for (const file of files) {
    const path = file.webkitRelativePath || file.name
    if (!/\.csv$/i.test(path)) continue
    const text = await file.text()
    out.push({ path, text })
  }
  return out
}
