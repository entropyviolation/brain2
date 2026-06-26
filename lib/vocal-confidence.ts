/**
 * lib/vocal-confidence.ts — Vocal-confidence analysis (Morning affirmations)
 *
 * Pure, dependency-free DSP + scoring that estimates how *confidently* a spoken
 * affirmation was delivered. Runs entirely on the client (Web Audio frames in,
 * score out) with no API keys; the scoring boundary (`scoreConfidence`) is
 * deliberately swappable for a real model later.
 *
 * Feature set is grounded in the speech-prosody literature on perceived speaker
 * confidence / certainty, and chosen so it works equally for higher- and
 * lower-pitched (e.g. female and male) voices:
 *
 *   • Loudness / intensity ↑ → confident. Jiang & Pell (2014, 2017); Sabu & Rao (2020).
 *   • No trailing off — confident voices project to the end of the phrase;
 *     fading out is a strong uncertainty cue. (loudness contour)
 *   • Terminal pitch contour — falling/level = confident; rising "uptalk" =
 *     doubt/question. Ponsot et al. (2018); Pon-Barry (2008); Duchi et al. (2015).
 *   • Fluency — prompt onset, few/short internal pauses → confident; hesitation →
 *     doubt. Pon-Barry (2008); Sabu & Rao (2020).
 *   • Voice micro-stability — low cycle-to-cycle jitter (f0) & shimmer (amplitude)
 *     tremor read as assured; a shaky/wavering voice reads as nervous. This is
 *     *local* perturbation, not macro pitch range, so expressive intonation isn't
 *     penalized. Reconciles Jiang & Pell's "small f0 variance" (2014) vs "large
 *     f0 range" (2017) by separating tremor from intonation.
 *   • Voice quality (harmonics-to-noise ratio) — clear/resonant over breathy.
 *
 * Speaker independence:
 *   - Pitch is tracked with the McLeod Pitch Method (NSDF + parabolic
 *     interpolation), which is accurate and octave-error-resistant across the
 *     full speaking range (~70–500 Hz), so female f0 is tracked as reliably as
 *     male f0.
 *   - Absolute pitch *height* is never scored ("lower f0 = confident" only holds
 *     within a speaker and would bias across voices). All cues are relative /
 *     speaker-normalized.
 *
 * Accuracy notes:
 *   - Analysis is decimated to ~`ANALYSIS_INTERVAL_MS` so successive frames are
 *     decorrelated and tremor (jitter/shimmer) is actually measurable.
 *   - `confident` is gated: a delivery must be loud, steady, fluent, projected,
 *     free of uptalk, AND fully voiced. Sounding unsure on any of these blocks
 *     the "next" advance.
 */

export interface AudioFrameMetrics {
  /** Root-mean-square amplitude of the frame, ~0..1. */
  rms: number
  /** Detected fundamental frequency in Hz, or null when unvoiced. */
  pitchHz: number | null
  /** NSDF peak clarity, 0..1 (how clearly voiced the frame is). */
  clarity: number
}

export interface ConfidenceMetrics {
  totalSeconds: number
  voicedSeconds: number
  /** Voiced time as a fraction of total analyzed time, 0..1. */
  voicedRatio: number
  /** Mean RMS across voiced frames. */
  loudness: number
  /** 0..1 from shimmer (cycle-to-cycle amplitude tremor); 1 = rock steady. */
  loudnessStability: number
  /** 0..1 from jitter (cycle-to-cycle f0 tremor); 1 = rock steady. null if no pitch tracked. */
  pitchStability: number | null
  /** 0..1 voice quality from harmonics-to-noise ratio. */
  clarity: number
  /** 0..1 terminal contour: 1 = falling/level (confident), low = rising uptalk. null if indeterminate. */
  intonation: number | null
  /** 0..1 loudness projection: 1 = maintained to the end, low = trailing off. null if indeterminate. */
  projection: number | null
  /** Seconds from analysis start to first voiced frame (onset latency). */
  onsetDelaySeconds: number
  /** Internal silence as a fraction of the spoken span, 0..1. */
  pauseRatio: number
}

export interface ConfidenceComponents {
  /** Loudness / intensity gate, 0..1. */
  volume: number
  /** Voice steadiness: jitter + shimmer + voice quality, 0..1. */
  steadiness: number
  /** Delivery conviction: no-uptalk + projection (no trailing off) + fluency, 0..1. */
  conviction: number
  /** Voiced duration vs. what the affirmation needs, 0..1. */
  sustain: number
}

