/**
 * lib/location-types.ts — Built-in **Location** item type.
 *
 * A place: a city, a house, a café, a country. People link to it with the
 * place relations in `lib/person-relations.ts` (`lives-in`, `born-in`,
 * `grew-up-in`). Locations nest with `located-in` (transitive).
 *
 * Pure + serializable. Registered via `withLocationType()` in
 * `lib/item-types.ts`, like Flight.
 */
import type { AttributeDefinition, ItemTypeDefinition } from "@/lib/types"

export const LOCATION_TYPE_ID = "location"

export const LOCATION_ATTR = {
  kind: "locationKind",
  address: "address",
  city: "city",
  region: "region",
  country: "country",
  latitude: "latitude",
  longitude: "longitude",
} as const

const LOCATION_ATTRIBUTES: AttributeDefinition[] = [
  {
    id: LOCATION_ATTR.kind,
    name: "Kind",
    type: "selection",
    options: ["Home", "City", "Region", "Country", "Venue", "Business", "Nature", "Other"],
  },
  { id: LOCATION_ATTR.address, name: "Address", type: "string" },
  { id: LOCATION_ATTR.city, name: "City", type: "string" },
  { id: LOCATION_ATTR.region, name: "Region", type: "string" },
  { id: LOCATION_ATTR.country, name: "Country", type: "string" },
  { id: LOCATION_ATTR.latitude, name: "Latitude", type: "number", allowFloat: true },
  { id: LOCATION_ATTR.longitude, name: "Longitude", type: "number", allowFloat: true },
]

export function getLocationTypeDefinition(): ItemTypeDefinition {
  return {
    id: LOCATION_TYPE_ID,
    name: "Location",
    pluralName: "Locations",
    itemLabel: "location",
    description: "A place: home, city, venue, country. People and items link to it; places nest with located in.",
    builtin: true,
    kind: "catalog",
    color: "#5b8a72",
    attributes: LOCATION_ATTRIBUTES,
    displayedAttributes: [LOCATION_ATTR.kind, LOCATION_ATTR.city, LOCATION_ATTR.country],
    detailPanels: ["details"],
  }
}

/** Idempotent: appends Location when missing. */
export function withLocationType(existing: ItemTypeDefinition[]): ItemTypeDefinition[] {
  if (existing.some((t) => t.id === LOCATION_TYPE_ID)) return existing
  return [...existing, getLocationTypeDefinition()]
}
