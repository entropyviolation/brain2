/**
 * lib/filmrecs-score.ts — Offline Film DNA scoring
 *
 * Pure TypeScript ports of the Lab's offline paths: decade vectors + cosine
 * blend, shelf/decade ranking for Watch, and a lightweight Hanyf-style
 * nearest-like score (no MiniLM / sklearn).
 */
import {
  type FilmRecord,
  decadeOf,
  normalizeFilmTitle,
} from "@/lib/filmrecs-types"

export type DecadeVec = Record<number, number>

export function decadeVec(films: Array<{ year?: number | null }>): DecadeVec {
  const v: DecadeVec = {}
  for (const f of films) {
    const d = decadeOf(f.year)
    if (d == null) continue
    v[d] = (v[d] || 0) + 1
  }
  return v
}

export function cosine(a: DecadeVec, b: DecadeVec): number {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)].map(Number))
  let dot = 0
  let na = 0
  let nb = 0
  for (const k of keys) {
    const x = a[k] || 0
    const y = b[k] || 0
    dot += x * y
    na += x * x
    nb += y * y
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0
}

export interface BlendResult {
  score: number
  tierTitle: string
  tierBlurb: string
  overlap: number
  eraSimilarity: number
  common: FilmRecord[]
  sharedDecade: number | null
  forYou: FilmRecord[]
  forThem: FilmRecord[]
  myVec: DecadeVec
  theirVec: DecadeVec
}

function blendTier(score: number): [string, string] {
  if (score >= 80) return ["Separated at birth", "Cancel your plans — you have a watch party to schedule."]
  if (score >= 60) return ["Same wavelength", "Different shelves, same library. Trade freely."]
  if (score >= 40) return ["Complementary chaos", "Enough overlap to trust each other, enough gaps to matter."]
  if (score >= 20) return ["Opposites with overlap", "A few shared anchors — build the bridge from there."]
  return ["Uncharted territory", "Almost nothing in common. That's either a red flag or a goldmine."]
}

/** Taste blend between your catalog and a friend's Letterboxd-derived list. */
export function blendCatalogs(
  mine: FilmRecord[],
  theirs: FilmRecord[],
  opts: { forThemPool?: FilmRecord[]; limit?: number } = {},
): BlendResult {
  const limit = opts.limit ?? 10
  const myAll = mine
  const theirKeys = new Map(theirs.map((f) => [normalizeFilmTitle(f.title), f]))
  const common: FilmRecord[] = []
  const seen = new Set<string>()

  for (const f of myAll) {
    const k = normalizeFilmTitle(f.title)
    const t = theirKeys.get(k)
    if (!t || seen.has(k)) continue
    if (t.year && f.year && Math.abs(t.year - f.year) > 1) continue
    seen.add(k)
    common.push({ ...f, liked: !!f.liked })
  }

  const myVec = decadeVec(myAll)
  const theirVec = decadeVec(theirs)
  const overlap = common.length / Math.min(Math.max(theirs.length, 1), Math.max(myAll.length, 1))
  const sim = cosine(myVec, theirVec)
  const score = Math.round(Math.min(99, 60 * Math.sqrt(Math.min(1, overlap * 1.6)) + 40 * sim))
  const [tierTitle, tierBlurb] = blendTier(score)

  const sharedDecade =
    Object.keys(myVec)
      .map(Number)
      .filter((d) => theirVec[d])
      .sort((a, b) => Math.min(myVec[b], theirVec[b]) - Math.min(myVec[a], theirVec[a]))[0] ?? null

  const myW = (d: number | null) => (d == null ? 0 : myVec[d] || 0)
  const thW = (d: number | null) => (d == null ? 0 : theirVec[d] || 0)

  const forYou = theirs
    .filter((f) => !seen.has(normalizeFilmTitle(f.title)))
    .sort(
      (a, b) =>
        myW(decadeOf(b.year)) - myW(decadeOf(a.year)) || (b.year || 0) - (a.year || 0),
    )
    .slice(0, limit)

  const pool = opts.forThemPool ?? mine.filter((f) => f.source === "watchlist" || f.source === "both" || !f.liked)
  const forThem = pool
    .filter((f) => !theirKeys.has(normalizeFilmTitle(f.title)))
    .sort(
      (a, b) =>
        thW(decadeOf(b.year)) - thW(decadeOf(a.year)) || (b.year || 0) - (a.year || 0),
    )
    .slice(0, limit)

  return {
    score,
    tierTitle,
    tierBlurb,
    overlap,
    eraSimilarity: sim,
    common: common.sort((a, b) => Number(!!b.liked) - Number(!!a.liked) || (a.year || 0) - (b.year || 0)),
    sharedDecade,
    forYou,
    forThem,
    myVec,
    theirVec,
  }
}

function asSet(val: unknown): Set<string> {
  if (val == null) return new Set()
  if (typeof val === "string") return val.trim() ? new Set([val.trim().toLowerCase()]) : new Set()
  if (Array.isArray(val)) return new Set(val.map((x) => String(x).trim().toLowerCase()).filter(Boolean))
  return new Set()
}

function setDissimilarity(a: Set<string>, b: Set<string>): number {
  if (!a.size && !b.size) return 0
  let inter = 0
  for (const x of a) if (b.has(x)) inter++
  return Math.max(a.size, b.size) - inter
}

function titleTokens(title: string): Set<string> {
  const stop = new Set(["the", "a", "an", "of", "and", "or", "in", "on", "to", "for", "with"])
  return new Set(
    (title.toLowerCase().match(/[a-z0-9]+/g) || []).filter((t) => t.length > 2 && !stop.has(t)),
  )
}