export interface ConfidenceScore {
  /** Overall confidence, 0..1. */
  score: number
  components: ConfidenceComponents
  /** True once the affirmation was delivered with full confidence. */
  confident: boolean
}

export interface ConfidenceWeights {
  volume: number
  steadiness: number
  conviction: number
  sustain: number
}

export interface ConfidenceOptions {
  /** Frames quieter than this RMS are treated as silence. */
  silenceRms: number
  /** Frames below this NSDF clarity are treated as unvoiced. */
  clarityThreshold: number
  /** RMS that maps to a full (1.0) volume sub-score. */
  targetLoudness: number
  /** Relative shimmer (amplitude perturbation) that maps to zero stability. */
  maxShimmer: number
  /** Relative jitter (f0 perturbation) that maps to zero stability. */
  maxJitter: number
  /** HNR (dB) at/below which voice-quality clarity scores 0. */
  minHnrDb: number
  /** HNR (dB) at/above which voice-quality clarity scores 1. */
  targetHnrDb: number
  /** Relative terminal f0 rise that maps intonation to 0 (full uptalk penalty). */
  maxTerminalRise: number
  /**
   * End-loudness ÷ median-loudness ratio at/below which projection scores 0 (a
   * real fade-out / mumbled ending). Natural phrase-final taper sits well above
   * this, so it is NOT penalized.
   */
  minLoudnessRatio: number
  /** End ÷ median loudness ratio at/above which projection scores a full 1 (no fade). */
  fullLoudnessRatio: number
  /** Onset latency (s) tolerated before fluency is penalized. */
  onsetGraceSeconds: number
  /** Onset latency (s) beyond grace that drives onset fluency to 0. */
  maxOnsetDelaySeconds: number
  /** Internal pause ratio that drives pause fluency to 0. */
  maxPauseRatio: number
  /** Voiced seconds required for full sustain (set per affirmation). */
  requiredVoicedSeconds: number
  /** Overall score needed to count as confident. */
  confidenceThreshold: number
  /** Minimum volume sub-score needed to count as confident. */
  minVolume: number
  /** Minimum steadiness sub-score needed to count as confident. */
  minSteadiness: number
  /** Minimum conviction sub-score needed to count as confident. */
  minConviction: number
  /** Minimum fluency (prompt onset, few pauses) needed to count as confident. */
  minFluency: number
  /** Minimum intonation (no-uptalk) needed to count as confident (when measured). */
  minIntonation: number
  /** Minimum projection (no trailing off) needed to count as confident (when measured). */
  minProjection: number
  /** Lowest plausible speaking pitch (Hz) for the pitch search. */
  minPitchHz: number
  /** Highest plausible speaking pitch (Hz) for the pitch search. */
  maxPitchHz: number
  /** MPM peak-pick threshold as a fraction of the strongest NSDF peak. */
  pitchPeakThreshold: number
  /** Blend weights for the four scored components (should sum to 1). */
  weights: ConfidenceWeights
}

export const DEFAULT_CONFIDENCE_OPTIONS: ConfidenceOptions = {
  silenceRms: 0.012,
  clarityThreshold: 0.6,
  targetLoudness: 0.08,
  maxShimmer: 0.7,
  maxJitter: 0.06,
  minHnrDb: 1,
  targetHnrDb: 10,
  maxTerminalRise: 0.12,
  minLoudnessRatio: 0.35,
  fullLoudnessRatio: 0.7,
  onsetGraceSeconds: 0.5,
  maxOnsetDelaySeconds: 2,
  maxPauseRatio: 0.45,
  requiredVoicedSeconds: 1.6,
  confidenceThreshold: 0.78,
  minVolume: 0.5,
  minSteadiness: 0.45,
  minConviction: 0.6,
  minFluency: 0.5,
  minIntonation: 0.5,
  minProjection: 0.5,
  minPitchHz: 70,
  maxPitchHz: 500,
  pitchPeakThreshold: 0.9,
  weights: { volume: 0.22, steadiness: 0.26, conviction: 0.32, sustain: 0.2 },
}

