/**
 * components/Home/home-glance-tiles.tsx — Night well, Harvest leftover, Inbox mill
 *
 * Optional overview squares. Off until the Widgets key shows them.
 * Night is the morning you woke into. Harvest is unpaid points on the
 * selected day. Inbox mill is the revisit pile (not Monkey brain), newest title in the footer.
 */
"use client"

import { CopyCaption, useCopySetting } from "@/components/Home/widgets/copy-context"

import { useMemo, useState } from "react"
import { harvestFace, inboxMillFace, nightWellFace, pickHomeNight } from "@/lib/home-glances"
import { previousDateKey, sleepMinutes } from "@/lib/sleep-log"
import { itemTitleOrUntitled } from "@/lib/item-utils"
import { computeDaySun, SAN_DIEGO_COORDS } from "@/lib/sun-times"
import { sunPlaceForCity, useSunTimesStore } from "@/lib/sun-times-store"
import { useHomeWeatherStore } from "@/lib/home-weather-store"
import { useUserSettingsStore } from "@/lib/user-settings-store"
import { useSleepStore } from "@/lib/sleep-store"
import { usePointsStore } from "@/lib/points-store"
import { useTaskStore } from "@/lib/task-store"
import { revisitInboxTasks } from "@/lib/item-slices"
import { HomeWidgetDialog, TileHide, TileOpen, WidgetWell, WidgetWells } from "@/components/Home/home-widget-dialog"

export function NightWellTile({
  currentDate,
  onHide,
}: {
  currentDate: Date
  onHide: () => void
}) {
  const nights = useSleepStore((s) => s.nights)
  const settingsCity = useUserSettingsStore((s) => s.homeCity)
  const lat = useHomeWeatherStore((s) => s.lat)
  const lng = useHomeWeatherStore((s) => s.lng)
  const places = useSunTimesStore((s) => s.places)
  const [open, setOpen] = useState(false)
  const night = pickHomeNight(nights, currentDate)
  const pin = lat != null && lng != null ? { lat, lng } : sunPlaceForCity(settingsCity, places) ?? SAN_DIEGO_COORDS
  const sunset = night
    ? computeDaySun(previousDateKey(night.date), pin.lat, pin.lng)?.sunsetMinutes
    : undefined
  const nightFace = nightWellFace(night, sunset)
  const format = useCopySetting<string>("format", "hm")
  const minutes = night ? sleepMinutes(night) : null
  const face =
    format === "decimal" && minutes != null && !night?.allNighter
      ? { ...nightFace, crt: `${(minutes / 60).toFixed(1)}h` }
      : nightFace

  return (
    <>
      <div className="home-tile is-night" data-widget="night" data-testid="home-night-tile">
        <TileHide id="night" onHide={onHide} />
        <TileOpen label="Night well" onOpen={() => setOpen(true)}>
          <div className="hab-score-caption">
            <span>
              <CopyCaption>Night</CopyCaption>
            </span>
          </div>
          <div className="hab-score-readout home-night-readout" data-centered="true">
            {face.crt}
          </div>
          <div className="home-tile-foot">
            <p className="hab-score-sub">{face.footer}</p>
          </div>
        </TileOpen>
      </div>
      <HomeWidgetDialog open={open} onOpenChange={setOpen} title="Night well">
        <WidgetWell label={face.footer} tone="nixie">{face.crt}</WidgetWell>
      </HomeWidgetDialog>
    </>
  )
}

