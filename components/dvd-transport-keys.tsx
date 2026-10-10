/**
 * components/dvd-transport-keys.tsx — the house Pause, Play, and Stop
 *
 * Import this when a clock or a player needs those three. The glassy disc
 * comes with the file (`dvd-transport-keys.css`). Do not draw a Lucide
 * stroke, a square key, or a word button for the same job.
 *
 *   <DvdTransportKey mark="pause" label="Pause Computer Work" onClick={pause} />
 */
"use client"

import "./dvd-transport-keys.css"

export type DvdMark = "pause" | "play" | "stop"

function MarkShapes({ mark }: { mark: DvdMark }) {
  if (mark === "pause") {
    return (
      <>
        <rect x="2.85" y="2.7" width="4.05" height="10.6" rx="0.45" />
        <rect x="9.1" y="2.7" width="4.05" height="10.6" rx="0.45" />
      </>
    )
  }
  if (mark === "stop") {
    return <rect x="3.85" y="3.85" width="8.3" height="8.3" rx="0.45" />
  }
  /* Centroid sits just right of the button center, the way a DVD play key
     looks balanced. A box-centered triangle reads left-heavy. */
  return <polygon points="6.35,2.85 14.15,8 6.35,13.15" />
}

function DvdGlyph({ mark }: { mark: DvdMark }) {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden focusable="false">
      <g className="dvd-key-lip" transform="translate(0 0.7)">
        <MarkShapes mark={mark} />
      </g>
      <g className="dvd-key-ink">
        <MarkShapes mark={mark} />
      </g>
    </svg>
  )
}

export function DvdTransportKey({
  mark,
  label,
  onClick,
  className,
  pressed,
  disabled,
}: {
  /** `pause` two bars, `play` the triangle, `stop` the square. */
  mark: DvdMark
  /** Accessible name, also the tooltip. */
  label: string
  onClick: () => void
  className?: string
  /** Holds the sunken press, for a key that stays down. */
  pressed?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      className={className ? `dvd-key ${className}` : "dvd-key"}
      data-dvd-mark={mark}
      aria-label={label}
      aria-pressed={pressed ? true : undefined}
      title={label}
      disabled={disabled || undefined}
      onClick={onClick}
    >
      <DvdGlyph mark={mark} />
    </button>
  )
}
