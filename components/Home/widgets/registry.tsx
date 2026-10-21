/**
 * components/Home/widgets/registry.tsx — Draw one installed copy
 *
 * The React half of the kind registry (`lib/widgets/kinds.ts`): which tile
 * draws each kind. Today's tiles are the faces, and their silver handheld
 * dialogs are the details, so every detail works as it did. A Countdown copy
 * draws its one mark; a Language study copy draws its one language. A copy
 * whose kind this build does not know draws a quiet placeholder.
 */
"use client"

import type { ReactNode } from "react"
import { HomeReviewBanner } from "@/components/Home/home-review-banner"
import { PointsBoard } from "@/components/Home/points-stats"
import { AwardTile } from "@/components/Home/home-award-tile"
import { ProgressTile } from "@/components/Home/home-progress-tile"
import { AffirmationTile } from "@/components/Home/home-affirmation-tile"
import { DaysUntilTile } from "@/components/Home/home-days-until"
import { MoonTile } from "@/components/Home/home-moon-tile"
import { SolarRemainderTile } from "@/components/Home/home-solar-tile"
import { TrackingNowTile } from "@/components/Home/home-tracking-tile"
import { HarvestTile, InboxMillTile, NightWellTile } from "@/components/Home/home-glance-tiles"
import { AlreadyFlowingTile, PlanAndLivedTile } from "@/components/Home/home-reading-tiles"
import { BudgetTile } from "@/components/Home/home-budget-tile"
import { VocabTile } from "@/components/Home/home-vocab-tile"
import { ScreenPetTile } from "@/components/Home/home-screen-pet"
import { NextTile } from "@/components/Home/home-next-tile"
import { DayLampTile } from "@/components/Home/home-day-lamp"
import { WeatherTile } from "@/components/Home/weather-instrument"
import { isVocabLang } from "@/lib/vocab-words"
import type { ReviewPeriod } from "@/lib/types"
import type { WidgetCopy } from "@/lib/widgets/types"

export type WidgetTileProps = {
  copy: WidgetCopy
  currentDate: Date
  onHide: () => void
  onStartReview?: (period: ReviewPeriod, periodKey: string) => void
  onOpenHomeTab?: (tab: "plan" | "todo") => void
}

type TileRenderer = (props: WidgetTileProps) => ReactNode

const TILES: Record<string, TileRenderer> = {
  review: ({ currentDate, onStartReview, onHide }) => (
    <HomeReviewBanner currentDate={currentDate} onStartReview={onStartReview} tile onHide={onHide} />
  ),
  points: ({ currentDate, onHide }) => <PointsBoard currentDate={currentDate} onHide={onHide} />,
  award: ({ onHide }) => <AwardTile onHide={onHide} />,
  progress: ({ currentDate, onHide }) => <ProgressTile currentDate={currentDate} onHide={onHide} />,
  affirmation: ({ currentDate, onHide }) => <AffirmationTile currentDate={currentDate} onHide={onHide} />,
  daysuntil: ({ copy, onHide }) => {
    const markId = copy.settings.markId
    return typeof markId === "string" ? <DaysUntilTile itemId={markId} onHide={onHide} /> : null
  },
  moon: ({ currentDate, onHide }) => <MoonTile currentDate={currentDate} onHide={onHide} />,
  solar: ({ onHide }) => <SolarRemainderTile onHide={onHide} />,
  tracking: ({ onHide }) => <TrackingNowTile onHide={onHide} />,
  night: ({ currentDate, onHide }) => <NightWellTile currentDate={currentDate} onHide={onHide} />,
  harvest: ({ currentDate, onHide }) => <HarvestTile currentDate={currentDate} onHide={onHide} />,
  inbox: ({ onHide }) => <InboxMillTile onHide={onHide} />,
  flow: ({ currentDate, onHide }) => <AlreadyFlowingTile currentDate={currentDate} onHide={onHide} />,
  paint: ({ currentDate, onHide }) => <PlanAndLivedTile currentDate={currentDate} onHide={onHide} />,
  vocab: ({ copy, currentDate, onHide }) => (
    <VocabTile currentDate={currentDate} onHide={onHide} lang={isVocabLang(copy.key) ? copy.key : undefined} />
  ),
  budget: ({ currentDate, onHide }) => <BudgetTile currentDate={currentDate} onHide={onHide} />,
  pet: ({ currentDate, onHide }) => <ScreenPetTile currentDate={currentDate} onHide={onHide} />,
  next: ({ currentDate, onHide, onOpenHomeTab }) => (
    <NextTile currentDate={currentDate} onHide={onHide} onOpenHomeTab={onOpenHomeTab} />
  ),
  daylamp: ({ currentDate, onHide }) => <DayLampTile currentDate={currentDate} onHide={onHide} />,
  weather: ({ currentDate, onHide }) => <WeatherTile currentDate={currentDate} onHide={onHide} />,
}

export function renderWidgetTile(props: WidgetTileProps): ReactNode {
  const draw = TILES[props.copy.kind]
  return draw ? draw(props) : null
}

/** A copy whose kind this build does not know: kept, and shown quietly. */
export function UnknownWidgetFace({ kind }: { kind: string }) {
  return (
    <div className="home-tile is-unknown" data-widget="unknown" data-testid="home-unknown-tile">
      <div className="hab-score-caption">
        <span>{kind}</span>
      </div>
      <div className="hab-score-readout" data-centered="true">
        —
      </div>
      <div className="home-tile-foot">
        <p className="hab-score-sub">Widget not available in this version</p>
      </div>
    </div>
  )
}
