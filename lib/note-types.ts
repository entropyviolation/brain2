/**
 * lib/note-types.ts — Document / rich-note item type (Brain2 feature #184/#84)
 *
 * Defines the built-in-style `note` `ItemTypeDefinition` that turns COGS into a
 * lightweight second brain: a `note` is a free-form document whose primary
 * content is its rich-text/markdown `Item.body`, surfaced through the `"body"`
 * detail panel (`components/ItemDetail/BodyPanel.tsx`). Notes aren't actionable —
 * they don't schedule or complete — but they participate fully in tags, links,
 * and lists like any other item.
 *
 * Mirrors `lib/second-brain-types.ts`: pure + serializable (no store/React
 * imports), exporting the type definition plus a `withNoteType()` merge helper
 * the item-type store wires into seeding during the integration pass.
 */
import type { AttributeDefinition, ItemTypeDefinition } from "@/lib/types"

/** Stable item-type id (referenced by the seed helper + tests). */
export const NOTE_TYPE_ID = "note"

/** Attribute ids for the Note type. Centralized so UI can reference them. */
export const NOTE_ATTR = {
  summary: "summary",
  status: "status",
} as const

const NOTE_ATTRIBUTES: AttributeDefinition[] = [
  { id: NOTE_ATTR.summary, name: "Summary", type: "string" },
  {
    id: NOTE_ATTR.status,
    name: "Status",
    type: "selection",
    optionSource: "manual",
    options: ["draft", "evergreen", "archived"],
  },
]

/**
 * The Note item-type definition. Built-in (cannot be deleted) so the document
 * experience is always available; `completable: false` keeps notes out of the
 * actionable task pipeline. The `"body"` panel hosts the rich-text editor.
 */
export function getNoteTypeDefinition(): ItemTypeDefinition {
  return {
    id: NOTE_TYPE_ID,
    name: "Note",
    pluralName: "Notes",
    itemLabel: "note",
    description:
      "A free-form document whose content lives in its rich-text/markdown body. The backbone of the second brain: link notes to tasks, goals, and each other.",
    builtin: true,
    color: "#0a7c7c",
    attributes: NOTE_ATTRIBUTES,
    defaultAttributeValues: {
      [NOTE_ATTR.status]: "draft",
    },
    displayedAttributes: [NOTE_ATTR.status, NOTE_ATTR.summary],
    // "body" hosts the document editor; "details" exposes attributes/tags/links.
    detailPanels: ["details", "body"],
    capabilities: { completable: false },
  }
}

/** Ids of the note type(s) (for presence checks / seeding). */
export const NOTE_TYPE_IDS = [NOTE_TYPE_ID] as const

/**
 * Pure merge: returns `existing` with the Note type appended if missing. Existing
 * definitions are preserved untouched, so this is idempotent and never removes a
 * user type. The item-type store wraps this in a seeding action during the
 * integration pass.
 */
export function withNoteType(existing: ItemTypeDefinition[]): ItemTypeDefinition[] {
  const present = new Set(existing.map((t) => t.id))
  return present.has(NOTE_TYPE_ID) ? existing : [...existing, getNoteTypeDefinition()]
}
