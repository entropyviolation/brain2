/**
 * components/Home/Tracking/settings/tracking-view-settings-dialog.tsx — Tracking settings
 *
 * One settings sheet for the whole Tracking tab. The fascia gear opens it on
 * the bay for the view you are standing on; the pen well's Look → View latch
 * opens it on General. Distinct from pen settings (one pen) and tag settings.
 *
 * A rail on the left, one bay at a time on the right:
 * - **General** — the Pen gallery, level categories per view, every hidden
 *   pen in every view, the day-summary well.
 * - **Time Grid** — log flags, sun lines, screen face per time base, ribbon
 *   percent, typed Fill clocks. Cell size stays on the grid's own knob.
 *   Superimpose stays on the grid's view-mode bar.
 * - **Activity Log** — the shortest gap it lists, and whether log lines sit
 *   between blocks.
 * - **Day Log** — the span it opens on.
 * - **Tracking log** — the span and composer key it opens on, Recent chips,
 *   the bottom-right logged flag, and cycle tracking.
 * - **BIM commands** — the Telegram bot guide plus the commands you added
 *   (`bim-commands-guide.tsx`).
 * Every control writes through as it changes; Done closes.
 */
"use client"

import { useState, type ReactNode } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ClockPicker } from "@/components/ui/clock-picker/clock-picker"
import { Label } from "@/components/ui/label"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import {
  ACTIVITY_GAP_STEPS,
  TRACKING_FILL_CLOCK_LABELS,
  setRibbonPercent,
  setScreenFace,
  useTrackingViewPrefs,
  setTrackingViewPrefs,
  type LogComposerModePref,
  type ScreenFace,
  type TrackingSpan,
} from "@/components/Home/Tracking/tracking-view-prefs"
import { BimCommandsGuide } from "@/components/Home/Tracking/settings/bim-commands-guide"
import { PenGalleryDialog } from "@/components/Home/Tracking/pen-gallery-dialog"
import { LevelCategoriesSettings } from "@/components/Home/Tracking/settings/level-categories-settings"
import "../tracking-chrome.css"
import "../tracking-settings.css"

export type TrackingSettingsSection = "general" | "grid" | "activity" | "daylog" | "log" | "bim"

const SECTIONS: { id: TrackingSettingsSection; label: string; blurb: string }[] = [
  { id: "general", label: "General", blurb: "Pens, levels, hidden pens" },
  { id: "grid", label: "Time Grid", blurb: "Flags, faces, fill" },
  { id: "activity", label: "Activity Log", blurb: "Gaps and log lines" },
  { id: "daylog", label: "Day Log", blurb: "Opening span" },
  { id: "log", label: "Tracking log", blurb: "Composer, flag, cycle" },
  { id: "bim", label: "BIM commands", blurb: "Telegram bot guide" },
]

const COMPOSER_KEYS: { id: LogComposerModePref; label: string }[] = [
  { id: "event", label: "Event" },
  { id: "switch", label: "Switch" },
  { id: "intake", label: "Intake" },
  { id: "spend", label: "Spent" },
  { id: "note", label: "Note" },
  { id: "thought", label: "Thought" },
]

