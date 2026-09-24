/**
 * components/Home/Habits/noble-gas-tube.tsx — Glass noble-gas progress
 *
 * Finger-tube (test-tube) silhouette: cylinder + hemispherical DOME, never a
 * pipette point. Plasma LENGTH of the glowing column = percent.
 *
 * Photographed lab-tube, not a neon sign: borosilicate skin, residual vacuum
 * tint, soft volumetric column, modest lens bloom. CSS/SVG only — a WebGL
 * volume at 38px rail height would look muddy and cost two extra contexts.
 *
 * Layer stack (back → front):
 *   1. Silicone cradle / left occlusion
 *   2. Envelope BACK — dark glass + residual gas
 *   3. Electrode pin + faint cathode (0% = spark here)
 *   4. Plasma CLIPPED to a stadium of width plasmaClipWidth(percent):
 *        photographed bloom → soft volume filling the bore → axis column
 *        → advancing hemispherical head (fills the dome at 100%)
 *   5. Envelope FRONT — thin IOR skin, rim, small specular
 *
 * Hue (`hue` or gas default) tints only the discharge. Flicker is a 24s
 * 3% shimmer; prefers-reduced-motion is still.
 */
"use client"

import { useId, type CSSProperties } from "react"
import {
  defaultTubeColorForGas,
  dischargePaint,
  sanitizeTubeColor,
} from "@/lib/habit-tube"
import "./noble-gas-tube.css"

export type NobleGas = "argon" | "xenon" | "krypton"

const CHAMBER_X = 38
const CHAMBER_W = 268

/** Inner radius of the glass bore — also the dome / plasma-front radius. */
export const TUBE_INNER_R = 15

const CY = 28
const OUTER_R = 18
const LEFT_C = 28
const RIGHT_C = 292

function stadiumPath(cxLeft: number, cxRight: number, cy: number, r: number): string {
  return [
    `M ${cxLeft} ${cy - r}`,
    `H ${cxRight}`,
    `A ${r} ${r} 0 0 1 ${cxRight} ${cy + r}`,
    `H ${cxLeft}`,
    `A ${r} ${r} 0 0 1 ${cxLeft} ${cy - r}`,
    "Z",
  ].join(" ")
}

const OUTER_D = stadiumPath(LEFT_C, RIGHT_C, CY, OUTER_R)
const INNER_D = stadiumPath(LEFT_C, RIGHT_C, CY, TUBE_INNER_R)

/** Clamp a meter to 0–100. Non-finite values read as empty. */
export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, value))
}

/**
 * Plasma length as a 0–1 fraction of the inner chamber.
 * 0% keeps a tiny electrode spark; 100% fills the hemispherical dome.
 */
export function plasmaFill(percent: number): number {
  const p = clampPercent(percent) / 100
  if (p <= 0) return 0.018
  return p
}

export function plasmaClipWidth(percent: number, chamber = CHAMBER_W): number {
  return plasmaFill(percent) * chamber
}

/** Rounded clip cap so the column front is a hemisphere, not a flat cut. */
export function plasmaClipRx(percent: number, chamber = CHAMBER_W): number {
  return Math.min(TUBE_INNER_R, plasmaClipWidth(percent, chamber) / 2)
}

