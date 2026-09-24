/**
 * lib/item-type-recipes.ts — Optional starter schemas + implied-action hints
 *
 * Shown in the item-type editor so users can build Book / Furniture / Resource /
 * Shopping (or wire implied actions) without reading the code. Applying a recipe
 * returns a *new* user type definition — it never silently overwrites an
 * existing customized catalog type.
 */
import type { ItemTypeDefinition } from "@/lib/types"
import { getBookTypeDefinition } from "@/lib/book-types"
import {
  getFurnitureTypeDefinition,
  getResourceTypeDefinition,
  getShoppingTypeDefinition,
} from "@/lib/catalog-types"

export interface ItemTypeRecipe {
  id: string
  name: string
  summary: string
  hint: string
  build: () => ItemTypeDefinition
}

function asUserType(def: ItemTypeDefinition, id: string, name: string): ItemTypeDefinition {
  const { builtin: _b, kind: _k, ...rest } = def
  return { ...rest, id, name, builtin: undefined, kind: undefined }
}

export const ITEM_TYPE_RECIPES: ItemTypeRecipe[] = [
  {
    id: "book",
    name: "Book",
    summary: "Cover image, pages read, author, reading status.",
    hint: "Wire implied actions: on Update, when Pages read increases → Log action “read {delta} pages of {title}” (counts in Done + points) and Increment habit (pick your pages/day habit). The seeded Book type already includes these rules targeting the default “Read at least 10 pages per day” habit.",
    build: () => asUserType(getBookTypeDefinition(), "my-book", "My book"),
  },
  {
    id: "furniture",
    name: "Furniture",
    summary: "Photo, room, dimensions — no schedule tab.",
    hint: "Leave Scheduleable unchecked. A wishlist rug should not ask to be scheduled. Completing is optional; most furniture items are just records.",
    build: () => asUserType(getFurnitureTypeDefinition(), "my-furniture", "My furniture"),
  },
  {
    id: "resource",
    name: "Resource",
    summary: "URL, kind, notes, plus a document body panel.",
    hint: "Enable the Body panel for long notes. Resources are references, not tasks — skip scheduling unless you explicitly want a deadline.",
    build: () => asUserType(getResourceTypeDefinition(), "my-resource", "My resource"),
  },
  {
    id: "shopping",
    name: "Shopping item",
    summary: "Quantity, store, price, purchased checkbox.",
    hint: "Optional: a list rule “when Purchased is true, add tag bought”. Completing the item can mean “acquired”; you do not need Scheduling.",
    build: () => asUserType(getShoppingTypeDefinition(), "my-shopping-item", "My shopping item"),
  },
  {
    id: "implied-progress",
    name: "Progress → Done + habit",
    summary: "Generic implied-action pattern for any numeric field.",
    hint: "On the type (or a list): trigger Update, When <number field> increased, Then Log action with template “{delta} of {title}” and Increment habit with amount = delta. Works for pages, minutes practiced, km walked, etc.",
    build: () => ({
      id: "my-progress-item",
      name: "Progress item",
      itemLabel: "item",
      description: "A record with a numeric progress field that logs Done activity when the number goes up.",
      attributes: [
        { id: "progress", name: "Progress", type: "number", allowFloat: false },
        { id: "target", name: "Target", type: "number", allowFloat: false },
      ],
      displayedAttributes: ["progress", "target"],
      detailPanels: ["details"],
      detailLayout: { featuredAttributeIds: ["progress", "target"] },
      capabilities: {},
      rules: [
        {
          id: "progress-log",
          name: "Log progress",
          trigger: "update",
          when: { field: "progress", operator: "increased" },
          action: { kind: "logAction", titleTemplate: "{delta} of {title}", awardPoints: true },
        },
      ],
    }),
  },
]
