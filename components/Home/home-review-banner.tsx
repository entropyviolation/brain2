/**
 * components/Home/home-review-banner.tsx — Due rituals tile (§8.7 / §13)
 *
 * Compact square on the Home overview strip. Lists available/undone rituals
 * and opens the matching end ritual (or points at Header → Rituals).
 */
"use client"

import { useMemo, useState } from "react"
import { useReviewsStore } from "@/lib/reviews-store"
import { countAvailableRituals, listAvailableRituals } from "@/lib/rituals"
import { listAvailableStarLordSlots } from "@/lib/star-lord"
import { useStarLordStore } from "@/lib/star-lord-store"
import { useUserSettingsStore } from "@/lib/user-settings-store"
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
  const starReports = useStarLordStore((s) => s.reports)
  const birthday = useUserSettingsStore((s) => s.birthday)
  const [dismissed, setDismissed] = useState(false)
  const [open, setOpen] = useState(false)

  const available = useMemo(
    () => listAvailableRituals(reviews, currentDate),
    [reviews, currentDate],
  )
  const starDue = useMemo(
    () => listAvailableStarLordSlots(starReports, currentDate, birthday),
    [starReports, currentDate, birthday],
  )
  const pendingCount = useMemo(
    () => countAvailableRituals(reviews, currentDate) + starDue.length,
    [reviews, currentDate, starDue.length],
  )
  const first = available[0]

  if (dismissed || pendingCount === 0) return null

  const period = first?.periodTitle ?? starDue[0]?.title ?? ""

  const openFirst = () => {
    if (!first) {
      document.querySelector<HTMLButtonElement>("[data-rituals-entry]")?.click()
      return
    }
    if (first.kind === "day-morning" || (first.phase === "start" && first.period !== "day")) {
      const entry = document.querySelector<HTMLButtonElement>("[data-rituals-entry]")
      if (entry) {
        entry.click()
        return
      }
    }
    onStartReview?.(first.period, first.periodKey)
  }

  if (!tile) {
    return (
      <div className="home-review-banner">
        <div className="hab-score-caption">
          <span>Rituals due</span>
        </div>
        <p className="home-review-copy">
          {pendingCount} ready — {period}
        </p>
        <div className="home-review-actions">
          <button type="button" className="home-review-key" onClick={openFirst}>
            Open ritual
          </button>
          <button type="button" className="home-review-key" onClick={() => setDismissed(true)}>
            Dismiss
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="home-tile is-review home-review-banner" data-widget="review">
        {onHide && <TileHide id="review" onHide={onHide} />}
        <TileOpen label="Rituals" onOpen={() => setOpen(true)}>
          <div className="hab-score-caption">
            <span>Rituals due</span>
          </div>
          <div className="hab-score-readout" data-centered="true">
            {pendingCount}
          </div>
        </TileOpen>
        <div className="home-review-actions">
          <button type="button" className="home-review-key" onClick={openFirst}>
            Open
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
      <HomeWidgetDialog open={open} onOpenChange={setOpen} title="Rituals">
        {available.map((item) => (
          <p key={item.id} className="home-widget-row">
            <span>
              {item.title} · {item.periodTitle}
              <span className="text-muted-foreground text-xs block">
                app {item.appPath} · text {item.telegramCommand}
              </span>
            </span>
            <button
              type="button"
              className="home-review-key is-on"
              onClick={() => {
                if (item.kind === "day-morning") {
                  document.querySelector<HTMLButtonElement>("[data-rituals-entry]")?.click()
                } else if (item.phase === "start" && item.period !== "day") {
                  document.querySelector<HTMLButtonElement>("[data-rituals-entry]")?.click()
                } else {
                  onStartReview?.(item.period, item.periodKey)
                }
                setOpen(false)
              }}
            >
              Open
            </button>
          </p>
        ))}
        {starDue.map((item) => (
          <p key={item.id} className="home-widget-row">
            <span>
              {item.title} · {item.periodTitle}
              <span className="text-muted-foreground text-xs block">app {item.appPath}</span>
            </span>
            <button
              type="button"
              className="home-review-key is-on"
              onClick={() => {
                document.querySelector<HTMLButtonElement>("[data-rituals-entry]")?.click()
                setOpen(false)
              }}
            >
              Open
            </button>
          </p>
        ))}
      </HomeWidgetDialog>
    </>
  )
}
