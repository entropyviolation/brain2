import { describe, it, expect } from "vitest"
import {
  computeRms,
  detectPitch,
  computeFrameMetrics,
  requiredVoicedSecondsFor,
  relativePerturbation,
  clarityToHnr,
  terminalContourRise,
  terminalLoudnessRatio,
  scoreConfidence,
  ConfidenceTracker,
  DEFAULT_CONFIDENCE_OPTIONS,
  type AudioFrameMetrics,
  type ConfidenceMetrics,
} from "./vocal-confidence"

/** Build a sine-wave frame at a given frequency / amplitude. */
function sineFrame(freq: number, sampleRate: number, length: number, amp = 0.5): Float32Array {
  const out = new Float32Array(length)
  for (let i = 0; i < length; i++) out[i] = amp * Math.sin((2 * Math.PI * freq * i) / sampleRate)
  return out
}

describe("computeRms", () => {
  it("is zero for silence", () => {
    expect(computeRms(new Float32Array(128))).toBe(0)
  })

  it("approximates amp/sqrt(2) for a sine wave", () => {
    const rms = computeRms(sineFrame(200, 44100, 4096, 0.5))
    expect(rms).toBeGreaterThan(0.34)
    expect(rms).toBeLessThan(0.36)
  })
})

describe("detectPitch (McLeod Pitch Method)", () => {
  const sr = 44100

  it("recovers a low (male-range) fundamental", () => {
    const { pitchHz, clarity } = detectPitch(sineFrame(110, sr, 4096, 0.6), sr)
    expect(pitchHz).not.toBeNull()
    expect(pitchHz!).toBeGreaterThan(107)
    expect(pitchHz!).toBeLessThan(113)
    expect(clarity).toBeGreaterThan(0.8)
  })

  it("recovers a high (female-range) fundamental accurately", () => {
    for (const f of [180, 220, 260, 300]) {
      const { pitchHz, clarity } = detectPitch(sineFrame(f, sr, 4096, 0.5), sr)
      expect(pitchHz).not.toBeNull()
      // Within ~2% — parabolic interpolation keeps higher f0 accurate.
      expect(Math.abs(pitchHz! - f) / f).toBeLessThan(0.02)
      expect(clarity).toBeGreaterThan(0.8)
    }
  })

  it("tracks a richer (harmonic) female voice without octave-halving", () => {
    // Fundamental 240 Hz + harmonics — should report ~240, not 120.
    const length = 4096
    const buf = new Float32Array(length)
    for (let i = 0; i < length; i++) {
      const t = i / sr
      buf[i] =
        0.5 * Math.sin(2 * Math.PI * 240 * t) +
        0.3 * Math.sin(2 * Math.PI * 480 * t) +
        0.2 * Math.sin(2 * Math.PI * 720 * t)
    }
    const { pitchHz } = detectPitch(buf, sr)
    expect(pitchHz).not.toBeNull()
    expect(Math.abs(pitchHz! - 240) / 240).toBeLessThan(0.05)
  })

  it("reports low clarity for white noise", () => {
    const noise = new Float32Array(4096)
    let seed = 42
    for (let i = 0; i < noise.length; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff
      noise[i] = (seed / 0x7fffffff) * 2 - 1
    }
    const { clarity } = detectPitch(noise, sr)
    expect(clarity).toBeLessThan(0.6)
  })

  it("returns null pitch for an empty frame", () => {
    expect(detectPitch(new Float32Array(0), 44100)).toEqual({ pitchHz: null, clarity: 0 })
  })
})

describe("computeFrameMetrics", () => {
  it("marks quiet frames as unvoiced", () => {
    const quiet = sineFrame(180, 44100, 2048, 0.005)
    const m = computeFrameMetrics(quiet, 44100)
    expect(m.clarity).toBe(0)
    expect(m.pitchHz).toBeNull()
  })

  it("detects voiced frames above the silence floor", () => {
    const loud = sineFrame(180, 44100, 2048, 0.4)
    const m = computeFrameMetrics(loud, 44100)
    expect(m.rms).toBeGreaterThan(DEFAULT_CONFIDENCE_OPTIONS.silenceRms)
    expect(m.clarity).toBeGreaterThan(0.5)
    expect(m.pitchHz).not.toBeNull()
  })
})

