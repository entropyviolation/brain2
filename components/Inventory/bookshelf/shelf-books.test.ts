/**
 * Shelf mapping: membership, cover uri, and search matches. No WebGL.
 */
import { describe, expect, it } from "vitest"
import { BOOK_ATTR, BOOK_TYPE_ID, getBookTypeDefinition } from "@/lib/book-types"
import type { ItemTypeDefinition, Task } from "@/lib/types"
import { coverFrame, coverUriForTask, shelfBooks, shelfGesture, shelfMatchIds, shelfMeasures, shelfSearchEnter, tasksForShelf } from "./shelf-books"

function task(partial: Partial<Task> & Pick<Task, "id">): Task {
  return partial as Task
}

const bookType = getBookTypeDefinition()
const bareBook: ItemTypeDefinition = { ...bookType, detailLayout: undefined }
const filmType: ItemTypeDefinition = {
  ...bookType,
  id: "film",
  name: "Film",
  detailLayout: { heroImageAttrId: "poster" },
}

const coverFile = {
  id: "file-1",
  name: "middlemarch.jpg",
  mime: "image/jpeg",
  uri: "idb:middlemarch",
}

const novels = [
  task({
    id: "mid",
    title: "Middlemarch",
    description: "Middlemarch",
    lists: ["novels"],
    type: BOOK_TYPE_ID,
    attributes: { [BOOK_ATTR.cover]: coverFile },
  }),
  task({
    id: "done",
    title: "Finished Tale",
    description: "Finished Tale",
    lists: ["novels"],
    type: BOOK_TYPE_ID,
    completed: true,
    attributes: { [BOOK_ATTR.cover]: "idb:tale-string" },
  }),
  task({
    id: "emma",
    title: "Emma",
    description: "Emma",
    lists: ["novels"],
    type: BOOK_TYPE_ID,
  }),
  task({
    id: "other",
    title: "Outline",
    description: "Outline",
    lists: ["essays"],
  }),
  task({
    id: "poster",
    title: "Night Window",
    description: "Night Window",
    lists: ["novels"],
    type: "film",
    attributes: {
      cover: { id: "nope", name: "x", mime: "image/png", uri: "idb:not-the-hero" },
      poster: { id: "p", name: "poster.png", mime: "image/png", uri: "idb:poster" },
    },
  }),
  task({
    id: "plain",
    title: "Loose Note",
    description: "Loose Note",
    lists: ["novels"],
    attributes: { cover: "idb:ignored" },
  }),
]

