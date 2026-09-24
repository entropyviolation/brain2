/**
 * app/layout.tsx — Next.js root layout
 *
 * The App Router root layout that wraps every page: loads Karla (app) and
 * Source Serif 4 (Analytics titles via `--font-an-serif`), applies
 * global metadata, and imports global + module chrome stylesheets (so Fast Refresh
 * cannot drop lazy-tab CSS). `win95.css` owns `--chrome-*`; `chrome-patina.css`
 * remaps module aliases onto that family; `pcb-backdrop.css` paints the
 * desktop field (teal by default, optional PCB photos); `baby-animal-nest.css` skins the header CRT companion;
 * `win95.css` also sets navy `#000080` text-field and checkbox/radio focus (never WebKit orange);
 * `shell-chrome.css` skins the pinned mill title bar; `modules-chrome.css` skins the Modules catalog; `settings-chrome.css` skins Settings dialogs; `header-popup-chrome.css` skins pin-bar capture/review dialogs; `UiNamesHost` stamps
 * `data-ui-mode` on `<html>` (Names is the first overlay); `ChromePatina` writes the live gunmetal; `PcbBackdrop`
 * stamps `data-pcb-mode` on `<html>` (`suppressHydrationWarning` so a saved
 * plate cannot mismatch SSR). Server component (no "use client") since it only
 * renders the HTML shell.
 *
 * Spec: §2.2 — the application shell that hosts all modules.
 */
import type React from "react"
import type { Metadata } from "next"
import { Karla, Source_Serif_4 } from "next/font/google"
import "./globals.css"
import "./win95.css"
// Module chrome must live on the root layout, not only on lazy tab chunks.
// Next Fast Refresh (and first paint of a lazy tab) can drop or reorder
// component-imported CSS; the skin then falls back to unskinned Tailwind.
import "@/components/Lists/filemanager98.css"
import "@/components/Home/home-chrome.css"
import "@/components/Home/Tracking/tracking-chrome.css"
import "@/components/Home/Plan/plan-chrome.css"
import "@/components/Home/Habits/habit-grid.css"
import "@/components/Home/Habits/habit-chrome.css"
import "@/components/Home/Habits/habit-form-dialog.css"
import "@/components/Operations/operations-chrome.css"
import "@/components/Scheduler/scheduler-chrome.css"
import "@/components/Analytics/analytics-chrome.css"
import "@/components/Modules/modules-chrome.css"
import "@/components/Settings/settings-chrome.css"
import "@/components/header-popup-chrome.css"
import "@/components/Docs/docs.css"
import "@/components/Docs/document-editor.css"
import "@/components/Editor/editor.css"
import "@/components/Mobile/mobile.css"
import "@/components/baby-animal-nest.css"
import "@/components/shell-chrome.css"
import "@/components/UiNames/ui-names.css"
import "./chrome-patina.css"
import "./pcb-backdrop.css"
import { ChromePatina } from "./chrome-patina"
import { PcbBackdrop } from "./pcb-backdrop"
import { CompletionPopupHost } from "@/components/Completion/CompletionPopupHost"
import { UiNamesHost } from "@/components/UiNames/UiNamesHost"
import { APP_NAME } from "@/lib/app-brand"
import { DEFAULT_PCB_MODE, PCB_BACKDROP_BOOT_SCRIPT, pcbInkFor } from "@/lib/pcb-backdrop"

const karla = Karla({
  subsets: ["latin"],
  variable: "--font-karla",
  display: "swap",
})

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-an-serif",
  display: "swap",
})

export const metadata: Metadata = {
  title: APP_NAME,
  description:
    "A living application — cognitive offloading and getting stuff done. Adaptable, alive, beautiful: a new type of software.",
  generator: "v0.dev",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      className={`${karla.variable} ${sourceSerif.variable}`}
      data-pcb-mode={DEFAULT_PCB_MODE}
      data-pcb-ink={pcbInkFor(DEFAULT_PCB_MODE)}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: PCB_BACKDROP_BOOT_SCRIPT }} />
      </head>
      <body className={`${karla.className} win95-app`}>
        <ChromePatina />
        <PcbBackdrop />
        {children}
        <CompletionPopupHost />
        <UiNamesHost />
      </body>
    </html>
  )
}
