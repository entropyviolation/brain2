/**
 * components/BabyGame/shake.ts — screen shake and hit-stop, in whole pixels
 *
 * `kick` starts a shake: an optional hit-stop (the clock freezes for two frames), then a jitter that decays from `amp`
 * pixels to nothing over a quarter second, stepped at 30 Hz so it reads as pixel art and not a blur. The lab at
 * `/lab/baby-fx` has the drafts this came from (draft C, with draft A's decay).
 */

const LIFE = 0.27
const hash = (a: number, b: number) => {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches

export class Shake {
  private t0 = -10
  private amp = 0
  private stopUntil = -10

  /** Start a shake at `now` seconds. `stop` is the hit-stop in seconds (0 for none). */
  kick(now: number, amp = 2, stop = 0) {
    if (reducedMotion()) return
    this.t0 = now + stop
    this.amp = amp
    this.stopUntil = now + stop
  }

  /** True while the hit-stop holds the action still. */
  frozen(now: number): boolean {
    return now < this.stopUntil
  }

  /** The pixel offset to draw with at `now`. */
  offset(now: number): { x: number; y: number } {
    const age = (now - this.t0) / LIFE
    if (age < 0 || age >= 1) return { x: 0, y: 0 }
    const a = Math.round(this.amp * (1 - age))
    if (a === 0) return { x: 0, y: 0 }
    const step = Math.floor((now - this.t0) * 30)
    return { x: Math.round((hash(step, 1) - 0.5) * 2 * a), y: Math.round((hash(step, 2) - 0.5) * 2 * a) }
  }
}
