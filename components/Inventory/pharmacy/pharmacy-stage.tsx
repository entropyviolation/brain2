"use client"

/**
 * components/Inventory/pharmacy/pharmacy-stage.tsx — Loads the apothecary shelf on open
 */

import { useEffect, useRef } from "react"
import type { PharmacyBottle } from "./pharmacy-diorama"

export function PharmacyStage({
  bottles,
  selectedId,
  onPick,
}: {
  bottles: readonly PharmacyBottle[]
  selectedId: string | null
  onPick: (id: string) => void
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const onPickRef = useRef(onPick)
  const bottlesRef = useRef(bottles)
  const selectedRef = useRef(selectedId)
  onPickRef.current = onPick
  bottlesRef.current = bottles
  selectedRef.current = selectedId
  // A dose changes the fill, the face, or the label, so each is in the key.
  const signature = `${selectedId ?? ""}|${bottles
    .map((b) => `${b.id}:${b.name}:${b.strength ?? ""}:${b.form}:${Math.round(b.fill * 100)}:${b.level}:${b.color}`)
    .join(",")}`

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let cleanup = () => {}
    let dead = false
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
    void import("./pharmacy-diorama").then(({ mountPharmacy }) => {
      if (dead || !hostRef.current) return
      cleanup = mountPharmacy(hostRef.current, {
        bottles: bottlesRef.current,
        selectedId: selectedRef.current,
        reducedMotion,
        onPick: (id) => onPickRef.current(id),
      })
    })
    return () => {
      dead = true
      cleanup()
    }
  }, [signature])

  return <div ref={hostRef} className="inv-rx-diorama" role="img" aria-label="Pharmacy shelf. One bottle for each medicine or supplement." />
}
