/**
 * components/Home/Tracking/phone/phone-time-surface.tsx — Time Grid on a phone
 *
 * Day is the vertical timeline. Week and Infinite scroll keep the desk
 * plots, inside this page, because those edits (paint, fill, open a block)
 * already live there. Day, Week, and Infinite scroll are one segmented
 * control. Cell size, Show as, the screen face, ghosts' flags, Day tubes,
 * and Clear day sit in the recorder sheet.
 */
"use client"

import { useState } from "react"
import { deferSyncs } from "@/lib/defer-sync"
import { formatLocalDateKey } from "@/lib/date-utils"
import { GRID_STEPS, WEEK_STEPS, entriesForDay, type GridStep, type WeekStep } from "@/lib/time-entries"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { maxTreeDepth } from "@/lib/pen-tree"
import { useHabitTrackingSync } from "@/lib/habit-tracking-sync"
import { useSleepSync } from "@/lib/sleep-sync"
import { useScreenTimeSync } from "@/hooks/use-screentime-sync"
import { usePenActionSync } from "@/lib/pen-action-sync"
import { ERASE, noPaint, trackingPaintTool } from "@/components/Home/Tracking/cabinet/tracking-tool-mode"
import {
  DEFAULT_SUPERIMPOSE_OPACITY,
  setScreenFace,
  setSuperimposeMulti,
  setSuperimposeOpacity,
  setTrackingViewPrefs,
  useTrackingViewPrefs,
} from "@/components/Home/Tracking/tracking-view-prefs"
import { useGhostScopes } from "@/components/Home/Tracking/grids/ghost-layers"
import { PhoneDayTimeline } from "@/components/Home/Tracking/phone/phone-day-timeline"
import { PhoneSheet } from "@/components/Home/Tracking/phone/phone-sheet"
import { WeekGrid } from "@/components/Home/Tracking/grids/week-grid"
import { InfiniteStrip } from "@/components/Home/Tracking/grids/infinite-strip"
import { FillRangeControl } from "@/components/Home/Tracking/grids/fill-range-control"
import { CellSizeKeys } from "@/components/Home/Tracking/grids/cell-size-keys"
import { DepthControl } from "@/components/Home/Tracking/depth-control"
import { DayTubesDialog } from "@/components/Home/Tracking/grids/day-tubes-dialog"
import { PushKey, SlideSwitch } from "@/components/Home/Tracking/trk-scope"
import { ToolDetail } from "@/components/Home/Tracking/cabinet/tool-detail"

