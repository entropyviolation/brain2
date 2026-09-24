/**
 * app/mobile/layout.tsx — Viewport + PWA-ish meta for the mobile Home shell.
 */
import type { Metadata, Viewport } from "next"
import { APP_NAME } from "@/lib/app-brand"

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