/**
 * Cadence at which the live audio loop should analyze a frame. Decimating to
 * ~45ms (vs every animation frame) decorrelates successive ~46ms windows so
 * jitter/shimmer reflect real tremor rather than window overlap.
 */
export const ANALYSIS_INTERVAL_MS = 45

// Cap per-affirmation series so memory stays bounded even on a stuck session.
const MAX_SERIES = 4000

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n)

/** Root-mean-square amplitude of a time-domain frame. */
export function computeRms(samples: Float32Array): number {
  if (samples.length === 0) return 0
  let sum = 0
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i]
  return Math.sqrt(sum / samples.length)
}

/**
 * Pitch detection via the McLeod Pitch Method (McLeod & Wyvill, 2005): build the
 * Normalized Square Difference Function, peak-pick the first NSDF maximum within
 * `pitchPeakThreshold` of the strongest one (octave-error resistant), and refine
 * with parabolic interpolation. Returns the pitch (Hz) and a 0..1 clarity
 * (the NSDF value at the chosen peak). Works across the full speaking range, so
 * higher (female) and lower (male) voices are tracked equally well.
 */
export function detectPitch(
  samples: Float32Array,
  sampleRate: number,
  opts: Pick<
    ConfidenceOptions,
    "minPitchHz" | "maxPitchHz" | "pitchPeakThreshold"
  > = DEFAULT_CONFIDENCE_OPTIONS,
): { pitchHz: number | null; clarity: number } {
  const n = samples.length
  if (n === 0 || sampleRate <= 0) return { pitchHz: null, clarity: 0 }

  const minLag = Math.max(2, Math.floor(sampleRate / opts.maxPitchHz))
  const maxLag = Math.min(Math.floor(n / 2), Math.floor(sampleRate / opts.minPitchHz))
  if (maxLag <= minLag + 1) return { pitchHz: null, clarity: 0 }

  // NSDF: n'(t) = 2·Σ x[i]x[i+t] / Σ (x[i]² + x[i+t]²)
  const nsdf = new Float64Array(maxLag + 2)
  for (let lag = minLag; lag <= maxLag; lag++) {
    let acf = 0
    let m = 0
    for (let i = 0; i < n - lag; i++) {
      acf += samples[i] * samples[i + lag]
      m += samples[i] * samples[i] + samples[i + lag] * samples[i + lag]
    }
    nsdf[lag] = m > 0 ? (2 * acf) / m : 0
  }

  // Key maxima = the maximum within each positive region of the NSDF.
  let keyMax = 0
  let regionMaxPos = -1
  const peaks: number[] = []
  for (let lag = minLag; lag <= maxLag; lag++) {
    const v = nsdf[lag]
    if (v > 0) {
      if (regionMaxPos < 0 || v > nsdf[regionMaxPos]) regionMaxPos = lag
    } else if (regionMaxPos >= 0) {
      peaks.push(regionMaxPos)
      if (nsdf[regionMaxPos] > keyMax) keyMax = nsdf[regionMaxPos]
      regionMaxPos = -1
    }
  }
  if (regionMaxPos >= 0) {
    peaks.push(regionMaxPos)
    if (nsdf[regionMaxPos] > keyMax) keyMax = nsdf[regionMaxPos]
  }
  if (peaks.length === 0 || keyMax <= 0) return { pitchHz: null, clarity: clamp01(keyMax) }

  // Choose the first peak within threshold of the strongest (avoids octave-low).
  const threshold = opts.pitchPeakThreshold * keyMax
  let chosen = peaks[0]
  for (const p of peaks) {
    if (nsdf[p] >= threshold) {
      chosen = p
      break
    }
  }

  // Parabolic interpolation around the chosen integer lag for sub-sample accuracy.
  let tau = chosen
  let value = nsdf[chosen]
  if (chosen > minLag && chosen < maxLag) {
    const a = nsdf[chosen - 1]
    const b = nsdf[chosen]
    const c = nsdf[chosen + 1]
    const denom = a - 2 * b + c
    if (denom !== 0) {
      const delta = (0.5 * (a - c)) / denom
      if (delta > -1 && delta < 1) {
        tau = chosen + delta
        value = b - 0.25 * (a - c) * delta
      }
    }
  }
  if (tau <= 0) return { pitchHz: null, clarity: clamp01(value) }
  return { pitchHz: sampleRate / tau, clarity: clamp01(value) }
}

