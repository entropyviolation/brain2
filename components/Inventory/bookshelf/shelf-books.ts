/**
 * components/Inventory/bookshelf/shelf-books.ts — Shelf membership, covers, search
 *
 * Pure. The diorama and the phone list both read this. Membership is
 * `task.lists` (finished items stay). `tasksForList` drops cleared items,
 * so this module does not use it.
 *
 * A cover is the type's hero image when that cell has a picture. Otherwise
 * it is `BOOK_ATTR.cover`, the cell Fetch covers writes, including on a task.
 * Image cells store an `idb:` string; file cells store a `FileValue`. Both
 * yield a uri.
 *
 * Stored centimeters become a spine thickness and a height inside the case's
 * cloth range, so a pamphlet and a dictionary both fit. Without measurements
 * the diorama keeps its varied cloth sizes. A book with a cover stands
 * face-out; the picture fills that face (`coverFrame`). A click pulls one
 * book forward; the next click on that same book is the one that opens it.
 */
import { BOOK_ATTR } from "@/lib/book-types"
import { getItemType } from "@/lib/item-types"
import { itemTitle } from "@/lib/item-utils"
import { filterListItemsBySearch } from "@/lib/list-item-sort"
import type { AttributeValue, FileValue, ItemTypeDefinition, Task } from "@/lib/types"

export interface ShelfBook {
  id: string
  title: string
  /** Attachment uri (`idb:`, `data:`, `http…`), or null when the book has no cover. */
  coverUri: string | null
  /** Centimeters, when the item stores a measurement. */
  heightCm: number | null
  widthCm: number | null
  thicknessCm: number | null
}

/** World units the case already uses for a cloth spine and a face-out cover. */
const SPINE = { thick: [0.16, 0.26] as const, height: [0.62, 0.74] as const, width: [0.3, 0.384] as const }
const FACE = { width: [0.42, 0.54] as const, height: [0.6, 0.705] as const, thick: [0.075, 0.099] as const }
const CM = { height: [12, 32] as const, width: [10, 23] as const, thick: [0.4, 8] as const }

export interface ShelfMeasures {
  /** Along the shelf. Spine thickness when the book is spine-out. */
  w: number
  h: number
  /** Into the case. */
  d: number
}

export type ShelfGesture = { kind: "pull"; id: string } | { kind: "open"; id: string } | { kind: "clear" }

/**
 * First activation pulls the book out. A second activation on that same book
 * opens it. Empty shelf space clears the pull. Search does not call this.
 */
export function shelfGesture(pulledId: string | null, targetId: string | null): ShelfGesture {
  if (!targetId) return { kind: "clear" }
  if (pulledId === targetId) return { kind: "open", id: targetId }
  return { kind: "pull", id: targetId }
}

/** Enter in the search field: one match pulls, and the next Enter opens it. */
export function shelfSearchEnter(pulledId: string | null, matchIds: readonly string[]): ShelfGesture | null {
  if (matchIds.length !== 1) return null
  return shelfGesture(pulledId, matchIds[0])
}

/**
 * Map stored centimeters into the shelf's cloth range. A cover faces out, so
 * thickness is the depth. A cloth spine uses thickness for the width you see.
 * Missing axes stay at the middle of that range. No measurements returns null
 * and the diorama keeps the hashed cloth size.
 */
export function shelfMeasures(
  book: Pick<ShelfBook, "coverUri" | "heightCm" | "widthCm" | "thicknessCm">,
): ShelfMeasures | null {
  const height = positiveCm(book.heightCm)
  const width = positiveCm(book.widthCm)
  const thick = positiveCm(book.thicknessCm)
  if (height == null && width == null && thick == null) return null
  if (book.coverUri) {
    return {
      w: width == null ? mid(FACE.width) : mapCm(width, CM.width, FACE.width),
      h: height == null ? mid(FACE.height) : mapCm(height, CM.height, FACE.height),
      d: thick == null ? mid(FACE.thick) : mapCm(thick, CM.thick, FACE.thick),
    }
  }
  return {
    w: thick == null ? mid(SPINE.thick) : mapCm(thick, CM.thick, SPINE.thick),
    h: height == null ? mid(SPINE.height) : mapCm(height, CM.height, SPINE.height),
    d: width == null ? mid(SPINE.width) : mapCm(width, CM.width, SPINE.width),
  }
}

