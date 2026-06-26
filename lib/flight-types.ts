/**
 * lib/flight-types.ts — Built-in **Flight** item type (Workstream D)
 *
 * Defines the built-in `flight` `ItemTypeDefinition`: a single booked (or
 * planned) flight segment with airline, flight number, departure/arrival
 * airports + times, structured layovers, a booking reference, cost, and a
 * `booked` flag. These fields are what a future **Itinerary** module reads to
 * "map flights onto the global timeline" — the `departureTime`/`arrivalTime`
 * datetimes make a flight `scheduleable`.
 *
 * Layovers are modelled as a `multistring` of free-form stop descriptors (e.g.
 * "ATL 1h20m") — the most expressive *serializable* shape available in the
 * attribute system (AttributeValue has no nested-object array variant), keeping
 * the definition portable and JSON-safe.
 *
 * Pure + serializable: no store or React imports here. Registered into the
 * built-in registry via `withFlightType()` (see `lib/item-types.ts`) and
 * re-exposed as an idempotent `seedFlightType()` store action.
 */
import type { AttributeDefinition, ItemTypeDefinition } from "@/lib/types"

/** Stable item-type id, referenced by helpers, components, and tests. */
export const FLIGHT_TYPE_ID = "flight"

/** Attribute ids for the Flight type (centralized so UI/tests avoid magic strings). */
export const FLIGHT_ATTR = {
  flightNumber: "flightNumber",
  airline: "airline",
  departureAirport: "departureAirport",
  arrivalAirport: "arrivalAirport",
  departureTime: "departureTime",
  arrivalTime: "arrivalTime",
  /** Structured list of layover stops (e.g. "ATL 1h20m"). */
  layovers: "layovers",
  bookingNumber: "bookingNumber",
  cost: "cost",
  booked: "booked",
} as const

const FLIGHT_ATTRIBUTES: AttributeDefinition[] = [
  { id: FLIGHT_ATTR.flightNumber, name: "Flight Number", type: "string" },
  { id: FLIGHT_ATTR.airline, name: "Airline", type: "string" },
  { id: FLIGHT_ATTR.departureAirport, name: "Departure Airport", type: "string" },
  { id: FLIGHT_ATTR.arrivalAirport, name: "Arrival Airport", type: "string" },
  { id: FLIGHT_ATTR.departureTime, name: "Departure", type: "datetime", datetimeMode: "datetime" },
  { id: FLIGHT_ATTR.arrivalTime, name: "Arrival", type: "datetime", datetimeMode: "datetime" },
  { id: FLIGHT_ATTR.layovers, name: "Layovers", type: "multistring" },
  { id: FLIGHT_ATTR.bookingNumber, name: "Booking Number", type: "string" },
  { id: FLIGHT_ATTR.cost, name: "Cost", type: "number", unit: "$", allowFloat: true },
  { id: FLIGHT_ATTR.booked, name: "Booked", type: "boolean", booleanDisplay: "switch" },
]

/** The Flight item-type definition (built-in; always available app-wide). */
export function getFlightTypeDefinition(): ItemTypeDefinition {
  return {
    id: FLIGHT_TYPE_ID,
    name: "Flight",
    pluralName: "Flights",
    itemLabel: "flight",
    description:
      "A flight segment: airline, flight number, departure/arrival airports and times, layovers, booking reference, and cost. Maps onto the global timeline.",
    builtin: true,
    color: "#0ea5e9",
    attributes: FLIGHT_ATTRIBUTES,
    defaultAttributeValues: {
      [FLIGHT_ATTR.booked]: false,
    },
    displayedAttributes: [
      FLIGHT_ATTR.flightNumber,
      FLIGHT_ATTR.airline,
      FLIGHT_ATTR.departureAirport,
      FLIGHT_ATTR.arrivalAirport,
      FLIGHT_ATTR.departureTime,
    ],
    // Flights have start/end datetimes, so they place on the Scheduler timeline.
    detailPanels: ["details", "scheduling"],
    capabilities: { scheduleable: true, deadline: true },
  }
}

/** Flight type id(s), for presence checks / seeding. */
export const FLIGHT_TYPE_IDS = [FLIGHT_TYPE_ID] as const

/**
 * Pure "register the Flight type" merge: returns `existing` with the Flight type
 * appended if missing (existing definitions are preserved untouched, so this is
 * idempotent and never removes a user type). Wired into the built-in registry
 * and re-exposed as `seedFlightType()` on the item-type store.
 */
export function withFlightType(existing: ItemTypeDefinition[]): ItemTypeDefinition[] {
  if (existing.some((t) => t.id === FLIGHT_TYPE_ID)) return existing
  return [...existing, getFlightTypeDefinition()]
}