/** Full per-frame analysis: loudness + pitch + voicing clarity. */
export function computeFrameMetrics(
  samples: Float32Array,
  sampleRate: number,
  opts: ConfidenceOptions = DEFAULT_CONFIDENCE_OPTIONS,
): AudioFrameMetrics {
  const rms = computeRms(samples)
  if (rms < opts.silenceRms) return { rms, pitchHz: null, clarity: 0 }
  const { pitchHz, clarity } = detectPitch(samples, sampleRate, opts)
  return { rms, pitchHz, clarity }
}

/** Words-per-text → how many voiced seconds a full delivery should take. */
export function requiredVoicedSecondsFor(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length
  // ~0.34s per word feels natural for a deliberate, spoken affirmation.
  const estimate = words * 0.34
  return Math.min(6, Math.max(1.2, estimate))
}

/**
 * Relative average perturbation: mean(|x[i] - x[i-1]|) / mean(x). Frame-level
 * proxy for jitter (f0 series) and shimmer (RMS series) — local cycle-to-cycle
 * tremor, not macro range. `ratioGuard` (pitch) skips consecutive pairs whose
 * ratio falls outside [low, high] so octave glitches / phrase boundaries don't
 * masquerade as tremor.
 */
export function relativePerturbation(
  series: number[],
  ratioGuard?: { low: number; high: number },
): number {
  if (series.length < 2) return 0
  let sum = 0
  for (const v of series) sum += v
  const mean = sum / series.length
  if (mean <= 0) return 0

  let absSum = 0
  let count = 0
  for (let i = 1; i < series.length; i++) {
    const a = series[i - 1]
    const b = series[i]
    if (ratioGuard) {
      if (a <= 0) continue
      const ratio = b / a
      if (ratio < ratioGuard.low || ratio > ratioGuard.high) continue
    }
    absSum += Math.abs(b - a)
    count++
  }
  if (count === 0) return 0
  return absSum / count / mean
}

/** Convert a normalized correlation peak (0..1) into an HNR estimate (dB). */
export function clarityToHnr(clarity: number): number {
  const r = Math.min(0.9999, Math.max(0.0001, clarity))
  return 10 * Math.log10(r / (1 - r))
}

