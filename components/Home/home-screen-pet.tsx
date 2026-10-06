/**
 * components/Home/home-screen-pet.tsx — Pixel CRT pet on the Home strip
 *
 * Not today's friend: no photo, no mission, no gallery. Pose follows today's
 * habit completion and the hour (night → asleep unless pleased). The caption
 * is a pixel clock. Reduced motion holds one frame.
 */
"use client"

import { useEffect, useState } from "react"
import { format } from "date-fns"
import { petPose, type PetPose } from "@/lib/home-widgets"
import { useHomeDayStats } from "@/components/Home/home-day-stats"
import { HomeWidgetDialog, TileHide, TileOpen, WidgetWell, WidgetWells } from "@/components/Home/home-widget-dialog"

const POSE_FOOT: Record<PetPose, string> = {
  asleep: "asleep",
  idle: "awake",
  pleased: "pleased",
}

export function ScreenPetTile({
  currentDate,
  onHide,
}: {
  currentDate: Date
  onHide: () => void
}) {
  const stats = useHomeDayStats(currentDate)
  const [clock, setClock] = useState(() => new Date())

  useEffect(() => {
    const id = window.setInterval(() => setClock(new Date()), 30_000)
    return () => window.clearInterval(id)
  }, [])

  const pose = petPose(stats.habit.percent, stats.habit.total, clock.getHours())
  const time = format(clock, "h:mm")
  const night = clock.getHours() < 6 || clock.getHours() >= 22
  const [open, setOpen] = useState(false)
  const poseLine =
    pose === "pleased"
      ? "Pleased — today's habits are complete."
      : pose === "asleep" && night && stats.habit.percent >= 20
        ? "Asleep for the night — quiet hours after habits are underway."
        : pose === "asleep"
          ? "Asleep — under a fifth of today's habits are done, or it is night."
          : stats.habit.total === 0
            ? "Awake — nothing on the habit sheet today."
            : "Awake — today's habits are underway."

  return (
    <>
      <div className="home-tile is-pet" data-widget="pet" data-testid="home-pet-tile">
        <TileHide id="pet" onHide={onHide} />
        <TileOpen label="Screen pet" onOpen={() => setOpen(true)}>
          <div className="hab-score-caption">
            <span className="home-pet-clock">{time}</span>
          </div>
          <div className="home-crt home-pet-crt" data-pose={pose} data-night={night ? "yes" : "no"}>
            <PetSprite pose={pose} night={night} />
          </div>
          <div className="home-tile-foot">
            <p className="hab-score-sub">{POSE_FOOT[pose]}</p>
          </div>
        </TileOpen>
      </div>
      <HomeWidgetDialog open={open} onOpenChange={setOpen} title="Screen pet">
        <div className="home-widget-lead home-widget-pet-plate">
          <PetSprite pose={pose} night={night} className="home-widget-pet" />
          <span>{poseLine}</span>
        </div>
        <WidgetWells>
          <WidgetWell label="Habits">{stats.habit.completed}/{stats.habit.total}</WidgetWell>
          <WidgetWell label="Clock" tone="nixie">{time}</WidgetWell>
          <WidgetWell label="Hour">{night ? "Night" : "Day"}</WidgetWell>
          <WidgetWell label="Mood">{POSE_FOOT[pose]}</WidgetWell>
        </WidgetWells>
        <p className="home-widget-note">
          Pose reads today&apos;s daily habits and the clock. Night (10pm–6am) settles the pet to sleep
          unless every habit is done. Under 20% done is also asleep; 100% is pleased.
        </p>
      </HomeWidgetDialog>
    </>
  )
}

function PetSprite({
  pose,
  night,
  className,
}: {
  pose: PetPose
  night?: boolean
  className?: string
}) {
  return (
    <svg
      className={className ? `home-pet-sprite ${className}` : "home-pet-sprite"}
      data-pose={pose}
      data-night={night ? "yes" : "no"}
      viewBox="0 0 16 16"
      aria-hidden
    >
      <rect className="home-pet-body" x="4" y="6" width="8" height="6" />
      <rect className="home-pet-body" x="5" y="5" width="6" height="1" />
      <rect className="home-pet-body" x="4" y="4" width="2" height="2" />
      <rect className="home-pet-body" x="10" y="4" width="2" height="2" />
      <rect className="home-pet-body" x="5" y="12" width="2" height="2" />
      <rect className="home-pet-body" x="9" y="12" width="2" height="2" />
      {pose === "pleased" ? (
        <>
          <rect className="home-pet-mark" x="5" y="8" width="2" height="1" />
          <rect className="home-pet-mark" x="9" y="8" width="2" height="1" />
          <rect className="home-pet-mark" x="6" y="7" width="1" height="1" />
          <rect className="home-pet-mark" x="9" y="7" width="1" height="1" />
          <rect className="home-pet-mark" x="7" y="10" width="2" height="1" />
        </>
      ) : pose === "asleep" ? (
        <>
          <rect className="home-pet-mark" x="5" y="8" width="2" height="1" />
          <rect className="home-pet-mark" x="9" y="8" width="2" height="1" />
          <rect className="home-pet-mark home-pet-z" x="13" y="3" width="1" height="1" />
          <rect className="home-pet-mark home-pet-z" x="14" y="2" width="1" height="1" />
          <rect className="home-pet-mark home-pet-z" x="14" y="5" width="1" height="1" />
          {night ? <rect className="home-pet-moon" x="1" y="1" width="2" height="2" /> : null}
        </>
      ) : (
        <>
          <rect className="home-pet-eyes" x="5" y="7" width="2" height="2" />
          <rect className="home-pet-eyes" x="9" y="7" width="2" height="2" />
          <rect className="home-pet-mark" x="7" y="10" width="2" height="1" />
        </>
      )}
    </svg>
  )
}
