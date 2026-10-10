/**
 * components/Settings/BoubaKikiField.tsx — Experimental corner mix
 *
 * Same control family as Window gray. 0 rounds chrome corners (bouba), 100
 * points them (kiki). Mix 50 is the measured default snapshot in
 * `lib/corner-mix.ts`. Default restores that mix and pauses drift. Instant
 * applies the slider to the whole app. Timed previews in this panel only;
 * when the interval ends the app takes the new corners and drift resumes.
 */
"use client"

import { useEffect, useId, useState } from "react"
import { Spline } from "lucide-react"
import { Label } from "@/components/ui/label"
import { DriftAxisControls } from "@/components/Settings/DriftAxisControls"
import { useCornerPanelPreview } from "@/components/Settings/panel-preview"
import { cornerClock, useThemeStore } from "@/lib/theme-store"
import { DEFAULT_CORNER_MIX, DEFAULT_CORNER_PRESET, cornerTokenValue } from "@/lib/corner-mix"
import { DRIFT_PRESET_MS, driftPosition } from "@/lib/drift-clock"

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

export function BoubaKikiField() {
  const cornerMix = useThemeStore((s) => s.cornerMix)
  const cornerPhase = useThemeStore((s) => s.cornerPhase)
  const cornerEpochMs = useThemeStore((s) => s.cornerEpochMs)
  const cornerPeriodMs = useThemeStore((s) => s.cornerPeriodMs)
  const cornerPaused = useThemeStore((s) => s.cornerPaused)
  const cornerTransition = useThemeStore((s) => s.cornerTransition)
  const setCornerMix = useThemeStore((s) => s.setCornerMix)
  const setCornerPeriod = useThemeStore((s) => s.setCornerPeriod)
  const setCornerPaused = useThemeStore((s) => s.setCornerPaused)
  const startCornerTransition = useThemeStore((s) => s.startCornerTransition)
  const resetCornerMix = useThemeStore((s) => s.resetCornerMix)

  const sliderId = useId()
  const [now, setNow] = useState(() => Date.now())
  const [applyMode, setApplyMode] = useState<"instant" | "timed">("instant")
  const [draft, setDraft] = useState<number | null>(null)
  const [manualPeriodMs, setManualPeriodMs] = useState<number>(DRIFT_PRESET_MS["30s"])

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), cornerPaused && !cornerTransition ? 1000 : 200)
    return () => window.clearInterval(id)
  }, [cornerPaused, cornerTransition])

  const clock = cornerClock({
    cornerMix,
    cornerPhase,
    cornerEpochMs,
    cornerPeriodMs,
    cornerPaused,
    cornerTransition,
  })
  const live = driftPosition(clock, now)
  const previewRef = useCornerPanelPreview(cornerTransition != null, live)
  const thumb = draft ?? Math.round(live)
  const sample = cornerTokenValue("--r-2", live)
  const showGhost = draft != null && Math.abs(draft - live) >= 1

  function onSlider(value: number) {
    if (applyMode === "instant") {
      setDraft(null)
      setCornerMix(value)
      return
    }
    setDraft(value)
  }

  function onApplyMode(mode: "instant" | "timed") {
    setApplyMode(mode)
    if (mode === "instant" && draft != null) {
      setCornerMix(draft)
      setDraft(null)
    }
  }

  function onStart() {
    const target = draft ?? Math.round(live)
    startCornerTransition(target, manualPeriodMs, prefersReducedMotion())
    setDraft(null)
  }

  return (
    <div ref={previewRef} className="set-drift rounded-lg border border-dashed">
      <div className="set-drift-title flex items-center gap-2">
        <Spline className="h-4 w-4" aria-hidden />
        <h3 className="font-semibold">Bouba/Kiki</h3>
      </div>
      <p className="set-drift-copy text-sm text-muted-foreground">
        Experimental. Chrome corners — fields, buttons, windows, edges — drift from rounded
        (bouba) toward pointy (kiki) and back. Default restores today’s corners and pauses.
        Instant applies the slider to the whole app. Timed previews the shift in this panel
        only; when that interval ends, the app takes the new corners and the drift speed
        takes over again.
      </p>

      <div className="set-drift-scale">
        <div className="set-drift-labelrow">
          <Label htmlFor={sliderId}>Corners</Label>
          <span className="set-drift-now text-xs text-muted-foreground">
            now {Math.round(live)} · fascia {sample}
          </span>
        </div>
        <div className="set-drift-track">
          <div className="chrome-face-slider">
            <span className="chrome-face-slider-classic" title="Default corners" />
            {showGhost ? (
              <span
                className="chrome-face-slider-ghost"
                style={{ left: `${Math.min(100, Math.max(0, live))}%` }}
                data-live-percent={live.toFixed(1)}
                title="Corners now"
              />
            ) : null}
            <input
              id={sliderId}
              type="range"
              min={0}
              max={100}
              step={1}
              value={thumb}
              onChange={(e) => onSlider(Number(e.target.value))}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={thumb}
              aria-valuetext={`Corners ${thumb}, live ${Math.round(live)}. ${DEFAULT_CORNER_MIX} is ${DEFAULT_CORNER_PRESET}.`}
            />
          </div>
        </div>
        <div className="set-drift-poles text-[11px] text-muted-foreground">
          <span>Bouba</span>
          <span>Kiki</span>
        </div>
        <div className="set-drift-center">
          <button type="button" onClick={resetCornerMix}>
            Default
          </button>
        </div>
      </div>

      <DriftAxisControls
        axis="Corners"
        paused={cornerPaused}
        periodMs={cornerPeriodMs}
        onPeriod={setCornerPeriod}
        onPaused={setCornerPaused}
        applyMode={applyMode}
        onApplyMode={onApplyMode}
        manualPeriodMs={manualPeriodMs}
        onManualPeriod={setManualPeriodMs}
        onStart={onStart}
        startDisabled={draft == null || Math.abs(draft - live) < 1}
        shifting={cornerTransition != null}
      />
    </div>
  )
}
