/**
 * components/Home/home-moon-tile.tsx — Moon phase on the Home strip
 *
 * The square is an 8-bit moon, the phase name, and days to the sooner of
 * the next full moon and the next new moon. The detail header is a
 * photographic phase; illumination and the neighboring major phases sit
 * beside it, then the solar-system chart. Inside the iOS shell the same
 * tile opens the phone sheet instead, and this dialog stays the desktop one.
 */
"use client"

import { CopyCaption, useCopySetting } from "@/components/Home/widgets/copy-context"

import { useEffect, useMemo, useState } from "react"
import { formatLocalDateKey } from "@/lib/date-utils"
import { formatMajorWhen, moonGlance } from "@/lib/lunar"
import { HomeWidgetDialog, TileHide, TileOpen } from "@/components/Home/home-widget-dialog"
import { MoonOrrery } from "@/components/Home/moon/home-moon-orrery"
import { MoonPhaseDisk } from "@/components/Home/moon/home-moon-phase"
import { PixelMoon } from "@/components/Home/moon/home-moon-sprite"
import { MobileMoonSheet } from "@/components/Mobile/moon/mobile-moon-sheet"
import { useInMobileShell } from "@/components/Mobile/use-in-mobile-shell"

export function MoonTile({
  currentDate,
  onHide,
}: {
  currentDate: Date
  onHide: () => void
}) {
  const [now, setNow] = useState(() => new Date())
  const [open, setOpen] = useState(false)
  const mobile = useInMobileShell()

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
  const readout = useCopySetting<string>("readout", "phase")
  const sprite = useCopySetting<boolean>("sprite", true)
  const crtLine =
    readout === "countdown"
      ? face.untilPhrase
      : readout === "light"
        ? `${Math.round(face.illumination * 100)}% lit`
        : face.label
  const footLine = readout === "phase" ? face.untilPhrase : face.label

  return (
    <>
      <div className="home-tile is-moon" data-widget="moon" data-testid="home-moon-tile" data-phase={face.phase}>
        <TileHide id="moon" onHide={onHide} />
        <TileOpen label="Moon" onOpen={() => setOpen(true)}>
          <div className="hab-score-caption">
            <span>
              <CopyCaption>Moon</CopyCaption>
            </span>
          </div>
          <div className="home-crt home-moon-crt" data-readout={readout}>
            {sprite ? <PixelMoon cycle={face.cycle} /> : null}
            <p className="home-moon-name">{crtLine}</p>
          </div>
          <div className="home-tile-foot">
            <p className="hab-score-sub">{footLine}</p>
          </div>
        </TileOpen>
      </div>
      {mobile ? (
        <MobileMoonSheet open={open} onClose={() => setOpen(false)} face={face} />
      ) : (
        <HomeWidgetDialog open={open} onOpenChange={setOpen} title="Moon" className="is-sky">
          <div className="home-moon-facts">
            <MoonPhaseDisk cycle={face.cycle} />
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
          <MoonOrrery date={when} />
        </HomeWidgetDialog>
      )}
    </>
  )
}
