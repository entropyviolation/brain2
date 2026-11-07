/**
 * lib/flight-bimby/index.ts — The Flight BIMBY's tools
 *
 * `looksLikeFlightConfirmation` (is this a booking, not a plan?), `extractFlights` (read it),
 * `fillBlanks` / `searchFlightInfo` (finish it from facts), `addFlightFromInfo` /
 * `fileFlightDraft` (write the Flight item and its event), `createEventFromFlight` (event only).
 */
export { extractFlights, looksLikeFlightConfirmation, missingFields } from "./extract"
export { fillBlanks, searchFlightInfo } from "./lookup"
export { addFlightFromInfo, buildFlightEvent, buildFlightItem, createEventFromFlight, fileFlightDraft, findFlightItem, flightList, flightMinutes } from "./file"
export type { AddFlightsResult } from "./file"
export type { ExtractResult, FiledFlight, FlightDraft } from "./types"
