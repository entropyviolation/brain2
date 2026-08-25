/**
 * app/mobile/page.tsx — Mobile Home entry (Capacitor / sideload / Add to Home Screen).
 *
 * Completely separate from the desktop root page. Does not change desktop
 * tabs, stores, or data. Opens the Home dashboard behind a login gate.
 */
"use client"

import { MobileApp } from "@/components/Mobile/MobileApp"

export default function MobilePage() {
  return <MobileApp />
}
