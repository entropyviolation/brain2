/**
 * A breath into the microphone, as a loudness gate.
 * On iOS the sand close waits for this. The puff has to be loud and held;
 * room noise and ordinary speech stay under the gate. A short quiet gap
 * in the middle of a real breath does not throw the hold away.
 */

export type BlowEar = {
  floor: number
  loudMs: number
  quietMs: number
  blown: boolean
}

/** Absolute RMS a puff must clear, even when the room has been very quiet. */
export const BLOW_ABS = 0.34
/** How far above the recent quiet level a puff must sit. */
export const BLOW_RATIO = 4.5
/** How long the puff has to last. */
export const BLOW_HOLD_MS = 340
/** Quiet this brief is still the same breath. */
export const BLOW_QUIET_GRACE_MS = 80

export function createBlowEar(): BlowEar {
  return { floor: 0.02, loudMs: 0, quietMs: 0, blown: false }
}

/**
 * True on the iPhone app (and iPhone Safari). Desktop, Electron, and tests stay false,
 * so the breath does not change the sand close there.
 */
export function sandHearsBreath(): boolean {
  if (typeof window === "undefined") return false
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : ""
  if (/Electron/i.test(ua)) return false
  const protocol = window.location?.protocol ?? ""
  if (protocol === "capacitor:" || protocol === "ionic:") return true
  const cap = (window as { Capacitor?: { getPlatform?: () => string } }).Capacitor
  if (typeof cap?.getPlatform === "function" && cap.getPlatform() === "ios") return true
  return /iPhone|iPad|iPod/i.test(ua)
}

/**
 * Feed one loudness sample. Returns true on the frame the breath is recognized.
 * Later frames stay false so the dune is blown once.
 */
export function hearBlow(ear: BlowEar, rms: number, dtMs: number): boolean {
  if (ear.blown || dtMs <= 0 || !Number.isFinite(rms)) return false
  const gate = Math.max(BLOW_ABS, ear.floor * BLOW_RATIO)
  if (rms >= gate) {
    ear.quietMs = 0
    ear.loudMs += dtMs
    if (ear.loudMs >= BLOW_HOLD_MS) {
      ear.blown = true
      return true
    }
    return false
  }
  ear.quietMs += dtMs
  if (ear.quietMs >= BLOW_QUIET_GRACE_MS) ear.loudMs = 0
  if (rms < gate * 0.45) ear.floor = ear.floor * 0.85 + rms * 0.15
  return false
}
