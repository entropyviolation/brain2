/**
 * components/Home/Tracking/tracking-desk-slots.tsx — Where desk pieces mount
 *
 * The Home Tracking desk is three bays plus the lace-framed writing region
 * under them. A view that owns a piece of state renders that piece into a
 * slot elsewhere on the desk with a portal: the week grid's Fill fields go
 * into the instrument column's tool well (`fillSlot`), and its day / week
 * summaries go into the lace region (`summarySlot`). Outside the desk (the
 * compact header grid, tests) both are null and views render inline.
 */
"use client"

import { createContext, useContext } from "react"

export type TrackingDeskSlots = {
  fillSlot: HTMLElement | null
  summarySlot: HTMLElement | null
}

export const TrackingDeskSlotsContext = createContext<TrackingDeskSlots>({ fillSlot: null, summarySlot: null })

export function useTrackingDeskSlots(): TrackingDeskSlots {
  return useContext(TrackingDeskSlotsContext)
}
