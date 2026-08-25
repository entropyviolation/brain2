"use client"

import { useEffect, useRef, useState } from "react"
import { letterboxdHref, normalizeFilmTitle, type FilmRecord } from "@/lib/filmrecs-types"

const GRADS = [
  "linear-gradient(160deg,#ff8000,#c45c00)",
  "linear-gradient(160deg,#00e054,#008a34)",
  "linear-gradient(160deg,#40bcf4,#1a6f99)",
]

const posterCache = new Map<string, string | null>()
const queue: Array<{ key: string; title: string; year?: number | null; apply: (url: string | null) => void }> = []
let pumping = false

async function pumpPosterQueue() {
  if (pumping) return
  pumping = true
  while (queue.length) {
    const job = queue.shift()!
    if (posterCache.has(job.key)) {
      job.apply(posterCache.get(job.key) ?? null)
      continue
    }
    let url: string | null = null
    try {
      const term = job.title.replace(/\(.*?\)/g, "").trim()
      const res = await fetch(
        `https://itunes.apple.com/search?media=movie&limit=8&term=${encodeURIComponent(term)}`,
      )
      if (res.ok) {
        const data = (await res.json()) as {
          results?: Array<{ trackName?: string; releaseDate?: string; artworkUrl100?: string }>
        }
        const cands = (data.results || [])
          .map((r) => ({
            t: r.trackName || "",
            y: r.releaseDate ? new Date(r.releaseDate).getFullYear() : null,
            a: r.artworkUrl100,
          }))
          .filter((c) => c.a)
        const nk = job.key
        const best =
          cands.find((c) => normalizeFilmTitle(c.t) === nk && (!job.year || !c.y || Math.abs(c.y - job.year) <= 1)) ||
          cands.find(
            (c) =>
              (normalizeFilmTitle(c.t).startsWith(nk) || nk.startsWith(normalizeFilmTitle(c.t))) &&
              (!job.year || !c.y || Math.abs(c.y - job.year) <= 1),
          ) ||
          cands.find((c) => (!job.year || !c.y || Math.abs(c.y - job.year) <= 1) && normalizeFilmTitle(c.t).includes(nk))
        if (best?.a) url = best.a.replace("100x100", "600x600")
      }
    } catch {
      /* offline / CSP — keep gradient fallback */
    }
    posterCache.set(job.key, url)
    job.apply(url)
    await new Promise((r) => setTimeout(r, 220))
  }
  pumping = false
}

export function PosterCard({
  film,
  rank,
  badge,
  reason,
  onToggleFavorite,
}: {
  film: FilmRecord
  rank?: number
  badge?: boolean
  reason?: string
  onToggleFavorite?: (film: FilmRecord) => void
}) {
  const [src, setSrc] = useState<string | null>(film.poster || null)
  const [ready, setReady] = useState(!!film.poster)
  const imgRef = useRef<HTMLImageElement>(null)
  const gi = (film.title.length + (film.year || 0)) % 3
  const lb = letterboxdHref(film)

  useEffect(() => {
    if (film.poster) {
      setSrc(film.poster)
      setReady(true)
      return
    }
    const key = normalizeFilmTitle(film.title)
    if (posterCache.has(key)) {
      const cached = posterCache.get(key) ?? null
      setSrc(cached)
      setReady(!!cached)
      return
    }
    const el = imgRef.current?.parentElement
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return
        io.disconnect()
        queue.push({
          key,
          title: film.title,
          year: film.year,
          apply: (url) => {
            setSrc(url)
            setReady(!!url)
          },
        })
        void pumpPosterQueue()
      },
      { rootMargin: "280px" },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [film.poster, film.title, film.year])

  return (
    <div className="fd-pcard">
      <div className="fb" style={{ background: GRADS[gi] }}>
        <span className="mono">{film.year || "\u00a0"}</span>
        <span className="ft">{film.title}</span>
      </div>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={imgRef}
          alt={`${film.title} poster`}
          className={ready ? "ready" : undefined}
          src={src}
          loading="lazy"
          onLoad={() => setReady(true)}
          onError={() => setSrc(null)}
        />
      ) : (
        <img ref={imgRef} alt="" aria-hidden style={{ display: "none" }} />
      )}
      {film.favorited ? <span className="favStar" title="favorited">★</span> : null}
      {badge && film.liked ? <span className={`badge${film.favorited ? " shift" : ""}`} title="liked" /> : null}
      {rank != null ? <span className="rank">{String(rank).padStart(2, "0")}</span> : null}
      <div className="ov">
        <div>
          <div className="ot">{film.title}</div>
          <div className="oy">
            {film.year || ""}
            {reason ? ` · ${reason}` : ""}
          </div>
        </div>
        <div className="acts">
          {onToggleFavorite ? (
            <button
              type="button"
              className={`btn fav${film.favorited ? " on" : ""}`}
              onClick={() => onToggleFavorite(film)}
              title="Favorite"
            >
              ★
            </button>
          ) : null}
          <a className="btn" href={lb} target="_blank" rel="noopener noreferrer" title="Open on Letterboxd">
            lb ↗
          </a>
        </div>
      </div>
    </div>
  )
}
