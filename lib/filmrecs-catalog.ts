/**
 * lib/filmrecs-catalog.ts — Map Films-list tasks ↔ FilmRecord + Letterboxd merge
 */
import type { AttributeValue, Task, List } from "@/lib/types"
import { createListItem, withCategoryDefaults } from "@/lib/item-utils"
import {
  FILM_ATTR,
  FILMRECS_SHELVES,
  type FilmRecord,
  type FilmSource,
  normalizeFilmTitle,
} from "@/lib/filmrecs-types"
import type {
  LetterboxdExportBundle,
  LetterboxdFilmRow,
  LetterboxdParseResult,
} from "@/lib/letterboxd-parse"

function asString(v: AttributeValue | undefined): string | undefined {
  if (v == null) return undefined
  if (typeof v === "string") return v
  if (typeof v === "number" || typeof v === "boolean") return String(v)
  return undefined
}

function asNumber(v: AttributeValue | undefined): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v
  if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return Number(v)
  return null
}

function asBool(v: AttributeValue | undefined): boolean {
  return v === true || v === "true" || v === 1
}

function asStringList(v: AttributeValue | undefined): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x)).filter(Boolean)
  if (typeof v === "string" && v.trim()) return v.split(/[,;]/).map((s) => s.trim()).filter(Boolean)
  return []
}

export function taskToFilm(task: Task, shelves: readonly string[] = FILMRECS_SHELVES): FilmRecord {
  const attrs = task.attributes || {}
  const shelf = asString(attrs[FILM_ATTR.shelf]) || null
  const shelfId = shelf ? shelves.indexOf(shelf) : -1
  return {
    id: task.id,
    title: task.description || "Untitled",
    year: asNumber(attrs[FILM_ATTR.year]),
    shelf,
    shelfId: shelfId >= 0 ? shelfId : null,
    source: (asString(attrs[FILM_ATTR.source]) as FilmSource) || null,
    liked: asBool(attrs[FILM_ATTR.liked]),
    favorited: asBool(attrs[FILM_ATTR.favorited]),
    rating: asNumber(attrs[FILM_ATTR.rating]),
    genres: asStringList(attrs[FILM_ATTR.genres]),
    poster: asString(attrs[FILM_ATTR.poster]) || null,
    url: asString(attrs[FILM_ATTR.letterboxdUrl]) || null,
    overview: asString(attrs[FILM_ATTR.overview]) || null,
    watchedDate: asString(attrs[FILM_ATTR.watchedDate]) || null,
  }
}

export function filmToAttributes(film: Partial<FilmRecord>): Record<string, AttributeValue> {
  const out: Record<string, AttributeValue> = {}
  if (film.year != null) out[FILM_ATTR.year] = film.year
  if (film.shelf) out[FILM_ATTR.shelf] = film.shelf
  else if (film.shelfId != null && FILMRECS_SHELVES[film.shelfId]) {
    out[FILM_ATTR.shelf] = FILMRECS_SHELVES[film.shelfId]
  }
  if (film.source) out[FILM_ATTR.source] = film.source
  if (film.liked != null) out[FILM_ATTR.liked] = film.liked
  if (film.favorited != null) out[FILM_ATTR.favorited] = film.favorited
  if (film.rating != null) out[FILM_ATTR.rating] = film.rating
  if (film.genres?.length) out[FILM_ATTR.genres] = film.genres
  if (film.poster) out[FILM_ATTR.poster] = film.poster
  if (film.url) out[FILM_ATTR.letterboxdUrl] = film.url
  if (film.overview) out[FILM_ATTR.overview] = film.overview
  if (film.watchedDate) out[FILM_ATTR.watchedDate] = film.watchedDate
  return out
}

export interface SeedFilm {
  title: string
  year?: number | null
  shelf_id?: number | null
  source?: string | null
  liked?: boolean
  rating?: number | null
  genres?: string[]
  poster?: string | null
  url?: string | null
  overview?: string | null
}

export function seedFilmToTask(category: List, film: SeedFilm): Task {
  const shelf =
    film.shelf_id != null && film.shelf_id >= 0 ? FILMRECS_SHELVES[film.shelf_id] : undefined
  const attrs = filmToAttributes({
    year: film.year,
    shelf,
    shelfId: film.shelf_id,
    source: (film.source as FilmSource) || (film.liked ? "likes" : "watchlist"),
    liked: !!film.liked,
    rating: film.rating,
    genres: film.genres,
    poster: film.poster,
    url: film.url,
    overview: film.overview,
  })
  return withCategoryDefaults(
    { ...createListItem(film.title, [category.id]), attributes: attrs },
    category,
  )
}

export interface MergeStats {
  added: number
  updated: number
  parsed: number
  kind: string
  files?: number
}

function sourceFromRow(row: LetterboxdFilmRow, prevSource?: string | null): FilmSource {
  const liked = row.liked
  const queued = row.queued
  if ((queued && liked) || (queued && prevSource === "likes") || (liked && prevSource === "watchlist")) {
    return "both"
  }
  if (queued) return "watchlist"
  if (liked) return "likes"
  if (row.watched) return "watched"
  return "added"
}

/** Build create/update ops from a Letterboxd parse/bundle against existing Films tasks. */
export function planLetterboxdMerge(
  category: List,
  existing: Task[],
  parsed: LetterboxdParseResult | LetterboxdExportBundle,
): { create: Task[]; update: Task[]; stats: MergeStats } {
  const byTitle = new Map<string, Task>()
  for (const t of existing) {
    byTitle.set(normalizeFilmTitle(t.description || ""), t)
  }
  const create: Task[] = []
  const update: Task[] = []

  for (const row of parsed.films) {
    const key = normalizeFilmTitle(row.title)
    const existingTask = byTitle.get(key)
    const prev = existingTask ? asString(existingTask.attributes?.[FILM_ATTR.source]) : null
    const liked = row.liked || row.exportKind === "likes"
    const source = sourceFromRow({ ...row, liked }, prev)

    const patch = filmToAttributes({
      year: row.year,
      source,
      liked,
      rating: row.rating ?? (liked ? 4.5 : null),
      url: row.url,
      genres: row.tags.length ? row.tags : undefined,
      watchedDate: row.watchedDate,
    })

    if (existingTask) {
      const next = {
        ...existingTask,
        attributes: { ...(existingTask.attributes || {}), ...patch },
      }
      update.push(next)
      byTitle.set(key, next)
    } else {
      const task = withCategoryDefaults(
        { ...createListItem(row.title, [category.id]), attributes: patch },
        category,
      )
      create.push(task)
      byTitle.set(key, task)
    }
  }

  return {
    create,
    update,
    stats: {
      added: create.length,
      updated: update.length,
      parsed: parsed.count,
      kind: parsed.kind,
      files: "files" in parsed ? parsed.files.length : 1,
    },
  }
}

export function partitionFilms(films: FilmRecord[]): {
  watchlist: FilmRecord[]
  likes: FilmRecord[]
  favorites: FilmRecord[]
} {
  const likes = films.filter((f) => f.liked || f.source === "likes")
  const queue = films.filter(
    (f) =>
      !f.liked &&
      f.source !== "likes" &&
      (f.source === "watchlist" ||
        f.source === "both" ||
        f.source === "added" ||
        f.source === "watched" ||
        !f.source),
  )
  return {
    watchlist: queue.length ? queue : films.filter((f) => !f.liked),
    likes,
    favorites: films.filter((f) => f.favorited),
  }
}
