/**
 * lib/attribute-type-catalog.ts — What each attribute type is for
 *
 * One entry per canonical `AttributeType`: an engraved glyph, the label
 * (`ATTRIBUTE_TYPE_LABELS`), one plain sentence on what it holds, and an
 * example drawn from real uses (books, flights, places, rooms). Item detail's
 * type picker and attribute cells read this so a type is never just a word in
 * a dropdown.
 */
import type { AttributeType } from "@/lib/types"
import { ATTRIBUTE_TYPE_LABELS } from "@/lib/attribute-utils"

export type AttributeTypeGroup = "Words" | "Numbers" | "Choices" | "Time" | "Media" | "References"

export interface AttributeTypeInfo {
  type: AttributeType
  label: string
  /** Two-to-three character engraved glyph for the type key. */
  glyph: string
  group: AttributeTypeGroup
  /** What it holds, one sentence. */
  blurb: string
  /** Real-shaped example. */
  example: string
}

const INFO: Record<AttributeType, Omit<AttributeTypeInfo, "type" | "label">> = {
  string: { glyph: "Aa", group: "Words", blurb: "Free text, one line or a paragraph.", example: "Author · Address · Booking ref" },
  multistring: { glyph: "≡", group: "Words", blurb: "Several short entries kept as chips.", example: "Layovers · Genres · Nicknames" },
  link: { glyph: "↗", group: "Words", blurb: "A web address you can open.", example: "Letterboxd page · PDF link" },
  number: { glyph: "#", group: "Numbers", blurb: "A number, with an optional unit.", example: "Cost $ · Width in · Pages" },
  goal: { glyph: "x/y", group: "Numbers", blurb: "Progress toward a target, drawn as a meter.", example: "Pages read / page count" },
  formula: { glyph: "ƒ", group: "Numbers", blurb: "Computed from this item's other attributes.", example: "=price * quantity" },
  boolean: { glyph: "◉", group: "Choices", blurb: "Yes or no, as a checkbox or a rocker.", example: "Booked · Owned · Follows back" },
  selection: { glyph: "▾", group: "Choices", blurb: "Pick one (or several) from options you name.", example: "Status · Kind · Priority" },
  color: { glyph: "▣", group: "Choices", blurb: "A swatch color.", example: "Paint · Fabric · Label" },
  datetime: { glyph: "◷", group: "Time", blurb: "A date, a clock time, or both.", example: "Departure · Date met · Due" },
  image: { glyph: "▨", group: "Media", blurb: "One picture shown inline.", example: "Cover · Poster · Photo" },
  multiimage: { glyph: "▦", group: "Media", blurb: "A small gallery of pictures.", example: "Room photos · Outfit shots" },
  file: { glyph: "▤", group: "Media", blurb: "One attached file of any kind.", example: "Ticket PDF · Lease" },
  multifile: { glyph: "▥", group: "Media", blurb: "Several attached files.", example: "Receipts · Chapters" },
  item: { glyph: "◇", group: "References", blurb: "Points at another item in your vault.", example: "Matched book · Host · Project" },
  list: { glyph: "☰", group: "References", blurb: "Points at one of your lists.", example: "Packing list · Source list" },
}

export const ATTRIBUTE_TYPE_GROUPS: AttributeTypeGroup[] = ["Words", "Numbers", "Choices", "Time", "Media", "References"]

/** Every type the creator offers, in picker order. */
export const CREATABLE_ATTRIBUTE_TYPES: AttributeType[] = [
  "string",
  "multistring",
  "link",
  "number",
  "goal",
  "formula",
  "boolean",
  "selection",
  "color",
  "datetime",
  "image",
  "multiimage",
  "file",
  "multifile",
  "item",
  "list",
]

export function attributeTypeInfo(type: AttributeType): AttributeTypeInfo {
  const info = INFO[type] ?? INFO.string
  return { type, label: ATTRIBUTE_TYPE_LABELS[type] ?? type, ...info }
}

export function attributeTypesByGroup(): { group: AttributeTypeGroup; types: AttributeTypeInfo[] }[] {
  return ATTRIBUTE_TYPE_GROUPS.map((group) => ({
    group,
    types: CREATABLE_ATTRIBUTE_TYPES.map(attributeTypeInfo).filter((info) => info.group === group),
  }))
}

/** Types whose value editor wants a full-width cell (a gallery, a list of chips, a paragraph). */
export function attributeIsWide(type: AttributeType): boolean {
  return type === "multiimage" || type === "multifile" || type === "image"
}
