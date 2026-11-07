/**
 * components/Mobile/read/MobileSpeedRead.tsx — the Speed Read module as a phone page.
 *
 * Same `SpeedReadView` as the Modules workspace. Its home lists the PDF library
 * kept on the Mac (`lib/speed-read-library.ts`), so every PDF opened on the
 * desk can be read here. A PDF picked on the phone joins that library too.
 */
"use client"

import { ChevronLeft } from "lucide-react"
import { SpeedReadView } from "@/components/Modules/workspace/speedread/SpeedReadView"
import "./mobile-read.css"

export function MobileSpeedRead() {
  return (
    <div className="m-read">
      <header className="m-read-bar">
        <button type="button" className="m-read-back" onClick={() => window.location.assign("/")} aria-label="Back to the desk">
          <ChevronLeft size={20} aria-hidden /> Desk
        </button>
        <h1 className="m-read-title">Speed read</h1>
      </header>
      <SpeedReadView />
    </div>
  )
}
