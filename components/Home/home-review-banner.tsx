/**
 * components/Home/home-review-banner.tsx — Surfaces due end-of-period reviews (§8.7)
 */
"use client"

import { useMemo, useState } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { ClipboardCheck } from "lucide-react"
import { useReviewsStore, REVIEW_PERIODS, periodLabel } from "@/lib/reviews-store"
import { countPendingReviews, getPendingReviews } from "@/lib/pending-reviews"
import type { ReviewPeriod } from "@/lib/types"

type HomeReviewBannerProps = {
  currentDate: Date
  onStartReview?: (period: ReviewPeriod, periodKey: string) => void
}

export function HomeReviewBanner({ currentDate, onStartReview }: HomeReviewBannerProps) {
  const reviews = useReviewsStore((s) => s.reviews)
  const [dismissed, setDismissed] = useState(false)

  const pending = useMemo(() => getPendingReviews(reviews, currentDate), [reviews, currentDate])
  const pendingCount = useMemo(() => countPendingReviews(reviews, currentDate), [reviews, currentDate])
  const firstDue = REVIEW_PERIODS.find((p) => pending[p].needed)

  if (dismissed || pendingCount === 0 || !firstDue) return null

  const { key } = pending[firstDue]

  return (
    <Alert className="home-review-banner">
      <ClipboardCheck className="h-4 w-4" />
      <AlertTitle>Review due</AlertTitle>
      <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <span>
          {pendingCount === 1
            ? `Your ${firstDue} review for ${periodLabel(firstDue, key)} is ready.`
            : `${pendingCount} end-of-period reviews are ready — starting with ${firstDue} (${periodLabel(firstDue, key)}).`}
        </span>
        <div className="flex gap-2 shrink-0">
          <Button
            size="sm"
            onClick={() => onStartReview?.(firstDue, key)}
          >
            Start review
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setDismissed(true)}>
            Dismiss
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  )
}
