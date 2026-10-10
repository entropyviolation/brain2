/**
 * components/Settings/ChromeFaceField.tsx — App-wide gunmetal warmth
 *
 * One slider for the Win95 face. Warmth walks the design-ref grays in
 * `lib/chrome-patina.ts`. Mix 50 is the stored classic default. Drift walks
 * that path and back; pause holds it. Default restores the stored palette
 * and pauses. Instant applies the slider to the whole app. Timed previews
 * in this panel only; when the interval ends the app takes the new gray
 * and the drift speed takes over.
 */
"use client"

import { useEffect, useId, useRef, useState } from "react"
import { Layers } from "lucide-react"
import { Label } from "@/components/ui/label"
import { DriftAxisControls } from "@/components/Settings/DriftAxisControls"
import { useWarmthPanelPreview } from "@/components/Settings/panel-preview"
import { useThemeStore, warmthClock } from "@/lib/theme-store"
import { chromePatinaTokens } from "@/lib/chrome-patina"
import { DRIFT_PRESET_MS, driftPosition } from "@/lib/drift-clock"

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

export function ChromeFaceField() {
  const chromeFace = useThemeStore((s) => s.chromeFace)
  const chromePhase = useThemeStore((s) => s.chromePhase)
  const chromeEpochMs = useThemeStore((s) => s.chromeEpochMs)
  const chromePeriodMs = useThemeStore((s) => s.chromePeriodMs)
  const chromePaused = useThemeStore((s) => s.chromePaused)
  const chromeTransition = useThemeStore((s) => s.chromeTransition)
  const setChromeFace = useThemeStore((s) => s.setChromeFace)
  const setChromePeriod = useThemeStore((s) => s.setChromePeriod)
  const setChromePaused = useThemeStore((s) => s.setChromePaused)
  const startChromeTransition = useThemeStore((s) => s.startChromeTransition)
  const resetChromeFace = useThemeStore((s) => s.resetChromeFace)

  const sliderId = useId()
  const [now, setNow] = useState(() => Date.now())
  const [applyMode, setApplyMode] = useState<"instant" | "timed">("instant")
  const [draft, setDraft] = useState<number | null>(null)
  const [held, setHeld] = useState<number | null>(null)
  const holding = useRef(false)
  const [manualPeriodMs, setManualPeriodMs] = useState<number>(DRIFT_PRESET_MS["30s"])

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), chromePaused && !chromeTransition ? 1000 : 200)
    return () => window.clearInterval(id)
  }, [chromePaused, chromeTransition])

  const clock = warmthClock({
    chromeFace,
    chromePhase,
    chromeEpochMs,
    chromePeriodMs,
    chromePaused,
    chromeTransition,
  })
  const live = driftPosition(clock, now)
  const previewRef = useWarmthPanelPreview(chromeTransition != null, live)
  const thumb = held ?? draft ?? Math.round(live)
  const tokens = chromePatinaTokens(live)
  const showGhost = draft != null && Math.abs(draft - live) >= 1

  function onSlider(value: number) {
    if (applyMode === "instant") {
      setDraft(null)
      if (holding.current) setHeld(value)
      setChromeFace(value)
      return
    }
    setDraft(value)
  }

  function onApplyMode(mode: "instant" | "timed") {
    setApplyMode(mode)
    if (mode === "instant" && draft != null) {
      setChromeFace(draft)
      setDraft(null)
    }
  }

  function onStart() {
    const target = draft ?? Math.round(live)
    startChromeTransition(target, manualPeriodMs, prefersReducedMotion())
    setDraft(null)
  }

  return (
    <div ref={previewRef} className="set-drift rounded-lg border border-dashed">
      <div className="set-drift-title flex items-center gap-2">
        <Layers className="h-4 w-4" />
        <h3 className="font-semibold">Window gray</h3>
      </div>
      <p className="set-drift-copy text-sm text-muted-foreground">
        One metal for every beveled face — Lists, Plan, Scheduler, Operations, Habits chrome.
        It drifts along the computer grays from the design refs — olive, warm silver, classic
        Windows 95, cool silver — and back. Default restores that stored classic metal and pauses.
        Instant applies the slider to the whole app. Timed previews the shift in this panel only;
        when that interval ends, the app takes the new gray and the drift speed takes over again.
      </p>

      <div className="set-drift-scale">
        <div className="set-drift-labelrow">
          <Label htmlFor={sliderId}>Warmth</Label>
          <span className="set-drift-now text-xs text-muted-foreground">now {Math.round(live)}</span>
        </div>
        <div className="set-drift-track">
          <span
            className="chrome-face-swatch"
            style={{ background: tokens["--chrome-face"] }}
            title="Live face"
            aria-hidden
          />
          <div className="chrome-face-slider">
            <span className="chrome-face-slider-classic" title="Classic Win95" />
            {showGhost ? (
              <span
                className="chrome-face-slider-ghost"
                style={{ left: `${Math.min(100, Math.max(0, live))}%` }}
                data-live-percent={live.toFixed(1)}
                title="Living metal now"
              />
            ) : null}
            <input
              id={sliderId}
              type="range"
              min={0}
              max={100}
              step={1}
              value={thumb}
              onPointerDown={() => {
                holding.current = true
              }}
              onPointerUp={() => {
                holding.current = false
                setHeld(null)
              }}
              onPointerCancel={() => {
                holding.current = false
                setHeld(null)
              }}
              onChange={(e) => onSlider(Number(e.target.value))}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={thumb}
              aria-valuetext={`Warmth ${thumb}, live ${Math.round(live)}`}
            />
          </div>
        </div>
        <div className="set-drift-poles text-[11px] text-muted-foreground">
          <span>Warm</span>
          <span>Cool</span>
        </div>
        <div className="set-drift-center">
          <button type="button" onClick={resetChromeFace}>
            Default
          </button>
        </div>
      </div>

      <DriftAxisControls
        axis="Warmth"
        paused={chromePaused}
        periodMs={chromePeriodMs}
        onPeriod={setChromePeriod}
        onPaused={setChromePaused}
        applyMode={applyMode}
        onApplyMode={onApplyMode}
        manualPeriodMs={manualPeriodMs}
        onManualPeriod={setManualPeriodMs}
        onStart={onStart}
        startDisabled={draft == null || Math.abs(draft - live) < 1}
        shifting={chromeTransition != null}
      />
    </div>
  )
}
