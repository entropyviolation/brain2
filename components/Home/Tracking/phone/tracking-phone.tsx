/**
 * components/Home/Tracking/phone/tracking-phone.tsx — Home Tracking on a phone
 *
 * Mounted only when the viewport is at most 767px. The desk stays mounted
 * above that. One sticky header holds the day, the four views, and the pen
 * deck. Time Grid's day is a vertical timeline. Paint tools sit in a tray
 * that does not cover the day. Pens, Now, Find, Fill, and the recorder open
 * as bottom sheets.
 */
"use client"

import { useCallback, useRef, useState, type PointerEvent } from "react"
import { addDays, startOfWeek } from "date-fns"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatLocalDateKey } from "@/lib/date-utils"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { ActualDayView } from "@/components/Home/Tracking/actual-day-view"
import { TrackingActivityLog } from "@/components/Home/Tracking/tracking-activity-log"
import { TrackingLogView } from "@/components/Home/Tracking/tracking-log/tracking-log-view"
import { WorkingNowStrip } from "@/components/Home/Tracking/working-now-strip"
import { PenColorNowStrip } from "@/components/Home/Tracking/pen-color-now-strip"
import { TrackingDayNotes } from "@/components/Home/Tracking/tracking-day-notes"
import { PenPalette } from "@/components/Home/Tracking/pen-palette"
import { PenModeDeck } from "@/components/Home/Tracking/pen-mode-bar"
import { TrackingSettingsDialog, type TrackingSettingsSection } from "@/components/Home/Tracking/settings/tracking-view-settings-dialog"
import { LogActivityLatch } from "@/components/Home/Tracking/log-activity-dialog"
import { TrackingFind } from "@/components/Home/Tracking/tracking-find"
import { TrackingDeskSlotsContext } from "@/components/Home/Tracking/tracking-desk-slots"
import { PhoneSheet } from "@/components/Home/Tracking/phone/phone-sheet"
import { PhoneTimeSurface } from "@/components/Home/Tracking/phone/phone-time-surface"
import { nextPaintPenId, trackingPaintTool, type TrackingPaintTool } from "@/components/Home/Tracking/cabinet/tracking-tool-mode"
import { setTimegridReveal } from "@/components/Home/Tracking/timegrid-reveal"
import "./tracking-phone.css"

type TrackingTab = "grid" | "activity" | "daylog" | "log"
type PhoneSheetName = "now" | "pens" | "find" | "fill" | "more"

const SETTINGS_BAY: Record<TrackingTab, TrackingSettingsSection> = {
  grid: "grid",
  activity: "activity",
  daylog: "daylog",
  log: "log",
}

