/**
 * components/Home/home-sky-motion.tsx — View width and time rate for the Moon chart
 *
 * Two sliders, the scale of the view, and how fast eight familiar motions
 * would cross a 1,000 px screen. The dots move at that speed. Reset returns
 * the chart to real time and to forward. View width and the rate are saved.
 * Play, Reverse, and Pause run or freeze the one chart clock. They do not
 * change the rate, the view width, or this store. Reverse is not saved.
 */
"use client"

import { memo, useEffect, useMemo, useRef } from "react"
import { motionReadout, TIME_RATES, VIEW_WIDTH_LOG_MAX, VIEW_WIDTH_LOG_MIN, VIEW_WIDTH_LOG_STEP } from "@/lib/sky-motion"
import { useSkyMotionStore } from "@/lib/sky-motion-store"

export const SkyMotionBar = memo(function SkyMotionBar({
  paused = false,
  reversed = false,
  onPausedChange,
  onReversedChange,
}: {
  paused?: boolean
  reversed?: boolean
  onPausedChange?: (paused: boolean) => void
  onReversedChange?: (reversed: boolean) => void
}) {
  const viewWidthLog = useSkyMotionStore((s) => s.viewWidthLog)
  const rateIndex = useSkyMotionStore((s) => s.rateIndex)
  const setViewWidthLog = useSkyMotionStore((s) => s.setViewWidthLog)
  const setRateIndex = useSkyMotionStore((s) => s.setRateIndex)
  const resetTimeRate = useSkyMotionStore((s) => s.resetTimeRate)
  const readout = useMemo(() => motionReadout(viewWidthLog, rateIndex), [viewWidthLog, rateIndex])
  const rowsRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    const root = rowsRef.current
    if (!root) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const dots = [...root.querySelectorAll<HTMLElement>("[data-dot]")]
    const speeds = readout.rows.map((row) => row.fractionPerSec)
    const pos = dots.map(() => Math.random())
    let last = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1)
      last = now
      dots.forEach((dot, i) => {
        const track = dot.parentElement
        const width = track?.clientWidth || 300
        pos[i] = (pos[i]! + (speeds[i] ?? 0) * dt) % 1
        dot.style.transform = `translateX(${pos[i]! * Math.max(0, width - 10)}px)`
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [readout])

  return (
    <section className="home-sky-motion" data-testid="sky-motion-bar" aria-label="Screen motion">
      <h3>On-screen motion</h3>
      <p className="home-sky-motion-lead">How fast things move across this 1,000 px view at the chosen width and time rate.</p>
      <div className="home-sky-motion-ctl">
        <label htmlFor="sky-view-width">View width</label>
        <input
          id="sky-view-width"
          type="range"
          min={VIEW_WIDTH_LOG_MIN}
          max={VIEW_WIDTH_LOG_MAX}
          step={VIEW_WIDTH_LOG_STEP}
          value={viewWidthLog}
          aria-valuetext={readout.viewWidthLabel}
          onChange={(event) => setViewWidthLog(Number(event.target.value))}
        />
        <output htmlFor="sky-view-width">{readout.viewWidthLabel}</output>
      </div>
      <div className="home-sky-motion-ctl">
        <label htmlFor="sky-time-rate">Time rate</label>
        <input
          id="sky-time-rate"
          type="range"
          min={0}
          max={TIME_RATES.length - 1}
          step={1}
          value={rateIndex}
          aria-valuetext={readout.rateLabel}
          onChange={(event) => setRateIndex(Number(event.target.value))}
        />
        <div className="home-sky-motion-rate">
          <output htmlFor="sky-time-rate">{readout.rateLabel}</output>
          <button
            type="button"
            className="home-review-key"
            onClick={() => {
              resetTimeRate()
              onReversedChange?.(false)
            }}
          >
            Reset to real time
          </button>
        </div>
      </div>
      <div className="home-sky-motion-clock">
        <span id="sky-clock-label">Clock</span>
        <div role="group" aria-labelledby="sky-clock-label">
          <button
            type="button"
            className={!paused && !reversed ? "home-review-key is-on" : "home-review-key"}
            aria-pressed={!paused && !reversed}
            title="Play the chart clock forward. Real time follows the anchor."
            onClick={() => {
              onReversedChange?.(false)
              onPausedChange?.(false)
            }}
          >
            Play
          </button>
          <button
            type="button"
            className={!paused && reversed ? "home-review-key is-on" : "home-review-key"}
            aria-pressed={!paused && reversed}
            title="Play the one clock backward. The saved rate and view width stay."
            onClick={() => {
              onReversedChange?.(true)
              onPausedChange?.(false)
            }}
          >
            Reverse
          </button>
          <button
            type="button"
            className={paused ? "home-review-key is-on" : "home-review-key"}
            aria-pressed={paused}
            title="Pause freezes the chart clock. The time rate and view width stay as they are."
            onClick={() => onPausedChange?.(true)}
          >
            Pause
          </button>
        </div>
        {paused ? <span className="home-sky-motion-held">Paused</span> : null}
      </div>
      <div className="home-sky-motion-scale">
        <span>{readout.scaleLabel}</span>
        <span>{readout.lightLabel}</span>
      </div>
      <ul className="home-sky-motion-rows" ref={rowsRef}>
        {readout.rows.map((row) => (
          <li key={row.id} className="home-sky-motion-row" data-motion={row.kind}>
            <div className="home-sky-motion-name">
              {row.name}
              <small>{row.speedLabel}</small>
            </div>
            <div className="home-sky-motion-track" aria-hidden="true">
              <span
                className="home-sky-motion-dot"
                data-dot=""
                style={{ background: row.color, opacity: row.kind === "fast" ? 0.35 : 1 }}
              />
            </div>
            <div className="home-sky-motion-state">
              {row.pxLabel}
              <small data-kind={row.kind}>{row.motionLabel}</small>
            </div>
          </li>
        ))}
      </ul>
      <p className="home-sky-motion-sum">{readout.summary}</p>
    </section>
  )
})
