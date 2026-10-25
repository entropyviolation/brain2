/**
 * components/Analytics/BrowserHistoryView.tsx — Sources → Browser
 *
 * Chrome history exports (one JSON per profile) merged and analysed in the
 * browser by `lib/browser-history.ts`. Files are kept in IndexedDB on this
 * computer (they are too big for localStorage) and never uploaded. The shared
 * date range does not apply here.
 */
"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { analyse, mergeInto, type HistoryAnalysis, type HistoryFile, type Visit } from "@/lib/browser-history"
import { applyChromeHistory } from "@/lib/chrome-sessions"
import "./browser-history-view.css"

const DB = "brain2-browser-history"

function idb<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB, 1)
    open.onupgradeneeded = () => open.result.createObjectStore("files")
    open.onerror = () => reject(open.error)
    open.onsuccess = () => {
      const req = run(open.result.transaction("files", mode).objectStore("files"))
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    }
  })
}

const fmt = (n: number) => n.toLocaleString("en-US")
const day = (t: number) => new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })

function Bars({ rows, max = 12, unit = "" }: { rows: [string, number][]; max?: number; unit?: string }) {
  const top = rows.slice(0, max)
  const peak = Math.max(1, ...top.map((r) => r[1]))
  return (
    <ul className="an-bh-bars">
      {top.map(([k, n]) => (
        <li key={k} title={`${k}: ${fmt(n)}${unit}`}>
          <span className="an-bh-k">{k}</span>
          <span className="an-bh-track">
            <i style={{ width: `${(n / peak) * 100}%` }} />
          </span>
          <b>{fmt(n)}</b>
        </li>
      ))}
    </ul>
  )
}

function HourBars({ hours }: { hours: number[] }) {
  const peak = Math.max(1, ...hours)
  return (
    <svg viewBox="0 0 240 70" className="an-bh-svg" role="img" aria-label="By hour of day">
      {hours.map((n, h) => (
        <rect key={h} x={h * 10 + 1} y={56 - (n / peak) * 52} width={8} height={(n / peak) * 52} className="an-bh-fill" />
      ))}
      {[0, 6, 12, 18].map((h) => (
        <text key={h} x={h * 10 + 5} y={67} className="an-bh-tick">
          {h}
        </text>
      ))}
    </svg>
  )
}

function HourDay({ grid }: { grid: number[][] }) {
  const peak = Math.max(1, ...grid.flat())
  const names = ["M", "T", "W", "T", "F", "S", "S"]
  return (
    <svg viewBox="0 0 260 90" className="an-bh-svg" role="img" aria-label="Weekday by hour">
      {grid.map((row, d) =>
        row.map((n, h) => (
          <rect key={`${d}-${h}`} x={12 + h * 10} y={d * 12 + 2} width={9} height={11} className="an-bh-fill" opacity={0.06 + 0.94 * (n / peak)}>
            <title>{`${names[d]} ${h}:00 — ${fmt(n)}`}</title>
          </rect>
        )),
      )}
      {names.map((n, d) => (
        <text key={d} x={2} y={d * 12 + 11} className="an-bh-tick">
          {n}
        </text>
      ))}
      {[0, 6, 12, 18].map((h) => (
        <text key={h} x={12 + h * 10} y={89} className="an-bh-tick">
          {h}
        </text>
      ))}
    </svg>
  )
}

function DayStrip({ rows, from, to }: { rows: [string, number][]; from: number; to: number }) {
  const m = new Map(rows)
  const days = Math.max(1, Math.round((to - from) / 86400000) + 1)
  const peak = Math.max(1, ...rows.map((r) => r[1]))
  const w = 600 / days
  const cells = []
  for (let i = 0; i < days; i++) {
    const d = new Date(from + i * 86400000)
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    const n = m.get(k) ?? 0
    const h = (n / peak) * 56
    cells.push(
      <rect key={k} x={i * w} y={60 - h} width={Math.max(1, w - 0.6)} height={h} className="an-bh-fill">
        <title>{`${k}: ${fmt(n)}`}</title>
      </rect>,
    )
  }
  return (
    <svg viewBox="0 0 600 70" className="an-bh-svg" preserveAspectRatio="none" role="img" aria-label="Per day">
      <line x1={0} x2={600} y1={60} y2={60} className="an-bh-axis" />
      {cells}
      {Array.from({ length: days }).flatMap((_, i) => {
        const d = new Date(from + i * 86400000)
        return d.getDate() === 1 || i === 0
          ? [
              <text key={i} x={i * w} y={69} className="an-bh-tick">
                {d.toLocaleDateString("en-US", { month: "short", day: i === 0 ? "numeric" : undefined })}
              </text>,
            ]
          : []
      })}
    </svg>
  )
}

