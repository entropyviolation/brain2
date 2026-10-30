"use client"

/**
 * components/Home/Tracking/tracking-log/food/kitchen-stage.tsx — Loads the diorama on open
 */

import { useEffect, useRef } from "react"
import type { DioramaLot } from "@/components/Home/Tracking/tracking-log/food/kitchen-diorama"
import type { KitchenRoom } from "@/lib/kitchen-types"

export function KitchenStage({
  lots,
  active,
  onRoom,
  onLot,
}: {
  lots: readonly DioramaLot[]
  active: KitchenRoom | "all"
  onRoom: (room: KitchenRoom) => void
  onLot?: (id: string) => void
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const onRoomRef = useRef(onRoom)
  const onLotRef = useRef(onLot)
  const lotsRef = useRef(lots)
  const activeRef = useRef(active)
  onRoomRef.current = onRoom
  onLotRef.current = onLot
  lotsRef.current = lots
  activeRef.current = active
  const signature = `${active}|${lots.map((lot) => `${lot.id ?? ""}:${lot.room}:${lot.name}`).join(",")}`

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let cleanup = () => {}
    let dead = false
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
    void import("./kitchen-diorama").then(({ mountKitchen }) => {
      if (dead || !hostRef.current) return
      cleanup = mountKitchen(hostRef.current, {
        lots: lotsRef.current,
        active: activeRef.current,
        reducedMotion,
        onRoom: (room) => onRoomRef.current(room),
        onLot: (id) => onLotRef.current?.(id),
      })
    })
    return () => {
      dead = true
      cleanup()
    }
  }, [signature])

  return <div ref={hostRef} className="trk-food-diorama" role="img" aria-label="Kitchen. Fridge, pantry, spice cabinet, and freezer." />
}
