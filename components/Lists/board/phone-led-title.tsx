"use client"

/**
 * components/Lists/board/phone-led-title.tsx
 *
 * Phone title readout. A title that fits stays still. One tap plays it
 * across the bar. The next tap drops the bar open so the whole line can be
 * read. A tap while it is open closes it. Reduced motion skips the play
 * and opens the bar on the first tap.
 */
import { useEffect, useRef, useState, type CSSProperties } from "react"

export type LedMode = "clip" | "scroll" | "expanded"

export function nextLedMode(mode: LedMode, overflows: boolean, reducedMotion: boolean): LedMode {
  if (mode === "expanded") return "clip"
  if (mode === "scroll") return "expanded"
  if (!overflows) return "clip"
  if (reducedMotion) return "expanded"
  return "scroll"
}

function reducedMotion(): boolean {
  if (typeof window.matchMedia !== "function") return false
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

export function PhoneLedTitle({ text }: { text: string }) {
  const ref = useRef<HTMLButtonElement>(null)
  const [mode, setMode] = useState<LedMode>("clip")

  useEffect(() => {
    setMode("clip")
  }, [text])

  const seconds = Math.min(24, Math.max(7, Math.round(text.length * 0.18)))

  return (
    <button
      type="button"
      ref={ref}
      className={`fm-led-title is-${mode}`}
      data-no95
      style={mode === "scroll" ? ({ "--fm-led-ms": `${seconds}s` } as CSSProperties) : undefined}
      aria-expanded={mode === "expanded"}
      aria-label={text}
      onClick={() => {
        const el = ref.current
        const overflows =
          mode === "scroll" || mode === "expanded" || (el != null && el.scrollWidth > el.clientWidth + 1)
        setMode(nextLedMode(mode, overflows, reducedMotion()))
      }}
    >
      {mode === "scroll" ? (
        <span className="fm-led-track">
          <span>{text}</span>
          <span aria-hidden="true">{text}</span>
        </span>
      ) : (
        text
      )}
    </button>
  )
}
