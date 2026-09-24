/**
 * components/ui/color-swatch.tsx — Win95 beveled color picker
 *
 * Native `<input type="color">` chips collapse inside padded UA chrome, so a
 * 22×18 control (the Tracking "New pen" row) showed a sliver of color. This
 * wraps the same input in a raised bezel and stretches the swatch to fill it.
 * Use it anywhere a hex color is picked — Tracking pens, tags, Habits, Lists.
 */
"use client"

import { cn } from "@/lib/utils"

const SIZES = {
  sm: "h-[22px] w-8",
  md: "h-7 w-10",
  lg: "h-10 w-14",
} as const

export function ColorSwatch({
  value,
  onChange,
  id,
  "aria-label": ariaLabel,
  className,
  size = "md",
  disabled,
}: {
  value: string
  onChange: (color: string) => void
  id?: string
  "aria-label"?: string
  className?: string
  size?: keyof typeof SIZES
  disabled?: boolean
}) {
  const hex = /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#2563eb"
  return (
    <span className={cn("cogs-color-swatch", SIZES[size], className)} data-disabled={disabled ? "true" : undefined}>
      <input
        id={id}
        type="color"
        value={hex}
        disabled={disabled}
        aria-label={ariaLabel ?? "Color"}
        onChange={(e) => onChange(e.target.value)}
      />
    </span>
  )
}