const PALETTE = ["#1f3a5f", "#3b82a0", "#6aa8a0", "#7a6fb0", "#a14d6e", "#8c99a6", "#2f6f5f", "#b3bcc6", "#4b5563", "#c9a0b8"]

function Legend({ keys }: { keys: string[] }) {
  return (
    <p className="an-bh-legend">
      {keys.map((k, i) => (
        <span key={k}>
          <i style={{ background: PALETTE[i % PALETTE.length] }} />
          {k}
        </span>
      ))}
    </p>
  )
}

/** One bar per day over the whole span, stacked by key. */
function StackedDays({ byDay, keys, from, to }: { byDay: Record<string, Record<string, number>>; keys: string[]; from: number; to: number }) {
  const days = Math.max(1, Math.round((to - from) / 86400000) + 1)
  const w = 600 / days
  const totals = Object.values(byDay).map((r) => Object.values(r).reduce((a, b) => a + b, 0))
  const peak = Math.max(1, ...totals)
  const bars: React.ReactElement[] = []
  const ticks = []
  for (let i = 0; i < days; i++) {
    const d = new Date(from + i * 86400000)
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    if (d.getDate() === 1 || i === 0)
      ticks.push(
        <text key={`t${k}`} x={i * w} y={79} className="an-bh-tick">
          {d.toLocaleDateString("en-US", { month: "short", day: i === 0 ? "numeric" : undefined })}
        </text>,
      )
    let y = 70
    keys.forEach((key, j) => {
      const n = byDay[k]?.[key] ?? 0
      if (!n) return
      const h = (n / peak) * 64
      y -= h
      bars.push(
        <rect key={`${k}${key}`} x={i * w} y={y} width={Math.max(1, w - 0.6)} height={h} fill={PALETTE[j % PALETTE.length]}>
          <title>{`${k} · ${key}: ${n}`}</title>
        </rect>,
      )
    })
  }
  return (
    <>
      <svg viewBox="0 0 600 82" className="an-bh-svg" preserveAspectRatio="none" role="img" aria-label="Per day, stacked">
        <line x1={0} x2={600} y1={70} y2={70} className="an-bh-axis" />
        {bars}
        {ticks}
      </svg>
      <Legend keys={keys} />
    </>
  )
}

function Card({ title, note, children, wide }: { title: string; note?: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <section className={`an-bh-card${wide ? " is-wide" : ""}`}>
      <h3>{title}</h3>
      {note ? <p className="an-bh-note">{note}</p> : null}
      {children}
    </section>
  )
}

function Stat({ v, l }: { v: string; l: string }) {
  return (
    <div className="an-bh-stat">
      <b>{v}</b>
      <span>{l}</span>
    </div>
  )
}

