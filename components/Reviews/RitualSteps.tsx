/**
 * components/Reviews/RitualSteps.tsx — one-question-at-a-time walk for rituals.
 *
 * A ritual hands in its steps (id, label, answered) and the current step's
 * body. This draws the lamp strip, the step plate (`03 / 09`), a side index
 * that folds away (open by default on wide screens, the choice is
 * remembered), and Back / Next. Arrow keys with Alt move between steps.
 * Every rite uses it: Morning, Night / end, Start, and Star Lord.
 * The ritual owns saving; `onStep` fires before the index changes so it can
 * write progress. `useRitualStep` remembers the step per ritual and day.
 */
"use client"

import { useEffect, useState, type ReactNode } from "react"
import { ChevronLeft, ChevronRight, ListTree } from "lucide-react"
import "./ritual-steps.css"

export type RitualStep = { id: string; label: string; answered: boolean }

const NAV_PREF_KEY = "brain2-ritual-nav-open"
const NAV_WIDE_QUERY = "(min-width: 720px)"

function readPref(key: string): string | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage.getItem(key)
  } catch {
    return null
  }
}

function writePref(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* private mode: the step still works, it just is not remembered */
  }
}

/** Step index remembered per ritual + day. `fallback` is used when nothing is stored. */
export function useRitualStep(storeKey: string, count: number, fallback: () => number) {
  const [index, setIndex] = useState(0)
  useEffect(() => {
    const raw = readPref(storeKey)
    const stored = raw === null ? NaN : Number(raw)
    const start = Number.isInteger(stored) ? stored : fallback()
    setIndex(Math.max(0, Math.min(count - 1, start)))
    // Seed once per key; the fallback reads store state that churns.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeKey, count])
  const go = (next: number) => {
    const clamped = Math.max(0, Math.min(count - 1, next))
    setIndex(clamped)
    writePref(storeKey, String(clamped))
  }
  return [index, go] as const
}

export function RitualStepper({
  steps,
  index,
  onStep,
  children,
  finishLabel,
  onFinish,
  tone,
}: {
  steps: RitualStep[]
  index: number
  onStep: (next: number) => void
  children: ReactNode
  finishLabel: string
  onFinish: () => void
  /** Color of the rite: dawn (morning, start), dusk (night, end), north (Star Lord). */
  tone?: "dawn" | "dusk" | "north"
}) {
  const [navOpen, setNavOpen] = useState(false)
  // A saved choice wins. With none, the index opens where there is room for it.
  useEffect(() => {
    const pref = readPref(NAV_PREF_KEY)
    if (pref === "1" || pref === "0") setNavOpen(pref === "1")
    else setNavOpen(typeof window !== "undefined" && window.matchMedia?.(NAV_WIDE_QUERY).matches === true)
  }, [])
  const toggleNav = () =>
    setNavOpen((open) => {
      writePref(NAV_PREF_KEY, open ? "0" : "1")
      return !open
    })

  const step = steps[index]
  const answered = steps.filter((s) => s.answered).length
  const last = index === steps.length - 1
  const pad = (n: number) => String(n).padStart(2, "0")

  return (
    <div
      className="rst"
      data-tone={tone}
      data-nav-open={navOpen ? "true" : undefined}
      onKeyDown={(e) => {
        if (!e.altKey) return
        if (e.key === "ArrowRight" && !last) {
          e.preventDefault()
          onStep(index + 1)
        } else if (e.key === "ArrowLeft" && index > 0) {
          e.preventDefault()
          onStep(index - 1)
        }
      }}
    >
      <div className="rst-strip" aria-label="Ritual steps">
        {steps.map((s, i) => (
          <button
            key={s.id}
            type="button"
            aria-current={i === index ? "step" : undefined}
            aria-label={`Go to ${s.label}${s.answered ? " (answered)" : ""}`}
            title={s.label}
            className="rst-lamp rst-own"
            data-answered={s.answered ? "true" : undefined}
            data-current={i === index ? "true" : undefined}
            onClick={() => onStep(i)}
          />
        ))}
        <span className="rst-tally" aria-live="polite">
          {answered}/{steps.length}
        </span>
      </div>

      <div className="rst-plate">
        <span className="rst-count" aria-hidden>
          {pad(index + 1)}
          <i>/</i>
          {pad(steps.length)}
        </span>
        <h3 className="rst-title">{step.label}</h3>
        <button
          type="button"
          className="rst-nav-key rst-own"
          aria-pressed={navOpen}
          aria-label={navOpen ? "Hide step index" : "Show step index"}
          title={navOpen ? "Hide step index" : "Show step index"}
          onClick={toggleNav}
        >
          <ListTree className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="rst-room">
        {navOpen ? (
          <nav className="rst-index" aria-label="Step index">
            {steps.map((s, i) => (
              <button
                key={s.id}
                type="button"
                className="rst-index-row rst-own"
                data-answered={s.answered ? "true" : undefined}
                data-current={i === index ? "true" : undefined}
                aria-current={i === index ? "step" : undefined}
                onClick={() => onStep(i)}
              >
                <span className="rst-index-lamp" aria-hidden />
                <span className="rst-index-num" aria-hidden>
                  {pad(i + 1)}
                </span>
                <span className="rst-index-label">{s.label}</span>
              </button>
            ))}
          </nav>
        ) : null}
        <div className="rst-card" key={step.id} data-step={step.id}>
          {children}
        </div>
      </div>

      <div className="rst-walk">
        <button type="button" className="rst-walk-key rst-own" disabled={index === 0} onClick={() => onStep(index - 1)}>
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>
        <span className="rst-walk-hint">
          {steps[index + 1] ? `Next: ${steps[index + 1].label}` : "Last step"}
        </span>
        {last ? (
          <button type="button" className="rst-walk-key is-go rst-own" onClick={onFinish}>
            {finishLabel}
          </button>
        ) : (
          <button type="button" className="rst-walk-key is-go rst-own" onClick={() => onStep(index + 1)}>
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )
}
