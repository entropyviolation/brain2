/**
 * components/Home/home-glance-tiles.tsx — Night well, Harvest leftover, Inbox mill
 *
 * Optional overview squares. Off until the Widgets key shows them.
 * Night is the morning you woke into. Harvest is unpaid points on the
 * selected day. Inbox mill is the revisit pile (not Monkey brain), newest title in the footer.
 */
"use client"

import { useMemo, useState } from "react"
import { harvestFace, inboxMillFace, nightWellFace, pickHomeNight } from "@/lib/home-glances"
import { previousDateKey } from "@/lib/sleep-log"
import { itemTitleOrUntitled } from "@/lib/item-utils"
import { inInboxPartition, sortInboxNewestFirst } from "@/lib/inbox-batch"
import { computeDaySun, SAN_DIEGO_COORDS } from "@/lib/sun-times"
import { sunPlaceForCity, useSunTimesStore } from "@/lib/sun-times-store"
import { useHomeWeatherStore } from "@/lib/home-weather-store"
import { useUserSettingsStore } from "@/lib/user-settings-store"
import { useSleepStore } from "@/lib/sleep-store"
import { usePointsStore } from "@/lib/points-store"
import { useTaskStore } from "@/lib/task-store"
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
  const face = nightWellFace(night, sunset)

  return (
    <>
      <div className="home-tile is-night" data-widget="night" data-testid="home-night-tile">
        <TileHide id="night" onHide={onHide} />
        <TileOpen label="Night well" onOpen={() => setOpen(true)}>
          <div className="hab-score-caption">
            <span>Night</span>
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
  const face = harvestFace(earned, possible)

  return (
    <>
      <div className="home-tile is-harvest" data-widget="harvest" data-testid="home-harvest-tile">
        <TileHide id="harvest" onHide={onHide} />
        <TileOpen label="Harvest leftover" onOpen={() => setOpen(true)}>
          <div className="hab-score-caption">
            <span>Left</span>
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
  const tasks = useTaskStore((s) => s.tasks)
  const [open, setOpen] = useState(false)
  const ideas = useMemo(
    () =>
      sortInboxNewestFirst(tasks.filter((task) => inInboxPartition(task, "inbox"))).map((task) => ({
        id: task.id,
        title: itemTitleOrUntitled(task),
      })),
    [tasks],
  )
  const face = inboxMillFace(ideas.map((idea) => idea.title))
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
            <span>Inbox</span>
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
