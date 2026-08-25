import { describe, expect, it } from "vitest"
import {
  FALLBACK_LIST_NAME,
  IPHONE_NOTES_INGEST_FOLDER_NAME,
  NOTES_TO_INGEST_LIST_NAME,
  ensureIphoneNotesIngestDestination,
  filterNewNotes,
  ingestedAppleNoteIds,
  mergeNoteBodies,
  noteDisplayTitle,
  noteToBulkAddDraft,
  noteToListItem,
  noteToParkedItem,
  notesPeriodRange,
  parseAppleNotesPayload,
  parseBulkAddText,
  persistIngestedNoteIds,
  stripNoteHtml,
  type AppleNote,
} from "@/lib/apple-notes"
import type { Folder, List } from "@/lib/types"

function note(over: Partial<AppleNote> = {}): AppleNote {
  return {
    id: "n1",
    title: "Milk",
    body: "2 percent",
    folder: "Groceries",
    account: "iCloud",
    createdAt: "2026-08-20T12:00:00.000Z",
    modifiedAt: "2026-08-21T12:00:00.000Z",
    ...over,
  }
}

describe("stripNoteHtml", () => {
  it("converts Notes HTML into plaintext", () => {
    expect(stripNoteHtml("<div>Hello<br>world</div>")).toBe("Hello\nworld")
  })

  it("decodes entities and drops empty markup", () => {
    expect(stripNoteHtml("<p>A &amp; B&nbsp;C</p>")).toBe("A & B C")
  })
})

describe("noteDisplayTitle", () => {
  it("prefers the real title", () => {
    expect(noteDisplayTitle(note())).toBe("Milk")
  })

  it("falls back to the first body line for New Note", () => {
    expect(noteDisplayTitle(note({ title: "New Note", body: "Call dentist\nTomorrow" }))).toBe("Call dentist")
  })
})

describe("parseAppleNotesPayload", () => {
  it("drops recently deleted and sorts newest first", () => {
    const parsed = parseAppleNotesPayload([
      { id: "old", title: "Old", body: "x", folder: "Work", modifiedAt: "2026-01-01T00:00:00.000Z" },
      { id: "new", title: "New", body: "<b>Hi</b>", folder: "Work", modifiedAt: "2026-08-01T00:00:00.000Z" },
      { id: "trash", title: "Gone", body: "z", folder: "Recently Deleted", modifiedAt: "2026-08-02T00:00:00.000Z" },
    ])
    expect(parsed.map((n) => n.id)).toEqual(["new", "old"])
    expect(parsed[0].body).toBe("Hi")
  })

  it("fills a local id when Notes omitted one", () => {
    const parsed = parseAppleNotesPayload([{ title: "Solo", body: "x", modifiedAt: "2026-08-01T00:00:00.000Z" }])
    expect(parsed[0].id.length).toBeGreaterThan(0)
  })
})

describe("notesPeriodRange", () => {
  const now = new Date(2026, 7, 25, 15, 30, 0)

  it("uses the last 7 days for the week preset", () => {
    const { since, until } = notesPeriodRange("7d", now)
    expect(until).toEqual(now)
    expect(since.getTime()).toBe(now.getTime() - 7 * 86400000)
  })

  it("starts this year on Jan 1 local", () => {
    const { since } = notesPeriodRange("year", now)
    expect(since).toEqual(new Date(2026, 0, 1))
  })

  it("honors a custom inclusive local range", () => {
    const { since, until } = notesPeriodRange("custom", now, "2026-08-01", "2026-08-10")
    expect(since).toEqual(new Date(2026, 7, 1, 0, 0, 0, 0))
    expect(until.getFullYear()).toBe(2026)
    expect(until.getMonth()).toBe(7)
    expect(until.getDate()).toBe(10)
    expect(until.getHours()).toBe(23)
  })
})