function Keys<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: readonly { id: T; label: string }[]
  value: T
  onChange: (next: T) => void
}) {
  return (
    <div className="trk-set-keys" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={String(option.id)}
          type="button"
          data-no95=""
          aria-pressed={value === option.id}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

/** One setting: name and a line of help on the left, the control on the right. */
function Row({ title, help, children, htmlFor }: { title: string; help?: ReactNode; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="trk-set-row">
      <div className="trk-set-row-copy">
        {htmlFor ? (
          <label className="trk-set-row-title" htmlFor={htmlFor}>
            {title}
          </label>
        ) : (
          <span className="trk-set-row-title">{title}</span>
        )}
        {help ? <p className="trk-set-row-help">{help}</p> : null}
      </div>
      <div className="trk-set-row-control">{children}</div>
    </div>
  )
}

function Toggle({ id, checked, onChange, label }: { id: string; checked: boolean; onChange: (next: boolean) => void; label: string }) {
  return (
    <label className="trk-set-toggle" htmlFor={id}>
      <input id={id} type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span className="trk-set-toggle-lamp" aria-hidden />
      <span>{label}</span>
    </label>
  )
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="trk-set-group" aria-label={title}>
      <h4 className="trk-section-title">{title}</h4>
      {children}
    </section>
  )
}

const SPAN_KEYS: { id: TrackingSpan; label: string }[] = [
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
]

const FACE_KEYS: { id: ScreenFace; label: string }[] = [
  { id: "paper", label: "Paper" },
  { id: "glass", label: "Glass" },
]

export function TrackingSettingsDialog({
  scopeId,
  initialSection = "general",
  onClose,
}: {
  /** The view the opener stood on. Settings are for every view; kept for callers. */
  scopeId?: string
  initialSection?: TrackingSettingsSection
  onClose: () => void
}) {
  const [section, setSection] = useState<TrackingSettingsSection>(initialSection)
  const [galleryOpen, setGalleryOpen] = useState(false)
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const hiddenPenIds = useTimeTrackingStore((s) => s.hiddenPenIds)
  const toggleHiddenPen = useTimeTrackingStore((s) => s.toggleHiddenPen)
  const enableCycleTracking = useTimeTrackingStore((s) => s.enableCycleTracking)
  const setEnableCycleTracking = useTimeTrackingStore((s) => s.setEnableCycleTracking)
  const prefs = useTrackingViewPrefs()

  const penCount = scopes.reduce((sum, scope) => sum + scope.pens.length, 0)
  const hiddenByScope = scopes
    .map((scope) => {
      const hidden = new Set(hiddenPenIds[scope.id] ?? [])
      return { scope, pens: scope.pens.filter((pen) => hidden.has(pen.id)) }
    })
    .filter((row) => row.pens.length > 0)

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent
          className="trk95 trk-dialog trk-view-settings trk-settings"
          data-ui-name="Tracking settings"
          data-ui-docs="components/Home/Tracking/README.md"
        >
          <DialogHeader className="trk-dialog-head trk-settings-head">
            <DialogTitle>Tracking settings</DialogTitle>
            <DialogDescription className="trk-help">
              For the whole Tracking tab. Each view has its own bay; changes apply as you make them.
            </DialogDescription>
          </DialogHeader>

          <div className="trk-settings-deck">
            <nav className="trk-settings-rail" aria-label="Tracking settings sections">
              {SECTIONS.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  data-no95=""
                  aria-current={section === row.id ? "page" : undefined}
                  onClick={() => setSection(row.id)}
                >
                  <span className="trk-settings-rail-label">{row.label}</span>
                  <span className="trk-settings-rail-blurb">{row.blurb}</span>
                </button>
              ))}
            </nav>

            <div className="trk-dialog-body trk-settings-pane" data-section={section}>
              {section === "general" ? (
                <>
                  <Group title="Pens">
                    <div className="trk-set-gallery-door">
                      <div className="trk-set-gallery-strip" aria-hidden>
                        {scopes
                          .flatMap((scope) => scope.pens)
                          .slice(0, 28)
                          .map((pen) => (
                            <span key={pen.id} style={{ background: pen.color }} />
                          ))}
                      </div>
                      <div className="trk-set-row-copy">
                        <span className="trk-set-row-title">Pen gallery</span>
                        <p className="trk-set-row-help">
                          All {penCount} pens across {scopes.length} views, sorted together. Search, rename, recolor, hide.
                        </p>
                      </div>
                      <button type="button" data-no95="" className="trk-set-primary" onClick={() => setGalleryOpen(true)}>
                        Open pen gallery
                      </button>
                    </div>
                  </Group>
                  <Group title="Level categories">
                    <p className="trk-set-row-help">
                      Name the rungs of each view’s counts-as ladder — Ocean Beach is a Neighborhood, San Diego a City.
                      Broadest first. Put a pen on a level in its settings under Counts as; Data → Tracking reads a
                      view by level.
                    </p>
                    <LevelCategoriesSettings />
                  </Group>
                  <Group title="Hidden pens">
                    <p className="trk-set-row-help">Hidden pens leave the well. Their paint still shows and they stay in the vault.</p>
                    {hiddenByScope.length === 0 ? (
                      <p className="trk-set-empty">No hidden pens in any view.</p>
                    ) : (
                      hiddenByScope.map(({ scope, pens }) => (
                        <div key={scope.id} className="trk-set-hidden-view">
                          <p className="trk-set-hidden-name">{scope.name}</p>
                          <ul>
                            {pens.map((pen) => (
                              <li key={pen.id}>
                                <span className="trk-set-bead" style={{ background: pen.color }} aria-hidden />
                                <span>{pen.name}</span>
                                <button type="button" data-no95="" onClick={() => toggleHiddenPen(scope.id, pen.id)}>
                                  Show
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))
                    )}
                  </Group>
                  <Group title="Day summary">
                    <Row title="Summary well starts open" help="The writing well under the desk opens with the composer showing.">
                      <Toggle
                        id="trk-set-notes-open"
                        label={prefs.notesWellExpanded ? "Open" : "Closed"}
                        checked={prefs.notesWellExpanded}
                        onChange={(notesWellExpanded) => setTrackingViewPrefs({ notesWellExpanded })}
                      />
                    </Row>
                  </Group>
                </>
              ) : null}

              {section === "grid" ? (
                <>
                  <Group title="On the plot">
                    <Row
                      title="Log flags"
                      help="Text log, Intake, Switch, and Spent flags on the Day, Week, and Infinite plots. Off keeps them in the Tracking log."
                    >
                      <Toggle
                        id="trk-set-log-flags"
                        label="Show log flags on the time grid"
                        checked={!prefs.hideLogFlags}
                        onChange={(on) => setTrackingViewPrefs({ hideLogFlags: !on })}
                      />
                    </Row>
                    <Row title="Sunrise and sunset" help="The two sun lines. The now line always stays.">
                      <Toggle
                        id="trk-set-sun"
                        label="Show sun lines"
                        checked={!prefs.hideSunLines}
                        onChange={(on) => setTrackingViewPrefs({ hideSunLines: !on })}
                      />
                    </Row>
                  </Group>
                  <Group title="Screen face">
                    {(["day", "week", "infinite"] as const).map((span) => (
                      <Row key={span} title={span === "day" ? "Day" : span === "week" ? "Week" : "Infinite"}>
                        <Keys
                          label={`${span} screen face`}
                          options={FACE_KEYS}
                          value={prefs.screenFace[span]}
                          onChange={(face) => setScreenFace(span, face)}
                        />
                      </Row>
                    ))}
                  </Group>
                  <Group title="Ribbon percent">
                    {(["day", "week"] as const).map((span) => (
                      <Row key={span} title={span === "day" ? "Day" : "Week"} help={span === "day" ? "Share of tracked time, or of the whole day." : undefined}>
                        <Keys
                          label={`${span} ribbon percent`}
                          options={[
                            { id: "tracked", label: "Tracked" },
                            { id: "period", label: span === "day" ? "Whole day" : "Whole week" },
                          ]}
                          value={prefs.ribbonPercent[span]}
                          onChange={(basis) => setRibbonPercent(span, basis)}
                        />
                      </Row>
                    ))}
                  </Group>
                  <Group title="Fill range">
                    <p className="trk-set-row-help">
                      Clock hours for typed Fill. Day Fill is the fallback when the day is fully untracked (otherwise
                      the longest empty gap). Week Fill is the week-grid default. Drag still paints any minutes.
                    </p>
                    <div className="trk-fill-clocks">
                      <div className="trk-fill-clock-group">
                        <p className="trk-section-title">Day grid</p>
                        <div className="trk-field">
                          <Label htmlFor="trk-day-fill-starts">{TRACKING_FILL_CLOCK_LABELS.fillFrom}</Label>
                          <ClockPicker
                            id="trk-day-fill-starts"
                            value={prefs.fillFrom}
                            onChange={(fillFrom) => setTrackingViewPrefs({ fillFrom })}
                            className="h-8 w-[7.5rem]"
                          />
                        </div>
                        <div className="trk-field">
                          <Label htmlFor="trk-day-fill-ends">{TRACKING_FILL_CLOCK_LABELS.fillTo}</Label>
                          <ClockPicker
                            id="trk-day-fill-ends"
                            value={prefs.fillTo}
                            onChange={(fillTo) => setTrackingViewPrefs({ fillTo })}
                            className="h-8 w-[7.5rem]"
                          />
                        </div>
                      </div>
                      <div className="trk-fill-clock-group">
                        <p className="trk-section-title">Week grid</p>
                        <div className="trk-field">
                          <Label htmlFor="trk-week-fill-starts">{TRACKING_FILL_CLOCK_LABELS.weekFillFrom}</Label>
                          <ClockPicker
                            id="trk-week-fill-starts"
                            value={prefs.weekFillFrom}
                            onChange={(weekFillFrom) => setTrackingViewPrefs({ weekFillFrom })}
                            className="h-8 w-[7.5rem]"
                          />
                        </div>
                        <div className="trk-field">
                          <Label htmlFor="trk-week-fill-ends">{TRACKING_FILL_CLOCK_LABELS.weekFillTo}</Label>
                          <ClockPicker
                            id="trk-week-fill-ends"
                            value={prefs.weekFillTo}
                            onChange={(weekFillTo) => setTrackingViewPrefs({ weekFillTo })}
                            className="h-8 w-[7.5rem]"
                          />
                        </div>
                      </div>
                    </div>
                  </Group>
                  <p className="trk-set-footnote">Cell size is the knob on the grid. Superimpose is on the grid’s view-mode bar.</p>
                </>
              ) : null}

              {section === "activity" ? (
                <Group title="Activity Log">
                  <Row
                    title="Untracked gaps"
                    help="The shortest empty stretch listed between blocks, ready to paint in one click."
                  >
                    <Keys
                      label="Shortest gap listed"
                      options={ACTIVITY_GAP_STEPS.map((step) => ({ id: step, label: step === 0 ? "Off" : `${step}m` }))}
                      value={prefs.activityGapMinutes}
                      onChange={(activityGapMinutes) => setTrackingViewPrefs({ activityGapMinutes })}
                    />
                  </Row>
                  <Row title="Log lines" help="Text log, Intake, and Switch instants listed in time between the blocks.">
                    <Toggle
                      id="trk-set-activity-lines"
                      label="List log lines"
                      checked={prefs.activityShowLogLines}
                      onChange={(activityShowLogLines) => setTrackingViewPrefs({ activityShowLogLines })}
                    />
                  </Row>
                </Group>
              ) : null}

              {section === "daylog" ? (
                <Group title="Day Log">
                  <Row title="Opens on" help="Day keeps the agenda for the selected day; Week shows the seven columns.">
                    <Keys
                      label="Day Log opens on"
                      options={SPAN_KEYS}
                      value={prefs.dayLogSpan}
                      onChange={(dayLogSpan) => setTrackingViewPrefs({ dayLogSpan })}
                    />
                  </Row>
                </Group>
              ) : null}

              {section === "log" ? (
                <>
                  <Group title="Composer">
                    <Row title="Opens on" help="Day keeps the shelves; Week shows the seven-column board.">
                      <Keys
                        label="Tracking log opens on"
                        options={SPAN_KEYS}
                        value={prefs.logSpan}
                        onChange={(logSpan) => setTrackingViewPrefs({ logSpan })}
                      />
                    </Row>
                    <Row title="First key" help="The Add a line key that is pressed when the view opens. Note, unless you pick another.">
                      <Keys
                        label="Composer opens on"
                        options={COMPOSER_KEYS}
                        value={prefs.logDefaultMode}
                        onChange={(logDefaultMode) => setTrackingViewPrefs({ logDefaultMode })}
                      />
                    </Row>
                    <Row title="Recent chips" help="Intake’s Recent row and Spent’s Again row. A chip fills the form; Add logs it.">
                      <Toggle
                        id="trk-set-recents"
                        label="Show recent chips"
                        checked={prefs.logShowRecents}
                        onChange={(logShowRecents) => setTrackingViewPrefs({ logShowRecents })}
                      />
                    </Row>
                    <Row
                      title="Logged flag"
                      help="After Add, a flag slides up bottom right (COFFEE · FOOD INTAKE LOGGED · 2:43 PM). × closes it; it clears after a minute."
                    >
                      <Toggle
                        id="trk-set-flag"
                        label="Show the logged flag"
                        checked={prefs.logFlagOnAdd}
                        onChange={(logFlagOnAdd) => setTrackingViewPrefs({ logFlagOnAdd })}
                      />
                    </Row>
                  </Group>
                  <Group title="Cycle">
                    <Row title="Cycle tracking" help="Off hides the cycle section. Bleed, spotting, and ovulation marks stay stored.">
                      <Toggle
                        id="trk-set-cycle"
                        label="Enable cycle tracking"
                        checked={enableCycleTracking}
                        onChange={setEnableCycleTracking}
                      />
                    </Row>
                  </Group>
                  <p className="trk-set-footnote">Log keywords moved to BIM commands → Your commands.</p>
                </>
              ) : null}

              {section === "bim" ? <BimCommandsGuide /> : null}
            </div>
          </div>

          <div className="trk-dialog-actions">
            <button type="button" onClick={onClose}>
              Done
            </button>
          </div>
        </DialogContent>
      </Dialog>
      {galleryOpen ? <PenGalleryDialog onClose={() => setGalleryOpen(false)} /> : null}
    </>
  )
}

/** Older name; the pen well's View latch still imports it. */
export const TrackingViewSettingsDialog = TrackingSettingsDialog
