/**
 * app/lab/bim-flow/page.tsx — Build and test BIM's routed model flow
 *
 * A standalone route. Nothing links here; open `/lab/bim-flow` by hand.
 * See `components/Lab/BimFlow/README.md`.
 */
"use client"

import { BimFlowLab } from "@/components/Lab/BimFlow/BimFlowLab"

export default function BimFlowLabPage() {
  return <BimFlowLab />
}