describe("ingestedAppleNoteIds / filterNewNotes", () => {
  it("skips notes already stored as list items", () => {
    localStorage.clear()
    const ids = ingestedAppleNoteIds([{ attributes: { appleNoteId: "n1" } }, { attributes: {} }])
    expect(filterNewNotes([note({ id: "n1" }), note({ id: "n2", title: "Eggs" })], ids).map((n) => n.id)).toEqual(["n2"])
  })

  it("also skips ids persisted from a prior ingest", () => {
    localStorage.clear()
    persistIngestedNoteIds(["n1"])
    const ids = ingestedAppleNoteIds([])
    expect(filterNewNotes([note({ id: "n1" }), note({ id: "n2", title: "Eggs" })], ids).map((n) => n.id)).toEqual(["n2"])
  })
})

describe("noteToListItem", () => {
  it("files the note onto the list with the full body, not title-only", () => {
    const list: List = { id: "g", name: "Groceries", color: "#111", createdAt: new Date() }
    const item = noteToListItem(note(), list)
    expect(item.lists).toEqual(["g"])
    expect(item.title).toBe("Milk")
    expect(item.description).toContain("2 percent")
    expect(item.body).toBe("2 percent")
    expect(item.attributes?.appleNoteId).toBe("n1")
    expect(item.attributes?.source).toBe("apple-notes")
    expect(item.tags).toEqual(["Groceries"])
  })

  it("uses the fallback list name constant", () => {
    expect(FALLBACK_LIST_NAME).toBe("From Notes")
  })
})

describe("mergeNoteBodies", () => {
  it("fills preview rows with pulled plaintext", () => {
    const previews = [note({ body: "" }), note({ id: "n2", title: "Eggs", body: "" })]
    const full = [note({ body: "2 percent organic" })]
    const merged = mergeNoteBodies(previews, full)
    expect(merged[0].body).toBe("2 percent organic")
    expect(merged[1].body).toBe("")
  })
})

describe("noteToBulkAddDraft / parseBulkAddText", () => {
  it("turns a reminder note into List:\\nitem draft", () => {
    const draft = noteToBulkAddDraft(note({ title: "Weekend", body: "Weekend\nMilk\nEggs" }))
    expect(draft).toBe("Weekend:\nMilk\nEggs")
    expect(parseBulkAddText(draft)).toEqual([{ listName: "Weekend", items: ["Milk", "Eggs"] }])
  })

  it("keeps existing Category: syntax", () => {
    expect(noteToBulkAddDraft(note({ title: "x", body: "Groceries:\nMilk\nBread" }))).toBe("Groceries:\nMilk\nBread")
  })
})

describe("noteToParkedItem", () => {
  it("stores the full note text, not just the title", () => {
    const list: List = { id: "park", name: "notes to ingest", color: "#111", createdAt: new Date() }
    const item = noteToParkedItem(note({ body: "buy oat milk\ncall dentist" }), list)
    expect(item.description).toContain("buy oat milk")
    expect(item.description).toContain("call dentist")
    expect(item.body).toContain("buy oat milk")
    expect(item.attributes?.ingestStatus).toBe("parked")
  })
})

describe("ensureIphoneNotesIngestDestination", () => {
  it("creates the iPhone Notes Ingest folder and notes to ingest list", () => {
    const folders: Folder[] = []
    const lists: List[] = []
    const dest = ensureIphoneNotesIngestDestination({
      lists,
      folders,
      addList: (l) => lists.push(l),
      addFolder: (f) => folders.push(f),
      addListToFolder: (folderId, listId) => {
        const f = folders.find((x) => x.id === folderId)
        if (f && !f.listIds.includes(listId)) f.listIds.push(listId)
      },
    })
    expect(dest.folder.name).toBe(IPHONE_NOTES_INGEST_FOLDER_NAME)
    expect(dest.list.name).toBe(NOTES_TO_INGEST_LIST_NAME)
    expect(folders[0].listIds).toContain(dest.list.id)
  })
})
