/**
 * components/Home/home-review-banner.tsx — Due rituals tile (§8.7 / §13)
 *
 * Compact square on the Home overview strip. Lists available/undone rituals.
 * Open (tile key or a row in the detail) opens that rite's own dialog here,
 * through `RitualWalkDialog`. It does not click the header Rituals door: that
 * door loads its room on the first press and opens the menu after that, so
 * it never reached the rite. The detail closes first; the rite opens on the
 * next frame so the two dialogs do not fight over focus.
 * Open / Dismiss / Not now (ask tomorrow) share one key group.
 */
"use client"

import { CopyCaption, useCopySetting } from "@/components/Home/widgets/copy-context"
import { useEffect, useMemo, useRef, useState } from "react"
import dynamic from "next/dynamic"
import { useReviewsStore } from "@/lib/reviews-store"
import { countAvailableRituals, listAvailableRituals } from "@/lib/rituals"
import { listAvailableStarLordSlots } from "@/lib/star-lord"
import { ritualSlotPlacement, starLordSlotPlacement, type RitualTodoPlacement } from "@/lib/ritual-todo"
import { useStarLordStore } from "@/lib/star-lord-store"
import { useUserSettingsStore } from "@/lib/user-settings-store"
import { HomeWidgetDialog, TileHide, TileOpen } from "@/components/Home/home-widget-dialog"
import type { ReviewPeriod } from "@/lib/types"
import { addCalendarDays, formatLocalDateKey } from "@/lib/date-utils"
import { persistKey, readAliasedLocal, writeAliasedLocal } from "@/lib/storage-keys"

/** The rite dialogs load when a rite is opened, not with the Home strip. */
const RitualWalkDialog = dynamic(
  () => import("@/components/Reviews/RitualWalkDialog").then((m) => m.RitualWalkDialog),
  { ssr: false },
)

const RITUAL_SNOOZE_KEY = persistKey("rituals-snooze-until")

function readRitualSnoozeUntil(): string | null {
  if (typeof window === "undefined") return null
  return readAliasedLocal(RITUAL_SNOOZE_KEY)
}

function writeRitualSnoozeUntil(dateKey: string): void {
  writeAliasedLocal(RITUAL_SNOOZE_KEY, dateKey)
}

type HomeReviewBannerProps = {
  currentDate: Date
  /** No longer called. Open shows the rite here. Kept so callers still compile. */
  onStartReview?: (period: ReviewPeriod, periodKey: string) => void
  /** Square on the overview tray. */
  tile?: boolean
  onHide?: () => void
}

export function HomeReviewBanner({
  currentDate,
  tile = false,
  onHide,
}: HomeReviewBannerProps) {
  const reviews = useReviewsStore((s) => s.reviews)
  const starReports = useStarLordStore((s) => s.reports)
  const birthday = useUserSettingsStore((s) => s.birthday)
  const [dismissed, setDismissed] = useState(false)
  const [snoozedUntil, setSnoozedUntil] = useState<string | null>(() => readRitualSnoozeUntil())
  const [open, setOpen] = useState(false)
  const [walk, setWalk] = useState<RitualTodoPlacement | null>(null)
  const frame = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (frame.current != null) cancelAnimationFrame(frame.current)
    },
    [],
  )

  /** Close the detail, then open the rite on the next frame. */
  const openWalk = (placement: RitualTodoPlacement) => {
    setOpen(false)
    if (frame.current != null) cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(() => {
      frame.current = null
      setWalk(placement)
    })
  }

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
  const faceKeys = useCopySetting<boolean>("keys", true)
  const dayKey = formatLocalDateKey(currentDate)
  const snoozedForToday = Boolean(snoozedUntil && dayKey < snoozedUntil)

  const snoozeUntilTomorrow = () => {
    const until = formatLocalDateKey(addCalendarDays(currentDate, 1))
    writeRitualSnoozeUntil(until)
    setSnoozedUntil(until)
  }

  // The rite stays mounted after the square hides (the last rite saved, or
  // Dismiss), so closing it is the dialog's own job.
  const walkDialog = walk ? <RitualWalkDialog placement={walk} onClose={() => setWalk(null)} /> : null

  if (dismissed || snoozedForToday || pendingCount === 0) return walkDialog

  const period = first?.periodTitle ?? starDue[0]?.title ?? ""

  const openFirst = () => {
    if (first) openWalk(ritualSlotPlacement(first))
    else if (starDue[0]) openWalk(starLordSlotPlacement(starDue[0]))
  }

  if (!tile) {
    return (
      <>
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
            <button
              type="button"
              className="home-review-key"
              title="Hide until tomorrow"
              onClick={snoozeUntilTomorrow}
            >
              Not now
            </button>
            <button type="button" className="home-review-key" onClick={() => setDismissed(true)}>
              Dismiss
            </button>
          </div>
        </div>
        {walkDialog}
      </>
    )
  }

  return (
    <>
      <div className="home-tile is-review is-hero home-review-banner" data-widget="review">
        {onHide && <TileHide id="review" onHide={onHide} />}
        <TileOpen label="Rituals" onOpen={() => setOpen(true)}>
          <div className="hab-score-caption">
            <span>
              <CopyCaption>Rituals</CopyCaption>
            </span>
          </div>
          <div className="hab-score-readout" data-centered="true">
            {pendingCount}
          </div>
        </TileOpen>
        {faceKeys ? (
        <div className="home-review-actions">
          <button type="button" className="home-review-key" onClick={openFirst}>
            Open
          </button>
          <button
            type="button"
            className="home-review-key"
            title="Ask tomorrow"
            onClick={snoozeUntilTomorrow}
          >
            Not now
          </button>
          <button type="button" className="home-review-key" onClick={() => setDismissed(true)}>
            Dismiss
          </button>
        </div>
        ) : null}
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
              onClick={() => openWalk(ritualSlotPlacement(item))}
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
              onClick={() => openWalk(starLordSlotPlacement(item))}
            >
              Open
            </button>
          </p>
        ))}
      </HomeWidgetDialog>
      {walkDialog}
    </>
  )
}
