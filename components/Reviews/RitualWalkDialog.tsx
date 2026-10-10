/**
 * components/Reviews/RitualWalkDialog.tsx — Open the rite behind a To Do row
 *
 * Home → To Do calls this when the day's ritual row is opened. The walk is
 * the same dialog the Rituals menu uses. Close and submit stay those dialogs.
 */
"use client"

import { MorningReviewDialog } from "@/components/Reviews/MorningReview"
import { ReviewDialog } from "@/components/Reviews/reviews"
import { StarLordReportDialog } from "@/components/Reviews/StarLordReportDialog"
import { StartRitualDialog } from "@/components/Reviews/StartRitualDialog"
import type { RitualTodoPlacement } from "@/lib/ritual-todo"

export function RitualWalkDialog({
  placement,
  onClose,
}: {
  placement: RitualTodoPlacement | null
  onClose: () => void
}) {
  if (!placement) return null
  const walk = placement.walk
  if (walk.type === "morning") {
    return <MorningReviewDialog open onClose={onClose} date={placement.date} />
  }
  if (walk.type === "end") {
    return <ReviewDialog open period={walk.period} periodKey={walk.periodKey} onClose={onClose} />
  }
  if (walk.type === "start") {
    return <StartRitualDialog open period={walk.period} periodKey={walk.periodKey} onClose={onClose} />
  }
  return <StarLordReportDialog open kind={walk.occasion} dateKey={walk.dateKey} onClose={onClose} />
}
