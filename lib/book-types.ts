/**
 * lib/book-types.ts — Catalog **Book** item type
 *
 * A reading-list entry: cover image, author, ISBN, status, page counts, and
 * attached PDFs. This is the canonical demonstration that item types (not Task
 * defaults) own the detail view — a book shows a large cover and pages-read,
 * not Schedule / Subtasks / Analysis.
 *
 * Catalog seeding: registered if missing; user customizations persist. The
 * default implied-action rules log "read X pages of {title}" into Done and
 * increment the default "Read at least 10 pages per day" habit (`task-9`).
 *
 * Pure + serializable. Wired via `withBookType()` in `lib/item-types.ts`.
 */
import type { AttributeDefinition, ItemTypeDefinition } from "@/lib/types"

/** Stable item-type id, referenced by helpers, components, and tests. */
export const BOOK_TYPE_ID = "book"

/** Default daily-reading habit id from `getDefaultHabits()` — user-rewirable. */
export const BOOK_DEFAULT_READING_HABIT_ID = "task-9"

/** Attribute ids for the Book type (centralized so UI/tests avoid magic strings). */
export const BOOK_ATTR = {
  cover: "cover",
  author: "author",
  isbn: "isbn",
  status: "status",
  pageCount: "pageCount",
  pagesRead: "pagesRead",
  /** Attached PDFs / documents (multifile). Text is extracted + indexed. */
  files: "files",
} as const

/** Reading-status options a Book moves through. */
export const BOOK_STATUSES = ["to-read", "reading", "read", "abandoned"] as const
export type BookStatus = (typeof BOOK_STATUSES)[number]

/** Default status applied to a freshly created Book. */
export const DEFAULT_BOOK_STATUS: BookStatus = "to-read"

const BOOK_ATTRIBUTES: AttributeDefinition[] = [
  { id: BOOK_ATTR.cover, name: "Cover", type: "image" },
  { id: BOOK_ATTR.author, name: "Author", type: "string" },
  { id: BOOK_ATTR.isbn, name: "ISBN", type: "string" },
  {
    id: BOOK_ATTR.status,
    name: "Status",
    type: "selection",
    optionSource: "manual",
    options: [...BOOK_STATUSES],
  },
  { id: BOOK_ATTR.pageCount, name: "Page count", type: "number", allowFloat: false },
  { id: BOOK_ATTR.pagesRead, name: "Pages read", type: "number", allowFloat: false },
  { id: BOOK_ATTR.files, name: "Files", type: "multifile" },
]

/** The Book item-type definition (catalog seed; user-editable after first load). */
export function getBookTypeDefinition(): ItemTypeDefinition {
  return {
    id: BOOK_TYPE_ID,
    name: "Book",
    pluralName: "Books",
    itemLabel: "book",
    description:
      "A reading-list entry with a cover, author, page progress, and attached PDFs. Increasing pages read logs a Done activity and can count toward a daily reading habit.",
    builtin: true,
    kind: "catalog",
    color: "#b45309",
    attributes: BOOK_ATTRIBUTES,
    defaultAttributeValues: {
      [BOOK_ATTR.status]: DEFAULT_BOOK_STATUS,
      [BOOK_ATTR.pagesRead]: 0,
    },
    displayedAttributes: [BOOK_ATTR.author, BOOK_ATTR.status, BOOK_ATTR.pagesRead, BOOK_ATTR.pageCount],
    detailPanels: ["details"],
    detailLayout: {
      heroImageAttrId: BOOK_ATTR.cover,
      featuredAttributeIds: [BOOK_ATTR.pagesRead, BOOK_ATTR.pageCount, BOOK_ATTR.status],
    },
    capabilities: { completable: true },
    rules: [
      {
        id: "book-log-pages-read",
        name: "Log pages read",
        trigger: "update",
        when: { field: BOOK_ATTR.pagesRead, operator: "increased" },
        action: {
          kind: "logAction",
          titleTemplate: "read {delta} pages of {title}",
          awardPoints: true,
        },
      },
      {
        id: "book-habit-pages-read",
        name: "Count toward daily reading habit",
        trigger: "update",
        when: { field: BOOK_ATTR.pagesRead, operator: "increased" },
        action: {
          kind: "incrementHabit",
          habitId: BOOK_DEFAULT_READING_HABIT_ID,
          amount: "delta",
        },
      },
    ],
  }
}

/** Book type id(s), for presence checks / seeding. */
export const BOOK_TYPE_IDS = [BOOK_TYPE_ID] as const

/**
 * Pure "register the Book type" merge: returns `existing` with the Book type
 * appended if missing (existing definitions are preserved untouched).
 */
export function withBookType(existing: ItemTypeDefinition[]): ItemTypeDefinition[] {
  if (existing.some((t) => t.id === BOOK_TYPE_ID)) return existing
  return [...existing, getBookTypeDefinition()]
}
