/**
 * components/keycap-close.tsx — the keycap ×
 *
 * The close key Quick Add uses. A grey modifier cap with a round ×.
 * Hover and keyboard focus turn the plastic brick. The face comes with
 * the file (`keycap-close.css`). Pass `corner` on a dialog title bar so it
 * sits on `--b2-close-top` / `--b2-close-right`.
 *
 *   <KeycapClose corner onClick={close} />
 *
 * With Radix, wrap it: `<DialogClose asChild><KeycapClose corner /></DialogClose>`.
 * The house dialog close (`components/ui/dialog.tsx`) is this key.
 */
"use client"

import { forwardRef, type ButtonHTMLAttributes } from "react"

import { cn } from "@/lib/utils"

import "./keycap-close.css"

export const KeycapClose = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    /** Accessible name. Also the tooltip when `title` is omitted. */
    label?: string
    /** Pin to the dialog corner (`--b2-close-top` / `--b2-close-right`). */
    corner?: boolean
  }
>(function KeycapClose({ label = "Close", corner = false, className, title, type, ...rest }, ref) {
  return (
    <button
      {...rest}
      ref={ref}
      type={type ?? "button"}
      data-no95=""
      className={cn("keycap-close", corner && "is-corner", className)}
      aria-label={rest["aria-label"] ?? label}
      title={title ?? label}
    >
      <svg viewBox="0 0 12 12" width="11" height="11" aria-hidden focusable="false">
        <path className="keycap-close-lip" d="M3.15 3.15 L8.85 8.85 M8.85 3.15 L3.15 8.85" />
        <path className="keycap-close-ink" d="M3.15 3.15 L8.85 8.85 M8.85 3.15 L3.15 8.85" />
      </svg>
    </button>
  )
})