function Report({ a }: { a: HistoryAnalysis }) {
  const yt = a.youtube
  const [topic, setTopic] = useState<string | null>(null)
  const list = useMemo(
    () => yt.videos.filter((v) => !topic || v.topic === topic).sort((x, y) => y.last - x.last).slice(0, 40),
    [yt.videos, topic],
  )
  const longest = useMemo(() => [...a.sessions].sort((x, y) => y.end - y.start - (x.end - x.start)).slice(0, 5), [a.sessions])
  const hrs = a.activeMinutes / 60
  return (
    <>
      <div className="an-bh-stats">
        <Stat v={fmt(a.total)} l="page visits" />
        <Stat v={`${fmt(a.activeDays)}`} l={`active days, ${day(a.from)} – ${day(a.to)}`} />
        <Stat v={`${hrs.toFixed(0)} h`} l={`est. active (${fmt(a.sessions.length)} sessions)`} />
        <Stat v={fmt(Math.round(a.total / a.activeDays))} l="visits per active day" />
        <Stat v={`${(a.lateNightShare * 100).toFixed(0)}%`} l="between midnight and 5am" />
        <Stat v={`${a.extra.avgRunMin.toFixed(1)} min`} l="average stay on a site" />
        <Stat v={a.extra.runsPerSession.toFixed(1)} l="site switches per session" />
        <Stat v={`${(a.extra.questionShare * 100).toFixed(0)}%`} l="searches phrased as questions" />
        <Stat v={fmt(yt.videos.length)} l="YouTube videos" />
        <Stat v={fmt(a.searches.queries.length)} l="Google searches" />
      </div>
      <div className="an-bh-grid">
        <Card title="Visits per day" wide>
          <DayStrip rows={a.perDay} from={a.from} to={a.to} />
        </Card>
        <Card title="Daily mix by kind of site" wide>
          <StackedDays byDay={a.categoryByDay} keys={a.categories.slice(0, 8).map((c) => c[0])} from={a.from} to={a.to} />
        </Card>
        <Card title="Where the time goes" note="Visits by kind of site.">
          <Bars rows={a.categories} />
        </Card>
        <Card title="Top sites">
          <Bars rows={a.domains} max={14} />
        </Card>
        <Card title="Rabbit holes" note="Longest stretches on one site without leaving for more than 30 minutes.">
          <ul className="an-bh-list">
            {a.extra.rabbitHoles.map((r, i) => (
              <li key={i}>
                <b>{(r.minutes / 60).toFixed(1)} h</b> · {r.name} · {day(r.date)} · {fmt(r.pages)} pages
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Site loyalty" note="Days active out of the span, and when each was first and last seen.">
          <ul className="an-bh-list">
            {a.extra.sites.map((x) => (
              <li key={x.host}>
                <b>{x.name}</b> · {fmt(x.visits)} visits · {x.days} days · {day(x.first)} → {day(x.last)}
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Local servers" note="Named from the page title the server showed most.">
          <ul className="an-bh-list">
            {a.extra.dev.map((x) => (
              <li key={x.host}>
                <b>{x.name}</b> · {x.host} · {fmt(x.visits)} visits · {x.days} days
              </li>
            ))}
          </ul>
        </Card>
        <Card title="When you do what" note="Hour of day for the four biggest kinds of site." wide>
          <div className="an-bh-multi">
            {a.extra.categoryHours.slice(0, 4).map(([k, h]) => (
              <div key={k}>
                <b>{k}</b>
                <HourBars hours={h} />
              </div>
            ))}
          </div>
        </Card>
        <Card title="After midnight" note="Sites between 12 and 5am.">
          <Bars rows={a.extra.lateSites} max={8} />
        </Card>
        <Card title="Average day of week" note="Visits per active day. Monday first.">
          <Bars rows={["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d, i) => [d, Math.round(a.extra.weekdayAvg[i])] as [string, number])} />
        </Card>
        <Card title="Week by hour" note="Local time. Monday first.">
          <HourDay grid={a.hourDay} />
        </Card>
        <Card title="Hour of day">
          <HourBars hours={a.hours} />
        </Card>
        <Card title="How pages were reached" note="link = clicked, generated = search bar suggestion, typed = typed URL.">
          <Bars rows={a.transitions} />
        </Card>
        <Card title="Profiles">
          <Bars rows={a.profiles} />
        </Card>
        <Card title="Longest sessions" note="A new session starts after 30 minutes of nothing.">
          <ul className="an-bh-list">
            {longest.map((s) => (
              <li key={s.start}>
                <b>{Math.round((s.end - s.start) / 60000)} min</b> · {day(s.start)} · {fmt(s.visits)} pages · mostly {s.top}
              </li>
            ))}
          </ul>
        </Card>
        <Card title="What you searched" note="Google queries, repeat searches within a minute merged.">
          <Bars rows={a.searches.words.slice(0, 14)} max={14} />
        </Card>
        <Card title="Searches per day">
          <DayStrip rows={a.extra.searchPerDay} from={a.from} to={a.to} />
        </Card>
        <Card title="Searched again and again">
          <Bars rows={a.extra.repeatSearches} />
        </Card>
        <Card title="Recent searches">
          <ul className="an-bh-list">
            {a.searches.queries.slice(-12).reverse().map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </Card>
      </div>

      <h2 className="an-bh-h2">YouTube</h2>
      <div className="an-bh-grid">
        <Card title="Topics" note="Guessed from the video title with keyword lists. The export has no channel or description. Click a topic to filter the list.">
          <ul className="an-bh-bars is-click">
            {yt.topics.map(([k, n]) => (
              <li key={k} className={topic === k ? "is-on" : ""} onClick={() => setTopic(topic === k ? null : k)}>
                <span className="an-bh-k">{k}</span>
                <span className="an-bh-track">
                  <i style={{ width: `${(n / yt.topics[0][1]) * 100}%` }} />
                </span>
                <b>{n}</b>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Topics by day" wide>
          <StackedDays byDay={yt.topicByDay} keys={yt.topics.slice(0, 8).map((t) => t[0])} from={a.from} to={a.to} />
        </Card>
        <Card title="Most time on one video" note="Minutes from opening a video to the next page, 30 min cap per stretch. A tab left open reads as the cap.">
          <Bars rows={yt.watchMinutes} unit=" min" />
        </Card>
        <Card title="Watching habits">
          <ul className="an-bh-list">
            <li>
              <b>{yt.videosPerSession.toFixed(1)}</b> videos per YouTube session
            </li>
            <li>
              <b>{(yt.shortsShare * 100).toFixed(0)}%</b> of video pages are Shorts
            </li>
            <li>
              <b>{(yt.videos.length / a.activeDays).toFixed(1)}</b> new videos per active day
            </li>
          </ul>
        </Card>
        <Card title="Videos per day">
          <DayStrip rows={yt.perDay} from={a.from} to={a.to} />
        </Card>
        <Card title="When you watch">
          <HourBars hours={yt.hours} />
          <p className="an-bh-note">{yt.rewatched} videos opened again after 30+ minutes.</p>
        </Card>
        <Card title="Words in titles">
          <Bars rows={yt.words.slice(0, 14)} max={14} />
        </Card>
        <Card title={topic ? `Watched · ${topic}` : "Watched · latest 40"} wide>
          <ul className="an-bh-list is-videos">
            {list.map((v) => (
              <li key={v.id}>
                <a href={`https://www.youtube.com/watch?v=${v.id}`} target="_blank" rel="noreferrer">
                  {v.title}
                </a>
                <span>
                  {v.topic} · {day(v.last)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  )
}

export function BrowserHistoryView() {
  const [visits, setVisits] = useState<Visit[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)

  // Kept rows only ever grow: a later export that no longer holds old visits never removes them.
  useEffect(() => {
    idb<Visit[] | undefined>("readonly", (s) => s.get("visits") as IDBRequest<Visit[] | undefined>)
      .then(async (v) => {
        if (v) return v
        const old = await idb<HistoryFile[] | undefined>("readonly", (s) => s.get("all") as IDBRequest<HistoryFile[] | undefined>)
        return old?.length ? mergeInto([], old) : []
      })
      .then(setVisits)
      .catch(() => setVisits([]))
  }, [])

  const [painting, setPainting] = useState(false)
  const paint = useCallback(async (v: Visit[]) => {
    setPainting(true)
    const r = await applyChromeHistory(v, (done, total) => setNote(`Painting Screen Time… ${done} of ${total}`))
    setPainting(false)
    setNote(`Screen Time: ${r.added} new block${r.added === 1 ? "" : "s"} painted from ${r.runs} site stretches (${r.updated} stretched). Existing blocks and edits are left alone.`)
  }, [])

  const onPick = useCallback(
    async (list: FileList | null) => {
      if (!list || visits === null) return
      setErr(null)
      const added: HistoryFile[] = []
      for (const f of Array.from(list)) {
        try {
          const rows = JSON.parse(await f.text())
          if (!Array.isArray(rows) || !rows.every((r) => r && typeof r.url === "string")) throw new Error("not a history export")
          added.push({ profile: f.name.replace(/\.json$/i, ""), rows })
        } catch {
          setErr(`${f.name} is not a Chrome history export (a JSON list with url and visitTime).`)
        }
      }
      if (!added.length) return
      const next = mergeInto(visits, added)
      setNote(`${fmt(next.length - visits.length)} new visits kept (${fmt(next.length)} total).`)
      setVisits(next)
      idb("readwrite", (s) => s.put(next, "visits")).catch(() => setErr("Could not keep the history on this computer; it will be gone on reload."))
      void paint(next)
    },
    [visits, paint],
  )

  const analysis = useMemo(() => (visits?.length ? analyse(visits) : null), [visits])

  return (
    <div className="an-bh">
      <div className="an-bh-bar">
        <label className="an-bh-btn">
          Add history files
          <input type="file" accept=".json,application/json" multiple hidden onChange={(e) => onPick(e.target.files)} />
        </label>
        {visits?.length ? (
          <>
            <span>{fmt(visits.length)} visits kept. New files add to these; nothing is removed.</span>
            <button type="button" className="an-bh-btn" disabled={painting} onClick={() => void paint(visits)}>
              {painting ? "Painting…" : "Paint on Screen Time"}
            </button>
          </>
        ) : null}
      </div>
      {note ? <p className="an-bh-note">{note}</p> : null}
      {err ? <p className="an-bh-err">{err}</p> : null}
      {visits === null ? null : analysis ? (
        <Report a={analysis} />
      ) : (
        <p className="an-bh-note">
          Export each Chrome profile with the Quick Chrome History Export extension, then add the JSON files here. Profiles are merged; the file name
          becomes the profile name. Chrome keeps about 90 days, so keep adding files: older visits stay here after Chrome drops them. Files stay on this computer.
        </p>
      )}
    </div>
  )
}
