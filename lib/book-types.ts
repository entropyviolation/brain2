/**
 * lib/book-types.ts — Built-in **Book** item type (Workstream D)
 *
 * Defines the built-in `book` `ItemTypeDefinition`: a reading-list entry with an
 * author, ISBN, reading status, and a `multifile` attribute for attached PDFs
 * (e-books, papers) whose text is extracted + indexed (see `lib/file-extract.ts`
 * + `lib/search.ts`). It is the canonical demonstration of the new file/PDF
 * attribute primitive on a real, user-facing type.
 *
 * The book's *title* is the item's core `title`/name (mirrors the precedent in
 * `lib/operation-types.ts` / `lib/second-brain-types.ts`, which never redefine
 * `title` as an attribute), so the schema only carries the extra fields.
 *
 * Pure + serializable: no store or React imports here. Registered into the
 * built-in registry via `withBookType()` (see `lib/item-types.ts`) and re-exposed
 * as an idempotent `seedBookType()` store action.
 */
import type { AttributeDefinition, ItemTypeDefinition } from "@/lib/types"

/** Stable item-type id, referenced by helpers, components, and tests. */
export const BOOK_TYPE_ID = "book"

/** Attribute ids for the Book type (centralized so UI/tests avoid magic strings). */
export const BOOK_ATTR = {
  author: "author",
  isbn: "isbn",
  status: "status",
  /** Attached PDFs / documents (multifile). Text is extracted + indexed. */
  files: "files",
} as const

/** Reading-status options a Book moves through. */
export const BOOK_STATUSES = ["to-read", "reading", "read", "abandoned"] as const
export type BookStatus = (typeof BOOK_STATUSES)[number]

/** Default status applied to a freshly created Book. */
export const DEFAULT_BOOK_STATUS: BookStatus = "to-read"

const BOOK_ATTRIBUTES: AttributeDefinition[] = [
  { id: BOOK_ATTR.author, name: "Author", type: "string" },
  { id: BOOK_ATTR.isbn, name: "ISBN", type: "string" },
  {
    id: BOOK_ATTR.status,
    name: "Status",
    type: "selection",
    optionSource: "manual",
    options: [...BOOK_STATUSES],
  },
  { id: BOOK_ATTR.files, name: "Files", type: "multifile" },
]

/** The Book item-type definition (built-in; always available app-wide). */
export function getBookTypeDefinition(): ItemTypeDefinition {
  return {
    id: BOOK_TYPE_ID,
    name: "Book",
    pluralName: "Books",
    itemLabel: "book",
    description:
      "A reading-list entry: author, ISBN, and reading status, with attached PDFs whose text is extracted and searchable.",
    builtin: true,
    color: "#b45309",
    attributes: BOOK_ATTRIBUTES,
    defaultAttributeValues: {
      [BOOK_ATTR.status]: DEFAULT_BOOK_STATUS,
    },
    displayedAttributes: [BOOK_ATTR.author, BOOK_ATTR.status, BOOK_ATTR.isbn],
    detailPanels: ["details"],
    capabilities: { completable: true },
  }
}

/** Book type id(s), for presence checks / seeding. */
export const BOOK_TYPE_IDS = [BOOK_TYPE_ID] as const

/**
 * Pure "register the Book type" merge: returns `existing` with the Book type
 * appended if missing (existing definitions are preserved untouched, so this is
 * idempotent and never removes a user type). Wired into the built-in registry
 * and re-exposed as `seedBookType()` on the item-type store.
 */
export function withBookType(existing: ItemTypeDefinition[]): ItemTypeDefinition[] {
  if (existing.some((t) => t.id === BOOK_TYPE_ID)) return existing
  return [...existing, getBookTypeDefinition()]
}
