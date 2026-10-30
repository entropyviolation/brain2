/**
 * components/friend-details/FriendDetailsJournal.tsx — Mission log
 *
 * Today shows the newest two rows and no heading. Journal is the playlist:
 * day strips, one row per mission, decline reason indented under the row.
 */
"use client"

import { friendSourceLabel } from "@/lib/friend-copy"
import { friendMissionStatusLabel, type FriendMission } from "@/lib/friend-mission"
import { formatExactTime, formatRelativeTime, groupMissionsByDay } from "@/lib/friend-stats"

function LogRow({ row, now, onOpen }: { row: FriendMission; now: Date; onOpen: (id: string) => void }) {
  const when = formatRelativeTime(row.offeredAt, now)
  const exact = formatExactTime(row.offeredAt)
  const title = row.stepTitle || row.title
  return (
    <li>
      <button
        type="button"
        className="friend-log-row"
        data-no95=""
        aria-label={`Open mission ${title}`}
        onClick={() => onOpen(row.id)}
      >
        <span className={`friend-lamp is-${row.status}`} title={friendMissionStatusLabel(row.status)} />
        <span className="friend-log-main">
          <span className="friend-log-title">{title}</span>
          <span className="friend-log-source">{friendSourceLabel(row.source)}</span>
        </span>
        <time dateTime={row.offeredAt} title={exact}>
          {when}
        </time>
        {row.status === "done" ? (
          <span className="friend-log-points">+{row.points}</span>
        ) : (
          <span className="friend-log-points" />
        )}
      </button>
      {row.status === "declined" && row.declineReason ? (
        <p className="friend-log-why">{row.declineReason}</p>
      ) : null}
    </li>
  )
}

export function FriendDetailsJournal({
  rows,
  now,
  onOpen,
  compact,
}: {
  rows: FriendMission[]
  now: Date
  onOpen: (id: string) => void
  compact?: boolean
}) {
  if (compact) {
    if (rows.length === 0) return null
    return (
      <section className="friend-journal is-compact" aria-label="Latest">
        <ul>
          {rows.map((row) => (
            <LogRow key={row.id} row={row} now={now} onOpen={onOpen} />
          ))}
        </ul>
      </section>
    )
  }

  const groups = groupMissionsByDay(rows, now)

  return (
    <section className="friend-journal is-playlist" aria-label="Journal">
      {rows.length === 0 ? (
        <p className="friend-journal-empty">No missions yet.</p>
      ) : (
        groups.map((group) => (
          <div key={group.key} className="friend-journal-day">
            <h4>{group.label}</h4>
            <ul>
              {group.rows.map((row) => (
                <LogRow key={row.id} row={row} now={now} onOpen={onOpen} />
              ))}
            </ul>
          </div>
        ))
      )}
    </section>
  )
}
