/**
 * lib/document-types.ts — Built-in **Document** item type.
 *
 * A thing to read: a PDF, Markdown file, article or book. The file can be
 * stored (`docFile`) or only pointed at (`docUrl`, a link or path), like Book.
 * `docCover` and `docExcerpt` give the Document gallery its preview.
 *
 * Pure + serializable. Registered via `withDocumentType()` in `lib/item-types.ts`.
 * A list that allows this type offers the Document gallery display.
 */
import type { AttributeDefinition, ItemTypeDefinition } from "@/lib/types"

export const DOCUMENT_TYPE_ID = "document"

export const DOCUMENT_ATTR = {
  file: "docFile",
  url: "docUrl",
  author: "author",
  kind: "docKind",
  cover: "docCover",
  excerpt: "docExcerpt",
  pages: "docPages",
  status: "docStatus",
} as const

const DOCUMENT_ATTRIBUTES: AttributeDefinition[] = [
  { id: DOCUMENT_ATTR.file, name: "File", type: "file" },
  { id: DOCUMENT_ATTR.url, name: "Link or path", type: "string" },
  { id: DOCUMENT_ATTR.author, name: "Author", type: "string" },
  {
    id: DOCUMENT_ATTR.kind,
    name: "Kind",
    type: "selection",
    optionSource: "manual",
    options: ["Book", "Article", "Paper", "Notes", "Manual", "Other"],
  },
  { id: DOCUMENT_ATTR.cover, name: "Cover", type: "image" },
  { id: DOCUMENT_ATTR.excerpt, name: "Preview text", type: "string" },
  { id: DOCUMENT_ATTR.pages, name: "Pages", type: "number" },
  {
    id: DOCUMENT_ATTR.status,
    name: "Reading",
    type: "selection",
    optionSource: "manual",
    options: ["Unread", "Reading", "Read"],
  },
]

export function getDocumentTypeDefinition(): ItemTypeDefinition {
  return {
    id: DOCUMENT_TYPE_ID,
    name: "Document",
    pluralName: "Documents",
    itemLabel: "document",
    description: "A PDF, Markdown file, article or book to read. Store the file or just point at it; the gallery shows a preview.",
    builtin: true,
    kind: "catalog",
    color: "#7a5a3c",
    attributes: DOCUMENT_ATTRIBUTES,
    defaultAttributeValues: { [DOCUMENT_ATTR.status]: "Unread" },
    displayedAttributes: [DOCUMENT_ATTR.author, DOCUMENT_ATTR.status],
    detailPanels: ["details", "body"],
    capabilities: { completable: false },
  }
}

/** Idempotent: appends Document when missing. */
export function withDocumentType(existing: ItemTypeDefinition[]): ItemTypeDefinition[] {
  if (existing.some((t) => t.id === DOCUMENT_TYPE_ID)) return existing
  return [...existing, getDocumentTypeDefinition()]
}

/** Whether a list takes Document items (so it offers the Document gallery). */
export function listAllowsDocuments(list: { itemTypeId?: string; itemTypeIds?: string[] } | null | undefined): boolean {
  if (!list) return false
  return list.itemTypeIds ? list.itemTypeIds.includes(DOCUMENT_TYPE_ID) : list.itemTypeId === DOCUMENT_TYPE_ID
}
