"use client"

/**
 * hooks/useVocalConfidence.ts — Live microphone → vocal-confidence hook
 *
 * Owns the Web Audio plumbing for the morning affirmations ritual: requests the
 * mic, streams time-domain frames through `lib/vocal-confidence`'s
 * `ConfidenceTracker`, and exposes a live `ConfidenceScore` for the UI.
 *
 * All scoring/DSP lives in the pure `lib/vocal-confidence` module (unit-tested);
 * this hook is just the browser glue (getUserMedia + AnalyserNode + rAF loop)
 * and React state, so it can't be exercised in jsdom but stays thin.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import {
  ConfidenceTracker,
  computeFrameMetrics,
  DEFAULT_CONFIDENCE_OPTIONS,
  ANALYSIS_INTERVAL_MS,
  type ConfidenceScore,
  type ConfidenceOptions,
} from "@/lib/vocal-confidence"

export type VocalStatus = "idle" | "requesting" | "listening" | "denied" | "unsupported" | "error"

const EMPTY_SCORE: ConfidenceScore = {
  score: 0,
  components: { volume: 0, steadiness: 0, conviction: 0, sustain: 0 },
  confident: false,
}

// Throttle UI updates so we re-render ~15×/s instead of every animation frame.
const UI_UPDATE_INTERVAL_MS = 66

export interface UseVocalConfidence {
  status: VocalStatus
  score: ConfidenceScore
  error: string | null
  /** Open the mic (if needed) and begin a fresh attempt for `requiredVoicedSeconds`. */
  start: (requiredVoicedSeconds: number) => Promise<void>
  /** Begin the next attempt without re-opening the mic. */
  reset: (requiredVoicedSeconds: number) => void
  /** Release the mic and stop analysis. */
  stop: () => void
}

export function useVocalConfidence(
  options: Partial<ConfidenceOptions> = {},
): UseVocalConfidence {
  const [status, setStatus] = useState<VocalStatus>("idle")
  const [score, setScore] = useState<ConfidenceScore>(EMPTY_SCORE)
  const [error, setError] = useState<string | null>(null)

  const streamRef = useRef<MediaStream | null>(null)
  const ctxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const bufferRef = useRef<Float32Array | null>(null)
  const trackerRef = useRef<ConfidenceTracker | null>(null)
  // Full, merged options used for per-frame DSP (kept consistent with the tracker).
  const frameOptsRef = useRef<ConfidenceOptions>(DEFAULT_CONFIDENCE_OPTIONS)
  const rafRef = useRef<number | null>(null)
  const lastFrameTsRef = useRef<number>(0)
  const lastUiTsRef = useRef<number>(0)
  // Keep options stable across renders without re-subscribing the loop.
  const optionsRef = useRef(options)
  optionsRef.current = options

  const teardown = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (ctxRef.current && ctxRef.current.state !== "closed") {
      void ctxRef.current.close().catch(() => {})
    }
    ctxRef.current = null
    analyserRef.current = null
    bufferRef.current = null
  }, [])

  const loop = useCallback(() => {
    const analyser = analyserRef.current
    const ctx = ctxRef.current
    const tracker = trackerRef.current
    const buffer = bufferRef.current
    if (!analyser || !ctx || !tracker || !buffer) {
      rafRef.current = requestAnimationFrame(loop)
      return
    }

    const now = performance.now()
    // Decimate analysis to ANALYSIS_INTERVAL_MS so successive windows are
    // decorrelated (real tremor) and pitch DSP stays cheap.
    if (lastFrameTsRef.current === 0) {
      lastFrameTsRef.current = now
      rafRef.current = requestAnimationFrame(loop)
      return
    }
    const dt = now - lastFrameTsRef.current
    if (dt < ANALYSIS_INTERVAL_MS) {
      rafRef.current = requestAnimationFrame(loop)
      return
    }
    lastFrameTsRef.current = now

    analyser.getFloatTimeDomainData(buffer)
    const metrics = computeFrameMetrics(buffer, ctx.sampleRate, frameOptsRef.current)
    tracker.pushFrame(metrics, dt)

    if (now - lastUiTsRef.current >= UI_UPDATE_INTERVAL_MS) {
      lastUiTsRef.current = now
      setScore(tracker.getScore())
    }

    rafRef.current = requestAnimationFrame(loop)
  }, [])

  const start = useCallback(
    async (requiredVoicedSeconds: number) => {
      setError(null)
      const AudioCtx =
        typeof window !== "undefined"
          ? window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
          : undefined
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia || !AudioCtx) {
        setStatus("unsupported")
        setError("Microphone or audio analysis isn't supported in this environment.")
        return
      }

      // Already listening — just begin a fresh attempt.
      if (streamRef.current && trackerRef.current) {
        reset(requiredVoicedSeconds)
        return
      }

      setStatus("requesting")
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        streamRef.current = stream
        const ctx = new AudioCtx()
        ctxRef.current = ctx
        const source = ctx.createMediaStreamSource(stream)
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 2048
        source.connect(analyser)
        analyserRef.current = analyser
        bufferRef.current = new Float32Array(analyser.fftSize)

        const mergedOpts: ConfidenceOptions = {
          ...DEFAULT_CONFIDENCE_OPTIONS,
          ...optionsRef.current,
          requiredVoicedSeconds,
        }
        frameOptsRef.current = mergedOpts
        const tracker = new ConfidenceTracker(mergedOpts)
        trackerRef.current = tracker

        setScore(EMPTY_SCORE)
        setStatus("listening")
        lastFrameTsRef.current = 0
        lastUiTsRef.current = 0
        rafRef.current = requestAnimationFrame(loop)
      } catch (err) {
        teardown()
        const name = (err as { name?: string })?.name
        if (name === "NotAllowedError" || name === "SecurityError") {
          setStatus("denied")
          setError("Microphone permission was denied. Enable it to use affirmations.")
        } else {
          setStatus("error")
          setError("Could not start the microphone. Please try again.")
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loop, teardown],
  )

  const reset = useCallback((requiredVoicedSeconds: number) => {
    const tracker = trackerRef.current
    if (!tracker) return
    tracker.reset()
    tracker.setRequiredVoicedSeconds(requiredVoicedSeconds)
    setScore(EMPTY_SCORE)
  }, [])

  const stop = useCallback(() => {
    teardown()
    trackerRef.current = null
    setScore(EMPTY_SCORE)
    setStatus("idle")
  }, [teardown])

  // Release the mic if the consumer unmounts mid-session.
  useEffect(() => () => teardown(), [teardown])

  return { status, score, error, start, reset, stop }
}
