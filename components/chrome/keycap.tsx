/**
 * components/chrome/keycap.tsx — the house word key
 *
 * Pale silver by default. `plastic` picks the grey modifier, the navy
 * primary, or the two spare plastics. `latched` makes a room switcher key:
 * a lamp at the left, CRT glass while selected. `on` keeps a word key
 * dropped (`aria-pressed`). Paint is `.b2-keycap` in `chrome-primitives.css`.
 *
 *   <Keycap onClick={add} plastic="primary">Add task</Keycap>
 *   <Keycap latched={view === "week"} onClick={() => setView("week")}>Week</Keycap>
 */
"use client"

import { forwardRef, type ButtonHTMLAttributes } from "react"

import { cn } from "@/lib/utils"

import "./chrome-primitives.css"

export type KeycapPlastic = "silver" | "mod" | "primary" | "seafoam" | "cornflower"

export type KeycapProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  plastic?: KeycapPlastic
  /** Room switcher: `true` is the selected CRT key, `false` a resting key with a dim lamp. */
  latched?: boolean
  /** A word key that stays on. Sets `aria-pressed`. */
  on?: boolean
}

export const Keycap = forwardRef<HTMLButtonElement, KeycapProps>(function Keycap(
  { plastic = "silver", latched, on, className, type, ...rest },
  ref,
) {
  return (
    <button
      {...rest}
      ref={ref}
      type={type ?? "button"}
      data-no95=""
      data-plastic={plastic === "silver" ? undefined : plastic}
      data-latch={latched === undefined ? undefined : latched ? "on" : "off"}
      aria-pressed={on === undefined ? rest["aria-pressed"] : on}
      className={cn("b2-keycap", className)}
    />
  )
})