/** Median of a numeric array (returns null when empty). */
function median(nums: number[]): number | null {
  if (nums.length === 0) return null
  const sorted = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/** Median of a values series over a [startFrac, endFrac) slice of its timeline. */
function medianOverFraction(
  values: number[],
  times: number[],
  startFrac: number,
  endFrac: number,
): number | null {
  const n = values.length
  if (n === 0 || times.length !== n) return null
  const total = times[n - 1]
  if (!total || total <= 0) return null
  const lo = total * startFrac
  const hi = total * endFrac
  const slice: number[] = []
  for (let i = 0; i < n; i++) {
    const t = times[i]
    if (t >= lo && (endFrac >= 1 ? t <= hi : t < hi)) slice.push(values[i])
  }
  return median(slice)
}

// Minimum voiced frames before terminal (contour / projection) cues are trusted.
// At ANALYSIS_INTERVAL_MS this is ~0.36s — enough that the "final third" isn't
// just one or two noisy frames.
const MIN_TERMINAL_FRAMES = 8

/**
 * Relative f0 change of the final third vs. the earlier portion of the utterance
 * (positive = rising terminal "uptalk", negative = falling). Uses medians so a
 * couple of octave glitches or boundary frames don't dominate. Null when there
 * isn't enough voiced pitch data to judge.
 */
export function terminalContourRise(f0Series: number[], timeSeries: number[]): number | null {
  if (f0Series.length < MIN_TERMINAL_FRAMES) return null
  const end = medianOverFraction(f0Series, timeSeries, 0.67, 1)
  const earlier = medianOverFraction(f0Series, timeSeries, 0, 0.67)
  const allMedian = median(f0Series)
  if (end === null || earlier === null || allMedian === null || allMedian <= 0) return null
  return (end - earlier) / allMedian
}

/**
 * Loudness projection ratio: median RMS over the final third ÷ median RMS over
 * the whole utterance. ~1 = maintained (incl. natural slight taper), well below
 * 1 = the ending fades/mumbles out (uncertainty). Using the global median as the
 * reference means a normal phrase-final taper is NOT read as trailing off. Null
 * when there isn't enough voiced data.
 */
export function terminalLoudnessRatio(rmsSeries: number[], timeSeries: number[]): number | null {
  if (rmsSeries.length < MIN_TERMINAL_FRAMES) return null
  const end = medianOverFraction(rmsSeries, timeSeries, 0.67, 1)
  const all = median(rmsSeries)
  if (end === null || all === null || all <= 0) return null
  return end / all
}

/**
 * Score confidence from accumulated metrics. Pure: same metrics → same score.
 * `confident` requires a delivery that is loud, steady, projected, free of
 * uptalk, fluent *and* fully voiced — so the UI can only advance on a genuine,
 * complete, assured delivery (an unsure delivery fails one or more gates).
 */
export function scoreConfidence(
  metrics: ConfidenceMetrics,
  opts: ConfidenceOptions = DEFAULT_CONFIDENCE_OPTIONS,
): ConfidenceScore {
  const volume = clamp01(metrics.loudness / opts.targetLoudness)

  // Voice steadiness — jitter + shimmer + voice quality. Lean on amplitude +
  // clarity only when no pitch could be tracked at all (null), so a very shaky
  // (but tracked) pitch is still penalized rather than ignored.
  const steadiness =
    metrics.pitchStability !== null
      ? clamp01(metrics.pitchStability * 0.4 + metrics.loudnessStability * 0.3 + metrics.clarity * 0.3)
      : clamp01(metrics.loudnessStability * 0.5 + metrics.clarity * 0.5)

  // Fluency — prompt onset and few internal pauses.
  const onsetScore = clamp01(
    1 - Math.max(0, metrics.onsetDelaySeconds - opts.onsetGraceSeconds) / opts.maxOnsetDelaySeconds,
  )
  const pauseScore = clamp01(1 - metrics.pauseRatio / opts.maxPauseRatio)
  const fluency = clamp01(onsetScore * 0.5 + pauseScore * 0.5)

  // Conviction (the displayed meter) — how assured the delivery sounds, as a
  // weighted average of the measured cues: assertive ending (no uptalk),
  // sustained projection (no fade-out), and fluency. Intonation/fluency lead
  // because they're the most reliable; projection is supporting. This is a
  // *smooth, interpretable* value — the hard "any weak cue blocks Next" logic
  // lives in the per-cue gates below, so a normal phrase-final taper no longer
  // artificially tanks the meter (the previous min-blend over-penalized it).
  const FLUENCY_W = 0.35
  const INTONATION_W = 0.4
  const PROJECTION_W = 0.25
  let convSum = fluency * FLUENCY_W
  let convWeight = FLUENCY_W
  if (metrics.intonation !== null) {
    convSum += metrics.intonation * INTONATION_W
    convWeight += INTONATION_W
  }
  if (metrics.projection !== null) {
    convSum += metrics.projection * PROJECTION_W
    convWeight += PROJECTION_W
  }
  const conviction = clamp01(convSum / convWeight)

  const sustain = clamp01(metrics.voicedSeconds / opts.requiredVoicedSeconds)

  const w = opts.weights
  const score = clamp01(
    volume * w.volume + steadiness * w.steadiness + conviction * w.conviction + sustain * w.sustain,
  )

  // Hard gates: a single weak delivery cue (hesitation OR uptalk OR fade-out)
  // blocks "confident", independent of the smoothed conviction meter.
  const confident =
    score >= opts.confidenceThreshold &&
    sustain >= 1 &&
    volume >= opts.minVolume &&
    steadiness >= opts.minSteadiness &&
    conviction >= opts.minConviction &&
    fluency >= opts.minFluency &&
    (metrics.intonation === null || metrics.intonation >= opts.minIntonation) &&
    (metrics.projection === null || metrics.projection >= opts.minProjection)

  return { score, components: { volume, steadiness, conviction, sustain }, confident }
}

/**
 * Accumulates frame metrics for a single affirmation attempt and exposes a live
 * confidence score. Call `pushFrame` from the audio loop (ideally every
 * `ANALYSIS_INTERVAL_MS`), read `getScore` for the UI, and `reset` before the
 * next affirmation.
 */
export class ConfidenceTracker {
  private readonly opts: ConfidenceOptions
  private totalMs = 0
  private voicedMs = 0
  private firstVoicedMs = -1
  private lastVoicedMs = 0
  private rmsSeries: number[] = []
  private rmsTimeSeries: number[] = []
  private f0Series: number[] = []
  private f0TimeSeries: number[] = []
  private claritySum = 0
  private clarityCount = 0

  constructor(opts: Partial<ConfidenceOptions> = {}) {
    this.opts = { ...DEFAULT_CONFIDENCE_OPTIONS, ...opts }
  }

  /** Update the required voiced duration (per-affirmation) without losing tuning. */
  setRequiredVoicedSeconds(seconds: number): void {
    this.opts.requiredVoicedSeconds = seconds
  }

  pushFrame(metrics: AudioFrameMetrics, dtMs: number): void {
    if (dtMs <= 0) return
    this.totalMs += dtMs
    const voiced =
      metrics.rms >= this.opts.silenceRms && metrics.clarity >= this.opts.clarityThreshold
    if (!voiced) return

    if (this.firstVoicedMs < 0) this.firstVoicedMs = this.totalMs
    this.lastVoicedMs = this.totalMs
    this.voicedMs += dtMs

    if (this.rmsSeries.length < MAX_SERIES) {
      this.rmsSeries.push(metrics.rms)
      this.rmsTimeSeries.push(this.voicedMs)
      this.claritySum += metrics.clarity
      this.clarityCount++
      if (metrics.pitchHz && metrics.pitchHz > 0) {
        this.f0Series.push(metrics.pitchHz)
        this.f0TimeSeries.push(this.voicedMs)
      }
    }
  }

  getMetrics(): ConfidenceMetrics {
    const o = this.opts
    const totalSeconds = this.totalMs / 1000
    const voicedSeconds = this.voicedMs / 1000
    const voicedRatio = this.totalMs > 0 ? this.voicedMs / this.totalMs : 0

    let loudnessSum = 0
    for (const r of this.rmsSeries) loudnessSum += r
    const loudness = this.rmsSeries.length ? loudnessSum / this.rmsSeries.length : 0

    const shimmer = relativePerturbation(this.rmsSeries)
    const loudnessStability = this.rmsSeries.length >= 3 ? clamp01(1 - shimmer / o.maxShimmer) : 0

    const jitter = relativePerturbation(this.f0Series, { low: 0.8, high: 1.25 })
    const pitchStability = this.f0Series.length >= 3 ? clamp01(1 - jitter / o.maxJitter) : null

    const meanClarity = this.clarityCount ? this.claritySum / this.clarityCount : 0
    const hnr = clarityToHnr(meanClarity)
    const clarity = clamp01((hnr - o.minHnrDb) / (o.targetHnrDb - o.minHnrDb))

    const rise = terminalContourRise(this.f0Series, this.f0TimeSeries)
    const intonation = rise === null ? null : clamp01(1 - Math.max(0, rise) / o.maxTerminalRise)

    const ratio = terminalLoudnessRatio(this.rmsSeries, this.rmsTimeSeries)
    const projection =
      ratio === null
        ? null
        : clamp01((ratio - o.minLoudnessRatio) / (o.fullLoudnessRatio - o.minLoudnessRatio))

    const onsetDelaySeconds = this.firstVoicedMs >= 0 ? this.firstVoicedMs / 1000 : totalSeconds
    const spanMs = this.firstVoicedMs >= 0 ? this.lastVoicedMs - this.firstVoicedMs : 0
    const internalPauseMs = Math.max(0, spanMs - this.voicedMs)
    const pauseRatio = spanMs > 0 ? internalPauseMs / spanMs : 0

    return {
      totalSeconds,
      voicedSeconds,
      voicedRatio,
      loudness,
      loudnessStability,
      pitchStability,
      clarity,
      intonation,
      projection,
      onsetDelaySeconds,
      pauseRatio,
    }
  }

  getScore(): ConfidenceScore {
    return scoreConfidence(this.getMetrics(), this.opts)
  }

  reset(): void {
    this.totalMs = 0
    this.voicedMs = 0
    this.firstVoicedMs = -1
    this.lastVoicedMs = 0
    this.rmsSeries = []
    this.rmsTimeSeries = []
    this.f0Series = []
    this.f0TimeSeries = []
    this.claritySum = 0
    this.clarityCount = 0
  }
}
