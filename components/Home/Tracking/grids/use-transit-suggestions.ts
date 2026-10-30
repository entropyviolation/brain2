/**
 * components/Home/Tracking/grids/use-transit-suggestions.ts — Tentative transit tiles for one Location day
 *
 * Candidates come from `lib/transit-suggest.ts`; each is priced once by
 * `lib/transit-time.ts`. Returns blocks to draw. Nothing is written to the store.
 */
"use client"

import { useEffect, useMemo, useState } from "react"
import type { TimeEntry } from "@/lib/time-entries"
import type { TrackScope } from "@/lib/time-tracking-store"
import { transitCandidates, transitEntries } from "@/lib/transit-suggest"
import { travelMinutes } from "@/lib/transit-time"

export function useTransitSuggestions(entries: TimeEntry[], date: string, scope: TrackScope | undefined): TimeEntry[] {
  const dates = useMemo(() => [date], [date])
  return useTransitSuggestionsFor(entries, dates, scope)
}

/** The same for several days (the week grid). */
export function useTransitSuggestionsFor(entries: TimeEntry[], dates: readonly string[], scope: TrackScope | undefined): TimeEntry[] {
  const cands = useMemo(() => dates.flatMap((d) => transitCandidates(entries, d, scope)), [entries, dates, scope])
  const [minutes, setMinutes] = useState<ReadonlyMap<string, number | undefined>>(() => new Map())
  useEffect(() => {
    let live = true
    for (const c of cands) {
      if (minutes.has(c.id)) continue
      void travelMinutes(c.from, c.to, c.date, c.gapStart).then((t) => {
        if (live) setMinutes((prev) => new Map(prev).set(c.id, t))
      })
    }
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cands])
  return useMemo(() => (scope ? transitEntries(cands, minutes, scope) : []), [cands, minutes, scope])
}
