/**
 * lib/catalog-types.ts — Seeded catalog item types (Furniture, Resource, Shopping)
 *
 * Catalog types are seeded once if missing; user edits persist (unlike system
 * types Task/Note/Operation/Item which are always re-seeded from code). They
 * demonstrate non-task items: a photo of a sofa should not grow a Schedule tab.
 *
 * Pure + serializable. Wired into the built-in registry via `withCatalogTypes()`.
 */
import type { AttributeDefinition, ItemTypeDefinition } from "@/lib/types"

export const FURNITURE_TYPE_ID = "furniture"
export const RESOURCE_TYPE_ID = "resource"
export const SHOPPING_TYPE_ID = "shopping"

export const FURNITURE_ATTR = {
  photo: "photo",
  room: "room",
  width: "width",
  depth: "depth",
  height: "height",
  notes: "notes",
} as const

export const RESOURCE_ATTR = {
  url: "url",
  kind: "kind",
  notes: "notes",
} as const

export const SHOPPING_ATTR = {
  quantity: "quantity",
  purchased: "purchased",
  store: "store",
  price: "price",
} as const

const FURNITURE_ATTRIBUTES: AttributeDefinition[] = [
  { id: FURNITURE_ATTR.photo, name: "Photo", type: "image" },
  { id: FURNITURE_ATTR.room, name: "Room", type: "string" },
  { id: FURNITURE_ATTR.width, name: "Width", type: "number", unit: "in", allowFloat: true },
  { id: FURNITURE_ATTR.depth, name: "Depth", type: "number", unit: "in", allowFloat: true },
  { id: FURNITURE_ATTR.height, name: "Height", type: "number", unit: "in", allowFloat: true },
  { id: FURNITURE_ATTR.notes, name: "Notes", type: "string" },
]

const RESOURCE_ATTRIBUTES: AttributeDefinition[] = [
  { id: RESOURCE_ATTR.url, name: "URL", type: "link" },
  {
    id: RESOURCE_ATTR.kind,
    name: "Kind",
    type: "selection",
    optionSource: "manual",
    options: ["article", "video", "tool", "person", "other"],
  },
  { id: RESOURCE_ATTR.notes, name: "Notes", type: "string" },
]

const SHOPPING_ATTRIBUTES: AttributeDefinition[] = [
  { id: SHOPPING_ATTR.quantity, name: "Quantity", type: "number", allowFloat: false },
  { id: SHOPPING_ATTR.purchased, name: "Purchased", type: "boolean", booleanDisplay: "checkbox" },
  { id: SHOPPING_ATTR.store, name: "Store", type: "string" },
  { id: SHOPPING_ATTR.price, name: "Price", type: "number", unit: "$", allowFloat: true },
]

export function getFurnitureTypeDefinition(): ItemTypeDefinition {
  return {
    id: FURNITURE_TYPE_ID,
    name: "Furniture",
    pluralName: "Furniture",
    itemLabel: "piece",
    description: "A physical object: photo, room, dimensions. Not a task — no schedule or complete chrome.",
    builtin: true,
    kind: "catalog",
    color: "#78716c",
    attributes: FURNITURE_ATTRIBUTES,
    displayedAttributes: [FURNITURE_ATTR.room, FURNITURE_ATTR.width, FURNITURE_ATTR.depth],
    detailPanels: ["details"],
    detailLayout: {
      heroImageAttrId: FURNITURE_ATTR.photo,
      featuredAttributeIds: [FURNITURE_ATTR.room],
    },
    capabilities: {},
  }
}

export function getResourceTypeDefinition(): ItemTypeDefinition {
  return {
    id: RESOURCE_TYPE_ID,
    name: "Resource",
    pluralName: "Resources",
    itemLabel: "resource",
    description: "A reference: URL, kind, notes, and an optional document body. Not scheduleable.",
    builtin: true,
    kind: "catalog",
    color: "#0369a1",
    attributes: RESOURCE_ATTRIBUTES,
    displayedAttributes: [RESOURCE_ATTR.kind, RESOURCE_ATTR.url],
    detailPanels: ["details", "body"],
    capabilities: {},
  }
}

export function getShoppingTypeDefinition(): ItemTypeDefinition {
  return {
    id: SHOPPING_TYPE_ID,
    name: "Shopping item",
    pluralName: "Shopping items",
    itemLabel: "item",
    description: "A wishlist / shopping-list row: quantity, store, price, purchased. Completing is optional.",
    builtin: true,
    kind: "catalog",
    color: "#15803d",
    attributes: SHOPPING_ATTRIBUTES,
    defaultAttributeValues: {
      [SHOPPING_ATTR.quantity]: 1,
      [SHOPPING_ATTR.purchased]: false,
    },
    displayedAttributes: [SHOPPING_ATTR.quantity, SHOPPING_ATTR.price, SHOPPING_ATTR.purchased],
    detailPanels: ["details"],
    detailLayout: {
      featuredAttributeIds: [SHOPPING_ATTR.quantity, SHOPPING_ATTR.purchased, SHOPPING_ATTR.price],
    },
    capabilities: { completable: true },
  }
}

export const CATALOG_TYPE_IDS = [FURNITURE_TYPE_ID, RESOURCE_TYPE_ID, SHOPPING_TYPE_ID] as const

function withType(
  existing: ItemTypeDefinition[],
  id: string,
  getDef: () => ItemTypeDefinition,
): ItemTypeDefinition[] {
  if (existing.some((t) => t.id === id)) return existing
  return [...existing, getDef()]
}

/** Append Furniture / Resource / Shopping if missing (idempotent). */
export function withCatalogTypes(existing: ItemTypeDefinition[]): ItemTypeDefinition[] {
  return withType(
    withType(withType(existing, FURNITURE_TYPE_ID, getFurnitureTypeDefinition), RESOURCE_TYPE_ID, getResourceTypeDefinition),
    SHOPPING_TYPE_ID,
    getShoppingTypeDefinition,
  )
}
