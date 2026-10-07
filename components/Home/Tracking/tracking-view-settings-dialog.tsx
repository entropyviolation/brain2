/**
 * components/Home/Tracking/tracking-view-settings-dialog.tsx — Settings for this view
 *
 * Distinct from pen settings. The fascia gear and the Look View latch open
 * this same dialog. Command notes are for the whole Tracking
 * section. Log keywords are added, renamed, and removed here. Cell size, typed fill defaults, and which pens are hiding in the
 * well stay here too. Superimpose lives on the Time Grid, under the view-mode
 * bar — not in this popup. Infinite scroll lives on the Time Grid toolbar
 * next to Day/Week — not here. It does not rename or recolor a pen — that
 * lives next to the selected-pen swatch.
 */
"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ClockPicker } from "@/components/ui/clock-picker/clock-picker"
import { Label } from "@/components/ui/label"
import { GRID_STEPS, WEEK_STEPS, type GridStep, type WeekStep } from "@/lib/time-entries"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import {
  TRACKING_FILL_CLOCK_LABELS,
  useTrackingViewPrefs,
  setTrackingViewPrefs,
} from "@/components/Home/Tracking/tracking-view-prefs"
import { LogKeywordsSettings } from "@/components/Home/Tracking/log-keywords-settings"
import { UnsavedChangesDialog, unsavedDismissProps, useUnsavedGuard } from "@/components/ui/unsaved-changes-guard"
import "./tracking-chrome.css"

function TrackingCommandNotes() {
  return (
    <div className="trk-command-notes" data-testid="tracking-command-notes">
      <p>
        <strong>Log.</strong> <code>log: went outside</code> and <code>log went outside</code> write an Event on
        Activity, pen Text log. The word log works with or without the colon. No time is a point at send time.{" "}
        <code>at 3:30</code> is that minute on the send day. A clock range is a block. <code>10m</code> or{" "}
        <code>10 min</code> just finished. <code>START</code> stays open until <code>END</code> of the same name. A
        line under the event is the note; the clock stays on the first line. Trailing <code>loc: home</code> reuses
        or creates that Location pen and paints a Location instant at the same minute. A bare phrase with no log
        prefix is not a log.
      </p>
      <p>
        <strong>Saved keywords.</strong> Phrases you add here, such as <code>went outside</code> or{" "}
        <code>cleaning</code>, match the longest one. <code>log: went outside 12:04</code> and{" "}
        <code>log went outside 7/4/26 1:00</code> keep the phrase as the title. The rest is the date and time. The
        list starts empty. <code>log keywords</code> and <code>log: keywords</code> reply with that numbered list
        and do not create a row.
      </p>
      <p>
        <strong>Log categories.</strong> <code>log categories</code> and <code>log: categories</code> reply with the
        tracking views: the name, the id you type after <code>switch:</code>, and depth when that view has one. Not
        an event.
      </p>
      <p>
        <strong>Switch.</strong> <code>switch: location from: home to: ralphs</code>. The colon sits right after
        switch. The next word is the view when it names one you have; omit it and the view is Activity.{" "}
        <code>from:</code> is what you left and <code>to:</code> is the destination. A bare name after the view is
        the destination, as in <code>switch: to cleaning</code> or <code>switch: company Elijah</code>. Activity
        stores <code>started …</code> on the Switch pen. Another view paints that scope, and the tick color is the
        destination.
      </p>
      <p>
        <strong>Aliases.</strong> <code>st:</code> and <code>switch task:</code> are Switch on Activity (
        <code>st: cleaning</code>). <code>so:</code>, <code>switch objective:</code>, and <code>switch goal:</code>{" "}
        write the Objective pen. <code>transit:</code> stays the Transit pen. The colon is required.
      </p>
      <p>
        <strong>Intake.</strong> <code>intake:</code> is a point, with no duration. <code>intake food:</code>,{" "}
        <code>intake drink:</code>, and <code>intake drug:</code> set the class. The pen stays Intake. No time uses
        the send time. A line under the event is the note.
      </p>
      <p>
        <strong>Note.</strong> <code>note:</code> and <code>n</code> write a Text log instant, the Note row.{" "}
        <code>jot:</code> and <code>memo:</code> are the same. <code>day:</code> stays the day jot and does not read
        a clock.
      </p>
      <p>
        <strong>Thought process.</strong> <code>tp:</code>, <code>TP:</code>, <code>thought process:</code>, and{" "}
        <code>log: tp:</code> write a Text log instant with <code>eventKind</code> <code>thought-process</code>. A
        thought process is a specialized note: the crystallized thought of this moment, not a general note. The
        colon is required, so a bare <code>tp</code> or <code>thought process</code> is not this. The first line is
        the title; lines under it are the note. Example: <code>tp: opening the editor to fix the clock</code>.
      </p>
      <p>
        <strong>Clocks.</strong> <code>1pm</code>, <code>1:00 PM</code>, and <code>1:00 p.m.</code> are 13:00. A
        bare clock is military: <code>12:04</code> is noon, <code>18:37</code> is 6:37pm, and <code>1:00</code> is
        1:00am. Log lines, switch lines, and tracking-note clocks use that reader. Ordinary inbox text does not.{" "}
        <code>7/4/26</code> and <code>7/4/2026</code> are July 4, 2026. A date alone does not invent a clock.{" "}
        <code>est</code>, <code>estimated</code>, or <code>~</code> is estimated. <code>unknown</code> keeps the
        minute for placement. A clock with no such word is exact.
      </p>
    </div>
  )
}

