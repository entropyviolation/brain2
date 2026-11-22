/**
 * components/chrome/crt-well.tsx — a value in black glass
 *
 * Phosphor `--crt-phosphor` with its glow, a faint bloom at the top, a
 * gunmetal ring. Pads the glyphs. Phosphor goes in this well, never straight
 * on the mill. Paint is `.b2-crt` in `chrome-primitives.css`.
 *
 *   <CrtWell aria-label="Minutes today">47</CrtWell>
 */
import { forwardRef, type ElementType, type HTMLAttributes } from "react"

import { cn } from "@/lib/utils"

import "./chrome-primitives.css"

export type CrtWellProps = HTMLAttributes<HTMLElement> & {
  as?: ElementType
  size?: "normal" | "small"
}

export const CrtWell = forwardRef<HTMLElement, CrtWellProps>(function CrtWell(
  { as: Tag = "span", size = "normal", className, ...rest },
  ref,
) {
  return (
    <Tag
      {...rest}
      ref={ref}
      data-size={size === "normal" ? undefined : size}
      className={cn("b2-crt", className)}
    />
  )
})
