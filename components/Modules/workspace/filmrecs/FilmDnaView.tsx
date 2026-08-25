/**
 * FilmDnaView — Film DNA Lab workspace view (DNA / Watch / Blend)
 *
 * Reads the Films list bound via `view.config.categoryId`, renders taste DNA,
 * offline watch ranking, and Letterboxd CSV blend/import. Favorites + imports
 * write back through the task store.
 */
"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { ModuleView } from "@/lib/modules-store"
import { useTaskStore } from "@/lib/task-store"
import { FILM_ATTR, FILMRECS_SHELVES, type FilmRecord } from "@/lib/filmrecs-types"
import { taskToFilm, partitionFilms, planLetterboxdMerge } from "@/lib/filmrecs-catalog"
import { parseLetterboxdCsv, parseLetterboxdExportBundle, readLetterboxdFiles } from "@/lib/letterboxd-parse"
import {
  blendCatalogs,
  decadeVec,
  rankWatchlist,
  shelfStats,
  watchScatter,
  type BlendResult,
  type RankedFilm,
} from "@/lib/filmrecs-score"
import { PosterCard } from "./PosterCard"
import "./film-dna.css"

type Pane = "dna" | "watch" | "blend" | "import"
type SortMode = "shelf" | "year" | "recommended"
type WatchMode = "safe" | "balanced" | "explore"

const DEMO_BLEND: FilmRecord[] = [
  { id: "d1", title: "Eraserhead", year: 1977 },
  { id: "d2", title: "Mulholland Drive", year: 2001 },
  { id: "d3", title: "Primer", year: 2004 },
  { id: "d4", title: "Coherence", year: 2013 },
  { id: "d5", title: "Stalker", year: 1979 },
  { id: "d6", title: "Paris, Texas", year: 1984 },
  { id: "d7", title: "Chungking Express", year: 1994 },
  { id: "d8", title: "Perfect Blue", year: 1997 },
  { id: "d9", title: "Brazil", year: 1985 },
  { id: "d10", title: "The Lobster", year: 2015 },
  { id: "d11", title: "Aftersun", year: 2022 },
  { id: "d12", title: "Uncut Gems", year: 2019 },
  { id: "d13", title: "Possession", year: 1981 },
  { id: "d14", title: "Videodrome", year: 1983 },
  { id: "d15", title: "The Holy Mountain", year: 1973 },
  { id: "d16", title: "Fantastic Planet", year: 1973 },
  { id: "d17", title: "Anomalisa", year: 2015 },
  { id: "d18", title: "Burning", year: 2018 },
  { id: "d19", title: "Frances Ha", year: 2012 },
  { id: "d20", title: "Amélie", year: 2001 },
]

function loadGoogleFonts() {
  if (typeof document === "undefined") return
  if (document.getElementById("film-dna-fonts")) return
  const link = document.createElement("link")
  link.id = "film-dna-fonts"
  link.rel = "stylesheet"
  link.href =
    "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Archivo:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap"
  document.head.appendChild(link)
}

