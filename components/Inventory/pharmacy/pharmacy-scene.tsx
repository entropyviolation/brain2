/**
 * components/Inventory/pharmacy/pharmacy-scene.tsx — Pharmacy on the desk and the phone
 *
 * The desk mounts the 3D apothecary shelf above the board. The phone has the
 * same board and no Three.js. Bottles live in `usePharmacyStore`; this scene
 * owns only which one is picked.
 */
"use client"

import { useMemo, useState } from "react"
import { usePharmacyStore } from "@/lib/pharmacy-store"
import { PharmacyBoard } from "./pharmacy-board"
import { pharmacyBottles, pharmacySummary } from "./pharmacy-rows"
import { PharmacyStage } from "./pharmacy-stage"
import "./pharmacy.css"

export function PharmacyScene({ surface }: { surface: "desk" | "phone" }) {
  const items = usePharmacyStore((s) => s.items)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const bottles = useMemo(() => pharmacyBottles(items), [items])
  const phone = surface === "phone"
  return (
    <section
      className={phone ? "inv-stage inv-rx inv-rx-phone" : "inv-stage inv-rx"}
      aria-label="Pharmacy"
      data-testid={phone ? "pharmacy-phone" : "pharmacy-scene"}
    >
      <p className="inv-stage-count inv-rx-summary">{pharmacySummary(items)}</p>
      {phone ? null : (
        <div className="inv-rx-window">
          <PharmacyStage bottles={bottles} selectedId={selectedId} onPick={(id) => setSelectedId((cur) => (cur === id ? null : id))} />
        </div>
      )}
      <PharmacyBoard selectedId={selectedId} onSelect={setSelectedId} />
    </section>
  )
}
