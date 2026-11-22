/**
 * components/Home/ToDo/parking-lot/types.ts — the contract every parking-lot scene keeps
 *
 * A scene draws the parked sessions in a host div and reports picks. It never
 * resumes anything itself: `playResume` is the verb's motion, and the caller
 * resumes the session when it settles. Reduced motion settles at once.
 */
import type { SessionTier } from "@/lib/session-plan"

export type ParkingLotMode = "classic" | "rack" | "well" | "garage" | "night"

export const PARKING_LOT_MODES: { id: ParkingLotMode; label: string }[] = [
  { id: "classic", label: "Classic" },
  { id: "rack", label: "Cartridge rack" },
  { id: "well", label: "Scrying well" },
  { id: "garage", label: "Garage" },
  { id: "night", label: "Night garage" },
]

/** One parked session as a scene sees it. */
export type LotCar = {
  id: string
  title: string
  /** "2:59:15 left" — already formatted. */
  leftLabel: string
  /** Tier of the line it was on (or its first open line). Picks the lamp or paint. */
  tier: SessionTier
}

export type LotScene = {
  /** Replace the parked set. Called on mount and whenever the set or a clock label changes. */
  setCars: (cars: LotCar[], selectedId: string | null) => void
  select: (id: string | null) => void
  /** The resume motion for that car. Resolves when it is done (at once under reduced motion). */
  playResume: (id: string) => Promise<void>
  dispose: () => void
}

export type MountLot = (host: HTMLDivElement, opts: { onPick: (id: string) => void; reducedMotion: boolean }) => LotScene

/** Light colors per tier. House LEDs: green, blue, purple. */
export const LOT_TIER_COLOR: Record<SessionTier, number> = { min: 0x7dffc4, goal: 0x9ad7ff, exceptional: 0x7e14ff }
