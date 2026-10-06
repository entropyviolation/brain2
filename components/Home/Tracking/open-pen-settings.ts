/**
 * components/Home/Tracking/open-pen-settings.ts — Open pen settings from a color
 *
 * Double-click a pen color anywhere Tracking draws one. `PenSettingsHost`
 * (mounted once on the app page) is the dialog. Callers do not each keep a copy.
 */
export interface PenSettingsTarget {
  scopeId: string
  penId: string
}

type Listener = (target: PenSettingsTarget) => void

const listeners = new Set<Listener>()

export function openPenSettings(scopeId: string, penId: string) {
  const target = { scopeId, penId }
  listeners.forEach((listener) => listener(target))
}

export function subscribePenSettings(listener: Listener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Double-click on a pen color. Stops the click from also activating the row. */
export function penColorDoubleClick(scopeId: string, penId: string) {
  return (event: { preventDefault(): void; stopPropagation(): void }) => {
    event.preventDefault()
    event.stopPropagation()
    openPenSettings(scopeId, penId)
  }
}

export const PEN_COLOR_OPEN_TITLE = "Double-click to open pen settings"
