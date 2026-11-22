/**
 * components/chrome/fascia.tsx — the brushed bay a row of instruments sits in
 *
 * `finish="bay"` (default) is the inset pewter bay. `finish="mill"` is the
 * raised mill strip the period navs use. Layout is a flex row; a room sets
 * its own grid or gap on top. Paint is `.b2-fascia` in `chrome-primitives.css`.
 *
 *   <Fascia><Nameplate>Week 47</Nameplate><Keycap>Today</Keycap></Fascia>
 */
import { forwardRef, type ElementType, type HTMLAttributes } from "react"

import { cn } from "@/lib/utils"

import "./chrome-primitives.css"

export type FasciaProps = HTMLAttributes<HTMLElement> & {
  as?: ElementType
  finish?: "bay" | "mill"
}

export const Fascia = forwardRef<HTMLElement, FasciaProps>(function Fascia(
  { as: Tag = "div", finish = "bay", className, ...rest },
  ref,
) {
  return (
    <Tag
      {...rest}
      ref={ref}
      data-finish={finish === "bay" ? undefined : finish}
      className={cn("b2-fascia", className)}
    />
  )
})
