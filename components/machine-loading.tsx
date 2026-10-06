/**
 * components/machine-loading.tsx — Wait instrument
 *
 * Suspense and listing waits. A milled Tek well: green or blue POWER lamp,
 * a phosphor sine, and — about three waits in five — the screen pet walking
 * the floor (usually one, less often two, rarer three, rarest four). The
 * readout says loading and blinks three bars. `pip` is the status-row scope
 * (trace + lamp only). `decorative` stays out of the accessibility tree when
 * nearby copy already names the wait. `prefers-reduced-motion` holds the
 * trace and the pets still.
 */
"use client"

import { useState, type CSSProperties } from "react"

export type MachineLoadingSize = "desk" | "nest" | "pip"
export type LampInk = "green" | "blue"

export type WaitCast = {
  lamp: LampInk
  /** How many screen pets pace the glass floor. */
  petCount: number
}

/**
 * 40% of waits are empty. The other 60% get the screen pet: half of those
 * get one, then two, then three, and four abreast is the rare end.
 */
export function rollCritterCount(random: () => number): number {
  if (random() >= 0.6) return 0
  const roll = random()
  if (roll < 0.5) return 1
  if (roll < 0.78) return 2
  if (roll < 0.93) return 3
  return 4
}

export function rollWaitCast(random: () => number = Math.random): WaitCast {
  return {
    petCount: rollCritterCount(random),
    lamp: random() < 0.5 ? "green" : "blue",
  }
}

function scopeSine(width: number, mid: number, amp: number, waves: number) {
  let d = ""
  for (let x = 2; x <= width - 2; x += 2) {
    const t = (x - 2) / (width - 4)
    const y = mid + Math.sin(t * Math.PI * 2 * waves) * amp
    d += `${x === 2 ? "M" : "L"}${x} ${y.toFixed(2)}`
  }
  return d
}

const SINE = scopeSine(160, 36, 13, 3)

/** Idle pose of the Home screen pet (`home-screen-pet.tsx`). One drawing, pacing the floor. */
function ScreenPet() {
  return (
    <svg className="ml-pet-sprite" viewBox="0 0 16 16" aria-hidden="true">
      <rect className="ml-pet-body" x="4" y="6" width="8" height="6" />
      <rect className="ml-pet-body" x="5" y="5" width="6" height="1" />
      <rect className="ml-pet-body" x="4" y="4" width="2" height="2" />
      <rect className="ml-pet-body" x="10" y="4" width="2" height="2" />
      <rect className="ml-pet-leg" x="5" y="12" width="2" height="2" />
      <rect className="ml-pet-leg ml-pet-leg-b" x="9" y="12" width="2" height="2" />
      <rect className="ml-pet-eyes" x="5" y="7" width="2" height="2" />
      <rect className="ml-pet-eyes" x="9" y="7" width="2" height="2" />
    </svg>
  )
}

export function MachineLoading({
  label = "loading",
  size = "desk",
  decorative = false,
  className,
}: {
  label?: string
  size?: MachineLoadingSize
  decorative?: boolean
  className?: string
}) {
  const [cast] = useState(rollWaitCast)
  const showPets = size !== "pip"
  const showReadout = size !== "pip"

  return (
    <div
      className={className ? `ml-load ${className}` : "ml-load"}
      data-size={size}
      data-lamp={cast.lamp}
      data-testid="machine-loading"
      role={decorative ? undefined : "status"}
      aria-live={decorative ? undefined : "polite"}
      aria-hidden={decorative ? true : undefined}
    >
      <div className="ml-chassis">
        <div className="ml-pwr">
          <span className="ml-pwr-lamp" />
          <span className="ml-pwr-word">PWR</span>
        </div>
        <div className="ml-glass">
          <svg className="ml-scope" viewBox="0 0 160 72" preserveAspectRatio="none" aria-hidden="true">
            <g className="ml-grid">
              {[18, 36, 54].map((y) => (
                <line key={`y${y}`} x1="0" y1={y} x2="160" y2={y} />
              ))}
              {[32, 64, 96, 128].map((x) => (
                <line key={`x${x}`} x1={x} y1="4" x2={x} y2="68" />
              ))}
            </g>
            <path className="ml-sine-ghost" d={SINE} />
            <path className="ml-sine" d={SINE} />
          </svg>
          {showPets && cast.petCount > 0 ? (
            <div className="ml-floor" aria-hidden="true">
              <span className="ml-ground" />
              {Array.from({ length: cast.petCount }, (_, i) => (
                <span key={i} className="ml-pet" style={{ "--i": i } as CSSProperties}>
                  <ScreenPet />
                </span>
              ))}
            </div>
          ) : null}
          <span className="ml-scan" />
        </div>
      </div>
      {showReadout ? (
        <p className="ml-readout">
          {label}
          <span className="ml-bars" aria-hidden="true">
            <span className="ml-bar" />
            <span className="ml-bar" />
            <span className="ml-bar" />
          </span>
        </p>
      ) : decorative ? null : (
        <span className="sr-only">{label}</span>
      )}
    </div>
  )
}
