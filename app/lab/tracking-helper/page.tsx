/**
 * app/lab/tracking-helper/page.tsx — Design and test the Tracking Helper's flow
 *
 * A standalone route, like `/lab/bim-flow`. The Tracking Helper's chat has a door here. The bench edits
 * and runs the flow; the tests under it replay or re-ask it. See `components/Lab/TrackingHelper/README.md`.
 */
"use client"

import { HelperTests } from "@/components/Lab/TrackingHelper/helper-tests"
import { SkillsPanel } from "@/components/Lab/TrackingHelper/SkillsPanel"
import { TrackingHelperLab } from "@/components/Lab/TrackingHelper/TrackingHelperLab"

export default function TrackingHelperLabPage() {
  return (
    <>
      <TrackingHelperLab />
      <HelperTests />
      <SkillsPanel />
    </>
  )
}
