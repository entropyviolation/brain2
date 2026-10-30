/**
 * lib/phone-sync/health-store.ts — Daily Apple Health totals on this device
 *
 * One row per local day: steps, walking and running distance, flights, active
 * energy, and heart rate (average, min, max). The sleep log and the Activity
 * grid hold nights and workouts. This store is the phone import's ledger so a
 * later page can tell a morning it wrote from one the person logged.
 */
"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { createCogsJSONStorage } from "@/lib/persist-storage"
import { persistKey } from "@/lib/storage-keys"
import type { HealthDay, HealthNightLedger } from "./health"

export interface HealthImportState {
  days: Record<string, HealthDay>
  /** Mornings this import wrote, so a hand-edited night is not replaced. */
  nights: Record<string, HealthNightLedger>
}

export const useHealthImportStore = create<HealthImportState>()(
  persist(() => ({ days: {}, nights: {} }), {
    name: persistKey("health-import"),
    version: 1,
    storage: createCogsJSONStorage(),
  }),
)
