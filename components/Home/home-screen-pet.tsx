/**
 * components/Home/home-screen-pet.tsx — Pixel CRT pet on the Home strip
 *
 * Not today's friend: no photo, no mission, no gallery. Pose follows today's
 * habit completion. The caption is a pixel clock. Reduced motion holds one frame.
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
  const pose = petPose(stats.habit.percent, stats.habit.total)
  const [clock, setClock] = useState(() => new Date())

  useEffect(() => {
    const id = window.setInterval(() => setClock(new Date()), 30_000)
    return () => window.clearInterval(id)
  }, [])

  const time = format(clock, "h:mm")
  const [open, setOpen] = useState(false)
  const poseLine =
    pose === "asleep"
      ? "Asleep — under a fifth of today's habits are done."
      : pose === "pleased"
        ? "Pleased — today's habits are complete."
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
          <div className="home-crt home-pet-crt" data-pose={pose}>
            <PetSprite pose={pose} />
          </div>
          <div className="home-tile-foot">
            <p className="hab-score-sub">{POSE_FOOT[pose]}</p>
          </div>
        </TileOpen>
      </div>
      <HomeWidgetDialog open={open} onOpenChange={setOpen} title="Screen pet">
        <div className="home-widget-lead home-widget-pet-plate">
          <PetSprite pose={pose} className="home-widget-pet" />
          <span>{poseLine}</span>
        </div>
        <WidgetWells>
          <WidgetWell label="Habits">{stats.habit.completed}/{stats.habit.total}</WidgetWell>
          <WidgetWell label="Clock" tone="nixie">{time}</WidgetWell>
        </WidgetWells>
      </HomeWidgetDialog>
    </>
  )
}

function PetSprite({ pose, className }: { pose: PetPose; className?: string }) {
  return (
    <svg
      className={className ? `home-pet-sprite ${className}` : "home-pet-sprite"}
      data-pose={pose}
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
        </>
      ) : pose === "asleep" ? (
        <>
          <rect className="home-pet-mark" x="5" y="8" width="2" height="1" />
          <rect className="home-pet-mark" x="9" y="8" width="2" height="1" />
          <rect className="home-pet-mark" x="13" y="3" width="1" height="1" />
          <rect className="home-pet-mark" x="14" y="2" width="1" height="1" />
          <rect className="home-pet-mark" x="14" y="5" width="1" height="1" />
        </>
      ) : (
        <>
          <rect className="home-pet-eyes" x="5" y="7" width="2" height="2" />
          <rect className="home-pet-eyes" x="9" y="7" width="2" height="2" />
        </>
      )}
    </svg>
  )
}
