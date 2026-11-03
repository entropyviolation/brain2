/**
 * app/lab/baby-play/page.tsx — The Baby animal game, opened straight from the lab
 *
 * A review aid: the same dialog the friend panel opens, without a friend panel. Use it to walk the cottage.
 */
"use client"

import { useState } from "react"
import { BabyGame } from "@/components/BabyGame/BabyGame"

export default function BabyPlayPage() {
  const [open, setOpen] = useState(true)
  return (
    <main style={{ padding: 16, background: "#0b1016", color: "#cfe0e4", minHeight: "100vh" }}>
      {open ? <BabyGame friend={{ animalId: "fox", name: "Pip", level: 1 }} onClose={() => setOpen(false)} /> : <button type="button" onClick={() => setOpen(true)}>Open the game</button>}
    </main>
  )
}
