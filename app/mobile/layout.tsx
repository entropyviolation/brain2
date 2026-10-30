/**
 * app/mobile/layout.tsx — Viewport + PWA-ish meta for the mobile Home shell.
 * The keycap keyboard mounts here so login, Home, and the NFC hub all get it.
 */
import type { Metadata, Viewport } from "next"
import { APP_NAME } from "@/lib/app-brand"
import { MobileKeyboard } from "@/components/Mobile/keyboard/mobile-keyboard"

export const metadata: Metadata = {
  title: `${APP_NAME} Mobile — Home`,
  description: `${APP_NAME} Home on mobile (Habits, Plan, To Do, Goals, Tracking).`,
  appleWebApp: {
    capable: true,
    title: `${APP_NAME} Home`,
    statusBarStyle: "default",
  },
  manifest: "/mobile-manifest.webmanifest",
}

/**
 * Same fit as the root layout. Zoom stays unlocked: maximum-scale 1
 * kept a focus zoom from returning to the full page.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#c0c0c0",
}

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <MobileKeyboard />
    </>
  )
}