function StepButtons<T extends number>({
  steps,
  value,
  onChange,
  suffix = "m",
}: {
  steps: readonly T[]
  value: T
  onChange: (step: T) => void
  suffix?: string
}) {
  return (
    <div className="trk-module-keys" role="group">
      {steps.map((step) => (
        <button
          key={step}
          type="button"
          onClick={() => onChange(step)}
          aria-pressed={value === step}
        >
          {step}
          {suffix}
        </button>
      ))}
    </div>
  )
}

function CellSizeCrt({ step }: { step: number }) {
  const cells = 60 / step
  return (
    <div className="trk-crt-preview">
      <div className="trk-crt-preview-screen" aria-hidden>
        {Array.from({ length: 4 }, (_, hour) => (
          <div key={hour} className="trk-crt-preview-row">
            {Array.from({ length: cells }, (_, c) => (
              <span key={c} className="trk-crt-preview-cell" />
            ))}
          </div>
        ))}
      </div>
      <p className="trk-crt-preview-caption">DAY · {step}m cells · minute storage</p>
    </div>
  )
}

export function TrackingViewSettingsDialog({
  scopeId,
  onClose,
}: {
  scopeId: string
  onClose: () => void
}) {
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const hiddenPenIds = useTimeTrackingStore((s) => s.hiddenPenIds)
  const toggleHiddenPen = useTimeTrackingStore((s) => s.toggleHiddenPen)
  const gridStep = useTimeTrackingStore((s) => s.gridStep)
  const weekStep = useTimeTrackingStore((s) => s.weekStep)
  const setGridStep = useTimeTrackingStore((s) => s.setGridStep)
  const setWeekStep = useTimeTrackingStore((s) => s.setWeekStep)
  const prefs = useTrackingViewPrefs()
  const enableCycleTracking = useTimeTrackingStore((s) => s.enableCycleTracking)
  const setEnableCycleTracking = useTimeTrackingStore((s) => s.setEnableCycleTracking)

  const scope = scopes.find((s) => s.id === scopeId)
  const hidden = new Set(hiddenPenIds[scopeId] ?? [])
  const hiddenPens = (scope?.pens ?? []).filter((p) => hidden.has(p.id))
  const guard = useUnsavedGuard({
    open: true,
    onOpenChange: (next) => {
      if (!next) onClose()
    },
    isDirty: false,
  })

  return (
    <>
    <Dialog open onOpenChange={guard.handleOpenChange}>
      <DialogContent className="trk95 trk-dialog trk-view-settings sm:max-w-xl" data-ui-name="Tracking view settings" data-ui-docs="components/Home/Tracking/README.md" {...unsavedDismissProps(guard.requestClose)}>
        <DialogHeader className="trk-dialog-head">
          <DialogTitle>View settings · {scope?.name ?? "Tracking"}</DialogTitle>
        </DialogHeader>
        <div className="trk-dialog-body">
          <p className="trk-help">Settings for the whole Tracking section. Hidden pens are for this view. Pens stay in the well.</p>

          <div className="trk-section space-y-2">
            <Label className="trk-section-title">Commands</Label>
            <TrackingCommandNotes />
          </div>

          <LogKeywordsSettings />

          <div className="trk-section space-y-2">
            <Label className="trk-section-title">Cycle</Label>
            <label className="trk-cycle-enable">
              <input
                type="checkbox"
                checked={enableCycleTracking}
                onChange={(event) => setEnableCycleTracking(event.target.checked)}
              />
              Enable cycle tracking
            </label>
            <p className="trk-help">
              Off hides the cycle section on the Tracking log. Bleed, spotting, and ovulation marks stay stored.
            </p>
          </div>

          <div className="trk-section space-y-2">
            <Label className="trk-section-title">Cell size</Label>
            <p className="trk-help">Rendering only — stored time stays minute-accurate.</p>
            <div className="trk-field">
              <span className="trk-field-label">Day</span>
              <StepButtons
                steps={GRID_STEPS}
                value={gridStep}
                onChange={(step) => setGridStep(step as GridStep)}
              />
            </div>
            <div className="trk-field">
              <span className="trk-field-label">Week</span>
              <StepButtons
                steps={WEEK_STEPS}
                value={weekStep}
                onChange={(step) => setWeekStep(step as WeekStep)}
              />
            </div>
            <CellSizeCrt step={gridStep} />
          </div>

          <div className="trk-section space-y-2">
            <Label className="trk-section-title">Fill range</Label>
            <p className="trk-help">
              Clock hours for typed Fill — not calendar dates. Day Fill is the Time Grid
              fallback when that day is fully untracked (the control otherwise uses the
              longest empty gap). Week Fill is the week-grid default. Drag still paints any minutes.
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
          </div>

          <div className="trk-section space-y-1.5">
            <Label className="trk-section-title">Hidden pens</Label>
            <p className="trk-help">Still in the vault; paint still shows. They leave the well.</p>
            {hiddenPens.length === 0 ? (
              <p className="text-xs text-muted-foreground">None hidden in {scope?.name}.</p>
            ) : (
              <ul className="space-y-1">
                {hiddenPens.map((pen) => (
                  <li key={pen.id} className="flex items-center gap-2">
                    <span
                      className="inline-block h-3 w-3 shrink-0"
                      style={{ background: pen.color }}
                      aria-hidden
                    />
                    <span className="flex-1 text-sm">{pen.name}</span>
                    <button type="button" onClick={() => toggleHiddenPen(scopeId, pen.id)}>
                      Show
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
          <div className="trk-dialog-actions">
            <button type="button" onClick={guard.forceClose}>
              OK
            </button>
            <button type="button" onClick={guard.requestClose}>
              Cancel
            </button>
            <button type="button" onClick={guard.forceClose}>
              Apply
            </button>
          </div>
      </DialogContent>
    </Dialog>
    <UnsavedChangesDialog {...guard.prompt} />
    </>
  )
}
