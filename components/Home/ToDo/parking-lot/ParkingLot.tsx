/**
 * components/Home/ToDo/parking-lot/ParkingLot.tsx — the parked popup's lot
 *
 * Draws every parked session in the chosen scene (rack, well or garage) and
 * reports picks. three.js and the scene load only when a scene mode is on, so
 * Classic costs nothing. The scene handle goes to `sceneRef` so Resume can
 * play its motion before the session resumes.
 */
"use client"

import { useEffect, useRef, type MutableRefObject } from "react"
import type { LotCar, LotScene, MountLot, ParkingLotMode } from "./types"
import { PARKING_LOT_MODES } from "./types"
import "./parking-lot.css"

const LOADERS: Record<Exclude<ParkingLotMode, "classic">, () => Promise<{ mount: MountLot }>> = {
  rack: () => import("./scene-rack"),
  well: () => import("./scene-well"),
  garage: () => import("./scene-garage"),
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
}

export function ParkingLotStage({
  mode,
  cars,
  selectedId,
  onPick,
  sceneRef,
}: {
  mode: Exclude<ParkingLotMode, "classic">
  cars: LotCar[]
  selectedId: string | null
  onPick: (id: string) => void
  sceneRef: MutableRefObject<LotScene | null>
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const pickRef = useRef(onPick)
  pickRef.current = onPick
  const latest = useRef({ cars, selectedId })
  latest.current = { cars, selectedId }

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let scene: LotScene | null = null
    let gone = false
    LOADERS[mode]()
      .then(({ mount }) => {
        if (gone) return
        scene = mount(host, { onPick: (id) => pickRef.current(id), reducedMotion: prefersReducedMotion() })
        scene.setCars(latest.current.cars, latest.current.selectedId)
        sceneRef.current = scene
      })
      .catch(() => {
        /* WebGL or the chunk failed: the list below still works */
      })
    return () => {
      gone = true
      if (sceneRef.current === scene) sceneRef.current = null
      scene?.dispose()
    }
  }, [mode, sceneRef])

  const carsKey = cars.map((c) => `${c.id}|${c.title}|${c.leftLabel}|${c.tier}`).join(";")
  useEffect(() => {
    sceneRef.current?.setCars(latest.current.cars, latest.current.selectedId)
    // carsKey stands in for the array, which is rebuilt each render
  }, [carsKey, sceneRef])

  useEffect(() => {
    sceneRef.current?.select(selectedId)
  }, [selectedId, sceneRef])

  return <div ref={hostRef} className={`pl-stage is-${mode}`} aria-label="Parked sessions" role="img" />
}

/** The four mode keys. Classic is the plain list. */
export function ParkingLotModeKeys({ mode, onChange }: { mode: ParkingLotMode; onChange: (mode: ParkingLotMode) => void }) {
  return (
    <div className="pl-modes" role="group" aria-label="Parking lot view">
      {PARKING_LOT_MODES.map((m) => (
        <button key={m.id} type="button" className="pl-mode" aria-pressed={mode === m.id} onClick={() => onChange(m.id)}>
          <span className="pl-mode-lamp" aria-hidden />
          {m.label}
        </button>
      ))}
    </div>
  )
}