/** Items on this list, including finished ones, ordered by title. */
export function tasksForShelf(tasks: readonly Task[], listId: string | null): Task[] {
  if (!listId) return []
  return tasks
    .filter((task) => task.lists?.includes(listId))
    .slice()
    .sort((a, b) => itemTitle(a).localeCompare(itemTitle(b)) || a.id.localeCompare(b.id))
}

export function shelfBooks(tasks: readonly Task[], types: readonly ItemTypeDefinition[]): ShelfBook[] {
  return tasks.map((task) => ({
    id: task.id,
    title: itemTitle(task),
    coverUri: coverUriForTask(task, types),
    heightCm: centimeters(task, BOOK_ATTR.heightCm),
    widthCm: centimeters(task, BOOK_ATTR.widthCm),
    thicknessCm: centimeters(task, BOOK_ATTR.thicknessCm),
  }))
}

/**
 * Ids whose titles match `query` the way list search does (every word, title
 * only). A blank query matches nothing, so an empty search does not pull
 * every book forward.
 */
export function shelfMatchIds(tasks: readonly Task[], query: string): string[] {
  if (!query.trim()) return []
  return filterListItemsBySearch(tasks as Task[], query).map((task) => task.id)
}

export function coverUriForTask(task: Task, types: readonly ItemTypeDefinition[]): string | null {
  const type = getItemType(types as ItemTypeDefinition[], task.type)
  const hero = type.detailLayout?.heroImageAttrId
  if (hero) {
    const uri = uriFromAttribute(task.attributes?.[hero])
    if (uri) return uri
  }
  if (hero === BOOK_ATTR.cover) return null
  return uriFromAttribute(task.attributes?.[BOOK_ATTR.cover])
}

/** A `FileValue`, a list of them, or the uri string an image cell stores. */
function uriFromAttribute(value: AttributeValue | undefined): string | null {
  if (typeof value === "string") {
    const uri = value.trim()
    return uri || null
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      const uri = uriFromAttribute(entry as AttributeValue)
      if (uri) return uri
    }
    return null
  }
  if (value && typeof value === "object") {
    const uri = (value as FileValue).uri
    if (typeof uri === "string" && uri.trim()) return uri.trim()
  }
  return null
}

function centimeters(task: Task, id: string): number | null {
  return positiveCm(task.attributes?.[id] as number | string | null | undefined)
}

function positiveCm(value: number | string | null | undefined): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN
  return Number.isFinite(n) && n > 0 ? n : null
}

function mapCm(cm: number, src: readonly [number, number], dst: readonly [number, number]): number {
  const span = src[1] - src[0]
  const t = span <= 0 ? 0 : Math.min(1, Math.max(0, (cm - src[0]) / span))
  return dst[0] + t * (dst[1] - dst[0])
}

function mid(dst: readonly [number, number]): number {
  return (dst[0] + dst[1]) / 2
}

export interface CoverFrame {
  repeatX: number
  repeatY: number
  offsetX: number
  offsetY: number
}

/**
 * Crop a cover so it fills the front board. `faceAspect` is width / height.
 * A wider picture loses its sides. A taller picture loses the top and bottom.
 * The cover is never stretched.
 */
export function coverFrame(imgW: number, imgH: number, faceAspect: number): CoverFrame {
  const imgAspect = imgW / Math.max(imgH, 1)
  const face = faceAspect > 0 ? faceAspect : 2 / 3
  if (imgAspect > face) {
    const repeatX = face / imgAspect
    return { repeatX, repeatY: 1, offsetX: (1 - repeatX) / 2, offsetY: 0 }
  }
  const repeatY = imgAspect / Math.max(face, 0.001)
  return { repeatX: 1, repeatY, offsetX: 0, offsetY: (1 - repeatY) / 2 }
}
