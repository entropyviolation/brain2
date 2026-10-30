/**
 * One microphone for the whole app.
 *
 * Asked as soon as the page can, and again on each gesture until the stream
 * is open. A refusal during a gesture stops the retries for this page load;
 * the next launch asks again. The stream stays for the life of the page.
 * Samples are read for loudness and then discarded. Nothing is stored or sent.
 *
 * iOS shows the microphone indicator while this stream is open, and will not
 * show the permission sheet until a gesture. `NSMicrophoneUsageDescription`
 * in `ios/App/App/Info.plist` is what lets that sheet appear.
 */

import { computeRms } from "@/lib/vocal-confidence"

type AudioCtor = typeof AudioContext

let stream: MediaStream | null = null
let ctx: AudioContext | null = null
let level = 0
let denied = false
let asking: Promise<MediaStream | null> | null = null
let askingFromGesture = false
let meter = 0
let holders = 0
let detach: (() => void) | null = null

export function micLevel(): number {
  return level
}

export function liveAudioContext(): AudioContext | null {
  return ctx
}

export function liveMicStream(): MediaStream | null {
  return stream
}

export function micWasDenied(): boolean {
  return denied
}

function audioCtor(): AudioCtor | null {
  if (typeof window === "undefined") return null
  return window.AudioContext || (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext || null
}

function supported(): boolean {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && !!audioCtor()
}

function isDeny(err: unknown): boolean {
  const name = (err as { name?: string })?.name
  return name === "NotAllowedError" || name === "SecurityError"
}

function startMeter(media: MediaStream, context: AudioContext) {
  if (meter) return
  const source = context.createMediaStreamSource(media)
  const analyser = context.createAnalyser()
  analyser.fftSize = 1024
  source.connect(analyser)
  const samples = new Float32Array(analyser.fftSize)
  const tick = () => {
    analyser.getFloatTimeDomainData(samples)
    level = computeRms(samples)
    meter = requestAnimationFrame(tick)
  }
  meter = requestAnimationFrame(tick)
}

function adopt(next: MediaStream, context: AudioContext): MediaStream {
  if (stream) {
    next.getTracks().forEach((track) => track.stop())
    if (context !== ctx) void context.close().catch(() => {})
    return stream
  }
  stream = next
  ctx = context
  denied = false
  for (const track of next.getTracks()) {
    track.onended = () => {
      if (stream !== next) return
      stream = null
      level = 0
      if (meter) cancelAnimationFrame(meter)
      meter = 0
      void ensureLiveMic(false)
    }
  }
  void context.resume().catch(() => {})
  startMeter(next, context)
  return stream
}

function callGetUserMedia(fromGesture: boolean): Promise<MediaStream | null> {
  const Ctor = audioCtor()
  if (!Ctor || !supported()) return Promise.resolve(null)
  if (fromGesture) void ctx?.resume().catch(() => {})
  const open = (audio: boolean | MediaTrackConstraints) => navigator.mediaDevices.getUserMedia({ audio })
  return open({
    echoCancellation: { ideal: false },
    noiseSuppression: { ideal: false },
    autoGainControl: { ideal: false },
  })
    .catch((err: unknown) => {
      if ((err as { name?: string })?.name === "OverconstrainedError") return open(true)
      throw err
    })
    .then((next) => {
      const context = ctx && ctx.state !== "closed" ? ctx : new Ctor()
      return adopt(next, context)
    })
    .catch((err: unknown) => {
      if (fromGesture && isDeny(err)) denied = true
      return null
    })
}

/**
 * Open the microphone if it is not already open.
 * A gesture call invokes `getUserMedia` on this turn, which is what iOS requires
 * before it will show the permission sheet.
 */
export function ensureLiveMic(fromGesture = false): Promise<MediaStream | null> {
  if (stream) {
    if (fromGesture) void ctx?.resume().catch(() => {})
    return Promise.resolve(stream)
  }
  if (denied || !supported()) return Promise.resolve(null)
  if (asking && (!fromGesture || askingFromGesture)) return asking
  askingFromGesture = fromGesture
  const pending = callGetUserMedia(fromGesture).finally(() => {
    if (asking === pending) {
      asking = null
      askingFromGesture = false
    }
  })
  asking = pending
  return pending
}

/** Ask now, and on every pointer or key until the stream is open. */
export function holdMicrophone(): () => void {
  if (typeof window === "undefined") return () => {}
  holders += 1
  if (holders === 1) {
    void ensureLiveMic(false)
    const onGesture = () => {
      void ensureLiveMic(true)
    }
    const onVisible = () => {
      if (document.visibilityState !== "visible") return
      void ctx?.resume().catch(() => {})
      void ensureLiveMic(false)
    }
    window.addEventListener("pointerdown", onGesture, true)
    window.addEventListener("keydown", onGesture, true)
    document.addEventListener("visibilitychange", onVisible)
    detach = () => {
      window.removeEventListener("pointerdown", onGesture, true)
      window.removeEventListener("keydown", onGesture, true)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }
  return () => {
    holders = Math.max(0, holders - 1)
    if (holders === 0 && detach) {
      detach()
      detach = null
    }
  }
}
