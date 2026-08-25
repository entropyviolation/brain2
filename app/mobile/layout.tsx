/**
 * app/mobile/layout.tsx — Viewport + PWA-ish meta for the mobile Home shell.
 */
import type { Metadata, Viewport } from "next"

export const metadata: Metadata = {
  title: "COGS Mobile — Home",
  description: "COGS Home on mobile (Habits, Plan, To Do, Goals, Tracking).",
  appleWebApp: {
    capable: true,
    title: "COGS Home",
    statusBarStyle: "default",
  },
  manifest: "/mobile-manifest.webmanifest",
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#c0c0c0",
}

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return children
}
