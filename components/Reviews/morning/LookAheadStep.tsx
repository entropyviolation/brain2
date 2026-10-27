/**
 * components/Reviews/morning/LookAheadStep.tsx — Week and month, due, overdue.
 *
 * One `LookAheadSection`. Week and month uses mode `lists`. Due and overdue
 * pass their step id as the mode. No extra wrapper.
 */
import { LookAheadSection } from "@/components/Reviews/LookAheadSection"
import { getWeekString } from "@/lib/date-utils"
export function LookAheadStep({
  stepId,
  now,
  dayKey,
  activeDate,
}: {
  stepId: "ahead" | "due" | "overdue"
  now: Date
  dayKey: string
  activeDate: Date
}) {
  return (
    <LookAheadSection
      key={stepId}
      mode={stepId === "ahead" ? "lists" : stepId}
      now={now}
      target={{ period: "day", key: dayKey, label: "Today" }}
      lists={[
        { title: "This week", period: "week", key: getWeekString(activeDate) },
        { title: "This month", period: "month", key: dayKey.slice(0, 7) },
      ]}
    />
  )
}
