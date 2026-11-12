/**
 * components/Mobile/phone-desk-keys.tsx — the phone shell's keys on the desk
 *
 * The iPhone app opens the desk page, not `/mobile/`. This group sits in the
 * header's Menu sheet beside Refresh and carries what the phone shell's top row
 * had that the desk lacks: the **Mac** key (✓ loaded, … loading, ✕ failed; tap to
 * reload), Mobile hub, NFC, Speed read, Bulk Add, From Notes, and Phone Notes. BIM is the
 * header key beside Menu. On mount it engages the Mac window
 * (`lib/phone-window.ts`) and loads it, the same as the shell.
 * `PhoneKeyboard` mounts the keycap keyboard (`keyboard/mobile-keyboard.tsx`)
 * outside the sheet, which `/mobile/` gets from its layout. Anywhere but the
 * iOS app both render nothing.
 */
"use client"

import { useEffect, useState } from "react"
import { AutoTrackRunner } from "@/components/Mobile/auto-track/auto-track-runner"
import { openCaptureDoor } from "@/components/capture-door-bus"
import { EnhancedBulkAdd } from "@/components/enhanced-bulk-add"
import { MobileKeyboard } from "@/components/Mobile/keyboard/mobile-keyboard"
import { Button } from "@/components/ui/button"
import { engagePhoneWindow, getPhoneWindowSnapshot, loadPhoneWindow, phoneWindowNote, subscribePhoneWindow } from "@/lib/phone-window"

export function macKeyLabel(status: string): string {
  if (status === "live") return "Mac ✓"
  if (status === "loading") return "Mac …"
  if (status === "offline" || status === "stale") return "Mac ✕"
  return "Mac ?"
}

function isIosApp(): boolean {
  if (typeof window === "undefined") return false
  if (window.location.protocol === "capacitor:") return true
  const cap = (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
  return typeof cap?.isNativePlatform === "function" && cap.isNativePlatform()
}

/**
 * The keycap deck for the desk page in the iOS app. Lives outside the Menu sheet, so closing the sheet never touches it.
 * The automatic Health and location sync rides along, since this is the one piece always mounted in the app.
 */
export function PhoneKeyboard() {
  const [onPhone, setOnPhone] = useState(false)
  useEffect(() => setOnPhone(isIosApp()), [])
  return onPhone ? (
    <>
      <MobileKeyboard />
      <AutoTrackRunner />
    </>
  ) : null
}

export function PhoneDeskKeys() {
  const [onPhone, setOnPhone] = useState(false)
  const [snap, setSnap] = useState(getPhoneWindowSnapshot)

  useEffect(() => {
    if (!isIosApp()) return
    setOnPhone(true)
    engagePhoneWindow()
    const off = subscribePhoneWindow(() => setSnap(getPhoneWindowSnapshot()))
    void loadPhoneWindow()
    return off
  }, [])

  if (!onPhone) return null
  const line = phoneWindowNote(snap.status) ?? (snap.status === "live" ? "Mac loaded." : "Mac not asked yet.")

  return (
    <>
    <fieldset className="b2-shell-group b2-shell-phone" data-ui-name="Phone keys" data-ui-docs="components/Mobile/README.md">
      <legend>Phone</legend>
      <div className="b2-shell-keys">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="b2-shell-mac-key"
          data-status={snap.status}
          aria-label="Reload from the Mac"
          onClick={() => void loadPhoneWindow()}
        >
          {macKeyLabel(snap.status)}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => window.location.assign("/mobile/hub/")}>
          Mobile hub
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => window.location.assign("/mobile/nfc/")}>
          NFC
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => window.location.assign("/mobile/read/")}>
          Speed read
        </Button>
        <EnhancedBulkAdd />
        <Button type="button" variant="outline" size="sm" onClick={() => openCaptureDoor("notes")}>
          From Notes
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => openCaptureDoor("phone")}>
          Phone Notes
        </Button>
      </div>
      <p className="b2-shell-phone-line" role="status" data-status={snap.status}>
        {line}
      </p>
    </fieldset>
    </>
  )
}
