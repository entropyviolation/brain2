/**
 * app/layout.tsx — Next.js root layout
 *
 * The App Router root layout that wraps every page: loads the Karla font, applies
 * global metadata, and imports the global stylesheet. Server component (no
 * "use client") since it only renders the HTML shell.
 *
 * Spec: §2.2 — the application shell that hosts all modules.
 */
import type React from "react"
import type { Metadata } from "next"
import { Karla } from "next/font/google"
import "./globals.css"
import "./win95.css"
import { CompletionPopupHost } from "@/components/Completion/CompletionPopupHost"

const karla = Karla({
  subsets: ["latin"],
  variable: "--font-karla",
  display: "swap",
})

export const metadata: Metadata = {
  title: "COGS Task Management",
  description: " ",
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={karla.variable}>
      <body className={`${karla.className} win95-app`}>
        {children}
        <CompletionPopupHost />
      </body>
    </html>
  )
}
