/**
 * lib/desktop-dictation.ts — Dictation in the Electron app
 *
 * Web Speech does not work inside Electron, so this records the mic with
 * `MediaRecorder` and hands the audio to `window.desktop.transcribeAudio`
 * (`electron/dictate.js`: ffmpeg + local Whisper). Press once to listen, again
 * to stop. While listening, the recording so far goes to the warm worker about
 * once a second (`window.desktop.dictatePartial`) and `live` holds the words so
 * far, so the box fills as you talk. Stop runs one last full pass and hands the
 * text to `onText`. States: `warming` (mic on, model loading), `listening`,
 * `transcribing` (last pass). Older desktop builds without `dictatePartial`
 * still work; they just show no live words.
 * Absent outside the desktop app: `available` is false and the key is hidden.
 */
"use client"

import { useCallback, useEffect, useRef, useState } from "react"

type TranscribeResult = { ok: true; text: string } | { ok: false; error: string }
type DesktopDictateBridge = {
  transcribeAudio?: (bytes: ArrayBuffer, mime: string) => Promise<TranscribeResult>
  dictatePartial?: (bytes: ArrayBuffer, mime: string) => Promise<TranscribeResult>
  dictateWarm?: () => Promise<boolean>
}

/** How often the recorder cuts a chunk; each cut can start a live pass. */
const SLICE_MS = 700

function bridge(): DesktopDictateBridge | null {
  if (typeof window === "undefined") return null
  return ((window as unknown as { desktop?: DesktopDictateBridge }).desktop ?? null)
}

export function isDesktopDictationAvailable(): boolean {
  return typeof bridge()?.transcribeAudio === "function" && typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia
}

export type DictateState = "idle" | "warming" | "listening" | "transcribing"

/** Join dictated words onto what is already typed, with one space between. */
export function appendDictated(draft: string, words: string): string {
  const said = words.trim()
  if (!said) return draft
  if (!draft.trim()) return said
  return /\s$/.test(draft) ? draft + said : `${draft} ${said}`
}

export function useDesktopDictation(onText: (text: string) => void) {
  const [available, setAvailable] = useState(false)
  const [state, setState] = useState<DictateState>("idle")
  const [error, setError] = useState<string | null>(null)
  const [live, setLive] = useState("")
  const recorder = useRef<MediaRecorder | null>(null)
  const stream = useRef<MediaStream | null>(null)
  const onTextRef = useRef(onText)
  onTextRef.current = onText

  useEffect(() => setAvailable(isDesktopDictationAvailable()), [])

  // A flag fades on its own: "Heard nothing." after 4s, other faults after 12s.
  useEffect(() => {
    if (!error) return
    const timer = setTimeout(() => setError(null), error === "Heard nothing." ? 4000 : 12000)
    return () => clearTimeout(timer)
  }, [error])

  const release = () => {
    stream.current?.getTracks().forEach((track) => track.stop())
    stream.current = null
    recorder.current = null
  }

  useEffect(() => () => {
    if (recorder.current?.state === "recording") recorder.current.stop()
    release()
  }, [])

  const toggle = useCallback(async () => {
    if (state === "transcribing") return
    if (recorder.current?.state === "recording") {
      recorder.current.stop()
      return
    }
    setError(null)
    setLive("")
    try {
      const desktop = bridge()!
      const media = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.current = media
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : ""
      const rec = new MediaRecorder(media, mime ? { mimeType: mime } : undefined)
      const chunks: Blob[] = []
      let stopped = false
      let inFlight = false
      let ready = !desktop.dictateWarm
      // One live pass at a time over everything heard so far; a pass that lands after stop is dropped.
      const livePass = async () => {
        if (!desktop.dictatePartial || inFlight || stopped || !ready || !chunks.length) return
        inFlight = true
        try {
          const type = rec.mimeType || "audio/webm"
          const result = await desktop.dictatePartial(await new Blob(chunks, { type }).arrayBuffer(), type)
          if (!stopped && result.ok && result.text) setLive(result.text)
        } catch {
          /* live text is best effort */
        } finally {
          inFlight = false
        }
      }
      rec.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data)
        void livePass()
      }
      rec.onstop = async () => {
        stopped = true
        const type = rec.mimeType || "audio/webm"
        release()
        setState("transcribing")
        try {
          const blob = new Blob(chunks, { type })
          const result = await desktop.transcribeAudio!(await blob.arrayBuffer(), type)
          if (result.ok) {
            if (result.text) onTextRef.current(result.text)
            else setError("Heard nothing.")
          } else setError(result.error)
        } catch (err) {
          setError(err instanceof Error ? err.message : "Dictation failed.")
        } finally {
          setLive("")
          setState("idle")
        }
      }
      recorder.current = rec
      rec.start(SLICE_MS)
      if (desktop.dictateWarm) {
        setState("warming")
        void desktop.dictateWarm().then(
          (ok) => {
            ready = ok
            if (!stopped) setState("listening")
          },
          () => {
            if (!stopped) setState("listening")
          },
        )
      } else setState("listening")
    } catch (err) {
      release()
      setState("idle")
      setError(err instanceof Error && err.name === "NotAllowedError" ? "Microphone access is off for Brain2 (System Settings → Privacy → Microphone)." : "Could not start the microphone.")
    }
  }, [state])

  return { available, state, error, live, toggle }
}
