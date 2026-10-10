/**
 * app/chrome-patina.tsx — Paint warmth and Bouba/Kiki on `:root`
 *
 * Writes the committed gunmetal and corner tokens. A timed shift holds the
 * previous state here; the settings panel previews the in-between on its own
 * element. The tick stays fast during that shift so the commit lands when
 * the interval ends, and during a short drift cycle. A day-long drift ticks
 * once a second. Not a CSS animation. Reduced motion is handled when the
 * shift is started (the clock jumps, and that end state is painted here).
 */
"use client"

import { useEffect } from "react"
import { applyChromePatina } from "@/lib/chrome-patina"
import { applyCornerMix } from "@/lib/corner-mix"
import { appDriftPosition, settleDrift, type DriftClock } from "@/lib/drift-clock"
import { cornerClock, useThemeStore, warmthClock } from "@/lib/theme-store"

function tickDelay(warmth: DriftClock, corner: DriftClock, now: number): number {
  const urgent = [warmth, corner].some((clock) => {
    const transition = clock.transition
    if (transition && now < transition.startedAt + transition.durationMs) return true
    return !clock.paused && clock.periodMs <= 2 * 60 * 1000
  })
  return urgent ? 100 : 1000
}

export function ChromePatina() {
  const chromeFace = useThemeStore((s) => s.chromeFace)
  const chromePeriodMs = useThemeStore((s) => s.chromePeriodMs)
  const chromePaused = useThemeStore((s) => s.chromePaused)
  const chromeTransition = useThemeStore((s) => s.chromeTransition)
  const cornerMix = useThemeStore((s) => s.cornerMix)
  const cornerPeriodMs = useThemeStore((s) => s.cornerPeriodMs)
  const cornerPaused = useThemeStore((s) => s.cornerPaused)
  const cornerTransition = useThemeStore((s) => s.cornerTransition)

  useEffect(() => {
    const root = document.documentElement
    let timer = 0
    let stopped = false

    const paint = () => {
      if (stopped) return
      const state = useThemeStore.getState()
      const now = Date.now()
      const warmth = warmthClock(state)
      const corner = cornerClock(state)
      const nextWarmth = settleDrift(warmth, now)
      const nextCorner = settleDrift(corner, now)
      applyChromePatina(root, appDriftPosition(nextWarmth, now))
      applyCornerMix(root, appDriftPosition(nextCorner, now))
      if (nextWarmth !== warmth || nextCorner !== corner) {
        useThemeStore.setState({
          ...(nextWarmth !== warmth
            ? {
                chromeFace: nextWarmth.anchor,
                chromePhase: nextWarmth.phase,
                chromeEpochMs: nextWarmth.epochMs,
                chromePeriodMs: nextWarmth.periodMs,
                chromePaused: nextWarmth.paused,
                chromeTransition: nextWarmth.transition,
              }
            : {}),
          ...(nextCorner !== corner
            ? {
                cornerMix: nextCorner.anchor,
                cornerPhase: nextCorner.phase,
                cornerEpochMs: nextCorner.epochMs,
                cornerPeriodMs: nextCorner.periodMs,
                cornerPaused: nextCorner.paused,
                cornerTransition: nextCorner.transition,
              }
            : {}),
        })
      }
      timer = window.setTimeout(paint, tickDelay(nextWarmth, nextCorner, now))
    }

    paint()
    const unsub = useThemeStore.persist.onFinishHydration(() => {
      window.clearTimeout(timer)
      paint()
    })
    return () => {
      stopped = true
      window.clearTimeout(timer)
      unsub()
    }
  }, [
    chromeFace,
    chromePeriodMs,
    chromePaused,
    chromeTransition,
    cornerMix,
    cornerPeriodMs,
    cornerPaused,
    cornerTransition,
  ])

  return null
}