export function TrackingPhone({
  currentDate,
  setCurrentDate,
  trackingTab,
  setTrackingTab,
}: {
  currentDate: Date
  setCurrentDate: (date: Date) => void
  trackingTab: TrackingTab
  setTrackingTab: (tab: TrackingTab) => void
}) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [sheet, setSheet] = useState<PhoneSheetName | null>(null)
  const [summarySlot, setSummarySlot] = useState<HTMLDivElement | null>(null)
  const activeScopeId = useTimeTrackingStore((s) => s.activeScopeId)
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const setActiveScope = useTimeTrackingStore((s) => s.setActiveScope)
  const setGridSpan = useTimeTrackingStore((s) => s.setGridSpan)
  const setInfiniteScroll = useTimeTrackingStore((s) => s.setInfiniteScroll)
  const settingsScopeId = scopes.some((scope) => scope.id === activeScopeId) ? activeScopeId : scopes[0]?.id
  const showPenDesk = trackingTab !== "log"
  const dateKey = formatLocalDateKey(currentDate)
  const todayKey = formatLocalDateKey(new Date())
  const weekStart = startOfWeek(currentDate)
  const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))
  const closeSheet = useCallback(() => setSheet(null), [])
  const toggleSheet = (name: PhoneSheetName) => setSheet((current) => (current === name ? null : name))
  const swipe = useDaySwipe((dir) => setCurrentDate(addDays(currentDate, dir)))

  return (
    <div
      className="trk95 trk-phone"
      data-tracking-layout="phone"
      data-tray={trackingTab === "grid" ? "true" : "false"}
      data-ui-name="Tracking"
      data-ui-docs="components/Home/Tracking/README.md"
      data-ui-help="Retrospective time and day log: painted minutes, actuals, and day-summary prose beside the plan."
      data-temporal="retrospective"
    >
      <Tabs value={trackingTab} onValueChange={(value) => setTrackingTab(value as TrackingTab)}>
        <header className="trk-phone-head">
          <div className="trk-phone-date" {...swipe}>
            <p className="trk-phone-kicker">Tracking</p>
            <h2 key={dateKey}>
              {currentDate.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
            </h2>
          </div>
          <div className="trk-phone-date-keys">
            <button type="button" className="trk-phone-chev" aria-label="Previous day" onClick={() => setCurrentDate(addDays(currentDate, -1))}>
              ‹
            </button>
            <div className="trk-phone-days" role="group" aria-label="Days">
              {days.map((day) => {
                const key = formatLocalDateKey(day)
                const selected = key === dateKey
                return (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={selected}
                    aria-current={selected ? "date" : undefined}
                    aria-label={day.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
                    onClick={() => setCurrentDate(day)}
                  >
                    <span>{day.toLocaleDateString(undefined, { weekday: "short" })}</span>
                    <strong>{day.getDate()}</strong>
                  </button>
                )
              })}
            </div>
            <button type="button" className="trk-phone-chev" aria-label="Next day" onClick={() => setCurrentDate(addDays(currentDate, 1))}>
              ›
            </button>
          </div>
          <div className="trk-phone-utilities">
            <button type="button" aria-pressed={dateKey === todayKey} onClick={() => setCurrentDate(new Date())}>
              Today
            </button>
            <button type="button" aria-expanded={sheet === "now"} onClick={() => toggleSheet("now")}>
              Now
            </button>
            <button type="button" aria-expanded={sheet === "find"} onClick={() => toggleSheet("find")}>
              Find
            </button>
            <button type="button" aria-label="Tracking settings" onClick={() => setSettingsOpen(true)}>
              Settings
            </button>
          </div>
          <TabsList className="trk-phone-views" aria-label="Tracking view">
            <TabsTrigger value="grid">Time Grid</TabsTrigger>
            <TabsTrigger value="activity">Activity Log</TabsTrigger>
            <TabsTrigger value="daylog">Day Log</TabsTrigger>
            <TabsTrigger value="log">Tracking log</TabsTrigger>
          </TabsList>
          {showPenDesk ? (
            <PenModeDeck
              ghostLeds={trackingTab === "grid"}
              action={trackingTab === "daylog" ? <LogActivityLatch dateKey={dateKey} /> : undefined}
            />
          ) : null}
        </header>

        <TrackingDeskSlotsContext.Provider value={{ fillSlot: null, summarySlot }}>
          <div className="trk-phone-body">
            <TabsContent value="grid" className="mt-0">
              <PhoneTimeSurface
                date={currentDate}
                setDate={setCurrentDate}
                fillOpen={sheet === "fill"}
                moreOpen={sheet === "more"}
                onCloseFill={closeSheet}
                onCloseMore={closeSheet}
              />
            </TabsContent>
            <TabsContent value="activity" className="mt-0">
              <TrackingActivityLog currentDate={currentDate} setCurrentDate={setCurrentDate} />
            </TabsContent>
            <TabsContent value="daylog" className="mt-0">
              <ActualDayView currentDate={currentDate} setCurrentDate={setCurrentDate} />
            </TabsContent>
            <TabsContent value="log" className="mt-0">
              <TrackingLogView currentDate={currentDate} setCurrentDate={setCurrentDate} />
            </TabsContent>
            <section className="trk-phone-notes" aria-label="Summaries">
              <div ref={setSummarySlot} className="trk-summary-slot" />
              <TrackingDayNotes currentDate={currentDate} />
            </section>
          </div>
        </TrackingDeskSlotsContext.Provider>
      </Tabs>

      {trackingTab === "grid" ? (
        <PhoneToolTray
          fillOpen={sheet === "fill"}
          moreOpen={sheet === "more"}
          pensOpen={sheet === "pens"}
          onFill={() => toggleSheet("fill")}
          onMore={() => toggleSheet("more")}
          onPens={() => toggleSheet("pens")}
        />
      ) : null}

      {sheet === "now" ? (
        <PhoneSheet title="Now" onClose={closeSheet}>
          <div className="trk-phone-now">
            <WorkingNowStrip />
            {showPenDesk ? <PenColorNowStrip /> : null}
          </div>
        </PhoneSheet>
      ) : null}
      {sheet === "pens" && showPenDesk ? (
        <PhoneSheet title="Pens" onClose={closeSheet}>
          <PenPalette variant="panel" />
        </PhoneSheet>
      ) : null}
      {sheet === "find" ? (
        <PhoneSheet title="Find" onClose={closeSheet}>
          <TrackingFind
            onJump={(hit) => {
              const [year, month, day] = hit.date.split("-").map(Number)
              setActiveScope(hit.scopeId)
              setCurrentDate(new Date(year, (month ?? 1) - 1, day ?? 1))
              setGridSpan("day")
              setInfiniteScroll(false)
              setTrackingTab("grid")
              setTimegridReveal({
                entryId: hit.entryId,
                date: hit.date,
                scopeId: hit.scopeId,
                startMin: hit.startMin,
              })
              closeSheet()
            }}
          />
        </PhoneSheet>
      ) : null}
      {settingsOpen ? (
        <TrackingSettingsDialog
          scopeId={settingsScopeId}
          initialSection={SETTINGS_BAY[trackingTab]}
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}
    </div>
  )
}

function PhoneToolTray({
  fillOpen,
  moreOpen,
  pensOpen,
  onFill,
  onMore,
  onPens,
}: {
  fillOpen: boolean
  moreOpen: boolean
  pensOpen: boolean
  onFill: () => void
  onMore: () => void
  onPens: () => void
}) {
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const activeScopeId = useTimeTrackingStore((s) => s.activeScopeId)
  const selectedPenId = useTimeTrackingStore((s) => s.selectedPenId)
  const setSelectedPen = useTimeTrackingStore((s) => s.setSelectedPen)
  const scope = scopes.find((item) => item.id === activeScopeId) || scopes[0]
  const paintTool = trackingPaintTool(selectedPenId)
  const pen = scope?.pens.find((item) => item.id === selectedPenId)
  const choose = (tool: TrackingPaintTool) => {
    setSelectedPen(nextPaintPenId(tool, selectedPenId, scope?.pens[0]?.id ?? null))
  }

  return (
    <div className="trk-phone-tray" role="toolbar" aria-label="Paint tools">
      <div className="trk-phone-tray-keys">
        <TrayKey label="Draw" pressed={paintTool === "draw"} onClick={() => choose("draw")} swatch={pen?.color} />
        <TrayKey label="Erase" pressed={paintTool === "erase"} onClick={() => choose("erase")} />
        <TrayKey label="Scissors" pressed={paintTool === "scissors"} onClick={() => choose("scissors")} />
        <TrayKey label="Point" pressed={paintTool === "point"} onClick={() => choose("point")} />
        <TrayKey label="Pens" pressed={pensOpen} onClick={onPens} />
        <TrayKey label="Fill" pressed={fillOpen} onClick={onFill} />
        <LogActivityLatch />
        <TrayKey label="More" pressed={moreOpen} onClick={onMore} />
      </div>
    </div>
  )
}

function TrayKey({
  label,
  pressed,
  onClick,
  swatch,
}: {
  label: string
  pressed: boolean
  onClick: () => void
  swatch?: string
}) {
  return (
    <button type="button" className="trk-phone-tray-key" aria-pressed={pressed} onClick={onClick}>
      {swatch ? <span className="trk-phone-swatch" style={{ background: swatch }} aria-hidden /> : null}
      {label}
    </button>
  )
}

function useDaySwipe(onStep: (dir: -1 | 1) => void) {
  const origin = useRef<{ x: number; y: number } | null>(null)
  const stepRef = useRef(onStep)
  stepRef.current = onStep
  return {
    onPointerDown(event: PointerEvent) {
      if (event.button !== 0) return
      origin.current = { x: event.clientX, y: event.clientY }
    },
    onPointerUp(event: PointerEvent) {
      const start = origin.current
      origin.current = null
      if (!start) return
      const dx = event.clientX - start.x
      const dy = event.clientY - start.y
      if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.2) return
      stepRef.current(dx < 0 ? 1 : -1)
    },
    onPointerCancel() {
      origin.current = null
    },
  }
}
