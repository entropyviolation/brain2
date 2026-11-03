/**
 * app/always-mic.tsx — keep the microphone open for the whole app.
 *
 * On iOS the permission sheet appears as soon as the platform will show it
 * (on launch, or on the next tap). The stream stays after that, so a breath
 * can blow the habit-window sand into the screen. Desktop does not ask here.
 * Spoken affirmations still open the microphone when that ritual starts.
 */
"use client"

import { useEffect } from "react"
import { sandHearsBreath } from "@/lib/mic-blow"
import { holdMicrophone } from "@/lib/live-mic"

export function AlwaysMic() {
  useEffect(() => {
    if (!sandHearsBreath()) return
    return holdMicrophone()
  }, [])
  return null
}
