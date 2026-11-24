/**
 * components/Bim/line-menu.tsx — Right-click (or long-press) a chat line: Reply to, Copy, Make secret
 *
 * Shared by the console and the phone log. The menu opens at the pointer over any line's background; a right-click
 * on a card, a key, a field, or over selected text keeps the browser's own menu. **Reply to** marks the line
 * (`useLineReply`); the next line you send answers it (`lib/ingest/line-reply.ts`). **Make secret** wraps the line,
 * the other side of its exchange, and the log row it was filed as in `\secret` marks (`lib/ingest/make-secret.ts`).
 */
"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type PointerEvent } from "react"
import { useBimChatStore, type BimLine } from "@/lib/ingest/bim-chat"
import { stripSecretSpans } from "@/lib/secrets"
import { quoteOf } from "@/lib/ingest/line-reply"

type Open = { x: number; y: number; line: BimLine } | null

/** Where the browser's own menu should win: inside a card, a key, a field, a fold, or with text selected. */
function keepNative(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el?.closest) return true
  if (el.closest("button, a, input, textarea, select, summary, details, [contenteditable], .report-card, .day-card, .wire-card, .habit-card, [data-card]")) return true
  const picked = typeof window !== "undefined" ? window.getSelection()?.toString() : ""
  return !!picked?.trim()
}

export function useLineMenu(onReply: (line: BimLine) => void) {
  const [open, setOpen] = useState<Open>(null)
  const press = useRef<{ timer: ReturnType<typeof setTimeout>; x: number; y: number } | null>(null)

  const onContextMenu = useCallback((event: MouseEvent, line: BimLine) => {
    if (line.waiting || keepNative(event.target)) return
    event.preventDefault()
    setOpen({ x: event.clientX, y: event.clientY, line })
  }, [])

  // Touch: hold half a second on a line (iOS fires no contextmenu).
  const onPointerDown = useCallback((event: PointerEvent, line: BimLine) => {
    if (event.pointerType !== "touch" || line.waiting || keepNative(event.target)) return
    const { clientX: x, clientY: y } = event
    press.current = { x, y, timer: setTimeout(() => setOpen({ x, y, line }), 500) }
  }, [])
  const cancelPress = useCallback((event?: PointerEvent) => {
    const p = press.current
    if (!p) return
    if (event && event.type === "pointermove" && Math.hypot(event.clientX - p.x, event.clientY - p.y) < 8) return
    clearTimeout(p.timer)
    press.current = null
  }, [])

  const menu = open ? (
    <LineMenu
      at={open}
      onClose={() => setOpen(null)}
      onReply={() => {
        onReply(open.line)
        setOpen(null)
      }}
    />
  ) : null

  return { menu, lineProps: (line: BimLine) => ({ "data-line-id": line.id, onContextMenu: (e: MouseEvent) => onContextMenu(e, line), onPointerDown: (e: PointerEvent) => onPointerDown(e, line), onPointerUp: () => cancelPress(), onPointerCancel: () => cancelPress(), onPointerMove: cancelPress }) }
}

function LineMenu({ at, onClose, onReply }: { at: NonNullable<Open>; onClose: () => void; onReply: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ref.current?.querySelector("button")?.focus()
    const away = (e: Event) => {
      if (!ref.current?.contains(e.target as Node)) onClose()
    }
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener("pointerdown", away, true)
    window.addEventListener("keydown", esc, true)
    window.addEventListener("blur", onClose)
    return () => {
      window.removeEventListener("pointerdown", away, true)
      window.removeEventListener("keydown", esc, true)
      window.removeEventListener("blur", onClose)
    }
  }, [onClose])
  // Keep it on screen.
  const x = Math.min(at.x, (typeof window !== "undefined" ? window.innerWidth : 9999) - 200)
  const y = Math.min(at.y, (typeof window !== "undefined" ? window.innerHeight : 9999) - 140)
  // Inside a transformed dialog, `fixed` is placed from the dialog, not the window: measure and shift back.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const box = el.getBoundingClientRect()
    el.style.left = `${x + (x - box.left)}px`
    el.style.top = `${y + (y - box.top)}px`
  }, [x, y])
  return (
    <div ref={ref} className="bim-line-menu" role="menu" aria-label="Line actions" style={{ left: x, top: y }}>
      <p className="bim-line-menu-quote">
        {at.line.who === "you" ? "YOU" : "BIM"} · {quoteOf(at.line.text, 48)}
      </p>
      <button data-no95 type="button" role="menuitem" onClick={onReply}>
        ↳ Reply to
      </button>
      <button
        data-no95
        type="button"
        role="menuitem"
        onClick={() => {
          void navigator.clipboard?.writeText(at.line.text).catch(() => {})
          onClose()
        }}
      >
        Copy
      </button>
      {stripSecretSpans(at.line.text).trim() ? (
        <button
          data-no95
          type="button"
          role="menuitem"
          onClick={() => {
            useBimChatStore.getState().makeSecret(at.line.id)
            onClose()
          }}
        >
          Make secret
        </button>
      ) : null}
    </div>
  )
}

/** Scroll the log to a quoted line and flash it. */
export function jumpToLine(id: string) {
  const el = document.querySelector<HTMLElement>(`[data-line-id="${CSS.escape(id)}"]`)
  if (!el) return
  el.scrollIntoView({ block: "center", behavior: "smooth" })
  el.classList.remove("is-flash")
  void el.offsetWidth
  el.classList.add("is-flash")
}
