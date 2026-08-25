/**
 * lib/filmrecs-types.ts — Film DNA Lab catalog shapes
 *
 * Shared film record used by scoring, Letterboxd import, and the Film DNA
 * workspace view. Attribute ids on the Films list match these field names
 * (except `title` which is the item description).
 */

export const FILMRECS_SHELVES = [
  "Time loops, doubles & puzzle-box sci-fi",
  "Simulations, dystopias & sci-fi thrillers",
  "Cosmic & transcendental",
  "Math & obsessive genius",
  "Surrealism & dream logic",
  "Art-house canon & slow cinema",
  "Maximalist fantasy & handmade worlds",
  "Animation",
  "Horror & the uncanny",
  "Cult, camp & midnight",
  "Hong Kong neon & Tokyo deep cuts",
  "Balkan brass & wandering souls",
  "Classics & New Hollywood",
  "Warm & wry indies",
  "Dramas that leave a mark",
  "Music, showbiz & stranger-than-fiction",
  "All-talk philosophy hangs",
  "Docs & tone poems",
] as const

export type FilmSource = "watchlist" | "likes" | "both" | "watched" | "added"

/** Canonical film row in the Films list / scoring pipeline. */
export interface FilmRecord {
  /** Task id when bound to a list item; synthetic id for blend-only rows. */
  id: string
  title: string
  year?: number | null
  shelf?: string | null
  shelfId?: number | null
  source?: FilmSource | string | null
  liked?: boolean
  favorited?: boolean
  rating?: number | null
  genres?: string[]
  poster?: string | null
  url?: string | null
  overview?: string | null
  watchedDate?: string | null
}

/** Attribute ids written onto the Films list by the filmrecs template. */
export const FILM_ATTR = {
  year: "year",
  shelf: "shelf",
  source: "source",
  liked: "liked",
  favorited: "favorited",
  rating: "rating",
  genres: "genres",
  poster: "poster",
  letterboxdUrl: "letterboxdUrl",
  overview: "overview",
  watchedDate: "watchedDate",
} as const

export function normalizeFilmTitle(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

export function decadeOf(year: number | null | undefined): number | null {
  if (year == null || !Number.isFinite(year)) return null
  return Math.floor(year / 10) * 10
}

export function letterboxdHref(film: Pick<FilmRecord, "title" | "year" | "url">): string {
  if (film.url) return film.url
  const q = encodeURIComponent(`${film.title} ${film.year ?? ""}`.trim()).replace(/%20/g, "+")
  return `https://letterboxd.com/search/films/${q}/`
}
