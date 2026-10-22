/**
 * components/People/person-time-together.tsx — Time together, from Tracking
 *
 * In a person's item detail (People I Know), under Known for / Last saw. Reads
 * `personTimeStats` (`lib/person-time.ts`) for the Company pens joined to this
 * person: totals and rhythm, when in the week and day you tend to be
 * together, where you usually are and what you are doing, who else is often
 * there, and the most recent sessions. Read-only; joins are edited in the
 * pipelines section below it.
 */
"use client"

import { memo, useMemo } from "react"
import { formatDuration, minutesToLabel } from "@/lib/time-entries"
import { joinedCompanyPenIds, personTimePenIds } from "@/lib/people-i-know"
import { cadenceSentence, personTimeStats, type PenShare } from "@/lib/person-time"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import type { Task } from "@/lib/types"

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

function dayLabel(date: string): string {
  const [y, m, d] = date.split("-").map(Number)
  return new Date(y!, m! - 1, d!).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })
}

function PersonTimeTogetherView({ person, todayIso }: { person: Task; todayIso: string }) {
  const entries = useTimeTrackingStore((s) => s.entries)
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const penIds = useMemo(() => personTimePenIds(person), [person])
  const joined = useMemo(() => joinedCompanyPenIds(person.personPipelines), [person.personPipelines])
  const stats = useMemo(() => personTimeStats(entries, scopes, penIds, todayIso), [entries, scopes, penIds, todayIso])
  const name = person.title || person.description || "them"

  if (!joined.length && !stats.totalMinutes) {
    return (
      <section className="person-time" aria-label="Time together" data-testid="person-time">
        <p className="person-time-title">Time together</p>
        <p className="person-detail-help">Join a Company pen below and Tracking time with {name} shows up here.</p>
      </section>
    )
  }
  if (!stats.totalMinutes) {
    return (
      <section className="person-time" aria-label="Time together" data-testid="person-time">
        <p className="person-time-title">Time together</p>
        <p className="person-detail-help">
          No tracked time with {name} yet. Paint them in Company, or tick them on a Social block.
        </p>
      </section>
    )
  }

  const weekdayMax = Math.max(...stats.weekday, 1)
  const hourMax = Math.max(...stats.hour, 1)

  return (
    <section className="person-time" aria-label="Time together" data-testid="person-time">
      <p className="person-time-title">Time together</p>
      <div className="person-time-readouts">
        <Readout label="All time" value={formatDuration(stats.totalMinutes)} note={`${stats.days} ${stats.days === 1 ? "day" : "days"} · ${stats.sessions.length} times`} />
        <Readout label="Last 30 days" value={formatDuration(stats.last30)} note={`${formatDuration(stats.last90)} in 90`} />
        <Readout label="Per week" value={formatDuration(stats.perWeek)} note="last 12 weeks" />
        <Readout
          label="Last together"
          value={stats.sinceLast === 0 ? "Today" : stats.sinceLast === 1 ? "Yesterday" : `${stats.sinceLast}d ago`}
          note={stats.last ? dayLabel(stats.last) : ""}
        />
      </div>
      <p className="person-time-rhythm">
        <strong>How often:</strong> {cadenceSentence(stats.cadenceDays)}
        {stats.longest ? (
          <>
            {" "}
            Longest: {formatDuration(stats.longest.minutes)} on {dayLabel(stats.longest.date)}.
          </>
        ) : null}
        {stats.first ? <> Since {dayLabel(stats.first)}.</> : null}
      </p>

      <div className="person-time-shape">
        <div className="person-time-week" role="img" aria-label="Time together by weekday">
          {stats.weekday.map((minutes, i) => (
            <div key={WEEKDAYS[i]} className="person-time-bar" title={`${WEEKDAYS[i]} · ${formatDuration(minutes)}`}>
              <span style={{ height: `${Math.round((minutes / weekdayMax) * 100)}%` }} />
              <em>{WEEKDAYS[i]![0]}</em>
            </div>
          ))}
        </div>
        <div className="person-time-hours" role="img" aria-label="Time together by hour of day">
          {stats.hour.map((minutes, h) => (
            <span
              key={h}
              title={`${minutesToLabel(h * 60)} · ${formatDuration(minutes)}`}
              style={{ opacity: minutes ? 0.18 + 0.82 * (minutes / hourMax) : 0.06 }}
            />
          ))}
          <em>12a</em>
          <em>6a</em>
          <em>12p</em>
          <em>6p</em>
        </div>
      </div>

      <div className="person-time-lists">
        <ShareList title="Where" rows={stats.places} empty="No Location painted alongside." />
        <ShareList title="Doing" rows={stats.activities} empty="No Activity painted alongside." />
        <ShareList title="Also there" rows={stats.others} empty="Usually just the two of you." />
      </div>

      <div className="person-time-sessions">
        <p className="person-time-sub">Recent times</p>
        <ul>
          {stats.sessions.slice(0, 8).map((session) => (
            <li key={`${session.date}-${session.startMin}`}>
              <span className="person-time-date">{dayLabel(session.date)}</span>
              <span className="person-time-clock">
                {minutesToLabel(session.startMin)}–{minutesToLabel(session.endMin)}
              </span>
              <span className="person-time-dur">{formatDuration(session.minutes)}</span>
              <span className="person-time-ctx">
                {[session.activities[0], session.places[0], session.others.length ? `with ${session.others.slice(0, 2).join(", ")}` : ""]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function Readout({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="person-time-readout">
      <span className="person-time-readout-label">{label}</span>
      <span className="person-time-readout-value">{value}</span>
      {note ? <span className="person-time-readout-note">{note}</span> : null}
    </div>
  )
}

function ShareList({ title, rows, empty }: { title: string; rows: PenShare[]; empty: string }) {
  const max = Math.max(...rows.map((row) => row.minutes), 1)
  return (
    <div className="person-time-share">
      <p className="person-time-sub">{title}</p>
      {rows.length === 0 ? (
        <p className="person-detail-help">{empty}</p>
      ) : (
        <ul>
          {rows.slice(0, 5).map((row) => (
            <li key={row.penId}>
              <span className="person-time-dot" style={{ background: row.color }} aria-hidden />
              <span className="person-time-name">{row.name}</span>
              <span className="person-time-meter" aria-hidden>
                <span style={{ width: `${Math.round((row.minutes / max) * 100)}%`, background: row.color }} />
              </span>
              <span className="person-time-dur">{formatDuration(row.minutes)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Memoized (1.2): reads only the person's name and `personPipelines`. */
export const PersonTimeTogether = memo(
  PersonTimeTogetherView,
  (a, b) =>
    a.todayIso === b.todayIso &&
    a.person.title === b.person.title &&
    a.person.description === b.person.description &&
    a.person.personPipelines === b.person.personPipelines,
)
