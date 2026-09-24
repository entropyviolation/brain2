/**
 * components/Home/Habits/habit-row-name.tsx — Title + meta under it
 *
 * Name column is text only. Streak and multiplier sit on a second line.
 */
import { Flame } from "lucide-react"

export function HabitRowName({
  name,
  prio = 0,
  streakTitle,
  thisWeekDays = 0,
  thisWeekHit = false,
  currentWeeks = 0,
}: {
  name: string
  prio?: number
  streakTitle?: string
  thisWeekDays?: number
  thisWeekHit?: boolean
  currentWeeks?: number
}) {
  const showStreak = Boolean(streakTitle) && (thisWeekDays > 0 || currentWeeks > 0)
  const showMeta = prio > 0 || showStreak

  return (
    <div className="habit-name">
      <span className="habit-name-title">{name}</span>
      {showMeta && (
        <span className="habit-name-meta">
          {prio > 0 && (
            <span className="habit-prio-chip" title="Priority weight (pin + missed periods)">
              ×{prio}
            </span>
          )}
          {showStreak && (
            <span className="habit-week-streak" aria-label={streakTitle}>
              {thisWeekHit ? (
                <span className="habit-week-streak-hit">4+</span>
              ) : thisWeekDays > 0 ? (
                <span>{thisWeekDays}d</span>
              ) : null}
              {currentWeeks > 0 && (
                <span className="habit-week-streak-run">
                  <Flame className="h-2.5 w-2.5" />
                  {currentWeeks}w
                </span>
              )}
            </span>
          )}
        </span>
      )}
    </div>
  )
}
