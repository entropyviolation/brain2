/**
 * components/Analytics/PeopleView.tsx — People: who you spend time with
 *
 * Time → People. Everyone is a Company person pen (`isPersonPen`), the same
 * pens People I Know items join. Minutes with a person are the union of
 * Company blocks that name them and Social · "Who with?" ticks
 * (`personMinuteMasks`, `lib/person-time.ts`).
 *
 * - Readouts: people seen in the window, time with anyone, share of recorded
 *   Company minutes with someone, and people seen for the first time ever.
 * - **Who** table: each person's time in the window and the change against the
 *   previous window of the same length, days, times together, last seen, their
 *   usual place and activity (all-time), and their rhythm.
 * - **Drifting**: people whose gap since last time is past twice their usual
 *   rhythm (and at least two weeks).
 * - **Social week**: minutes with anyone per day of the window.
 * - The **Who you were with** headcount plate (alone / 1 / 2 / 3 / 4+).
 *
 * Read-only over the tracking store, like every Analytics view.
 */
"use client"

import { useMemo, useState } from "react"
import { formatDuration } from "@/lib/time-entries"
import { formatLocalDateKey } from "@/lib/date-utils"
import { isPersonPen } from "@/lib/people-sync"
import { personMinuteMasks, personTimeStats, cadenceSentence } from "@/lib/person-time"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { useAnalyticsRange } from "./analytics-range-store"
import { dateKeysInclusive, previousAnalyticsWindow } from "./analytics-range"
import { ChartFrame } from "./chart-frame"
import "./analytics-boards.css"
import { StudioHelp, StudioReadout } from "./studio-kit"
import { CompanyHeadcountPlate } from "./TrackingContextPlates"
import { NativeSelect } from "@/components/ui/native-select"

type SortKey = "time" | "change" | "days" | "last" | "name"
const TABLE_LIMIT = 12

function count(mask: Uint8Array | undefined): number {
  if (!mask) return 0
  let n = 0
  for (let m = 0; m < 1440; m++) if (mask[m]) n++
  return n
}