function featureMeans(movies: FilmRecord[]): { year: number } {
  const years = movies.map((m) => m.year).filter((y): y is number => y != null)
  return { year: years.length ? years.reduce((a, b) => a + b, 0) / years.length : 2000 }
}

function dissimilarity(a: FilmRecord, b: FilmRecord, means: { year: number }): number {
  const ya = (a.year || means.year) / means.year
  const yb = (b.year || means.year) / means.year
  const num = Math.abs(ya - yb)
  let setTotal = setDissimilarity(asSet(a.genres), asSet(b.genres))
  setTotal += setDissimilarity(titleTokens(a.title), titleTokens(b.title))
  setTotal += setDissimilarity(
    asSet([a.shelf, a.shelfId != null ? String(a.shelfId) : null].filter(Boolean)),
    asSet([b.shelf, b.shelfId != null ? String(b.shelfId) : null].filter(Boolean)),
  )
  return num + setTotal
}

function maxDissimilarity(movies: FilmRecord[], sample = 60): number {
  if (movies.length < 2) return 1
  const means = featureMeans(movies)
  const idx = movies.length > sample
    ? movies.filter((_, i) => i % Math.ceil(movies.length / sample) === 0)
    : movies
  let mx = 0
  for (let i = 0; i < idx.length; i++) {
    for (let j = i + 1; j < Math.min(i + 10, idx.length); j++) {
      mx = Math.max(mx, dissimilarity(idx[i], idx[j], means))
    }
  }
  return mx > 0 ? mx : 1
}

export interface RankedFilm extends FilmRecord {
  rankScore: number
  uncertainty: number
  match: number
  nearestLikeTitle?: string
}

/** Offline watchlist ranking: nearest liked film + uncertainty-adjusted score. */
export function rankWatchlist(
  queue: FilmRecord[],
  likes: FilmRecord[],
  opts: { ut?: number; mode?: "safe" | "balanced" | "explore" } = {},
): RankedFilm[] {
  const seeds = likes.length ? likes : queue.filter((f) => f.favorited)
  if (!queue.length || !seeds.length) {
    return queue.map((f) => ({ ...f, rankScore: 0, uncertainty: 100, match: 0 }))
  }
  const means = featureMeans([...queue, ...seeds])
  const maxD = maxDissimilarity([...queue, ...seeds])
  const ratings = seeds.map((s) => s.rating).filter((r): r is number => r != null)
  const meanRate = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 4
  const ut = opts.ut ?? 12
  const mode = opts.mode ?? "balanced"

  const likeDec = decadeVec(seeds)
  const ranked = queue.map((target) => {
    let best: { d: number; seed: FilmRecord; feat: number } | null = null
    for (const seed of seeds) {
      if (normalizeFilmTitle(seed.title) === normalizeFilmTitle(target.title)) continue
      const d = dissimilarity(target, seed, means)
      const feat = 1 - Math.min(1, d / maxD)
      if (!best || feat > best.feat || (Math.abs(feat - best.feat) < 1e-9 && d < best.d)) {
        best = { d, seed, feat }
      }
    }
    const unc = best ? Math.min(100, Math.max(0, (best.d / maxD) * 100)) : 100
    const raw = best?.seed.rating != null ? best.seed.rating : 4.5
    const adjusted = unc <= ut ? raw : raw - (raw - meanRate) * (unc / 100)
    const confidence = 1 - unc / 100
    const decadeBoost = target.year ? (likeDec[decadeOf(target.year)!] || 0) / (seeds.length || 1) : 0
    let rankScore = adjusted * confidence * (0.35 + 0.65 * (best?.feat ?? 0)) + 0.15 * decadeBoost
    if (mode === "safe") rankScore *= 1 - unc / 200
    if (mode === "explore") rankScore *= 0.7 + unc / 200
    if (target.favorited) rankScore *= 1.15
    return {
      ...target,
      rankScore,
      uncertainty: Math.round(unc),
      match: Math.round((best?.feat ?? 0) * 100) / 100,
      nearestLikeTitle: best?.seed.title,
    }
  })

  ranked.sort((a, b) => b.rankScore - a.rankScore || a.uncertainty - b.uncertainty)
  return ranked
}

export interface WatchScatterPoint {
  id: string
  title: string
  year?: number | null
  x: number
  y: number
  favorited?: boolean
  nearestLike?: string
}

export function watchScatter(ranked: RankedFilm[]): {
  points: WatchScatterPoint[]
  safeBets: RankedFilm[]
  deepCuts: RankedFilm[]
} {
  const points = ranked.map((r) => ({
    id: r.id,
    title: r.title,
    year: r.year,
    x: r.match,
    y: r.uncertainty,
    favorited: r.favorited,
    nearestLike: r.nearestLikeTitle,
  }))
  const safeBets = ranked.filter((r) => r.match >= 0.45 && r.uncertainty <= 25).slice(0, 12)
  const deepCuts = ranked
    .filter((r) => r.match >= 0.3 && r.uncertainty > 25)
    .sort((a, b) => b.uncertainty - a.uncertainty)
    .slice(0, 12)
  return { points, safeBets, deepCuts: deepCuts.length ? deepCuts : ranked.slice(-12).reverse() }
}

export function shelfStats(films: FilmRecord[], shelves: string[]): { shelf: string; count: number; index: number }[] {
  const counts = new Map<number, number>()
  for (const f of films) {
    let idx = f.shelfId
    if (idx == null && f.shelf) idx = shelves.indexOf(f.shelf)
    if (idx == null || idx < 0) continue
    counts.set(idx, (counts.get(idx) || 0) + 1)
  }
  return shelves
    .map((shelf, index) => ({ shelf, index, count: counts.get(index) || 0 }))
    .filter((s) => s.count > 0)
    .sort((a, b) => b.count - a.count)
}