export function HarvestTile({
  currentDate,
  onHide,
}: {
  currentDate: Date
  onHide: () => void
}) {
  const tasks = useTaskStore((s) => s.tasks)
  const getDayPoints = usePointsStore((s) => s.getDayPoints)
  const getPossibleDayPoints = usePointsStore((s) => s.getPossibleDayPoints)
  const [open, setOpen] = useState(false)
  const earned = getDayPoints(currentDate)
  const possible = getPossibleDayPoints(currentDate, tasks)
  const harvest = harvestFace(earned, possible)
  const readout = useCopySetting<string>("readout", "points")
  const total = Math.max(0, Math.round(earned)) + Math.max(0, Math.round(possible))
  const face =
    readout === "percent" && total > 0
      ? { ...harvest, crt: `${Math.round((Math.max(0, Math.round(earned)) / total) * 100)}%`, footer: `harvested · ${harvest.footer}` }
      : harvest

  return (
    <>
      <div className="home-tile is-harvest" data-widget="harvest" data-testid="home-harvest-tile">
        <TileHide id="harvest" onHide={onHide} />
        <TileOpen label="Harvest leftover" onOpen={() => setOpen(true)}>
          <div className="hab-score-caption">
            <span>
              <CopyCaption>Left</CopyCaption>
            </span>
          </div>
          <div className="hab-score-readout" data-centered="true">
            {face.crt}
          </div>
          <div className="home-tile-foot">
            <p className="hab-score-sub">{face.footer}</p>
          </div>
        </TileOpen>
      </div>
      <HomeWidgetDialog open={open} onOpenChange={setOpen} title="Harvest leftover">
        <WidgetWell label={face.footer} tone="nixie">{face.crt}</WidgetWell>
        <WidgetWells>
          <WidgetWell label="Earned">{Math.round(earned)}</WidgetWell>
          <WidgetWell label="Still possible" tone="nixie">{Math.round(possible)}</WidgetWell>
        </WidgetWells>
      </HomeWidgetDialog>
    </>
  )
}

export function InboxMillTile({ onHide }: { onHide: () => void }) {
  const inboxTasks = useTaskStore((s) => revisitInboxTasks(s.tasks))
  const [open, setOpen] = useState(false)
  const ideas = useMemo(
    () => inboxTasks.map((task) => ({ id: task.id, title: itemTitleOrUntitled(task) })),
    [inboxTasks],
  )
  const footMode = useCopySetting<string>("foot", "newest")
  const oldestAge = useMemo(() => {
    const times = inboxTasks
      .map((task) => (task.createdAt ? new Date(task.createdAt).getTime() : NaN))
      .filter((time) => Number.isFinite(time))
    if (times.length === 0) return ""
    const days = Math.floor((Date.now() - Math.min(...times)) / 86_400_000)
    return days < 1 ? "today" : `${days}d`
  }, [inboxTasks])
  const mill = inboxMillFace(ideas.map((idea) => idea.title))
  const face =
    footMode === "oldest" && ideas.length > 0
      ? { ...mill, footer: oldestAge ? `oldest ${oldestAge}` : mill.footer }
      : { ...mill, footer: ideas.length > 0 && oldestAge ? `${mill.footer} · ${oldestAge}` : mill.footer }
  const openInbox = () => {
    setOpen(false)
    document.querySelector<HTMLButtonElement>("[data-inbox-entry]")?.click()
  }

  return (
    <>
      <div className="home-tile is-inbox" data-widget="inbox" data-testid="home-inbox-tile">
        <TileHide id="inbox" onHide={onHide} />
        <TileOpen label="Inbox mill" onOpen={() => setOpen(true)}>
          <div className="hab-score-caption">
            <span>
              <CopyCaption>Inbox</CopyCaption>
            </span>
          </div>
          <div className="hab-score-readout" data-centered="true">
            {face.crt}
          </div>
          <div className="home-tile-foot">
            <p className="hab-score-sub">{face.footer}</p>
          </div>
        </TileOpen>
      </div>
      <HomeWidgetDialog open={open} onOpenChange={setOpen} title="Inbox mill">
        {ideas.length === 0 ? (
          <p className="home-widget-lead">Inbox clear.</p>
        ) : (
          ideas.map((idea) => (
            <p key={idea.id} className="home-widget-row">
              <span>{idea.title}</span>
            </p>
          ))
        )}
        <button type="button" className="home-review-key" onClick={openInbox}>
          Open Inbox
        </button>
      </HomeWidgetDialog>
    </>
  )
}