export function PeopleView() {
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const entries = useTimeTrackingStore((s) => s.entries)
  const { dateKeys, label, fromKey, toKey, stepUnit } = useAnalyticsRange()
  const today = formatLocalDateKey(new Date())

  const previousKeys = useMemo(() => {
    if (!fromKey || !toKey) return []
    const prev = previousAnalyticsWindow(fromKey, toKey, stepUnit)
    return prev ? dateKeysInclusive(prev.from, prev.to) : []
  }, [fromKey, toKey, stepUnit])

  const board = useMemo(() => {
    const company = scopes.find((s) => s.id === "company")
    if (!company) return null
    const inWindow = new Set(dateKeys)
    const inPrevious = new Set(previousKeys)
    const firstKey = dateKeys[0] ?? today
    const anyone = new Map<string, Uint8Array>()
    const rows = company.pens
      .filter((pen) => isPersonPen(company, pen))
      .map((pen) => {
        const masks = personMinuteMasks(entries, scopes, [pen.id])
        let minutes = 0
        let previous = 0
        let days = 0
        let firstEver: string | null = null
        const byDay = new Map<string, number>()
        for (const [date, mask] of masks) {
          const n = count(mask)
          if (!n) continue
          if (!firstEver || date < firstEver) firstEver = date
          if (inWindow.has(date)) {
            minutes += n
            days += 1
            byDay.set(date, n)
            const union = anyone.get(date) ?? new Uint8Array(1440)
            for (let m = 0; m < 1440; m++) if (mask[m]) union[m] = 1
            anyone.set(date, union)
          }
          if (inPrevious.has(date)) previous += n
        }
        const stats = masks.size ? personTimeStats(entries, scopes, [pen.id], today) : null
        const sessionsInWindow = stats ? stats.sessions.filter((s) => inWindow.has(s.date)).length : 0
        return {
          pen,
          minutes,
          previous,
          days,
          sessions: sessionsInWindow,
          byDay,
          last: stats?.last ?? null,
          sinceLast: stats?.sinceLast ?? null,
          cadence: stats?.cadenceDays ?? null,
          place: stats?.places[0]?.name ?? "",
          activity: stats?.activities[0]?.name ?? "",
          isNew: Boolean(firstEver && inWindow.has(firstEver) && firstEver >= firstKey),
          ever: Boolean(stats?.totalMinutes),
        }
      })
    const seen = rows.filter((row) => row.minutes > 0).sort((a, b) => b.minutes - a.minutes)
    const drifting = rows
      .filter((row) => row.ever && row.cadence !== null && row.sinceLast !== null && row.sinceLast >= 14 && row.sinceLast > row.cadence * 2)
      .sort((a, b) => (b.sinceLast ?? 0) - (a.sinceLast ?? 0))
    const perDay = dateKeys.map((date) => ({ date, minutes: count(anyone.get(date)) }))
    const withAnyone = perDay.reduce((sum, day) => sum + day.minutes, 0)
    return { rows, seen, drifting, perDay, withAnyone, newPeople: rows.filter((row) => row.isNew) }
  }, [scopes, entries, dateKeys, previousKeys, today])

  const [find, setFind] = useState("")
  const [sort, setSort] = useState<SortKey>("time")
  const [showAll, setShowAll] = useState(false)
  const tableRows = useMemo(() => {
    if (!board) return []
    const q = find.trim().toLowerCase()
    const rows = board.seen.filter((row) => !q || row.pen.name.toLowerCase().includes(q))
    const by: Record<SortKey, (r: (typeof rows)[number]) => number> = {
      time: (r) => -r.minutes,
      change: (r) => -(r.minutes - r.previous),
      days: (r) => -r.days,
      last: (r) => r.sinceLast ?? Infinity,
      name: () => 0,
    }
    return [...rows].sort((a, b) => (sort === "name" ? a.pen.name.localeCompare(b.pen.name) : by[sort](a) - by[sort](b)))
  }, [board, find, sort])
  const visibleRows = showAll || find ? tableRows : tableRows.slice(0, TABLE_LIMIT)

  const peopleCount = board?.rows.length ?? 0
  const dayMax = Math.max(...(board?.perDay.map((d) => d.minutes) ?? [0]), 1)

  return (
    <div className="an-canvas an-stack an-people" data-testid="people-view">
      <header className="an-canvas-head">
        <div>
          <p className="an-canvas-title">People</p>
          <p className="an-canvas-kicker">
            {label} · {peopleCount} {peopleCount === 1 ? "person" : "people"} in Company. Time with someone counts a Company block that
            names them or a Social block that ticks them, once.
          </p>
        </div>
      </header>

      {!board || peopleCount === 0 ? (
        <ChartFrame empty emptySentence="No people in Company yet. Add someone as a Company pen, or tick a Who with? detail on a Social block.">
          <div />
        </ChartFrame>
      ) : (
        <>
          <section className="an-plate">
            <div className="an-readouts">
              <StudioReadout label="People seen" value={`${board.seen.length}`} note={label} tip="People with any tracked minute together in this window." />
              <StudioReadout label="Time with anyone" value={formatDuration(board.withAnyone)} note={`${formatDuration(Math.round(board.withAnyone / Math.max(1, dateKeys.length)))} / day`} tip="Minutes with at least one named person, counted once however many were there." />
              <StudioReadout label="New faces" value={`${board.newPeople.length}`} note={board.newPeople.slice(0, 3).map((r) => r.pen.name).join(", ") || "none"} tip="People whose first tracked minute ever falls in this window." />
              <StudioReadout label="Drifting" value={`${board.drifting.length}`} note="past twice their rhythm" tip="People not seen for at least two weeks and more than twice their usual gap." />
            </div>
          </section>

          <section className="an-plate" aria-label="Who">
            <p className="an-canvas-title">
              Who
              <StudioHelp text="Time together in this window and the change against the previous window of the same length. Usual place and activity are all-time: the Location and Activity pens painted over your minutes together. Rhythm is the median days between days together." />
            </p>
            {board.seen.length === 0 ? (
              <p className="an-level-empty">Nobody tracked together in the {label}.</p>
            ) : (
              <>
              <div className="an-people-controls">
                <label className="an-studio-field an-find-inline">
                  <span>Find</span>
                  <input value={find} onChange={(e) => setFind(e.target.value)} placeholder="Name" aria-label="Find a person" />
                </label>
                <label className="an-studio-field">
                  <span>Sort</span>
                  <NativeSelect value={sort} aria-label="Sort people" onChange={(e) => setSort(e.target.value as SortKey)}>
                    <option value="time">Most time</option>
                    <option value="change">Biggest rise</option>
                    <option value="days">Most days</option>
                    <option value="last">Seen most recently</option>
                    <option value="name">Name</option>
                  </NativeSelect>
                </label>
              </div>
              <div className="an-people-table-wrap">
                <table className="an-people-table">
                  <thead>
                    <tr>
                      <th scope="col">Person</th>
                      <th scope="col">Time</th>
                      <th scope="col">vs before</th>
                      <th scope="col">Days</th>
                      <th scope="col">Times</th>
                      <th scope="col">Last</th>
                      <th scope="col">Usually</th>
                      <th scope="col">Rhythm</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((row) => {
                      const delta = row.minutes - row.previous
                      const share = board.seen[0] ? row.minutes / board.seen[0].minutes : 0
                      return (
                        <tr key={row.pen.id}>
                          <th scope="row">
                            <span className="an-people-name">
                              <span className="an-headcount-dot" style={{ background: row.pen.color }} aria-hidden />
                              {row.pen.name}
                              {row.isNew ? <span className="an-people-new">new</span> : null}
                            </span>
                          </th>
                          <td>
                            <span className="an-people-meter" aria-hidden>
                              <span style={{ width: `${Math.round(share * 100)}%`, background: row.pen.color }} />
                            </span>
                            {formatDuration(row.minutes)}
                          </td>
                          <td className={delta > 0 ? "is-up" : delta < 0 ? "is-down" : undefined}>
                            {previousKeys.length ? `${delta > 0 ? "+" : delta < 0 ? "−" : ""}${formatDuration(Math.abs(delta))}` : "—"}
                          </td>
                          <td>{row.days}</td>
                          <td>{row.sessions}</td>
                          <td>{row.sinceLast === null ? "—" : row.sinceLast === 0 ? "today" : `${row.sinceLast}d ago`}</td>
                          <td>{[row.activity, row.place].filter(Boolean).join(" · ") || "—"}</td>
                          <td>{row.cadence === null ? "—" : cadenceSentence(row.cadence).replace(/\.$/, "")}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {tableRows.length > TABLE_LIMIT && !find ? (
                <button type="button" className="an-open-lists" onClick={() => setShowAll((v) => !v)}>
                  {showAll ? `Show top ${TABLE_LIMIT}` : `Show all ${tableRows.length}`}
                </button>
              ) : null}
              {find && tableRows.length === 0 ? <p className="an-n">Nobody matches “{find}”.</p> : null}
              </>
            )}
          </section>

          {board.seen.length ? <CompanyArcs seen={board.seen} drifting={board.drifting} /> : null}

          {board.seen.length ? (
            <section className="an-plate" aria-label="Days together" data-testid="people-days-together">
              <p className="an-canvas-title">
                Days together
                <StudioHelp text="One row per person (top 12 by time), one cell per day of the window. A filled cell is a day with any tracked minute together; darker means more minutes. Gaps show the rhythm at a glance." />
              </p>
              <div className="an-people-era" style={{ ["--days" as string]: dateKeys.length }}>
                {board.seen.slice(0, 12).map((row) => {
                  const peak = Math.max(1, ...row.byDay.values())
                  return (
                    <div key={row.pen.id} className="an-people-era-row">
                      <span className="an-people-era-name" title={row.pen.name}>{row.pen.name}</span>
                      <span className="an-people-era-cells">
                        {dateKeys.map((date) => {
                          const n = row.byDay.get(date) ?? 0
                          return (
                            <span
                              key={date}
                              title={`${row.pen.name} · ${date} · ${n ? formatDuration(n) : "not together"}`}
                              style={n ? { background: row.pen.color, opacity: 0.35 + 0.65 * (n / peak) } : undefined}
                            />
                          )
                        })}
                      </span>
                    </div>
                  )
                })}
              </div>
              <p className="an-n">
                {dateKeys[0]} → {dateKeys[dateKeys.length - 1]} · {dateKeys.length} days
              </p>
            </section>
          ) : null}

          {board.drifting.length ? (
            <section className="an-plate" aria-label="Drifting">
              <p className="an-canvas-title">
                Drifting
                <StudioHelp text="Not seen for at least two weeks and more than twice their usual gap between days together." />
              </p>
              <ul className="an-people-drift">
                {board.drifting.slice(0, 8).map((row) => (
                  <li key={row.pen.id}>
                    <span className="an-headcount-dot" style={{ background: row.pen.color }} aria-hidden />
                    <strong>{row.pen.name}</strong> — {row.sinceLast} days; usually {cadenceSentence(row.cadence).toLowerCase().replace(/\.$/, "")}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="an-plate" aria-label="Social days">
            <p className="an-canvas-title">
              Time with anyone, by day
              <StudioHelp text="Minutes per day with at least one named person. Blank days are days with nobody named, which is not the same as alone." />
            </p>
            <div className="an-people-days" role="img" aria-label="Minutes with anyone per day">
              {board.perDay.map((day) => (
                <span key={day.date} title={`${day.date} · ${formatDuration(day.minutes)}`}>
                  <span style={{ height: `${Math.round((day.minutes / dayMax) * 100)}%` }} />
                </span>
              ))}
            </div>
            <p className="an-n">
              {dateKeys[0]} → {dateKeys[dateKeys.length - 1]} · tallest bar {formatDuration(dayMax === 1 ? 0 : dayMax)} ·{" "}
              {board.perDay.filter((d) => d.minutes > 0).length} of {dateKeys.length} days with someone
            </p>
          </section>

          <CompanyHeadcountPlate entries={entries} scopes={scopes} dateKeys={dateKeys} rangeLabel={label} />
        </>
      )}
    </div>
  )
}

type ArcRow = { pen: { id: string; name: string; color: string }; minutes: number; sinceLast: number | null }

/**
 * Company arcs (IIB "Who's Suing Whom", turned inward): you in the middle,
 * people on a ring, stroke width ∝ √minutes together. Drifting people sit on
 * the ring faded with a dashed spoke.
 */
function CompanyArcs({ seen, drifting }: { seen: ArcRow[]; drifting: ArcRow[] }) {
  const [hover, setHover] = useState<string | null>(null)
  const people = [...seen.slice(0, 16), ...drifting.filter((d) => !seen.some((s) => s.pen.id === d.pen.id)).slice(0, 6)]
  const max = Math.max(1, ...seen.map((r) => r.minutes))
  const size = 320
  const c = size / 2
  const r = 118
  return (
    <section className="an-plate" aria-label="Company arcs" data-testid="people-arcs">
      <p className="an-canvas-title">
        Company arcs
        <StudioHelp text="You in the middle. Each spoke is a person; its width grows with the square root of your time together in this window. Faded dashed spokes are drifting people (not seen in a while). Hover a name for the numbers." />
      </p>
      <svg className="an-people-arcs" viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Time with each person as spokes from you">
        {people.map((row, i) => {
          const a = (i / people.length) * Math.PI * 2 - Math.PI / 2
          const x = c + Math.cos(a) * r
          const y = c + Math.sin(a) * r
          const isDrift = row.minutes === 0
          const w = isDrift ? 1 : 1.5 + 10 * Math.sqrt(row.minutes / max)
          const lit = hover === null || hover === row.pen.id
          const right = Math.cos(a) >= 0
          return (
            <g
              key={row.pen.id}
              opacity={lit ? (isDrift ? 0.45 : 1) : 0.2}
              onMouseEnter={() => setHover(row.pen.id)}
              onMouseLeave={() => setHover(null)}
            >
              <title>{`${row.pen.name} · ${isDrift ? `${row.sinceLast} days since` : formatDuration(row.minutes)}`}</title>
              <path
                d={`M ${c} ${c} Q ${c + Math.cos(a - 0.35) * r * 0.55} ${c + Math.sin(a - 0.35) * r * 0.55} ${x} ${y}`}
                fill="none"
                stroke={row.pen.color}
                strokeWidth={w}
                strokeLinecap="round"
                strokeDasharray={isDrift ? "3 4" : undefined}
              />
              <circle cx={x} cy={y} r={4} fill={row.pen.color} />
              <text
                x={x + (right ? 7 : -7)}
                y={y + 3}
                textAnchor={right ? "start" : "end"}
                className="an-people-arc-label"
              >
                {row.pen.name.length > 14 ? `${row.pen.name.slice(0, 13)}…` : row.pen.name}
              </text>
            </g>
          )
        })}
        <circle cx={c} cy={c} r={14} className="an-people-arc-you" />
        <text x={c} y={c + 3} textAnchor="middle" className="an-people-arc-label">you</text>
      </svg>
      {seen.length > 16 ? <p className="an-n">Top 16 of {seen.length} people seen, plus up to 6 drifting.</p> : null}
    </section>
  )
}
