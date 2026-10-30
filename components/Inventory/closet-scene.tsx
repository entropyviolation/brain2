/**
 * components/Inventory/closet-scene.tsx — Closet scene
 *
 * Garment wall, past wears, a mix-and-match board, and a read-only packing
 * shelf. Pieces and wears come from `useWardrobeStore`. Lookbooks and the
 * planned-outfit calendar stay a one-line empty state.
 */
"use client"

import { useState } from "react"
import { useWardrobeStore } from "@/lib/wardrobe"
import { ClosetBoard } from "./closet/closet-board"
import { ClosetGrid } from "./closet/closet-grid"
import { ClosetPacking, ClosetPlanned, ClosetWears } from "./closet/closet-shelves"
import "./closet/closet.css"

const SECTIONS = [
  ["pieces", "Pieces"],
  ["wears", "Wears"],
  ["board", "Board"],
  ["packing", "Packing"],
  ["lookbooks", "Lookbooks"],
  ["calendar", "Calendar"],
] as const

type SectionId = (typeof SECTIONS)[number][0]

export function ClosetScene() {
  const count = useWardrobeStore((state) => state.pieces.length)
  const [section, setSection] = useState<SectionId>("pieces")
  return (
    <section className="inv-stage inv-closet" aria-label="Closet" data-testid="closet-scene">
      <header className="inv-closet-head">
        <p className="inv-stage-count">{pieceCount(count)}</p>
        <div className="inv-closet-switch" role="tablist" aria-label="Closet sections">
          {SECTIONS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={section === id}
              className="inv-closet-switch-btn"
              onClick={() => setSection(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </header>
      {section === "pieces" ? <ClosetGrid /> : null}
      {section === "wears" ? <ClosetWears /> : null}
      {section === "board" ? <ClosetBoard /> : null}
      {section === "packing" ? <ClosetPacking /> : null}
      {section === "lookbooks" ? <ClosetPlanned line="Lookbooks are planned." /> : null}
      {section === "calendar" ? <ClosetPlanned line="A planned-outfit calendar is planned." /> : null}
    </section>
  )
}

function pieceCount(count: number): string {
  return `${count} ${count === 1 ? "piece" : "pieces"}`
}
