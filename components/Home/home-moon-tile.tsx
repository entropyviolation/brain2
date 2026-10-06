/**
 * components/Home/home-moon-tile.tsx — Moon phase on the Home strip
 *
 * The square is an 8-bit moon, the phase name, and days to the sooner of
 * the next full moon and the next new moon. The detail keeps that sprite,
 * the illumination and the neighboring major phases, then the solar-system chart.
 */
"use client"

import { useEffect, useMemo, useState } from "react"
import { formatLocalDateKey } from "@/lib/date-utils"
import { formatMajorWhen, moonGlance } from "@/lib/lunar"
import { HomeWidgetDialog, TileHide, TileOpen } from "@/components/Home/home-widget-dialog"
import { MoonOrrery } from "@/components/Home/home-moon-orrery"
import { PixelMoon } from "@/components/Home/home-moon-sprite"

export function MoonTile({
  currentDate,
  onHide,
}: {
  currentDate: Date
  onHide: () => void
}) {
  const [now, setNow] = useState(() => new Date())
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(id)
  }, [])

  const when = useMemo(() => {
    const sameDay = formatLocalDateKey(now) === formatLocalDateKey(currentDate)
    return sameDay
      ? now
      : new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), 12, 0, 0, 0)
  }, [currentDate, now])
  const face = useMemo(() => moonGlance(when), [when])

  return (
    <>
      <div className="home-tile is-moon" data-widget="moon" data-testid="home-moon-tile" data-phase={face.phase}>
        <TileHide id="moon" onHide={onHide} />
        <TileOpen label="Moon" onOpen={() => setOpen(true)}>
          <div className="hab-score-caption">
            <span>Moon</span>
          </div>
          <div className="home-crt home-moon-crt">
            <PixelMoon cycle={face.cycle} />
            <p className="home-moon-name">{face.label}</p>
          </div>
          <div className="home-tile-foot">
            <p className="hab-score-sub">{face.untilPhrase}</p>
          </div>
        </TileOpen>
      </div>
      <HomeWidgetDialog open={open} onOpenChange={setOpen} title="Moon" className="is-sky">
        <div className="home-moon-facts">
          <PixelMoon cycle={face.cycle} detail />
          <div className="home-moon-copy">
            <p className="home-widget-lead">{face.label}</p>
            <ul className="home-moon-lines">
              <li>{face.illuminationLine}</li>
              <li>
                Next Major Phase: {face.nextMajor.label} on {formatMajorWhen(face.nextMajor.at)}
              </li>
              <li>
                Previous Major Phase: {face.previousMajor.label} on {formatMajorWhen(face.previousMajor.at)}
              </li>
            </ul>
          </div>
        </div>
        <MoonOrrery
          date={when}
          cycle={face.cycle}
          phaseLabel={face.label}
          illuminationPct={Math.round(face.illumination * 100)}
        />
      </HomeWidgetDialog>
    </>
  )
}