export function FilmDnaView({ view }: { view: ModuleView }) {
  const categoryId = view.config.categoryId
  const allTasks = useTaskStore((s) => s.tasks)
  const lists = useTaskStore((s) => s.lists)
  const addTask = useTaskStore((s) => s.addTask)
  const updateTask = useTaskStore((s) => s.updateTask)
  const category = lists.find((c) => c.id === categoryId)

  const [pane, setPane] = useState<Pane>("dna")
  const [sortMode, setSortMode] = useState<SortMode>("shelf")
  const [watchMode, setWatchMode] = useState<WatchMode>("balanced")
  const [blend, setBlend] = useState<{ result: BlendResult; label: string } | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [importMsg, setImportMsg] = useState<string | null>(null)
  const [importBusy, setImportBusy] = useState(false)
  const [dropOver, setDropOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const folderRef = useRef<HTMLInputElement>(null)
  const importFolderRef = useRef<HTMLInputElement>(null)
  const importFilesRef = useRef<HTMLInputElement>(null)
  const scatterRef = useRef<HTMLCanvasElement>(null)
  const [scatterHint, setScatterHint] = useState("Match × uncertainty for your queue")

  useEffect(() => {
    loadGoogleFonts()
  }, [])

  const films = useMemo(() => {
    if (!categoryId) return []
    return allTasks.filter((t) => t.lists?.includes(categoryId)).map((t) => taskToFilm(t))
  }, [allTasks, categoryId])

  const { watchlist, likes, favorites } = useMemo(() => partitionFilms(films), [films])
  const myVec = useMemo(() => decadeVec(films), [films])
  const shelves = useMemo(() => shelfStats(watchlist, [...FILMRECS_SHELVES]), [watchlist])
  const ranked = useMemo(
    () => rankWatchlist(watchlist, likes.length ? likes : favorites, { mode: watchMode }),
    [watchlist, likes, favorites, watchMode],
  )
  const scatter = useMemo(() => watchScatter(ranked), [ranked])

  useEffect(() => {
    const canvas = scatterRef.current
    if (!canvas || pane !== "watch") return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    const w = canvas.clientWidth || 900
    const h = 280
    canvas.width = w * dpr
    canvas.height = h * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    const pad = { l: 44, r: 18, t: 18, b: 36 }
    ctx.strokeStyle = "rgba(139,153,167,.25)"
    ctx.beginPath()
    ctx.moveTo(pad.l, pad.t)
    ctx.lineTo(pad.l, h - pad.b)
    ctx.lineTo(w - pad.r, h - pad.b)
    ctx.stroke()
    ctx.fillStyle = "rgba(139,153,167,.7)"
    ctx.font = "10px Space Mono, monospace"
    ctx.fillText("match →", w / 2 - 20, h - 10)
    ctx.save()
    ctx.translate(14, h / 2 + 30)
    ctx.rotate(-Math.PI / 2)
    ctx.fillText("uncertainty →", 0, 0)
    ctx.restore()
    const midY = pad.t + (25 / 100) * (h - pad.t - pad.b)
    ctx.setLineDash([4, 4])
    ctx.strokeStyle = "rgba(139,153,167,.2)"
    ctx.beginPath()
    ctx.moveTo(pad.l, midY)
    ctx.lineTo(w - pad.r, midY)
    ctx.stroke()
    ctx.setLineDash([])
    for (const p of scatter.points) {
      const x = pad.l + p.x * (w - pad.l - pad.r)
      const y = pad.t + (p.y / 100) * (h - pad.t - pad.b)
      let color = "#40bcf4"
      if (p.x >= 0.45 && p.y <= 25) color = "#00e054"
      else if (p.x >= 0.35 && p.y > 25) color = "#ff8000"
      ctx.beginPath()
      ctx.fillStyle = color
      ctx.globalAlpha = 0.85
      ctx.arc(x, y, p.favorited ? 6 : 4, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
    }
    setScatterHint(`${scatter.points.length} films · mode ${watchMode}`)
  }, [scatter, pane, watchMode])

  const toggleFavorite = (film: FilmRecord) => {
    const task = allTasks.find((t) => t.id === film.id)
    if (!task) return
    updateTask({
      ...task,
      attributes: {
        ...(task.attributes || {}),
        [FILM_ATTR.favorited]: !film.favorited,
      },
    })
  }

  const runBlendFromRows = (rows: FilmRecord[], label: string) => {
    const result = blendCatalogs(films, rows, {
      forThemPool: watchlist,
    })
    setBlend({ result, label })
    setErr(null)
  }

  const ingestBlendSelection = async (fileList: ArrayLike<File>) => {
    const inputs = await readLetterboxdFiles(fileList)
    if (!inputs.length) {
      // Single non-folder CSV fallback
      const only = Array.from(fileList)[0]
      if (only && /\.csv$/i.test(only.name)) {
        const text = await only.text()
        const parsed = parseLetterboxdCsv(text, only.name)
        if (!parsed.films.length) {
          setErr("Couldn't find films in that CSV — pick a Letterboxd export folder instead.")
          return
        }
        runBlendFromRows(
          parsed.films.map((f, i) => ({
            id: `blend-${i}`,
            title: f.title,
            year: f.year,
            url: f.url,
            rating: f.rating,
          })),
          only.name.replace(/\.csv$/i, ""),
        )
        return
      }
      setErr("No CSV files found. Choose the unzipped Letterboxd export folder.")
      return
    }
    const bundle = parseLetterboxdExportBundle(inputs)
    if (!bundle.films.length) {
      setErr("Couldn't find film CSVs in that export (expected watchlist.csv, likes/films.csv, …).")
      return
    }
    runBlendFromRows(
      bundle.films.map((f, i) => ({
        id: `blend-${i}`,
        title: f.title,
        year: f.year,
        url: f.url,
        rating: f.rating,
        liked: f.liked,
      })),
      bundle.label || "friend",
    )
  }

  const importLetterboxdSelection = async (fileList: ArrayLike<File>) => {
    if (!category) {
      setErr("No Films list bound to this view.")
      return
    }
    setImportBusy(true)
    setErr(null)
    try {
      const inputs = await readLetterboxdFiles(fileList)
      if (!inputs.length) {
        setErr("No CSV files found. Unzip your Letterboxd export, then choose the folder.")
        return
      }
      const bundle = parseLetterboxdExportBundle(inputs)
      if (!bundle.films.length) {
        setErr("No film rows found. Expected watchlist.csv, watched.csv, ratings.csv, diary.csv, and/or likes/films.csv.")
        return
      }
      const existing = allTasks.filter((t) => t.lists?.includes(category.id))
      const plan = planLetterboxdMerge(category, existing, bundle)
      plan.create.forEach((t) => addTask(t))
      plan.update.forEach((t) => updateTask(t))
      const fileSummary = bundle.files.map((f) => `${f.kind}(${f.count})`).join(", ")
      setImportMsg(
        `Imported ${plan.stats.parsed} films from ${plan.stats.files} file(s): +${plan.stats.added} new, ${plan.stats.updated} updated. Used: ${fileSummary}.`,
      )
      setPane("dna")
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Import failed.")
    } finally {
      setImportBusy(false)
    }
  }

  if (!categoryId) {
    return <div className="p-4 text-sm text-muted-foreground">Bind a Films list to this Film DNA view in Settings.</div>
  }

  const decadeEntries = Object.entries(myVec)
    .map(([d, c]) => ({ d: Number(d), c }))
    .sort((a, b) => a.d - b.d)
  const maxDec = Math.max(1, ...decadeEntries.map((x) => x.c))
  const palette = ["var(--fd-orange)", "var(--fd-green)", "var(--fd-blue)"]

  const filmsByShelf = (idx: number) =>
    watchlist.filter((f) => f.shelfId === idx || f.shelf === FILMRECS_SHELVES[idx])

  const yearSorted = [...watchlist].sort((a, b) => (a.year || 0) - (b.year || 0))

  return (
    <div className="film-dna">
      <div className="film-dna-inner">
        <div className="fd-kicker">
          <span className="dots" style={{ display: "inline-flex", gap: 5 }}>
            <i style={{ background: "var(--fd-orange)" }} />
            <i style={{ background: "var(--fd-green)" }} />
            <i style={{ background: "var(--fd-blue)" }} />
          </span>
          Film DNA Lab
        </div>
        <h1 className="fd-title">
          Your film <em>DNA</em>
        </h1>
        <p className="fd-sub">
          Letterboxd taste map — shelves, watch ranking, and a blend with a friend&apos;s export folder. Data lives
          in your <b>{category?.name || "Films"}</b> list.
        </p>

        <div className="fd-tabs">
          {(
            [
              ["dna", "The DNA"],
              ["watch", "Watch"],
              ["blend", "The Blend"],
              ["import", "Import"],
            ] as const
          ).map(([id, label]) => (
            <button key={id} type="button" className={`fd-tab${pane === id ? " on" : ""}`} onClick={() => setPane(id)}>
              {label}
            </button>
          ))}
        </div>

        {pane === "dna" && (
          <>
            <div className="fd-stats">
              <div className="fd-stat">
                <div className="num">{watchlist.length}</div>
                <div className="lbl">In queue</div>
              </div>
              <div className="fd-stat">
                <div className="num">{likes.length}</div>
                <div className="lbl">Liked</div>
              </div>
              <div className="fd-stat">
                <div className="num">{favorites.length}</div>
                <div className="lbl">Favorites</div>
              </div>
              <div className="fd-stat">
                <div className="num">{shelves.length}</div>
                <div className="lbl">Shelves</div>
              </div>
            </div>

            <div className="fd-card">
              <h2>Decade profile</h2>
              <p className="fd-hint">Where your watchlist + likes land across eras.</p>
              <div className="fd-decades">
                {decadeEntries.map((e, i) => (
                  <div key={e.d} className="fd-dec">
                    <span className="cnt">{e.c}</span>
                    <div
                      className="bar"
                      style={{
                        height: `${Math.max(8, (e.c / maxDec) * 110)}px`,
                        background: palette[i % 3],
                      }}
                    />
                    <span className="yr">{String(e.d).slice(2)}s</span>
                  </div>
                ))}
                {!decadeEntries.length ? <div className="fd-empty">Import a Letterboxd CSV to seed decades.</div> : null}
              </div>
            </div>

            <div className="fd-card">
              <h2>Likes wall</h2>
              <p className="fd-hint">Films you&apos;ve hearted — the taste seeds for Watch ranking.</p>
              <div className="fd-pgrid">
                {likes.length ? (
                  likes.map((f) => <PosterCard key={f.id} film={f} badge onToggleFavorite={toggleFavorite} />)
                ) : (
                  <div className="fd-empty">No likes yet — import a likes.csv or mark films liked in the spreadsheet.</div>
                )}
              </div>
            </div>

            <div className="fd-card">
              <div className="fd-modes">
                {(
                  [
                    ["shelf", "By shelf"],
                    ["year", "By year"],
                    ["recommended", "Recommended"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={`fd-chip${sortMode === id ? " on" : ""}`}
                    onClick={() => setSortMode(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {sortMode === "shelf" &&
                (shelves.length ? (
                  shelves.map((s) => (
                    <div key={s.index} className="fd-shelf">
                      <h3>
                        <span>{s.shelf}</span>
                        <span>{s.count}</span>
                      </h3>
                      <div className="fd-pgrid">
                        {filmsByShelf(s.index).map((f) => (
                          <PosterCard key={f.id} film={f} badge onToggleFavorite={toggleFavorite} />
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="fd-empty">Queue is empty — import a watchlist CSV.</div>
                ))}
              {sortMode === "year" && (
                <div className="fd-pgrid">
                  {yearSorted.map((f, i) => (
                    <PosterCard key={f.id} film={f} rank={i + 1} badge onToggleFavorite={toggleFavorite} />
                  ))}
                </div>
              )}
              {sortMode === "recommended" && (
                <div className="fd-pgrid">
                  {ranked.map((f, i) => (
                    <PosterCard
                      key={f.id}
                      film={f}
                      rank={i + 1}
                      badge
                      reason={f.nearestLikeTitle ? `~${f.nearestLikeTitle}` : undefined}
                      onToggleFavorite={toggleFavorite}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {pane === "watch" && (
          <>
            <div className="fd-modes">
              {(
                [
                  ["safe", "Safe"],
                  ["balanced", "Balanced"],
                  ["explore", "Explore"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`fd-chip${watchMode === id ? " on" : ""}`}
                  onClick={() => setWatchMode(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="fd-card">
              <h2>Watch next</h2>
              <p className="fd-hint">{scatterHint} — green = safe bets, orange = deep cuts.</p>
              <canvas ref={scatterRef} className="fd-scatter" />
            </div>
            <div className="fd-two-col">
              <div className="fd-card">
                <h2>Safe bets</h2>
                <p className="fd-hint">High match, low uncertainty.</p>
                <div className="fd-pgrid">
                  {scatter.safeBets.length ? (
                    scatter.safeBets.map((f, i) => (
                      <PosterCard key={f.id} film={f} rank={i + 1} badge onToggleFavorite={toggleFavorite} />
                    ))
                  ) : (
                    <div className="fd-empty">No safe bets — try Balanced or add more likes.</div>
                  )}
                </div>
              </div>
              <div className="fd-card">
                <h2>Deep cuts</h2>
                <p className="fd-hint">Still on-taste, but farther from your likes.</p>
                <div className="fd-pgrid">
                  {scatter.deepCuts.map((f, i) => (
                    <PosterCard key={f.id} film={f} rank={i + 1} badge onToggleFavorite={toggleFavorite} />
                  ))}
                </div>
              </div>
            </div>
            <div className="fd-card">
              <h2>Favorites</h2>
              <p className="fd-hint">Star films on any card — they boost Watch ranking.</p>
              <div className="fd-pgrid">
                {favorites.length ? (
                  favorites.map((f) => <PosterCard key={f.id} film={f} badge onToggleFavorite={toggleFavorite} />)
                ) : (
                  <div className="fd-empty">Star films on any card to build favorites.</div>
                )}
              </div>
            </div>
            <RankStrip ranked={ranked.slice(0, 24)} onToggleFavorite={toggleFavorite} />
          </>
        )}

        {pane === "blend" && (
          <>
            {!blend ? (
              <div
                className={`fd-drop${dropOver ? " over" : ""}`}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDropOver(true)
                }}
                onDragLeave={() => setDropOver(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setDropOver(false)
                  if (e.dataTransfer.files?.length) void ingestBlendSelection(e.dataTransfer.files)
                }}
              >
                <h2>Drop a friend&apos;s Letterboxd export</h2>
                <p className="fd-hint" style={{ marginBottom: 14 }}>
                  Unzipped export folder (watchlist.csv, likes/films.csv, ratings.csv, …) or one CSV. We score
                  overlap + era cosine and suggest trades.
                </p>
                <div className="fd-toolbar" style={{ justifyContent: "center" }}>
                  <button type="button" className="fd-btn primary" onClick={() => folderRef.current?.click()}>
                    Choose export folder
                  </button>
                  <button type="button" className="fd-btn" onClick={() => fileRef.current?.click()}>
                    Choose CSV(s)
                  </button>
                  <button
                    type="button"
                    className="fd-btn"
                    onClick={() => runBlendFromRows(DEMO_BLEND, "demo-cinephile")}
                  >
                    Try demo blend
                  </button>
                </div>
                <input
                  ref={(el) => {
                    folderRef.current = el
                    if (el) {
                      el.setAttribute("webkitdirectory", "")
                      el.setAttribute("directory", "")
                    }
                  }}
                  type="file"
                  multiple
                  hidden
                  onChange={() => {
                    if (folderRef.current?.files?.length) void ingestBlendSelection(folderRef.current.files)
                  }}
                />
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv"
                  multiple
                  hidden
                  onChange={() => {
                    if (fileRef.current?.files?.length) void ingestBlendSelection(fileRef.current.files)
                  }}
                />
                {err ? <div className="fd-err">{err}</div> : null}
              </div>
            ) : (
              <BlendPanel
                blend={blend.result}
                label={blend.label}
                onReset={() => {
                  setBlend(null)
                  if (fileRef.current) fileRef.current.value = ""
                  if (folderRef.current) folderRef.current.value = ""
                }}
                onToggleFavorite={toggleFavorite}
              />
            )}
          </>
        )}

        {pane === "import" && (
          <div
            className={`fd-card${dropOver ? " over" : ""}`}
            onDragOver={(e) => {
              e.preventDefault()
              setDropOver(true)
            }}
            onDragLeave={() => setDropOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDropOver(false)
              if (e.dataTransfer.files?.length) void importLetterboxdSelection(e.dataTransfer.files)
            }}
          >
            <h2>Import Letterboxd export</h2>
            <p className="fd-hint">
              Letterboxd exports are a <b>folder</b> (not one file): watchlist.csv, watched.csv, ratings.csv,
              diary.csv, likes/films.csv, lists/… Drop the unzipped folder here — we merge film CSVs and skip
              profile/comments/deleted/orphaned noise.
            </p>
            <div className="fd-toolbar">
              <button
                type="button"
                className="fd-btn primary"
                disabled={importBusy}
                onClick={() => importFolderRef.current?.click()}
              >
                {importBusy ? "Importing…" : "Choose export folder"}
              </button>
              <button
                type="button"
                className="fd-btn"
                disabled={importBusy}
                onClick={() => importFilesRef.current?.click()}
              >
                Choose CSV files
              </button>
            </div>
            <input
              ref={(el) => {
                importFolderRef.current = el
                if (el) {
                  el.setAttribute("webkitdirectory", "")
                  el.setAttribute("directory", "")
                }
              }}
              type="file"
              multiple
              hidden
              onChange={() => {
                if (importFolderRef.current?.files?.length) {
                  void importLetterboxdSelection(importFolderRef.current.files)
                }
              }}
            />
            <input
              ref={importFilesRef}
              type="file"
              accept=".csv,text/csv"
              multiple
              hidden
              onChange={() => {
                if (importFilesRef.current?.files?.length) {
                  void importLetterboxdSelection(importFilesRef.current.files)
                }
              }}
            />
            {importMsg ? (
              <p className="fd-hint" style={{ color: "var(--fd-green)" }}>
                {importMsg}
              </p>
            ) : null}
            {err ? <div className="fd-err">{err}</div> : null}
            <p className="fd-hint" style={{ marginTop: 12 }}>
              Tip: Letterboxd → Settings → Import &amp; Export → Export your data → unzip the download → choose
              that folder here.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function RankStrip({
  ranked,
  onToggleFavorite,
}: {
  ranked: RankedFilm[]
  onToggleFavorite: (f: FilmRecord) => void
}) {
  return (
    <div className="fd-card">
      <h2>Full ranking</h2>
      <p className="fd-hint">Offline ensemble: nearest liked film × confidence × decade affinity.</p>
      <div className="fd-pgrid">
        {ranked.map((f, i) => (
          <PosterCard
            key={f.id}
            film={f}
            rank={i + 1}
            badge
            reason={`unc ${f.uncertainty}%`}
            onToggleFavorite={onToggleFavorite}
          />
        ))}
      </div>
    </div>
  )
}

function BlendPanel({
  blend,
  label,
  onReset,
  onToggleFavorite,
}: {
  blend: BlendResult
  label: string
  onReset: () => void
  onToggleFavorite: (f: FilmRecord) => void
}) {
  const allD = [...new Set([...Object.keys(blend.myVec), ...Object.keys(blend.theirVec)].map(Number))].sort(
    (a, b) => a - b,
  )
  const m1 = Math.max(1, ...Object.values(blend.myVec))
  const m2 = Math.max(1, ...Object.values(blend.theirVec))
  const circ = 2 * Math.PI * 70
  const offset = circ * (1 - blend.score / 100)
  const likedCommon = blend.common.filter((c) => c.liked).length

  return (
    <>
      <div className="fd-card">
        <div className="fd-toolbar" style={{ justifyContent: "space-between" }}>
          <div>
            <div className="fd-kicker" style={{ marginBottom: 4 }}>
              you × {label}
            </div>
            <h2 style={{ margin: 0 }}>{blend.tierTitle}</h2>
          </div>
          <button type="button" className="fd-btn" onClick={onReset}>
            Reset
          </button>
        </div>
        <div className="fd-blend-ring" style={{ marginTop: 12 }}>
          <div className="fd-ring-wrap">
            <svg width="120" height="120" viewBox="0 0 160 160">
              <circle cx="80" cy="80" r="70" fill="none" stroke="#242f3a" strokeWidth="10" />
              <circle
                cx="80"
                cy="80"
                r="70"
                fill="none"
                stroke="url(#fdGrad)"
                strokeWidth="10"
                strokeDasharray={circ}
                strokeDashoffset={offset}
                strokeLinecap="round"
              />
              <defs>
                <linearGradient id="fdGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#ff8000" />
                  <stop offset="50%" stopColor="#00e054" />
                  <stop offset="100%" stopColor="#40bcf4" />
                </linearGradient>
              </defs>
            </svg>
            <div className="pct">{blend.score}</div>
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <p className="fd-hint" style={{ marginBottom: 8 }}>
              <b>{blend.common.length}</b> shared film{blend.common.length === 1 ? "" : "s"} — {likedCommon} liked
              by you
              {blend.sharedDecade != null ? (
                <>
                  . Peak shared decade: <b>the {blend.sharedDecade}s</b>
                </>
              ) : null}
              . Era similarity: <b>{Math.round(blend.eraSimilarity * 100)}%</b>.
            </p>
            <p className="fd-hint">{blend.tierBlurb}</p>
            <div className="fd-cmp" style={{ marginTop: 10 }}>
              {allD.map((d) => (
                <div key={d} className="row">
                  <span className="yr">{String(d).slice(2)}s</span>
                  <span className="lane">
                    <span
                      className="b"
                      style={{ width: `${((blend.myVec[d] || 0) / m1) * 100}%`, background: "var(--fd-orange)" }}
                    />
                    <span
                      className="b"
                      style={{ width: `${((blend.theirVec[d] || 0) / m2) * 100}%`, background: "var(--fd-blue)" }}
                    />
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="fd-card">
        <h2>In common ({blend.common.length})</h2>
        <div className="fd-pgrid">
          {blend.common.length ? (
            blend.common.map((f) => <PosterCard key={f.id} film={f} badge onToggleFavorite={onToggleFavorite} />)
          ) : (
            <div className="fd-empty">Zero overlap. Genuinely impressive.</div>
          )}
        </div>
      </div>

      <div className="fd-two-col">
        <div className="fd-card">
          <h2>For you</h2>
          <p className="fd-hint">From their list, biased to your era profile.</p>
          <div className="fd-pgrid">
            {blend.forYou.map((f, i) => (
              <PosterCard key={f.id} film={f} rank={i + 1} />
            ))}
          </div>
        </div>
        <div className="fd-card">
          <h2>For them</h2>
          <p className="fd-hint">From your queue, biased to their eras.</p>
          <div className="fd-pgrid">
            {blend.forThem.map((f, i) => (
              <PosterCard key={f.id} film={f} rank={i + 1} onToggleFavorite={onToggleFavorite} />
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
