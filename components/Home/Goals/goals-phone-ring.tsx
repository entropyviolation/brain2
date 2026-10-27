/**
 * components/Home/Goals/goals-phone-ring.tsx — progress ring for phone Goals
 *
 * One ring, drawn from 12 o'clock. The number stays in HTML next to it.
 * Stroke motion is a spring ease; reduced motion drops the transition in CSS.
 */
"use client"

export function ProgressRing({
  percent,
  size = 44,
  stroke = 3.5,
  done = false,
}: {
  percent: number | null
  size?: number
  stroke?: number
  done?: boolean
}) {
  const radius = (size - stroke) / 2 - 0.5
  const center = size / 2
  const circumference = 2 * Math.PI * radius
  const clamped = percent == null ? 0 : Math.max(0, Math.min(100, percent))
  const offset = circumference * (1 - clamped / 100)

  return (
    <svg
      className={`gol-phone-ring${done ? " is-done" : ""}`}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
    >
      <circle className="gol-phone-ring-track" cx={center} cy={center} r={radius} strokeWidth={stroke} />
      <circle
        className="gol-phone-ring-value"
        cx={center}
        cy={center}
        r={radius}
        strokeWidth={stroke}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${center} ${center})`}
      />
    </svg>
  )
}
