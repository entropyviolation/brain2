"use client"

/**
 * Per-device session view settings in localStorage (`brain2.sessionView`): clock colour, hide finished, estimate bars.
 */
import { useState } from "react"

/** Session view settings (2026-10-22). Per device, in localStorage; the page works without it. */
interface SessionViewPrefs {
  clockColor: string
  hideDone: boolean
  showBars: boolean
}

/** Plan's opal mint (`--p-opal-mint`), soft on the dark clock glass. */
export const SESSION_CLOCK_DEFAULT = "#8cd4a5"
const SESSION_VIEW_KEY = "brain2.sessionView"
const SESSION_VIEW_DEFAULTS: SessionViewPrefs = { clockColor: SESSION_CLOCK_DEFAULT, hideDone: false, showBars: true }

function readSessionView(): SessionViewPrefs {
  try {
    const raw = JSON.parse(window.localStorage.getItem(SESSION_VIEW_KEY) ?? "{}") as Partial<SessionViewPrefs>
    return {
      clockColor: typeof raw.clockColor === "string" && /^#[0-9a-f]{6}$/i.test(raw.clockColor) ? raw.clockColor : SESSION_CLOCK_DEFAULT,
      hideDone: raw.hideDone === true,
      showBars: raw.showBars !== false,
    }
  } catch {
    return SESSION_VIEW_DEFAULTS
  }
}

function useSessionView(): [SessionViewPrefs, (patch: Partial<SessionViewPrefs>) => void] {
  const [prefs, setPrefs] = useState<SessionViewPrefs>(() => (typeof window === "undefined" ? SESSION_VIEW_DEFAULTS : readSessionView()))
  const update = (patch: Partial<SessionViewPrefs>) =>
    setPrefs((old) => {
      const next = { ...old, ...patch }
      try {
        window.localStorage.setItem(SESSION_VIEW_KEY, JSON.stringify(next))
      } catch {
        // Private window or blocked storage: the change holds for this sitting.
      }
      return next
    })
  return [prefs, update]
}

export { useSessionView }