export function PhoneTimeSurface({
  date,
  setDate,
  fillOpen,
  moreOpen,
  onCloseFill,
  onCloseMore,
}: {
  date: Date
  setDate: (date: Date) => void
  fillOpen: boolean
  moreOpen: boolean
  onCloseFill: () => void
  onCloseMore: () => void
}) {
  useHabitTrackingSync()
  useSleepSync()
  useScreenTimeSync()
  usePenActionSync()

  const gridSpan = useTimeTrackingStore((s) => s.gridSpan)
  const infiniteScroll = useTimeTrackingStore((s) => s.infiniteScroll)
  const setGridSpan = useTimeTrackingStore((s) => s.setGridSpan)
  const setInfiniteScroll = useTimeTrackingStore((s) => s.setInfiniteScroll)
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const activeScopeId = useTimeTrackingStore((s) => s.activeScopeId)
  const entries = useTimeTrackingStore((s) => s.entries)
  const selectedPenId = useTimeTrackingStore((s) => s.selectedPenId)
  const selectedVariantIds = useTimeTrackingStore((s) => s.selectedVariantIds)
  const paintMinutes = useTimeTrackingStore((s) => s.paintMinutes)
  const gridStep = useTimeTrackingStore((s) => s.gridStep)
  const weekStep = useTimeTrackingStore((s) => s.weekStep)
  const setGridStep = useTimeTrackingStore((s) => s.setGridStep)
  const setWeekStep = useTimeTrackingStore((s) => s.setWeekStep)
  const setScopeDisplayDepth = useTimeTrackingStore((s) => s.setScopeDisplayDepth)
  const clearDay = useTimeTrackingStore((s) => s.clearDay)
  const prefs = useTrackingViewPrefs()

  const scope = scopes.find((item) => item.id === activeScopeId) || scopes[0]
  const dk = formatLocalDateKey(date)
  const scrolling = infiniteScroll
  const spanKey = scrolling ? "infinite" : gridSpan === "week" ? "week" : "day"
  const face = prefs.screenFace[spanKey]
  const weekCells = !scrolling && gridSpan === "week"
  const paintTool = trackingPaintTool(selectedPenId)
  const ghosts = useGhostScopes(scope, scopes)
  const [tubesOpen, setTubesOpen] = useState(false)

  const chooseSpan = (next: "day" | "week" | "infinite") => {
    if (next === "infinite") {
      setInfiniteScroll(true)
      return
    }
    setGridSpan(next)
    setInfiniteScroll(false)
  }

  const leaveInfinite = (next: "day" | "week", day: Date) => {
    setDate(day)
    setGridSpan(next)
    setInfiniteScroll(false)
  }

  if (!scope) return <p className="trk-phone-empty">No tracking scopes.</p>

  const dayEntries = entriesForDay(entries, dk, scope.id)
  const selectedPen = scope.pens.find((pen) => pen.id === selectedPenId) ?? null

  return (
    <div className="trk-phone-surface" data-span={spanKey}>
      <div className="trk-phone-span" role="toolbar" aria-label="Time grid span">
        <button type="button" aria-pressed={!scrolling && gridSpan !== "week"} onClick={() => chooseSpan("day")}>
          Day
        </button>
        <button type="button" aria-pressed={!scrolling && gridSpan === "week"} onClick={() => chooseSpan("week")}>
          Week
        </button>
        <button type="button" aria-pressed={scrolling} onClick={() => chooseSpan("infinite")}>
          Infinite scroll
        </button>
      </div>

      {scrolling ? (
        <div className="trk-phone-infinite">
          <div className="trk-phone-infinite-jump">
            <button type="button" onClick={() => leaveInfinite("day", date)}>
              Open this day
            </button>
            <button type="button" onClick={() => leaveInfinite("week", date)}>
              Open this week
            </button>
          </div>
          <InfiniteStrip
            centerDate={date}
            onDateChange={setDate}
            onOpenDay={(day) => leaveInfinite("day", day)}
            onOpenWeek={(weekStart) => leaveInfinite("week", weekStart)}
            mode="week"
          />
        </div>
      ) : gridSpan === "week" ? (
        <div className="trk-screen-bezel" data-face={face}>
          <WeekGrid
            date={date}
            onDateChange={setDate}
            onOpenDay={(day) => leaveInfinite("day", day)}
            face={face}
          />
        </div>
      ) : (
        <div className="trk-screen-bezel" data-face={face}>
          <PhoneDayTimeline date={date} setDate={setDate} />
        </div>
      )}

      {fillOpen ? (
        <PhoneSheet title="Fill" onClose={onCloseFill}>
          {scrolling ? (
            <p className="trk-phone-note">Fill works on Day or Week.</p>
          ) : gridSpan === "week" ? (
            <button
              type="button"
              className="trk-phone-sheet-action"
              onClick={() => {
                onCloseFill()
                document.querySelector(".trk-phone .trk-fill-row")?.scrollIntoView({ block: "start" })
              }}
            >
              Week fill
            </button>
          ) : (
            <FillRangeControl
              dayEntries={dayEntries}
              fallbackFrom={prefs.fillFrom}
              fallbackTo={prefs.fillTo}
              selectedPenId={selectedPenId}
              penName={selectedPenId === ERASE ? "erase" : selectedPen?.name || "selected pen"}
              onFill={(from, parsedTo) => {
                if (!scope || noPaint(selectedPenId)) return
                deferSyncs(() =>
                  paintMinutes(
                    dk,
                    scope.id,
                    from,
                    parsedTo,
                    selectedPenId === ERASE ? null : selectedPenId,
                    selectedVariantIds,
                  ),
                )
              }}
            />
          )}
        </PhoneSheet>
      ) : null}

      {moreOpen ? (
        <PhoneSheet title="Time recorder" onClose={onCloseMore}>
          <ToolDetail paintTool={paintTool} />
          <div className="trk-phone-more">
            <CellSizeKeys
              steps={weekCells ? WEEK_STEPS : GRID_STEPS}
              value={weekCells ? weekStep : gridStep}
              ariaLabel={weekCells ? "Week cell size" : "Cell size"}
              onChange={(step) => {
                if (weekCells) setWeekStep(step as WeekStep)
                else setGridStep(step as GridStep)
              }}
            />
            {maxTreeDepth(scope.pens) > 0 ? (
              <DepthControl
                pens={scope.pens}
                labels={scope.depthLabels}
                value={scope.displayDepth ?? null}
                onChange={(depth) => setScopeDisplayDepth(scope.id, depth)}
                ariaLabel={`${scope.name} detail level`}
              />
            ) : null}
            <SlideSwitch
              title="SCREEN"
              options={[
                { value: "glass", label: "GLASS" },
                { value: "paper", label: "PAPER" },
              ]}
              value={face}
              onChange={(next) => setScreenFace(spanKey, next)}
            />
            <div className="trk-phone-flags" role="group" aria-label="Flags">
              <PushKey
                tone="mint"
                label="Multi"
                pressed={prefs.superimposeMulti}
                onClick={() => setSuperimposeMulti(!prefs.superimposeMulti)}
                title="Light several ghost views at once"
              />
              <PushKey
                tone="mint"
                label="Advanced"
                pressed={prefs.superimposeAdvanced}
                onClick={() => setTrackingViewPrefs({ superimposeAdvanced: !prefs.superimposeAdvanced })}
                title="Set each ghost's opacity"
              />
              <PushKey
                tone="mint"
                label="Hide log flags"
                pressed={prefs.hideLogFlags}
                onClick={() => setTrackingViewPrefs({ hideLogFlags: !prefs.hideLogFlags })}
                title="Hide log flags on the screen"
              />
              <PushKey
                tone="mint"
                label="Hide sun lines"
                note="☼ ☾"
                pressed={prefs.hideSunLines}
                onClick={() => setTrackingViewPrefs({ hideSunLines: !prefs.hideSunLines })}
                title="Hide sunrise and sunset lines"
              />
            </div>
            {prefs.superimposeAdvanced && ghosts.length > 0 ? (
              <div className="trk-opacity-rows" role="group" aria-label="Ghost opacity">
                {ghosts.map((ghost) => {
                  const value = Math.round((ghost.opacity ?? DEFAULT_SUPERIMPOSE_OPACITY) * 100)
                  return (
                    <label key={ghost.scope.id}>
                      <span>{ghost.scope.name}</span>
                      <input
                        type="range"
                        min={5}
                        max={100}
                        value={value}
                        aria-label={`${ghost.scope.name} ghost opacity`}
                        onChange={(event) => setSuperimposeOpacity(ghost.scope.id, Number(event.target.value) / 100)}
                      />
                      <span>{value}%</span>
                    </label>
                  )
                })}
              </div>
            ) : null}
            <PushKey label="Day tubes" pressed={tubesOpen} onClick={() => setTubesOpen(true)} title="Day tubes" />
            <button type="button" className="trk-phone-sheet-action" onClick={() => clearDay(dk, scope.id)}>
              Clear day
            </button>
          </div>
          <DayTubesDialog open={tubesOpen} onOpenChange={setTubesOpen} date={date} setDate={setDate} />
        </PhoneSheet>
      ) : null}
    </div>
  )
}
