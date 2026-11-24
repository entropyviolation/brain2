/**
 * lib/key-foley.ts — The BIM console's key sound
 *
 * A lubed tactile switch, made in Web Audio with no files: on press a soft low "thock" (a sine falling
 * 170 → 85 Hz) under a short band-passed noise tick; on release a quieter, higher tick. Each press varies its
 * pitch a few percent so a run of keys does not sound like a loop. The slide switch plays a two-part clack.
 *
 * Off by the speaker key on the console (`brain2-key-foley` = "off" in `localStorage`, per device).
 * The context is made on the first press, inside the gesture, so the browser allows it.
 */
"use client"

import { useSyncExternalStore } from "react"

const KEY = "brain2-key-foley"
let ctx: AudioContext | null = null
let noise: AudioBuffer | null = null
const listeners = new Set<() => void>()
const playing = new Set<() => void>()

function readOn(): boolean {
  try {
    return localStorage.getItem(KEY) !== "off"
  } catch {
    return true
  }
}

let on = typeof window === "undefined" ? true : readOn()

export function foleyOn(): boolean {
  return on
}

export function setFoley(next: boolean): void {
  on = next
  try {
    if (next) localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, "off")
  } catch {}
  for (const fn of listeners) fn()
  if (next) keyDown(1.1)
}

/** React: the current on/off. */
export function useFoley(): boolean {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn)
      return () => void listeners.delete(fn)
    },
    () => on,
    () => true,
  )
}

/** Hear each sound as it plays (the speaker grille glows). */
export function onFoleyPlay(fn: () => void): () => void {
  playing.add(fn)
  return () => void playing.delete(fn)
}

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AC) return null
      ctx = new AC()
    }
    if (ctx.state === "suspended") void ctx.resume()
    if (!noise) {
      noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.05), ctx.sampleRate)
      const data = noise.getChannelData(0)
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 2
    }
    return ctx
  } catch {
    return null
  }
}

const jitter = (n: number) => n * (0.96 + Math.random() * 0.08)

function tick(ac: AudioContext, at: number, freq: number, q: number, gain: number, len: number): void {
  const src = ac.createBufferSource()
  src.buffer = noise
  const band = ac.createBiquadFilter()
  band.type = "bandpass"
  band.frequency.value = jitter(freq)
  band.Q.value = q
  const g = ac.createGain()
  g.gain.setValueAtTime(gain, at)
  g.gain.exponentialRampToValueAtTime(0.0001, at + len)
  src.connect(band).connect(g).connect(ac.destination)
  src.start(at)
  src.stop(at + len + 0.01)
}

function thock(ac: AudioContext, at: number, from: number, to: number, gain: number, len: number): void {
  const osc = ac.createOscillator()
  osc.type = "sine"
  osc.frequency.setValueAtTime(jitter(from), at)
  osc.frequency.exponentialRampToValueAtTime(to, at + len)
  const g = ac.createGain()
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(gain, at + 0.004)
  g.gain.exponentialRampToValueAtTime(0.0001, at + len)
  // A low-pass keeps the body round: no click from the sine's start.
  const lp = ac.createBiquadFilter()
  lp.type = "lowpass"
  lp.frequency.value = 900
  osc.connect(lp).connect(g).connect(ac.destination)
  osc.start(at)
  osc.stop(at + len + 0.01)
}

function told(): void {
  for (const fn of playing)
    try {
      fn()
    } catch {}
}

/** Key pressed: the thock and its tick. `weight` above 1 is a heavier key (SEND, the slide switch). */
export function keyDown(weight = 1): void {
  if (!on) return
  const ac = audio()
  if (!ac) return
  const t = ac.currentTime + 0.002
  thock(ac, t, 170 / weight, 85 / weight, 0.16 * weight, 0.055)
  tick(ac, t, 2600, 1.4, 0.05, 0.012)
  told()
}

/** Key let go: a lighter, higher tick. */
export function keyUp(): void {
  if (!on) return
  const ac = audio()
  if (!ac) return
  tick(ac, ac.currentTime + 0.002, 3800, 2, 0.022, 0.01)
}

/** The slide switch: a clack, then the knob landing. */
export function switchClack(): void {
  if (!on) return
  const ac = audio()
  if (!ac) return
  const t = ac.currentTime + 0.002
  tick(ac, t, 3200, 1.2, 0.06, 0.012)
  thock(ac, t + 0.03, 210, 95, 0.18, 0.06)
  tick(ac, t + 0.03, 1900, 1.4, 0.04, 0.014)
  told()
}
