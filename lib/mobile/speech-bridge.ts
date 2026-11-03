/**
 * lib/mobile/speech-bridge.ts — Dictation for the keycap keyboard
 *
 * The native side is `ios/App/App/SpeechPlugin.swift` (jsName `BrainSpeech`).
 * Outside the iPhone app it falls back to the browser's Web Speech API when
 * there is one. `startDictation` calls `onWords` with everything heard so far;
 * the returned `stop` resolves the final words.
 */
import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core"

interface BrainSpeechPlugin {
  start(): Promise<void>
  stop(): Promise<{ text?: string }>
  addListener(event: "partial" | "end", fn: (data: { text?: string }) => void): Promise<PluginListenerHandle>
}

const BrainSpeech = registerPlugin<BrainSpeechPlugin>("BrainSpeech")

type WebRecognition = {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onend: (() => void) | null
  onerror: ((event: { error?: string }) => void) | null
  start(): void
  stop(): void
}

function webRecognition(): (new () => WebRecognition) | null {
  if (typeof window === "undefined") return null
  const w = window as { SpeechRecognition?: new () => WebRecognition; webkitSpeechRecognition?: new () => WebRecognition }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

function nativeSpeech(): boolean {
  return Capacitor.getPlatform() === "ios" && Capacitor.isPluginAvailable("BrainSpeech")
}

export function isDictationAvailable(): boolean {
  return nativeSpeech() || webRecognition() != null
}

export type Dictation = { stop: () => Promise<string> }

export async function startDictation(onWords: (text: string) => void, onEnd: () => void): Promise<Dictation> {
  if (nativeSpeech()) {
    const handles = await Promise.all([
      BrainSpeech.addListener("partial", (data) => onWords(data?.text ?? "")),
      BrainSpeech.addListener("end", () => {
        for (const handle of handles) void handle.remove()
        onEnd()
      }),
    ])
    try {
      await BrainSpeech.start()
    } catch (error) {
      for (const handle of handles) void handle.remove()
      throw error
    }
    return {
      stop: async () => {
        const result = await BrainSpeech.stop()
        return result?.text ?? ""
      },
    }
  }

  const Recognition = webRecognition()
  if (!Recognition) throw new Error("Dictation is not available here.")
  const rec = new Recognition()
  rec.continuous = true
  rec.interimResults = true
  rec.lang = navigator.language || "en-US"
  let heard = ""
  let settle: ((text: string) => void) | null = null
  rec.onresult = (event) => {
    heard = Array.from(event.results, (result) => result[0]?.transcript ?? "").join("")
    onWords(heard)
  }
  rec.onerror = () => rec.stop()
  rec.onend = () => {
    settle?.(heard)
    settle = null
    onEnd()
  }
  rec.start()
  return {
    stop: () =>
      new Promise<string>((resolve) => {
        settle = resolve
        rec.stop()
      }),
  }
}
