/**
 * components/Home/Tracking/tracking-view-settings-dialog.tsx — Settings for this view
 *
 * Distinct from pen settings. How the grid looks: cell size, typed fill
 * defaults, which pens are hiding in the well, photographed plate under the
 * pen tray. Infinite scroll lives on the Time Grid toolbar next to Day/Week —
 * not here. It does not rename or recolor a pen — that lives next to the big
 * selected-pen swatch.
 */
"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { GRID_STEPS, WEEK_STEPS, type GridStep, type WeekStep } from "@/lib/time-entries"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import {
  TRACKING_FILL_CLOCK_LABELS,
  useTrackingViewPrefs,
  setTrackingViewPrefs,
} from "@/components/Home/Tracking/tracking-view-prefs"
import { PEN_TRAY_IDS, PEN_TRAY_META, parsePenTray, penTrayStyle } from "@/components/Home/Tracking/pen-tray-bg"
import { UnsavedChangesDialog, unsavedDismissProps, useUnsavedGuard } from "@/components/ui/unsaved-changes-guard"
import "./tracking-chrome.css"
import "./pen-tray-bg.css"

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
      <DialogContent className="trk95 trk-dialog trk-view-settings sm:max-w-md" data-ui-name="Tracking view settings" data-ui-docs="components/Home/Tracking/README.md" {...unsavedDismissProps(guard.requestClose)}>
        <DialogHeader className="trk-dialog-head">
          <DialogTitle>View settings · {scope?.name ?? "Tracking"}</DialogTitle>
        </DialogHeader>
        <div className="trk-dialog-body">
          <p className="trk-help">How this view looks. Pens stay in the well.</p>

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
                  <Input
                    id="trk-day-fill-starts"
                    type="time"
                    value={prefs.fillFrom}
                    onChange={(e) => setTrackingViewPrefs({ fillFrom: e.target.value })}
                    className="h-8 w-[7.5rem]"
                  />
                </div>
                <div className="trk-field">
                  <Label htmlFor="trk-day-fill-ends">{TRACKING_FILL_CLOCK_LABELS.fillTo}</Label>
                  <Input
                    id="trk-day-fill-ends"
                    type="time"
                    value={prefs.fillTo}
                    onChange={(e) => setTrackingViewPrefs({ fillTo: e.target.value })}
                    className="h-8 w-[7.5rem]"
                  />
                </div>
              </div>
              <div className="trk-fill-clock-group">
                <p className="trk-section-title">Week grid</p>
                <div className="trk-field">
                  <Label htmlFor="trk-week-fill-starts">{TRACKING_FILL_CLOCK_LABELS.weekFillFrom}</Label>
                  <Input
                    id="trk-week-fill-starts"
                    type="time"
                    value={prefs.weekFillFrom}
                    onChange={(e) => setTrackingViewPrefs({ weekFillFrom: e.target.value })}
                    className="h-8 w-[7.5rem]"
                  />
                </div>
                <div className="trk-field">
                  <Label htmlFor="trk-week-fill-ends">{TRACKING_FILL_CLOCK_LABELS.weekFillTo}</Label>
                  <Input
                    id="trk-week-fill-ends"
                    type="time"
                    value={prefs.weekFillTo}
                    onChange={(e) => setTrackingViewPrefs({ weekFillTo: e.target.value })}
                    className="h-8 w-[7.5rem]"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="trk-section space-y-2">
            <Label className="trk-section-title">Pen tray</Label>
            <p className="trk-help">Photograph behind the pens. Time Grid stays white.</p>
            <div className="trk-tray-grid" role="radiogroup" aria-label="Pen tray photograph">
              {PEN_TRAY_IDS.map((id) => {
                const option = PEN_TRAY_META[id]
                const selected = parsePenTray(prefs.penTray) === id
                return (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    className="trk-tray-chip"
                    data-ink={option.ink}
                    style={penTrayStyle(id)}
                    aria-checked={selected}
                    aria-pressed={selected}
                    aria-label={option.label}
                    title={option.hint}
                    onClick={() => setTrackingViewPrefs({ penTray: id })}
                  >
                    <span className="trk-tray-chip-label">{option.label}</span>
                  </button>
                )
              })}
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
