/**
 * app/mobile/nfc/page.tsx — Phone-only NFC hub.
 *
 * Desktop has no link here. The phone opens it from the mobile nav and from
 * Settings → NFC tags while the phone shell is up.
 */
"use client"

import { MobileNfcHubScreen } from "@/components/Mobile/nfc-hub/MobileNfcHub"

export default function MobileNfcPage() {
  return <MobileNfcHubScreen />
}
