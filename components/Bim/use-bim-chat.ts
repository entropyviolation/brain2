/**
 * components/Bim/use-bim-chat.ts — shared draft + scroll for both BIM screens
 *
 * The phone terminal and the desktop console read one transcript
 * (`useBimChatStore`) and send through one executor path. This hook holds the
 * draft, keeps the log pinned to the newest line, and sends Enter / Send.
 */
"use client"

import { useEffect, useRef, useState, type KeyboardEvent } from "react"
import { useBimChatStore } from "@/lib/ingest/bim-chat"

export function useBimChat() {
  const lines = useBimChatStore((s) => s.lines)
  const busy = useBimChatStore((s) => s.busy)
  const send = useBimChatStore((s) => s.send)
  const clear = useBimChatStore((s) => s.clear)
  const [draft, setDraft] = useState("")
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const log = logRef.current
    if (log) log.scrollTop = log.scrollHeight
  }, [lines.length, busy])

  const submit = (text = draft) => {
    if (!text.trim() || busy) return
    void send(text)
    if (text === draft) setDraft("")
  }

  /** Enter sends; Shift+Enter keeps a new line for bulk dumps. */
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      submit()
    }
  }

  return { lines, busy, draft, setDraft, submit, onKeyDown, clear, logRef }
}

/** Last BIM line, when it still carries tap answers. */
export function openChoices(lines: ReturnType<typeof useBimChatStore.getState>["lines"]) {
  const last = lines[lines.length - 1]
  return last?.who === "bim" && last.choices?.length ? last.choices : []
}

export const BIM_QUICK = ["info", "groc", "today", "status", "inbox", "habits", "gm", "undo"] as const
