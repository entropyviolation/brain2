/**
 * lib/desktop-dictation.ts — Dictation in the Electron app
 *
 * Web Speech does not work inside Electron, so this records the mic with
 * `MediaRecorder` and hands the audio to `window.desktop.transcribeAudio`
 * (`electron/dictate.js`: ffmpeg + local Whisper). Press once to listen, again
 * to stop; the words come back after Whisper runs (a few seconds on `base`).
 * Absent outside the desktop app: `canDictate` is false and the key is hidden.
 */
"use client"

import { useCallback, useEffect, useRef, useState } from "react"

type TranscribeResult = { ok: true; text: string } | { ok: false; error: string }
type DesktopDictateBridge = { transcribeAudio?: (bytes: ArrayBuffer, mime: string) => Promise<TranscribeResult> }

function bridge(): DesktopDictateBridge | null {
  if (typeof window === "undefined") return null
  return ((window as unknown as { desktop?: DesktopDictateBridge }).desktop ?? null)
}

export function isDesktopDictationAvailable(): boolean {
  return typeof bridge()?.transcribeAudio === "function" && typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia
}

export type DictateState = "idle" | "listening" | "transcribing"

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
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.current = media
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : ""
      const rec = new MediaRecorder(media, mime ? { mimeType: mime } : undefined)
      const chunks: Blob[] = []
      rec.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data)
      }
      rec.onstop = async () => {
        const type = rec.mimeType || "audio/webm"
        release()
        setState("transcribing")
        try {
          const blob = new Blob(chunks, { type })
          const result = await bridge()!.transcribeAudio!(await blob.arrayBuffer(), type)
          if (result.ok) {
            if (result.text) onTextRef.current(result.text)
            else setError("Heard nothing.")
          } else setError(result.error)
        } catch (err) {
          setError(err instanceof Error ? err.message : "Dictation failed.")
        } finally {
          setState("idle")
        }
      }
      recorder.current = rec
      rec.start()
      setState("listening")
    } catch (err) {
      release()
      setState("idle")
      setError(err instanceof Error && err.name === "NotAllowedError" ? "Microphone access is off for Brain2 (System Settings → Privacy → Microphone)." : "Could not start the microphone.")
    }
  }, [state])

  return { available, state, error, toggle }
}
