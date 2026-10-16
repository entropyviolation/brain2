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

import { useMemo } from "react"
import { formatDuration } from "@/lib/time-entries"
import { formatLocalDateKey } from "@/lib/date-utils"
import { isPersonPen } from "@/lib/people-sync"
import { personMinuteMasks, personTimeStats, cadenceSentence } from "@/lib/person-time"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { useAnalyticsRange } from "./analytics-range-store"
import { dateKeysInclusive, previousAnalyticsWindow } from "./analytics-range"
import { ChartFrame } from "./chart-frame"
import { StudioHelp, StudioReadout } from "./studio-kit"
import { CompanyHeadcountPlate } from "./TrackingContextPlates"

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
        for (const [date, mask] of masks) {
          const n = count(mask)
          if (!n) continue
          if (!firstEver || date < firstEver) firstEver = date
          if (inWindow.has(date)) {
            minutes += n
            days += 1
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
                    {board.seen.map((row) => {
                      const delta = row.minutes - row.previous
                      const share = board.seen[0] ? row.minutes / board.seen[0].minutes : 0
                      return (
                        <tr key={row.pen.id}>
                          <th scope="row">
                            <span className="an-headcount-dot" style={{ background: row.pen.color }} aria-hidden />
                            {row.pen.name}
                            {row.isNew ? <span className="an-people-new">new</span> : null}
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
            )}
          </section>

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
          </section>

          <CompanyHeadcountPlate entries={entries} scopes={scopes} dateKeys={dateKeys} rangeLabel={label} />
        </>
      )}
    </div>
  )
}
