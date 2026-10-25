/**
 * components/ui/isolated-text-field.tsx — Text inputs that do not re-render
 * their parent on every keystroke.
 *
 * Holds draft text in local state and calls `onCommit` on blur (and Enter for
 * single-line inputs). Optional `onLiveChange` updates a parent ref without
 * setState so Save handlers can read the latest value immediately.
 */
"use client"

import { useEffect, useLayoutEffect, useRef, useState, type ComponentProps } from "react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

const TEXTAREA_SIZE_KEY = "brain2-textarea-h"
const textareaHeights = new Map<string, number>()

function readTextareaSizes(): Record<string, number> {
  try {
    const raw = sessionStorage.getItem(TEXTAREA_SIZE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== "object") return {}
    return parsed as Record<string, number>
  } catch {
    return {}
  }
}

export const textareaSizeMemory = {
  read(key: string): number | null {
    const mem = textareaHeights.get(key)
    if (typeof mem === "number") return mem
    try {
      const stored = readTextareaSizes()[key]
      if (typeof stored === "number") {
        textareaHeights.set(key, stored)
        return stored
      }
    } catch {
      return null
    }
    return null
  },
  write(key: string, height: number): void {
    if (height < 32) return
    textareaHeights.set(key, height)
    try {
      const all = readTextareaSizes()
      all[key] = height
      sessionStorage.setItem(TEXTAREA_SIZE_KEY, JSON.stringify(all))
    } catch {
      /* storage full or unavailable */
    }
  },
}

type IsolatedBase = {
  value: string
  onCommit?: (value: string) => void
  /** Fires on every keystroke. Keep this cheap (ref writes only). */
  onLiveChange?: (value: string) => void
}

export function IsolatedInput({
  value,
  onCommit,
  onLiveChange,
  ...props
}: IsolatedBase & Omit<ComponentProps<typeof Input>, "value" | "onChange">) {
  const [text, setText] = useState(value ?? "")
  const focused = useRef(false)
  const textRef = useRef(text)
  textRef.current = text

  useEffect(() => {
    if (!focused.current) setText(value ?? "")
  }, [value])

  const commit = () => {
    const next = textRef.current
    if (next !== (value ?? "")) onCommit?.(next)
  }

  return (
    <Input
      {...props}
      value={text}
      onFocus={(e) => {
        focused.current = true
        props.onFocus?.(e)
      }}
      onChange={(e) => {
        const next = e.target.value
        textRef.current = next
        setText(next)
        onLiveChange?.(next)
      }}
      onBlur={(e) => {
        focused.current = false
        commit()
        props.onBlur?.(e)
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.nativeEvent.isComposing) commit()
        props.onKeyDown?.(e)
      }}
    />
  )
}

export function IsolatedTextarea({
  value,
  onCommit,
  onLiveChange,
  sizeKey,
  ...props
}: IsolatedBase &
  Omit<ComponentProps<typeof Textarea>, "value" | "onChange"> & { sizeKey?: string }) {
  const [text, setText] = useState(value ?? "")
  const focused = useRef(false)
  const textRef = useRef(text)
  const areaRef = useRef<HTMLTextAreaElement>(null)
  textRef.current = text

  useEffect(() => {
    if (!focused.current) setText(value ?? "")
  }, [value])

  useLayoutEffect(() => {
    const el = areaRef.current
    if (!el || !sizeKey) return
    const saved = textareaSizeMemory.read(sizeKey)
    if (typeof saved === "number") el.style.height = `${saved}px`
    if (typeof ResizeObserver === "undefined") return
    let last = el.offsetHeight
    const observer = new ResizeObserver(() => {
      const next = el.offsetHeight
      if (Math.abs(next - last) < 1) return
      last = next
      textareaSizeMemory.write(sizeKey, next)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [sizeKey])

  const commit = () => {
    const next = textRef.current
    if (next !== (value ?? "")) onCommit?.(next)
  }

  return (
    <Textarea
      {...props}
      ref={areaRef}
      value={text}
      onFocus={(e) => {
        focused.current = true
        props.onFocus?.(e)
      }}
      onChange={(e) => {
        const next = e.target.value
        textRef.current = next
        setText(next)
        onLiveChange?.(next)
      }}
      onBlur={(e) => {
        focused.current = false
        commit()
        props.onBlur?.(e)
      }}
    />
  )
}
