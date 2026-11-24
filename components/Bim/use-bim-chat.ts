/**
 * components/Bim/use-bim-chat.ts — shared draft + scroll for both BIM screens
 *
 * The phone terminal and the desktop console read one transcript
 * (`useBimChatStore`) and send through one executor path. This hook holds the
 * draft, keeps the log pinned to the newest line, and sends Enter / Send.
 */
"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react"
import { BIM_CHAT_DRAFT_KEY, readDraft, writeTextDraft } from "@/lib/draft-store"
import { BIM_CHAT_ADD_EVENT } from "@/lib/doc-selection/doc-selection-bus"
import { useBimChatStore, type BimLine } from "@/lib/ingest/bim-chat"
import { maskSecrets, useSecretsShown } from "@/lib/secrets-store"
import { useBimLlmMode } from "@/lib/ingest/bim-switchboard"
import { useReplyTarget } from "@/lib/report-bimby/reply-target"
import { useLineReply } from "@/lib/ingest/line-reply"
import { chatPhotoFromFile } from "@/lib/ingest/chat-photo"
import type { IncomingAttachment } from "@/lib/ingest/types"

/**
 * The transcript as a screen may draw it (`docs/SECRETS.md`). Locked, every `\secret` span is cut from every line,
 * card ref and choice, and a line that was all secret (yours, or BIM's answer from your secrets) is not drawn at all. Unlocked with the chat switch
 * on, the lines come back as written. The store keeps them as written either way.
 */
export function useShownLines(lines: BimLine[]): BimLine[] {
  const shown = useSecretsShown("chat")
  return useMemo(() => {
    if (shown) return lines
    const masked = maskSecrets(lines, false)
    const gone = new Set(masked.filter((l, i) => !l.text.trim() && !!lines[i]!.text.trim()).map((l) => l.id))
    // The reply to a line that was all secret ("Logged: · 10:59 AM") goes with it.
    return masked.filter((l) => !gone.has(l.id) && !(l.replyTo && gone.has(l.replyTo)))
  }, [lines, shown])
}

export function useBimChat() {
  const lines = useShownLines(useBimChatStore((s) => s.lines))
  const busy = useBimChatStore((s) => s.busy)
  const send = useBimChatStore((s) => s.send)
  const clear = useBimChatStore((s) => s.clear)
  const checkIn = useBimChatStore((s) => s.checkIn)
  const llm = useBimLlmMode((s) => s.on)
  const setLlm = useBimLlmMode((s) => s.setOn)
  const [draft, setDraftState] = useState("")
  const [photos, setPhotos] = useState<IncomingAttachment[]>([])
  const [photoError, setPhotoError] = useState("")
  const logRef = useRef<HTMLDivElement>(null)
  // The card change the next line answers (tap a change on a card). Only your typed line carries it, not a tapped answer.
  const replyTarget = useReplyTarget((s) => s.target)
  const setReplyTarget = useReplyTarget((s) => s.set)
  // The earlier chat line the next line answers (right-click → Reply to). A card change, when both are set, wins.
  const lineTarget = useLineReply((s) => s.target)
  const setLineTarget = useLineReply((s) => s.set)
  useEffect(() => {
    if (replyTarget) setLineTarget(null)
  }, [replyTarget, setLineTarget])

  // The unsent line is kept on every keystroke and comes back after a closed
  // screen or a reload. Only a send clears it. Stable, so the memoized log does not repaint per keystroke.
  const setDraft = useCallback((text: string) => {
    setDraftState(text)
    writeTextDraft(BIM_CHAT_DRAFT_KEY, text)
  }, [])
  useEffect(() => {
    const saved = readDraft<{ text?: string }>(BIM_CHAT_DRAFT_KEY)?.text
    if (saved) setDraftState((now) => now || saved)
  }, [])

  // Text sent from a Docs selection is already in the saved draft; show it.
  useEffect(() => {
    const onAdd = () => {
      const saved = readDraft<{ text?: string }>(BIM_CHAT_DRAFT_KEY)?.text
      if (saved) setDraftState(saved)
    }
    window.addEventListener(BIM_CHAT_ADD_EVENT, onAdd)
    return () => window.removeEventListener(BIM_CHAT_ADD_EVENT, onAdd)
  }, [])

  // Follow the newest line only while you are at the bottom. Scrolled up to read (or to work a card
  // while a save runs), a reply or a card repaint no longer yanks you down. Your own send always does.
  const pinned = useRef(true)
  const lastWho = lines[lines.length - 1]?.who
  useEffect(() => {
    const log = logRef.current
    if (!log) return
    if (lastWho === "you") pinned.current = true
    if (!pinned.current) return
    log.scrollTop = log.scrollHeight
    // Off-screen lines are laid out at an estimated height until seen; pin again once real heights are in.
    const frame = requestAnimationFrame(() => {
      log.scrollTop = log.scrollHeight
    })
    return () => cancelAnimationFrame(frame)
  }, [lines.length, busy, lastWho])

  // When the glass shrinks (the keyboard opens), keep the newest line in view if it was in view.
  useEffect(() => {
    const log = logRef.current
    if (!log) return
    const onScroll = () => {
      pinned.current = log.scrollHeight - log.scrollTop - log.clientHeight < 32
    }
    log.addEventListener("scroll", onScroll, { passive: true })
    if (typeof ResizeObserver === "undefined") return () => log.removeEventListener("scroll", onScroll)
    const watch = new ResizeObserver(() => {
      if (pinned.current) log.scrollTop = log.scrollHeight
    })
    watch.observe(log)
    return () => {
      log.removeEventListener("scroll", onScroll)
      watch.disconnect()
    }
  }, [])

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
    // Never waits on a running turn: the line queues and gets its own reply slot (`useBimChatStore.send`).
    if (!text.trim() && !attached.length) return
    void send(text, attached, own && replyTarget ? replyTarget : undefined, own && lineTarget ? lineTarget : undefined)
    if (own) {
      setDraft("")
      setPhotos([])
      if (replyTarget) setReplyTarget(null)
      if (lineTarget) setLineTarget(null)
    }
  }

  /** Enter sends; Shift+Enter keeps a new line for bulk dumps. */
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      submit()
    }
  }

  return { lines, busy, draft, setDraft, submit, onKeyDown, clear, checkIn, logRef, llm, setLlm, photos, addPhotos, removePhoto, photoError, replyTarget, clearReplyTarget: () => setReplyTarget(null), lineTarget, replyToLine: setLineTarget }
}

/** Last BIM line, when it still carries tap answers. */
export function openChoices(lines: ReturnType<typeof useBimChatStore.getState>["lines"]) {
  const last = lines[lines.length - 1]
  return last?.who === "bim" && last.choices?.length ? last.choices : []
}

export const BIM_QUICK = ["info", "groc", "today", "status", "inbox", "habits", "gm", "undo"] as const
