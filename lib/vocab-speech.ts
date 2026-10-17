/**
 * lib/vocab-speech.ts — Say vocab words, definitions, and examples aloud
 *
 * First choice is Google's free neural voice (the Translate read-aloud
 * endpoint, no key) played through an `<audio>` element, so the browser needs
 * no CORS. Long text goes in chunks of up to ~180 characters, cut at sentence
 * and comma breaks. Offline, or when that endpoint refuses, speech falls back
 * to the browser's own synthesis with the best installed voice: Premium,
 * Enhanced, Siri, Natural, and Google voices first, and never Apple's
 * Eloquence and novelty voices (Eddy, Flo, Grandma, Zarvox…), which are the
 * 1980s vocoder sound. After a neural failure the fallback holds for five
 * minutes before the neural voice is tried again.
 *
 * Only one utterance plays at a time; a new call stops the last one.
 */

export type SpeechLang = string

/** BCP 47 tag → Google Translate `tl` code. */
function neuralLangCode(tag: string): string {
  const lower = tag.toLowerCase()
  if (lower.startsWith("zh")) return lower.includes("tw") || lower.includes("hant") ? "zh-TW" : "zh-CN"
  return lower.split("-")[0] ?? "en"
}

const NEURAL_LIMIT = 180
const NEURAL_RETRY_MS = 5 * 60_000

/** Apple Eloquence + novelty voices: robotic on every language. */
const ROBOT_VOICES = new Set(
  [
    "albert", "bad news", "bahh", "bells", "boing", "bubbles", "cellos", "deranged", "eddy", "flo",
    "fred", "good news", "grandma", "grandpa", "hysterical", "jester", "junior", "kathy", "organ",
    "pipe organ", "ralph", "reed", "rocko", "sandy", "shelley", "superstar", "trinoids", "whisper",
    "wobble", "zarvox",
  ],
)

let neuralDownUntil = 0
let playing: { stop: () => void } | null = null

/** Split text into chunks the neural endpoint accepts, at natural breaks. */
export function speechChunks(text: string, limit = NEURAL_LIMIT): string[] {
  const clean = text.replace(/\s+/g, " ").trim()
  if (!clean) return []
  const chunks: string[] = []
  let rest = clean
  while (rest.length > limit) {
    const window = rest.slice(0, limit + 1)
    let cut = -1
    for (const marks of [/[.!?。！？]\s?/g, /[,;:、，；：]\s?/g, /\s/g]) {
      let match: RegExpExecArray | null
      let last = -1
      marks.lastIndex = 0
      while ((match = marks.exec(window))) last = match.index + match[0].length
      if (last > limit * 0.4) {
        cut = last
        break
      }
    }
    if (cut <= 0) cut = limit
    chunks.push(rest.slice(0, cut).trim())
    rest = rest.slice(cut).trim()
  }
  if (rest) chunks.push(rest)
  return chunks
}

export function neuralSpeechUrl(chunk: string, tag: string, index = 0, total = 1, slow = false): string {
  const params = new URLSearchParams({
    ie: "UTF-8",
    client: "tw-ob",
    tl: neuralLangCode(tag),
    q: chunk,
    total: String(total),
    idx: String(index),
    textlen: String(chunk.length),
  })
  if (slow) params.set("ttsspeed", "0.3")
  return `https://translate.google.com/translate_tts?${params.toString()}`
}

function voiceName(voice: SpeechSynthesisVoice): string {
  return voice.name.replace(/\s*\(.*\)\s*$/, "").trim().toLowerCase()
}

/** Score an installed voice for a language; `null` when it should never be used. */
export function scoreVoice(voice: Pick<SpeechSynthesisVoice, "name" | "lang" | "default" | "localService">, tag: string): number | null {
  const want = tag.toLowerCase()
  const have = voice.lang.toLowerCase().replace("_", "-")
  const base = want.split("-")[0]!
  if (!(have === want || have.split("-")[0] === base)) return null
  if (ROBOT_VOICES.has(voiceName(voice as SpeechSynthesisVoice))) return null
  let score = have === want ? 2 : 0
  const name = voice.name.toLowerCase()
  if (/premium/.test(name)) score += 10
  else if (/enhanced|neural|natural/.test(name)) score += 8
  else if (/siri/.test(name)) score += 7
  else if (/google|microsoft/.test(name)) score += 6
  if (voice.default) score += 1
  return score
}

export function bestVoice(voices: readonly SpeechSynthesisVoice[], tag: string): SpeechSynthesisVoice | null {
  let best: SpeechSynthesisVoice | null = null
  let bestScore = -1
  for (const voice of voices) {
    const score = scoreVoice(voice, tag)
    if (score !== null && score > bestScore) {
      best = voice
      bestScore = score
    }
  }
  return best
}

function speakWithBrowser(text: string, tag: string, rate: number): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return
  const synth = window.speechSynthesis
  const go = () => {
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = tag
    utterance.rate = rate
    const voice = bestVoice(synth.getVoices(), tag)
    if (voice) utterance.voice = voice
    synth.cancel()
    synth.speak(utterance)
  }
  // Chromium fills the voice list after the first call; wait once for it.
  if (synth.getVoices().length === 0 && "onvoiceschanged" in synth) {
    let done = false
    const once = () => {
      if (done) return
      done = true
      synth.removeEventListener?.("voiceschanged", once)
      go()
    }
    synth.addEventListener?.("voiceschanged", once)
    window.setTimeout(once, 400)
    return
  }
  go()
}

export function stopSpeaking(): void {
  playing?.stop()
  playing = null
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel()
}

/**
 * Say `text` in the language `tag` (BCP 47, e.g. `fr-FR`).
 * `rate` applies to the browser fallback; `slow` asks the neural voice to slow down.
 */
export function speak(text: string, tag: string, opts: { rate?: number; slow?: boolean } = {}): void {
  if (typeof window === "undefined") return
  stopSpeaking()
  const rate = opts.rate ?? 0.9
  const chunks = speechChunks(text)
  if (chunks.length === 0) return
  const canNeural = typeof Audio !== "undefined" && Date.now() >= neuralDownUntil && navigator.onLine !== false
  if (!canNeural) {
    speakWithBrowser(text, tag, rate)
    return
  }
  let stopped = false
  const audio = new Audio()
  audio.preload = "auto"
  const current = { stop: () => { stopped = true; audio.pause(); audio.removeAttribute("src") } }
  playing = current
  const fallBack = (index: number, network: boolean) => {
    if (stopped) return
    stopped = true
    if (network) neuralDownUntil = Date.now() + NEURAL_RETRY_MS
    if (playing === current) playing = null
    speakWithBrowser(chunks.slice(index).join(" "), tag, rate)
  }
  const playChunk = (index: number) => {
    if (stopped) return
    if (index >= chunks.length) {
      if (playing === current) playing = null
      return
    }
    audio.onended = () => playChunk(index + 1)
    audio.onerror = () => fallBack(index, true)
    audio.src = neuralSpeechUrl(chunks[index]!, tag, index, chunks.length, opts.slow)
    const started = audio.play()
    if (started && typeof started.catch === "function") {
      started.catch((error: unknown) => {
        const name = error instanceof DOMException ? error.name : ""
        if (name === "AbortError") return
        // An autoplay refusal is not the network: say it with the browser voice and keep neural on.
        fallBack(index, name !== "NotAllowedError")
      })
    }
  }
  playChunk(0)
}
