/**
 * components/chrome/nameplate.tsx — engraved uppercase label on a smooth plate
 *
 * Ink `--plate-ink`. `face="smooth"` adds the light lip under the letters;
 * leave it off on a pixel face. `lamp` leads with a round power lamp
 * (`"on"` lights it). Render as a heading with `as="h3"`. Paint is
 * `.b2-nameplate` in `chrome-primitives.css`.
 *
 *   <Nameplate as="h3" lamp="on">Tracking</Nameplate>
 */
import { forwardRef, type ElementType, type HTMLAttributes } from "react"

import { cn } from "@/lib/utils"

import "./chrome-primitives.css"

export type NameplateProps = HTMLAttributes<HTMLElement> & {
  as?: ElementType
  face?: "pixel" | "smooth"
  lamp?: "on" | "off"
}

export const Nameplate = forwardRef<HTMLElement, NameplateProps>(function Nameplate(
  { as: Tag = "span", face = "pixel", lamp, className, ...rest },
  ref,
) {
  return (
    <Tag
      {...rest}
      ref={ref}
      data-face={face === "pixel" ? undefined : face}
      data-lamp={lamp}
      className={cn("b2-nameplate", className)}
    />
  )
})
