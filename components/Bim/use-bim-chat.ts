/**
 * components/Bim/use-bim-chat.ts — shared draft + scroll for both BIM screens
 *
 * The phone terminal and the desktop console read one transcript
 * (`useBimChatStore`) and send through one executor path. This hook holds the
 * draft, keeps the log pinned to the newest line, and sends Enter / Send.
 */
"use client"

import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react"
import { useBimChatStore } from "@/lib/ingest/bim-chat"
import { useBimLlmMode } from "@/lib/ingest/bim-switchboard"
import { chatPhotoFromFile } from "@/lib/ingest/chat-photo"
import type { IncomingAttachment } from "@/lib/ingest/types"

export function useBimChat() {
  const lines = useBimChatStore((s) => s.lines)
  const busy = useBimChatStore((s) => s.busy)
  const send = useBimChatStore((s) => s.send)
  const clear = useBimChatStore((s) => s.clear)
  const llm = useBimLlmMode((s) => s.on)
  const setLlm = useBimLlmMode((s) => s.setOn)
  const [draft, setDraft] = useState("")
  const [photos, setPhotos] = useState<IncomingAttachment[]>([])
  const [photoError, setPhotoError] = useState("")
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const log = logRef.current
    if (log) log.scrollTop = log.scrollHeight
  }, [lines.length, busy])

  /** Pick or shoot photos; they wait in the compose well with the caption until sent. */
  const addPhotos = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).filter((file) => file.type.startsWith("image/") || /\.(heic|heif)$/i.test(file.name))
    event.target.value = ""
    if (!files.length) return
    try {
      const made = await Promise.all(files.map(chatPhotoFromFile))
      setPhotos((prev) => [...prev, ...made].slice(0, 10))
      setPhotoError("")
    } catch {
      setPhotoError("Could not read that photo.")
    }
  }

  const removePhoto = (index: number) => setPhotos((prev) => prev.filter((_, i) => i !== index))

  const submit = (text = draft) => {
    const own = text === draft
    const attached = own ? photos : []
    if ((!text.trim() && !attached.length) || busy) return
    void send(text, attached)
    if (own) {
      setDraft("")
      setPhotos([])
    }
  }

  /** Enter sends; Shift+Enter keeps a new line for bulk dumps. */
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      submit()
    }
  }

  return { lines, busy, draft, setDraft, submit, onKeyDown, clear, logRef, llm, setLlm, photos, addPhotos, removePhoto, photoError }
}

/** Last BIM line, when it still carries tap answers. */
export function openChoices(lines: ReturnType<typeof useBimChatStore.getState>["lines"]) {
  const last = lines[lines.length - 1]
  return last?.who === "bim" && last.choices?.length ? last.choices : []
}

export const BIM_QUICK = ["info", "groc", "today", "status", "inbox", "habits", "gm", "undo"] as const
