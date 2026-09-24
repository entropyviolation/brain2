/**
 * lib/sleep-store.ts — The nightly sleep log
 *
 * One record per night, keyed by the morning date (see `lib/sleep-log.ts` for
 * why). This store holds only what the user *said*; everything derived from it —
 * the painted Tracking blocks, the Done row, the habit minutes — is produced by
 * `lib/sleep-sync.ts`, which is the only module allowed to import both this and
 * the tracking store. Night writes push onto `lib/action-history.ts` so Cmd/Ctrl-Z
 * restores the log and the derived blocks together.
 *
 * Keeping the statement and its consequences apart is what makes the feature
 * safe to re-run: correcting a bedtime three days later rewrites the derived
 * blocks for that night and nothing else.
 */
"use client"

import { useMemo } from "react"
import { create } from "zustand"
import { persist } from "zustand/middleware"
import { createCogsJSONStorage } from "@/lib/persist-storage"
import { persistKey } from "@/lib/storage-keys"
import {
  bindAllNighterNights,
  exemptionContext,
  notifyAllNighterLogged,
  type ExemptionContext,
} from "@/lib/habit-exemption"
import {
  DEFAULT_SLEEP_TARGET_MINUTES,
  type SleepNight,
  type SleepPrecision,
} from "@/lib/sleep-log"
import { rememberWorld } from "@/lib/action-history"

export interface SleepState {
  /** Morning date key → night. */
  nights: Record<string, SleepNight>
  /** What a full night should be, for debt and "met target" counts. */
  targetMinutes: number

  setBedtime: (date: string, sleptMin: number | undefined, precision?: SleepPrecision) => void
  setWakeTime: (date: string, wokeMin: number | undefined, precision?: SleepPrecision) => void
  setNightNote: (date: string, note: string) => void
  setPrecision: (date: string, end: "slept" | "woke", precision: SleepPrecision) => void
  /** Mark / clear an all-nighter morning (no sleep). Clears clock ends when set. */
  setAllNighter: (
    date: string,
    allNighter: boolean,
    meta?: { at?: string; source?: SleepNight["allNighterSource"] },
  ) => void
  clearNight: (date: string) => void
  setTargetMinutes: (minutes: number) => void

  getNight: (date: string) => SleepNight | undefined
}

/** Writes through a single normalizer so an empty night never lingers. */
function patchNight(
  nights: Record<string, SleepNight>,
  date: string,
  patch: Partial<SleepNight>,
): Record<string, SleepNight> {
  const current = nights[date] ?? { date }
  const next: SleepNight = { ...current, ...patch, date, updatedAt: new Date().toISOString() }

  const empty =
    next.sleptMin === undefined &&
    next.wokeMin === undefined &&
    !next.note?.trim() &&
    !next.allNighter
  if (empty) {
    const { [date]: _removed, ...rest } = nights
    return rest
  }
  return { ...nights, [date]: next }
}

/** Re-renders when all-nighter nights change, and hands the set to the exemption math. */
export function useExemptionContext(): ExemptionContext {
  const nights = useSleepStore((s) => s.nights)
  return useMemo(() => exemptionContext(nights), [nights])
}

export const useSleepStore = create<SleepState>()(
  persist(
    (set, get) => ({
      nights: {},
      targetMinutes: DEFAULT_SLEEP_TARGET_MINUTES,

      setBedtime: (date, sleptMin, precision) => {
        rememberWorld("sleep bedtime")
        set((state) => ({
          nights: patchNight(state.nights, date, {
            sleptMin,
            // Clearing an end clears its confidence too; keeping a stale
            // "definite" on an empty field would overstate the next entry.
            sleptPrecision: sleptMin === undefined ? undefined : precision ?? state.nights[date]?.sleptPrecision ?? "estimated",
          }),
        }))
      },

      setWakeTime: (date, wokeMin, precision) => {
        rememberWorld("sleep wake")
        set((state) => ({
          nights: patchNight(state.nights, date, {
            wokeMin,
            wokePrecision: wokeMin === undefined ? undefined : precision ?? state.nights[date]?.wokePrecision ?? "estimated",
          }),
        }))
      },

      setNightNote: (date, note) => {
        rememberWorld("sleep note")
        set((state) => ({ nights: patchNight(state.nights, date, { note: note.trim() || undefined }) }))
      },

      setPrecision: (date, end, precision) => {
        rememberWorld("sleep precision")
        set((state) => ({
          nights: patchNight(state.nights, date,
            end === "slept" ? { sleptPrecision: precision } : { wokePrecision: precision },
          ),
        }))
      },

      setAllNighter: (date, allNighter, meta) => {
        rememberWorld(allNighter ? "sleep all-nighter" : "clear all-nighter")
        set((state) => ({
          nights: patchNight(
            state.nights,
            date,
            allNighter
              ? {
                  allNighter: true,
                  allNighterAt: meta?.at ?? new Date().toISOString(),
                  allNighterSource: meta?.source ?? "desktop",
                  sleptMin: undefined,
                  wokeMin: undefined,
                  sleptPrecision: undefined,
                  wokePrecision: undefined,
                }
              : {
                  allNighter: undefined,
                  allNighterAt: undefined,
                  allNighterSource: undefined,
                },
          ),
        }))
        notifyAllNighterLogged(date)
      },

      clearNight: (date) => {
        const wasAllNighter = !!get().nights[date]?.allNighter
        rememberWorld("clear night")
        set((state) => {
          const { [date]: _removed, ...rest } = state.nights
          return { nights: rest }
        })
        if (wasAllNighter) notifyAllNighterLogged(date)
      },

      setTargetMinutes: (minutes) =>
        set({ targetMinutes: Math.min(16 * 60, Math.max(60, Math.round(minutes) || DEFAULT_SLEEP_TARGET_MINUTES)) }),

      getNight: (date) => get().nights[date],
    }),
    { name: persistKey("sleep-store"), version: 1, storage: createCogsJSONStorage() },
  ),
)

bindAllNighterNights(() => useSleepStore.getState().nights)