describe("requiredVoicedSecondsFor", () => {
  it("scales with word count within bounds", () => {
    expect(requiredVoicedSecondsFor("I am")).toBeGreaterThanOrEqual(1.2)
    const long = requiredVoicedSecondsFor("a b c d e f g h i j k l m n o p q r s t")
    expect(long).toBeLessThanOrEqual(6)
    expect(requiredVoicedSecondsFor("I am calm capable and ready")).toBeGreaterThan(
      requiredVoicedSecondsFor("I am calm"),
    )
  })

  it("never drops below the floor for empty text", () => {
    expect(requiredVoicedSecondsFor("")).toBe(1.2)
  })
})

describe("relativePerturbation (jitter / shimmer proxy)", () => {
  it("is zero for a perfectly constant series", () => {
    expect(relativePerturbation([5, 5, 5, 5])).toBe(0)
  })

  it("grows with cycle-to-cycle wobble", () => {
    const steady = relativePerturbation([100, 101, 100, 99, 100])
    const shaky = relativePerturbation([100, 130, 80, 125, 85])
    expect(shaky).toBeGreaterThan(steady)
  })

  it("ignores octave jumps when a ratio guard is supplied", () => {
    // A single doubling (octave error) is skipped, so perturbation stays ~0.
    expect(relativePerturbation([150, 150, 300, 150], { low: 0.8, high: 1.25 })).toBe(0)
  })
})

describe("clarityToHnr", () => {
  it("maps higher periodicity to higher HNR", () => {
    expect(clarityToHnr(0.9)).toBeGreaterThan(clarityToHnr(0.5))
  })

  it("is finite at the extremes", () => {
    expect(Number.isFinite(clarityToHnr(0))).toBe(true)
    expect(Number.isFinite(clarityToHnr(1))).toBe(true)
  })
})

describe("terminalContourRise (uptalk detection)", () => {
  const times = Array.from({ length: 12 }, (_, i) => (i + 1) * 100)

  it("is positive for a rising terminal (uptalk)", () => {
    const f0 = [150, 150, 150, 150, 150, 150, 150, 150, 170, 185, 200, 215]
    const rise = terminalContourRise(f0, times)
    expect(rise).not.toBeNull()
    expect(rise!).toBeGreaterThan(0)
  })

  it("is negative or ~0 for a falling/level terminal", () => {
    const flat = terminalContourRise(new Array(12).fill(150), times)
    expect(flat!).toBeCloseTo(0, 5)
    const falling = [180, 180, 175, 170, 165, 160, 155, 150, 145, 140, 135, 130]
    expect(terminalContourRise(falling, times)!).toBeLessThan(0)
  })

  it("returns null without enough data", () => {
    expect(terminalContourRise([150, 150], [100, 200])).toBeNull()
  })
})

describe("terminalLoudnessRatio (trailing-off)", () => {
  const times = Array.from({ length: 12 }, (_, i) => (i + 1) * 100)

  it("is well below 1 when the voice fades/mumbles out at the end", () => {
    const trailing = [0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.12, 0.08, 0.05, 0.03]
    expect(terminalLoudnessRatio(trailing, times)!).toBeLessThan(0.6)
  })

  it("is ~1 when loudness is maintained to the end", () => {
    expect(terminalLoudnessRatio(new Array(12).fill(0.2), times)!).toBeCloseTo(1, 5)
  })

  it("does NOT flag a natural slight phrase-final taper", () => {
    // Confident delivery with a gentle taper at the very end — should read ~maintained.
    const gentle = [0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.18, 0.17, 0.16, 0.15]
    expect(terminalLoudnessRatio(gentle, times)!).toBeGreaterThan(0.8)
  })
})