describe("shelf books", () => {
  const types = [bookType, bareBook, filmType]
  const onShelf = tasksForShelf(novels, "novels")

  it("keeps finished items on the named list and orders them by title", () => {
    expect(tasksForShelf(novels, null)).toEqual([])
    expect(onShelf.map((row) => row.id)).toEqual(["emma", "done", "plain", "mid", "poster"])
  })

  it("maps id, title, and cover uri from the hero attribute", () => {
    const books = shelfBooks(onShelf, types)
    expect(books.map((book) => book.title)).toEqual([
      "Emma",
      "Finished Tale",
      "Loose Note",
      "Middlemarch",
      "Night Window",
    ])
    const byId = new Map(books.map((book) => [book.id, book.coverUri]))
    expect(byId.get("mid")).toBe("idb:middlemarch")
    expect(byId.get("done")).toBe("idb:tale-string")
    expect(byId.get("emma")).toBeNull()
    expect(byId.get("poster")).toBe("idb:poster")
    expect(byId.get("plain")).toBe("idb:ignored")
  })

  it("shows a cover saved on a task", () => {
    const taskType: ItemTypeDefinition = { id: "task", name: "Task", attributes: [] }
    const row = task({
      id: "pihkal",
      title: "PiHKAL",
      type: "task",
      attributes: { cover: "idb:pihkal" },
    })
    expect(coverUriForTask(row, [taskType, bookType])).toBe("idb:pihkal")
  })

  it("uses the book cover attribute when the type has no hero", () => {
    const row = task({
      id: "bare",
      title: "Bare",
      type: BOOK_TYPE_ID,
      attributes: { [BOOK_ATTR.cover]: { id: "c", name: "c.jpg", mime: "image/jpeg", uri: "idb:bare" } },
    })
    expect(coverUriForTask(row, [bareBook])).toBe("idb:bare")
  })

  it("reads stored centimeters and fits a pamphlet and a dictionary on the shelf", () => {
    const row = task({
      id: "sized",
      title: "Dictionary",
      type: BOOK_TYPE_ID,
      attributes: { [BOOK_ATTR.heightCm]: 28, [BOOK_ATTR.widthCm]: 20, [BOOK_ATTR.thicknessCm]: 7 },
    })
    const [book] = shelfBooks([row], [bookType])
    expect(book.thicknessCm).toBe(7)
    expect(book.heightCm).toBe(28)
    const thin = shelfMeasures({ coverUri: null, heightCm: 14, widthCm: 11, thicknessCm: 0.4 })
    const thick = shelfMeasures(book)
    expect(thin).not.toBeNull()
    expect(thick).not.toBeNull()
    expect(thick!.w).toBeGreaterThan(thin!.w)
    expect(thick!.h).toBeGreaterThan(thin!.h)
    expect(thin!.w).toBeGreaterThanOrEqual(0.16)
    expect(thick!.w).toBeLessThanOrEqual(0.26)
    expect(shelfMeasures({ coverUri: null, heightCm: null, widthCm: null, thicknessCm: null })).toBeNull()
  })

  it("pulls a book out before it opens", () => {
    expect(shelfGesture(null, "emma")).toEqual({ kind: "pull", id: "emma" })
    expect(shelfGesture("emma", "emma")).toEqual({ kind: "open", id: "emma" })
    expect(shelfGesture("emma", "mid")).toEqual({ kind: "pull", id: "mid" })
    expect(shelfGesture("emma", null)).toEqual({ kind: "clear" })
    expect(shelfSearchEnter(null, ["emma"])).toEqual({ kind: "pull", id: "emma" })
    expect(shelfSearchEnter("emma", ["emma"])).toEqual({ kind: "open", id: "emma" })
    expect(shelfSearchEnter(null, [])).toBeNull()
    expect(shelfSearchEnter(null, ["emma", "mid"])).toBeNull()
  })

  it("crops a cover onto the front board without stretching it", () => {
    const square = coverFrame(1000, 1000, 2 / 3)
    expect(square.repeatY).toBe(1)
    expect(square.repeatX).toBeCloseTo((2 / 3) / 1, 5)
    expect(square.offsetX).toBeCloseTo((1 - square.repeatX) / 2, 5)
    expect(square.offsetY).toBe(0)

    const portrait = coverFrame(800, 1200, 2 / 3)
    expect(portrait.repeatX).toBe(1)
    expect(portrait.repeatY).toBeCloseTo(1, 5)
    expect(portrait.offsetX).toBe(0)

    const tall = coverFrame(400, 1200, 2 / 3)
    expect(tall.repeatX).toBe(1)
    expect(tall.repeatY).toBeLessThan(1)
    expect(tall.offsetY).toBeCloseTo((1 - tall.repeatY) / 2, 5)
  })

  it("matches titles with the same words as list search", () => {
    expect(shelfMatchIds(onShelf, "   ")).toEqual([])
    expect(shelfMatchIds(onShelf, "emma")).toEqual(["emma"])
    expect(shelfMatchIds(onShelf, "finished tale")).toEqual(["done"])
    expect(shelfMatchIds(onShelf, "tale finished")).toEqual(["done"])
    expect(shelfMatchIds(onShelf, "night")).toEqual(["poster"])
    expect(shelfMatchIds(onShelf, "outline")).toEqual([])
    expect(shelfMatchIds(onShelf, "le guin")).toEqual([])
  })
})
