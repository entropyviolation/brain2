/**
 * components/Home/home-review-banner.tsx — Due end-of-period reviews (§8.7)
 *
 * Compact square on the Home overview strip (not a full-width banner).
 * Start review and Dismiss keep the same behavior.
 */
"use client"

import { useMemo, useState } from "react"
import { useReviewsStore, REVIEW_PERIODS, periodLabel } from "@/lib/reviews-store"
import { countPendingReviews, getPendingReviews } from "@/lib/pending-reviews"
import { HomeWidgetDialog, TileHide, TileOpen } from "@/components/Home/home-widget-dialog"
import type { ReviewPeriod } from "@/lib/types"

type HomeReviewBannerProps = {
  currentDate: Date
  onStartReview?: (period: ReviewPeriod, periodKey: string) => void
  /** Square on the overview tray. */
  tile?: boolean
  onHide?: () => void
}

export function HomeReviewBanner({
  currentDate,
  onStartReview,
  tile = false,
  onHide,
}: HomeReviewBannerProps) {
  const reviews = useReviewsStore((s) => s.reviews)
  const [dismissed, setDismissed] = useState(false)
  const [open, setOpen] = useState(false)

  const pending = useMemo(() => getPendingReviews(reviews, currentDate), [reviews, currentDate])
  const pendingCount = useMemo(() => countPendingReviews(reviews, currentDate), [reviews, currentDate])
  const firstDue = REVIEW_PERIODS.find((p) => pending[p].needed)

  if (dismissed || pendingCount === 0 || !firstDue) return null

  const { key } = pending[firstDue]
  const period = periodLabel(firstDue, key)

  if (!tile) {
    return (
      <div className="home-review-banner">
        <div className="hab-score-caption">
          <span>Review due</span>
        </div>
        <p className="home-review-copy">
          {pendingCount} ready — {period}
        </p>
        <div className="home-review-actions">
          <button type="button" className="home-review-key" onClick={() => onStartReview?.(firstDue, key)}>
            Start review
          </button>
          <button type="button" className="home-review-key" onClick={() => setDismissed(true)}>
            Dismiss
          </button>
        </div>
      </div>
    )
  }

  const due = REVIEW_PERIODS.filter((item) => pending[item].needed)

  return (
    <>
      <div className="home-tile is-review home-review-banner" data-widget="review">
        {onHide && <TileHide id="review" onHide={onHide} />}
        <TileOpen label="Review" onOpen={() => setOpen(true)}>
          <div className="hab-score-caption">
            <span>Review due</span>
          </div>
          <div className="hab-score-readout" data-centered="true">
            {pendingCount}
          </div>
        </TileOpen>
        <div className="home-review-actions">
          <button type="button" className="home-review-key" onClick={() => onStartReview?.(firstDue, key)}>
            Start review
          </button>
          <button type="button" className="home-review-key" onClick={() => setDismissed(true)}>
            Dismiss
          </button>
        </div>
        <div className="home-tile-foot">
          <p className="hab-score-sub" title={period}>
            {period}
          </p>
        </div>
      </div>
      <HomeWidgetDialog open={open} onOpenChange={setOpen} title="Review">
        {due.map((item) => (
          <p key={item} className="home-widget-row">
            <span>{periodLabel(item, pending[item].key)}</span>
            <button
              type="button"
              className="home-review-key is-on"
              onClick={() => {
                onStartReview?.(item, pending[item].key)
                setOpen(false)
              }}
            >
              Start
            </button>
          </p>
        ))}
      </HomeWidgetDialog>
    </>
  )
}