describe("scoreConfidence", () => {
  const baseMetrics = (over: Partial<ConfidenceMetrics> = {}): ConfidenceMetrics => ({
    totalSeconds: 3,
    voicedSeconds: 2.5,
    voicedRatio: 0.83,
    loudness: 0.12,
    loudnessStability: 0.9,
    pitchStability: 0.9,
    clarity: 0.8,
    intonation: 0.95,
    projection: 0.95,
    onsetDelaySeconds: 0.2,
    pauseRatio: 0.05,
    ...over,
  })

  it("flags a loud, steady, projected, fluent, fully-voiced delivery as confident", () => {
    const s = scoreConfidence(baseMetrics(), { ...DEFAULT_CONFIDENCE_OPTIONS, requiredVoicedSeconds: 1.6 })
    expect(s.confident).toBe(true)
    expect(s.score).toBeGreaterThan(0.78)
    expect(s.components.sustain).toBe(1)
  })

  it("is never confident on silence", () => {
    const s = scoreConfidence(
      baseMetrics({
        voicedSeconds: 0,
        loudness: 0,
        loudnessStability: 0,
        pitchStability: 0,
        clarity: 0,
        intonation: null,
        projection: null,
        onsetDelaySeconds: 3,
        pauseRatio: 1,
      }),
    )
    expect(s.confident).toBe(false)
  })

  it("withholds confidence when too short (sustain gate)", () => {
    const s = scoreConfidence(baseMetrics({ voicedSeconds: 0.5 }), {
      ...DEFAULT_CONFIDENCE_OPTIONS,
      requiredVoicedSeconds: 3,
    })
    expect(s.components.sustain).toBeLessThan(1)
    expect(s.confident).toBe(false)
  })

  it("withholds confidence when too quiet (volume gate)", () => {
    const s = scoreConfidence(baseMetrics({ loudness: 0.02 }))
    expect(s.components.volume).toBeLessThan(DEFAULT_CONFIDENCE_OPTIONS.minVolume)
    expect(s.confident).toBe(false)
  })

  it("blocks a loud, steady delivery that ends in uptalk (intonation gate)", () => {
    // Everything strong except a clearly rising terminal — must NOT pass, and
    // conviction should read lower than a clean delivery (but the *gate*, not the
    // meter value, is what blocks).
    const clean = scoreConfidence(baseMetrics())
    const s = scoreConfidence(baseMetrics({ intonation: 0.2 }))
    expect(clean.confident).toBe(true)
    expect(s.confident).toBe(false)
    expect(s.components.conviction).toBeLessThan(clean.components.conviction)
  })

  it("blocks a delivery that trails off at the end (projection gate)", () => {
    const s = scoreConfidence(baseMetrics({ projection: 0.2 }))
    expect(s.confident).toBe(false)
  })

  it("blocks a hesitant delivery via the fluency gate (delayed onset + pauses)", () => {
    const s = scoreConfidence(baseMetrics({ onsetDelaySeconds: 2.5, pauseRatio: 0.6 }))
    expect(s.confident).toBe(false)
    // Conviction is still pulled down by the weak fluency cue.
    expect(s.components.conviction).toBeLessThan(scoreConfidence(baseMetrics()).components.conviction)
  })

  it("keeps conviction HIGH for a confident delivery with a natural taper", () => {
    // Regression: a falling ending with a gentle phrase-final loudness taper
    // (projection ~0.85) must not tank conviction the way the old min-blend did.
    const s = scoreConfidence(baseMetrics({ intonation: 1, projection: 0.85 }))
    expect(s.components.conviction).toBeGreaterThan(0.85)
    expect(s.confident).toBe(true)
  })

  it("penalizes uptalk via conviction relative to a falling ending", () => {
    const confidentEnding = scoreConfidence(baseMetrics({ intonation: 1 }))
    const uptalk = scoreConfidence(baseMetrics({ intonation: 0.1 }))
    expect(uptalk.components.conviction).toBeLessThan(confidentEnding.components.conviction)
    expect(uptalk.score).toBeLessThan(confidentEnding.score)
  })

  it("falls back to amplitude + clarity steadiness only when pitch is untracked (null)", () => {
    const s = scoreConfidence(baseMetrics({ pitchStability: null, loudnessStability: 0.8, clarity: 0.6 }))
    expect(s.components.steadiness).toBeCloseTo(0.7, 5)
  })

  it("penalizes (does not ignore) a tracked-but-very-shaky pitch", () => {
    const steady = scoreConfidence(baseMetrics({ pitchStability: 0.9 }))
    const shaky = scoreConfidence(baseMetrics({ pitchStability: 0 }))
    expect(shaky.components.steadiness).toBeLessThan(steady.components.steadiness)
  })
})

