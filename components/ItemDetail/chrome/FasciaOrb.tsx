/**
 * components/ItemDetail/chrome/FasciaOrb.tsx — The item's orb at the left of the
 * CRT title (PD 8.2). 28px, the same image the Lists desktop shows
 * (`iconFor(id, icon)`). Click → `OrbPickerDialog`; a pick or Reset calls
 * `onPick(icon | undefined)`, which the shell writes on the draft (`icon` is
 * in the save allowlist). For a person this is the same value as the big
 * Details orb. Without `onPick` (page, not editing) it is a still image.
 */
"use client"

import { useState } from "react"
import { iconFor } from "@/components/Icons/Icon"
import { OrbPickerDialog } from "@/components/Icons/OrbPicker"

export function FasciaOrb({
  id,
  icon,
  onPick,
}: {
  id: string
  icon?: string
  onPick?: (icon: string | undefined) => void
}) {
  const [open, setOpen] = useState(false)
  const [host, setHost] = useState<HTMLElement | null>(null)
  const src = iconFor(id, icon)
  if (!onPick) {
    return (
      <span className="id-fascia-orb" data-testid="fascia-orb">
        <img src={src} alt="" data-orb draggable={false} />
      </span>
    )
  }
  return (
    <>
      <button
        type="button"
        className="id-fascia-orb"
        data-testid="fascia-orb"
        data-no95
        aria-label="Change item orb"
        title="Change orb"
        onClick={(event) => {
          // Inside the popup, portal the picker into that dialog so it stacks on top.
          const dialog = event.currentTarget.closest('[role="dialog"]')
          setHost(dialog instanceof HTMLElement ? dialog : null)
          setOpen(true)
        }}
      >
        <img src={src} alt="" data-orb draggable={false} />
      </button>
      <OrbPickerDialog
        open={open}
        current={icon}
        container={host}
        onClose={() => setOpen(false)}
        onSelect={(next) => {
          onPick(next)
          setOpen(false)
        }}
      />
    </>
  )
}
