"use client"

/**
 * components/Lists/board/lists-title-bar.tsx
 *
 * File-manager title bar. Minimize and Maximize stay unlabeled buttons.
 * Close is the keycap and calls closeTarget.
 */
import { KeycapClose } from "@/components/keycap-close"
import { PhoneLedTitle } from "@/components/Lists/board/phone-led-title"
import { usePhoneListsLayout } from "@/components/Lists/board/use-phone-lists-layout"
import type { OpenTarget } from "@/components/Lists/types"

export function ListsTitleBar({
  openIconKey,
  openTarget,
  openName,
  closeTarget,
}: {
  openIconKey: string
  openTarget: OpenTarget
  openName: string
  closeTarget: () => void
}) {
  const phone = usePhoneListsLayout()
  const label = openTarget ? `${openName} — Lists` : "Lists — File Manager"
  return (
    <div className="fm-title-bar">
      <div className="fm-title-bar-text">
        <img src={openIconKey} alt="" loading="lazy" decoding="async" />
        {phone ? <PhoneLedTitle text={label} /> : label}
      </div>
      <div className="fm-title-bar-controls">
        <button className="fm-title-btn" aria-label="Minimize">_</button>
        <button className="fm-title-btn" aria-label="Maximize">□</button>
        <KeycapClose label="Close" onClick={closeTarget} />
      </div>
    </div>
  )
}
