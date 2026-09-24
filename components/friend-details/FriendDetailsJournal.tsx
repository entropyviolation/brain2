/**
 * components/friend-details/FriendDetailsJournal.tsx — Mission playlist
 *
 * Grouped by day. Status is a lamp. A row opens the mission detail card.
 * A decline reason stays as one line under the row.
 */
"use client"

import { friendSourceLabel } from "@/lib/friend-copy"
import { friendMissionStatusLabel, type FriendMission } from "@/lib/friend-mission"
import { formatExactTime, formatRelativeTime, groupMissionsByDay } from "@/lib/friend-stats"

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
  const groups = groupMissionsByDay(rows, now)

  return (
    <section className={`friend-journal${compact ? " is-compact" : " is-playlist"}`} aria-label="Journal">
      <h3>Journal</h3>
      {rows.length === 0 ? (
        <p className="friend-journal-empty">No missions yet. The chat button asks for one.</p>
      ) : (
        groups.map((group) => (
          <div key={group.key} className="friend-journal-day">
            <h4>{group.label}</h4>
            <ul>
              {group.rows.map((row) => {
                const when = formatRelativeTime(row.offeredAt, now)
                const exact = formatExactTime(row.offeredAt)
                const title = row.stepTitle || row.title
                return (
                  <li key={row.id}>
                    <button
                      type="button"
                      className="friend-log-row"
                      aria-label={`Open mission ${title}`}
                      onClick={() => onOpen(row.id)}
                    >
                      <span className={`friend-lamp is-${row.status}`} title={friendMissionStatusLabel(row.status)} />
                      <span className="friend-log-source">{friendSourceLabel(row.source)}</span>
                      <span className="friend-log-title">{title}</span>
                      <time dateTime={row.offeredAt} title={exact}>
                        {when}
                      </time>
                      {row.status === "done" ? (
                        <span className="friend-log-points">+{row.points} ◆</span>
                      ) : (
                        <span className="friend-log-points" />
                      )}
                    </button>
                    {row.status === "declined" && row.declineReason ? (
                      <p className="friend-log-why">{row.declineReason}</p>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          </div>
        ))
      )}
    </section>
  )
}
