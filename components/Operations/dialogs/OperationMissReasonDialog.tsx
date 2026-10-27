/**
 * components/Operations/OperationMissReasonDialog.tsx — Why an operation was missed
 *
 * Slim prompt. Not the after-action report. Optional preset and note, stored on
 * `OperationReview.blockedReasons`. Closing without a reason writes nothing.
 */
"use client"

import { MissReasonDialog } from "@/components/Reviews/MissReasonDialog"
import { useReviewsStore } from "@/lib/reviews-store"
import type { Task } from "@/lib/types"
import { saveOperationMissReason } from "./operation-actions"

export function OperationMissReasonDialog({
  operation,
  open,
  onClose,
}: {
  operation: Task
  open: boolean
  onClose: () => void
}) {
  const existing = useReviewsStore((s) => s.operationReviews.find((review) => review.operationId === operation.id))
  return (
    <MissReasonDialog
      open={open}
      subject={operation.description}
      title="Why missed"
      className="ops95-dialog"
      initial={existing?.blockedReasons?.[operation.id]}
      onResolve={(reason) => {
        if (reason) saveOperationMissReason(operation.id, reason)
        onClose()
      }}
    />
  )
}