export function NobleGasTube({
  value,
  gas = "argon",
  hue,
  label,
}: {
  value: number
  gas?: NobleGas
  hue?: string
  label: string
}) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "")
  const tint = sanitizeTubeColor(hue, defaultTubeColorForGas(gas))
  const paint = dischargePaint(tint, defaultTubeColorForGas(gas))
  const percent = clampPercent(value)
  const clipW = plasmaClipWidth(percent)
  const clipRx = plasmaClipRx(percent)
  const boreH = TUBE_INNER_R * 2
  const clipH = Math.min(boreH, Math.max(clipW, clipRx * 2))
  const clipY = CY - clipH / 2
  const rounded = Math.round(percent)
  const headX = CHAMBER_X + Math.max(clipRx, clipW - clipRx)
  const colH = Math.min(clipH * 0.58, 16)
  const clipId = `hab-gas-clip-${uid}`
  const boreId = `hab-gas-bore-${uid}`
  const glassId = `hab-gas-glass-${uid}`
  const coreId = `hab-gas-core-${uid}`
  const volId = `hab-gas-vol-${uid}`
  const vacId = `hab-gas-vac-${uid}`
  const specId = `hab-gas-spec-${uid}`
  const siliconeId = `hab-gas-silicone-${uid}`

  const style = {
    "--hab-plasma": `${percent}%`,
    "--hab-gas-core": paint.core,
    "--hab-gas-mid": paint.mid,
    "--hab-gas-halo": paint.halo,
    "--hab-gas-volume": paint.volume,
    "--hab-gas-residual": paint.residual,
    "--hab-gas-residual-hi": paint.residualHi,
  } as CSSProperties

  return (
    <div
      className="hab-gas-tube"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={rounded}
      aria-valuetext={`${rounded} percent`}
      data-percent={String(rounded)}
      data-gas={gas}
      data-hue={tint}
      data-shape="finger-tube"
      style={style}
    >
      <svg
        className="hab-gas-svg"
        viewBox="0 0 320 56"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        <defs>
          <clipPath id={boreId}>
            <path d={INNER_D} />
          </clipPath>
          <clipPath id={clipId}>
            <rect
              className="hab-gas-plasma-clip"
              data-testid="hab-gas-plasma-clip"
              x={CHAMBER_X}
              y={clipY}
              width={clipW}
              height={clipH}
              rx={clipRx}
              ry={clipRx}
            />
          </clipPath>
          <linearGradient id={glassId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e8f2f8" stopOpacity="0.38" />
            <stop offset="18%" stopColor="#9bb4c4" stopOpacity="0.12" />
            <stop offset="48%" stopColor="#1a242c" stopOpacity="0.04" />
            <stop offset="72%" stopColor="#0a1016" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#c8dce8" stopOpacity="0.16" />
          </linearGradient>
          <linearGradient id={vacId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={paint.residualHi} />
            <stop offset="42%" stopColor="#05070a" />
            <stop offset="100%" stopColor={paint.residual} />
          </linearGradient>
          <linearGradient id={volId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={paint.halo} stopOpacity="0.04" />
            <stop offset="22%" stopColor={paint.volume} stopOpacity="0.38" />
            <stop offset="50%" stopColor={paint.mid} stopOpacity="0.62" />
            <stop offset="78%" stopColor={paint.volume} stopOpacity="0.38" />
            <stop offset="100%" stopColor={paint.halo} stopOpacity="0.04" />
          </linearGradient>
          <linearGradient id={coreId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={paint.halo} stopOpacity="0" />
            <stop offset="32%" stopColor={paint.mid} stopOpacity="0.45" />
            <stop offset="50%" stopColor={paint.core} stopOpacity="0.72" />
            <stop offset="68%" stopColor={paint.mid} stopOpacity="0.45" />
            <stop offset="100%" stopColor={paint.halo} stopOpacity="0" />
          </linearGradient>
          <linearGradient id={specId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.55" />
            <stop offset="55%" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={siliconeId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#0a0a0c" />
            <stop offset="50%" stopColor="#16161a" />
            <stop offset="100%" stopColor="#070709" />
          </linearGradient>
        </defs>

        <rect x="1" y="8" width="30" height="40" rx="12" className="hab-gas-cradle" />
        <rect x="4" y="11" width="22" height="34" rx="10" fill={`url(#${siliconeId})`} />
        <path
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="0.8"
          d="M 16 13 C 24 16 28 21 28 28 C 28 35 24 40 16 43"
        />

        <path
          className="hab-gas-envelope"
          data-dome="hemisphere"
          d={OUTER_D}
          fill="rgba(18, 28, 36, 0.42)"
          stroke="rgba(168, 196, 214, 0.38)"
          strokeWidth="1.05"
        />
        <path fill={`url(#${vacId})`} d={INNER_D} />
        <g clipPath={`url(#${boreId})`}>
          <rect
            x={LEFT_C - TUBE_INNER_R}
            y={CY - TUBE_INNER_R}
            width={RIGHT_C - LEFT_C + TUBE_INNER_R * 2}
            height={TUBE_INNER_R * 2}
            className="hab-gas-residual"
            fill={paint.residual}
          />

          <g className="hab-gas-electrode">
            <rect x="30" y="25.4" width="15" height="5.2" rx="0.9" fill="#4a4e54" />
            <rect x="31" y="26.1" width="13" height="1.6" rx="0.4" fill="#9aa0a8" opacity="0.35" />
            <circle cx="45" cy="28" r="2.6" fill="#3a3e44" />
            <circle cx="44.5" cy="27.4" r="0.8" fill="#d0d4d8" opacity="0.4" />
          </g>

          <g clipPath={`url(#${clipId})`} className="hab-gas-live">
            <rect
              className="hab-gas-bloom"
              x={CHAMBER_X}
              y={clipY}
              width={clipW}
              height={clipH}
              rx={clipRx}
              fill={paint.halo}
            />
            <rect
              className="hab-gas-volume"
              x={CHAMBER_X}
              y={clipY}
              width={clipW}
              height={clipH}
              rx={clipRx}
              fill={`url(#${volId})`}
            />
            <rect
              className="hab-gas-column"
              x={CHAMBER_X}
              y={CY - colH / 2}
              width={clipW}
              height={colH}
              rx={colH / 2}
              fill={`url(#${coreId})`}
            />
            <rect
              className="hab-gas-spine"
              x={CHAMBER_X}
              y={CY - Math.min(0.9, clipH / 2)}
              width={clipW}
              height={Math.min(1.8, clipH)}
              rx={Math.min(0.9, clipH / 2)}
              fill={paint.core}
            />
            <ellipse
              className="hab-gas-anode"
              cx="46"
              cy={CY}
              rx={Math.min(8, clipW)}
              ry={Math.min(7, clipH / 2)}
              fill={paint.mid}
            />
            <ellipse
              className="hab-gas-head"
              cx={headX}
              cy={CY}
              rx={Math.max(clipRx * 0.92, Math.min(clipW, clipRx))}
              ry={Math.min(TUBE_INNER_R * 0.78, clipH / 2)}
              fill={paint.halo}
            />
          </g>
        </g>

        <path className="hab-gas-skin" fill={`url(#${glassId})`} d={OUTER_D} />
        <path
          fill="none"
          className="hab-gas-rim"
          stroke="rgba(214, 232, 244, 0.34)"
          strokeWidth="1.05"
          d={OUTER_D}
        />
        <path
          fill={`url(#${specId})`}
          opacity="0.42"
          d={`M ${LEFT_C + 6} 12.6
              H ${RIGHT_C - 4}
              A 14 6 0 0 1 ${RIGHT_C + 8} 20
              C ${RIGHT_C - 10} 15.2 ${RIGHT_C - 48} 13.8 180 13.7
              H ${LEFT_C + 8} Z`}
        />
        <path
          fill="none"
          stroke="rgba(255,255,255,0.28)"
          strokeWidth="0.85"
          strokeLinecap="round"
          d={`M ${LEFT_C + 8} 13.4 H ${RIGHT_C}
              A ${OUTER_R - 2} ${OUTER_R - 2} 0 0 1 ${RIGHT_C + OUTER_R - 4} ${CY - 3}`}
        />
        <path
          fill="none"
          stroke="rgba(6,8,12,0.42)"
          strokeWidth="0.95"
          strokeLinecap="round"
          d={`M ${LEFT_C + 8} 42.6 H ${RIGHT_C}
              A ${OUTER_R - 2} ${OUTER_R - 2} 0 0 0 ${RIGHT_C + OUTER_R - 4} ${CY + 3}`}
        />
        <ellipse
          className="hab-gas-dome-glint"
          cx={RIGHT_C + 7}
          cy={CY - 6}
          rx="3.2"
          ry="4.6"
          fill="#fff"
          opacity="0.18"
        />
        <ellipse cx={RIGHT_C + 10} cy={CY - 9} rx="1.2" ry="1.6" fill="#fff" opacity="0.28" />
        <ellipse cx={LEFT_C + 14} cy="15" rx="6" ry="1.6" fill="#fff" opacity="0.12" />

        <rect x="1" y="8" width="16" height="40" rx="10" className="hab-gas-occlusion" />
        <path
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="0.85"
          d="M 16 12 C 22 17 24 22 24 28 C 24 34 22 39 16 44"
        />
      </svg>
    </div>
  )
}
