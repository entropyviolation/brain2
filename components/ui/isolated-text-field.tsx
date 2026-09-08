/**
 * components/ui/isolated-text-field.tsx — Text inputs that do not re-render
 * their parent on every keystroke.
 *
 * Holds draft text in local state and calls `onCommit` on blur (and Enter for
 * single-line inputs). Optional `onLiveChange` updates a parent ref without
 * setState so Save handlers can read the latest value immediately.
 */
"use client"

import { useEffect, useRef, useState, type ComponentProps } from "react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

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
  ...props
}: IsolatedBase & Omit<ComponentProps<typeof Textarea>, "value" | "onChange">) {
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
    <Textarea
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
    />
  )
}
