/**
 * components/Settings/ChromeFaceField.tsx — App-wide gunmetal set-point
 *
 * One slider for the Win95 face gray. The thumb is the persisted set-point;
 * a ghost tick is the live metal (minutes-scale drift around that set-point).
 * Default 50 is classic `#c0c0c0`. Hue is locked in `lib/chrome-patina.ts`.
 */
"use client"

import { useEffect, useId, useState } from "react"
import { Layers } from "lucide-react"
import { Label } from "@/components/ui/label"
import { useThemeStore } from "@/lib/theme-store"
import {
  CHROME_COOL,
  chromeFaceDisplayedLevel,
  chromeLevelToPercent,
  chromePatinaTokens,
} from "@/lib/chrome-patina"

function livePercent(setpoint: number, now: number): number {
  return chromeLevelToPercent(chromeFaceDisplayedLevel(setpoint, now))
}

export function ChromeFaceField() {
  const setpoint = useThemeStore((s) => s.chromeFace)
  const setChromeFace = useThemeStore((s) => s.setChromeFace)
  const resetChromeFace = useThemeStore((s) => s.resetChromeFace)
  const sliderId = useId()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const tokens = chromePatinaTokens(setpoint, now)
  const ghost = livePercent(setpoint, now)

  return (
    <div className="space-y-3 rounded-lg border border-dashed p-4">
      <div className="flex items-center gap-2">
        <Layers className="h-4 w-4" />
        <h3 className="font-semibold">Window gray</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        One gunmetal for every beveled face — Lists, Plan, Scheduler, Operations, Habits chrome.
        Classic Windows 95 sits at the center mark. The metal breathes over minutes: the hollow tick
        is where it is now; the thumb is your set-point.
      </p>

      <div className="flex items-center gap-3">
        <span
          className="chrome-face-swatch"
          style={{ background: tokens["--chrome-face"] }}
          title="Live face"
          aria-hidden
        />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <Label htmlFor={sliderId}>Face gray</Label>
            <span className="text-xs text-muted-foreground">
              set {Math.round(setpoint)} · now {Math.round(ghost)}
            </span>
          </div>
          <div className="chrome-face-slider">
            <span className="chrome-face-slider-classic" title="Classic Win95" />
            <span
              className="chrome-face-slider-ghost"
              style={{ left: `${Math.min(100, Math.max(0, ghost))}%` }}
              data-live-percent={ghost.toFixed(1)}
              title="Living metal now"
            />
            <input
              id={sliderId}
              type="range"
              min={0}
              max={100}
              step={1}
              value={setpoint}
              onChange={(e) => setChromeFace(Number(e.target.value))}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={setpoint}
              aria-valuetext={`Set-point ${Math.round(setpoint)}, live ${Math.round(ghost)}`}
            />
          </div>
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>Darker</span>
            <button type="button" className="underline-offset-2 hover:underline" onClick={resetChromeFace}>
              Classic {CHROME_COOL.face}
            </button>
            <span>Lighter</span>
          </div>
        </div>
      </div>
    </div>
  )
}