describe("ConfidenceTracker", () => {
  const voiced: AudioFrameMetrics = { rms: 0.12, pitchHz: 150, clarity: 0.85 }
  const silent: AudioFrameMetrics = { rms: 0.001, pitchHz: null, clarity: 0 }

  it("accumulates voiced time and reaches confidence after steady, prompt speech", () => {
    const t = new ConfidenceTracker({ requiredVoicedSeconds: 1.6 })
    for (let i = 0; i < 40; i++) t.pushFrame(voiced, 50) // 2.0s voiced, immediate onset
    const score = t.getScore()
    expect(t.getMetrics().voicedSeconds).toBeCloseTo(2.0, 5)
    expect(score.confident).toBe(true)
  })

  it("ignores silent frames for voiced time but counts total", () => {
    const t = new ConfidenceTracker()
    for (let i = 0; i < 20; i++) t.pushFrame(silent, 50)
    const m = t.getMetrics()
    expect(m.totalSeconds).toBeCloseTo(1.0, 5)
    expect(m.voicedSeconds).toBe(0)
    expect(t.getScore().confident).toBe(false)
  })

  it("tracks onset latency from leading silence", () => {
    const t = new ConfidenceTracker()
    for (let i = 0; i < 10; i++) t.pushFrame(silent, 50) // 0.5s of hesitation
    for (let i = 0; i < 30; i++) t.pushFrame(voiced, 50)
    expect(t.getMetrics().onsetDelaySeconds).toBeCloseTo(0.55, 2)
  })

  it("measures internal pauses as halting delivery", () => {
    const t = new ConfidenceTracker()
    for (let i = 0; i < 10; i++) t.pushFrame(voiced, 50)
    for (let i = 0; i < 10; i++) t.pushFrame(silent, 50) // gap in the middle
    for (let i = 0; i < 10; i++) t.pushFrame(voiced, 50)
    expect(t.getMetrics().pauseRatio).toBeGreaterThan(0.3)
  })

  it("penalizes shaky (high cycle-to-cycle tremor) with lower steadiness", () => {
    const steady = new ConfidenceTracker()
    const shaky = new ConfidenceTracker()
    for (let i = 0; i < 40; i++) {
      steady.pushFrame({ rms: 0.12, pitchHz: 150, clarity: 0.85 }, 50)
      const wobbleRms = i % 2 === 0 ? 0.06 : 0.18
      const wobbleF0 = i % 2 === 0 ? 140 : 162 // ~15% step, within octave guard
      shaky.pushFrame({ rms: wobbleRms, pitchHz: wobbleF0, clarity: 0.85 }, 50)
    }
    expect(steady.getMetrics().loudnessStability).toBeGreaterThan(
      shaky.getMetrics().loudnessStability,
    )
    expect(steady.getMetrics().pitchStability!).toBeGreaterThan(shaky.getMetrics().pitchStability!)
    expect(steady.getScore().components.steadiness).toBeGreaterThan(
      shaky.getScore().components.steadiness,
    )
  })

  it("detects a rising terminal contour (uptalk) over the utterance", () => {
    const t = new ConfidenceTracker()
    for (let i = 0; i < 30; i++) t.pushFrame({ rms: 0.12, pitchHz: 150, clarity: 0.85 }, 50)
    for (let i = 0; i < 15; i++) t.pushFrame({ rms: 0.12, pitchHz: 200, clarity: 0.85 }, 50)
    const intonation = t.getMetrics().intonation
    expect(intonation).not.toBeNull()
    expect(intonation!).toBeLessThan(1)
  })

  it("reset clears accumulated state", () => {
    const t = new ConfidenceTracker()
    for (let i = 0; i < 10; i++) t.pushFrame(voiced, 50)
    t.reset()
    const m = t.getMetrics()
    expect(m.totalSeconds).toBe(0)
    expect(m.voicedSeconds).toBe(0)
    expect(m.loudness).toBe(0)
    expect(m.onsetDelaySeconds).toBe(0)
  })

  it("respects an updated required voiced duration", () => {
    const t = new ConfidenceTracker({ requiredVoicedSeconds: 1.0 })
    for (let i = 0; i < 24; i++) t.pushFrame(voiced, 50) // 1.2s
    expect(t.getScore().components.sustain).toBe(1)
    t.setRequiredVoicedSeconds(5)
    expect(t.getScore().components.sustain).toBeLessThan(1)
  })
})
