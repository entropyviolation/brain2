/**
 * lib/person-types.ts — Catalog **Person** item type
 *
 * Birthday and standing notes are the catalog attributes. The rest of the
 * biography is `Task.personProfile` (`lib/person-profile.ts`): a Person type
 * already saved in the vault still shows those fields, because seeding does
 * not rewrite a type the person has already kept. Joins to Company tracking
 * are `Task.personPipelines` (`lib/people-i-know.ts`). A Company pen is the
 * association; Company time is the blocks painted with that pen. A stored
 * timeblock row is kept. A later join is a new pipeline kind.
 */
import type { AttributeDefinition, ItemTypeDefinition } from "@/lib/types"

export const PERSON_TYPE_ID = "person"

export const PERSON_ATTR = {
  birthday: "birthday",
  notes: "notes",
} as const

const PERSON_ATTRIBUTES: AttributeDefinition[] = [
  { id: PERSON_ATTR.birthday, name: "Birthday", type: "datetime", datetimeMode: "date" },
  { id: PERSON_ATTR.notes, name: "Notes", type: "string" },
]

export function getPersonTypeDefinition(): ItemTypeDefinition {
  return {
    id: PERSON_TYPE_ID,
    name: "Person",
    pluralName: "People",
    itemLabel: "person",
    description:
      "Someone you know. Birthday and standing notes live on this type. Full name, nicknames, relation, when you met, Instagram, address, dated notes, interactions, gift notes, and Close live on the person. A Company pen is the association. Company time is the blocks painted with that pen.",
    builtin: true,
    kind: "catalog",
    color: "#0f766e",
    attributes: PERSON_ATTRIBUTES,
    displayedAttributes: [PERSON_ATTR.birthday, PERSON_ATTR.notes],
    detailPanels: ["details"],
    detailLayout: {
      featuredAttributeIds: [PERSON_ATTR.birthday, PERSON_ATTR.notes],
    },
    capabilities: {},
  }
}

export function withPersonType(existing: ItemTypeDefinition[]): ItemTypeDefinition[] {
  if (existing.some((t) => t.id === PERSON_TYPE_ID)) return existing
  return [...existing, getPersonTypeDefinition()]
}
