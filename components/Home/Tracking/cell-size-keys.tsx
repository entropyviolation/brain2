/**
 * components/Home/Tracking/cell-size-keys.tsx — Cell-step amp dial
 *
 * One milled knob for 1 / 5 / 10 / 15 / 30. The indicator sweeps a 270° arc,
 * finest at the lower left (−135°) and coarsest at the lower right (+135°).
 * Clockwise turns to a coarser step; counterclockwise turns finer — the same
 * way an amplifier volume knob gets louder as it turns clockwise.
 * Grab the knob and rotate around its center. Letting go stops the turn.
 * A press that does not rotate leaves the step. ArrowUp / ArrowLeft go finer;
 * ArrowDown / ArrowRight go coarser, while the knob is focused.
 * A wheel or trackpad scroll over the knob does not turn it and does not
 * take the page scroll. The step is still only how coarsely the grid draws.
 */
"use client"

import { useRef } from "react"
import "./tracking-chrome.css"

/** Travel of the indicator, finest to coarsest. Classic volume-knob sweep. */
const SWEEP_DEG = 270

type Grab<T extends number> = {
  index: number
  last: T
  prevAngle: number
  swept: number
}

/** 0° is up, positive is clockwise. */
function pointerAngle(clientX: number, clientY: number, rect: DOMRect): number {
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  return (Math.atan2(clientX - cx, -(clientY - cy)) * 180) / Math.PI
}

/** Shortest signed turn, clockwise positive, in (−180, 180]. */
function wrapDegrees(delta: number): number {
  const wrapped = ((delta % 360) + 360) % 360
  return wrapped > 180 ? wrapped - 360 : wrapped
}

function detentDegrees(index: number, count: number): number {
  if (count <= 1) return 0
  return -SWEEP_DEG / 2 + (index / (count - 1)) * SWEEP_DEG
}

export function CellSizeKeys<T extends number>({
  steps,
  value,
  onChange,
  ariaLabel = "Cell size",
}: {
  steps: readonly T[]
  value: T
  onChange: (step: T) => void
  ariaLabel?: string
}) {
  const index = Math.max(0, steps.indexOf(value))
  const grab = useRef<Grab<T> | null>(null)
  const degrees = detentDegrees(index, steps.length)

  const shift = (dir: -1 | 1) => {
    const next = steps[index + dir]
    if (next != null) onChange(next)
  }

  return (
    <div className="trk-cell-dial">
      <span className="trk-silk">Cell</span>
      <div
        className="trk-cell-knob"
        role="slider"
        tabIndex={0}
        aria-roledescription="dial"
        aria-label={ariaLabel}
        aria-valuemin={steps[0]}
        aria-valuemax={steps[steps.length - 1]}
        aria-valuenow={value}
        aria-valuetext={`${value} minutes`}
        title="Rendering only — stored time stays minute-accurate"
        onPointerDown={(event) => {
          if (event.button !== 0) return
          const rect = event.currentTarget.getBoundingClientRect()
          grab.current = {
            index,
            last: value,
            prevAngle: pointerAngle(event.clientX, event.clientY, rect),
            swept: 0,
          }
          try {
            event.currentTarget.setPointerCapture(event.pointerId)
          } catch {
            /* Pointer already gone, or the test DOM has no capture. */
          }
        }}
        onPointerMove={(event) => {
          const state = grab.current
          if (!state || steps.length < 2) return
          const rect = event.currentTarget.getBoundingClientRect()
          const angle = pointerAngle(event.clientX, event.clientY, rect)
          state.swept += wrapDegrees(angle - state.prevAngle)
          state.prevAngle = angle
          const detent = SWEEP_DEG / (steps.length - 1)
          const nextIndex = state.index + Math.round(state.swept / detent)
          const clamped = Math.max(0, Math.min(steps.length - 1, nextIndex))
          const step = steps[clamped]
          if (step == null || step === state.last) return
          state.last = step
          onChange(step)
        }}
        onPointerUp={() => {
          grab.current = null
        }}
        onPointerCancel={() => {
          grab.current = null
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
            event.preventDefault()
            shift(-1)
          } else if (event.key === "ArrowDown" || event.key === "ArrowRight") {
            event.preventDefault()
            shift(1)
          }
        }}
      >
        <span className="trk-cell-knob-face" style={{ transform: `rotate(${degrees}deg)` }}>
          <span className="trk-cell-knob-mark" />
        </span>
      </div>
      <span className="trk-cell-knob-readout">{value}m</span>
    </div>
  )
}
