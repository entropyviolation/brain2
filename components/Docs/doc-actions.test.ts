/**
 * components/Docs/doc-actions.test.ts — Docs note mutations
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useTaskStore } from "@/lib/task-store"
import { NOTE_TYPE_ID, NOTE_ATTR } from "@/lib/note-types"
import {
  createDocument,
  deleteDocument,
  documentFolder,
  documentFont,
  hydrateDocumentsFromIdb,
  listDocumentFolders,
  listDocuments,
  loadDocumentBody,
  renameDocument,
  setDocumentBody,
  setDocumentFolder,
  setDocumentFont,
} from "./doc-actions"
import { clearAllPersistedDocs, getPersistedDoc } from "@/lib/doc-persist"

describe("doc-actions", () => {
  beforeEach(async () => {
    useTaskStore.setState({ tasks: [] })
    await clearAllPersistedDocs()
  })

  it("creates a blank note-typed document with folder and font defaults", () => {
    const doc = createDocument("Q3 plan", "Plans")
    expect(doc.type).toBe(NOTE_TYPE_ID)
    expect(doc.description).toBe("Q3 plan")
    expect(doc.body).toContain("<p>")
    expect(documentFolder(doc)).toBe("Plans")
    expect(documentFont(doc)).toBe("Merriweather")
    expect(useTaskStore.getState().tasks).toHaveLength(1)
  })

  it("renames, folders, fonts, lists, and deletes", () => {
    const a = createDocument("A", "Work")
    const b = createDocument("B", "")
    renameDocument(a.id, "Alpha")
    setDocumentFolder(b.id, "Work")
    setDocumentFont(a.id, "Roboto")

    const tasks = useTaskStore.getState().tasks
    const docs = listDocuments(tasks)
    expect(docs.map((d) => d.description).sort()).toEqual(["Alpha", "B"])
    expect(listDocumentFolders(docs)).toEqual(["Work"])
    expect(docs.find((d) => d.id === a.id)?.attributes?.[NOTE_ATTR.fontFamily]).toBe("Roboto")

    deleteDocument(a.id)
    expect(listDocuments(useTaskStore.getState().tasks)).toHaveLength(1)
  })

  it("ignores disallowed fonts", () => {
    const doc = createDocument("X")
    setDocumentFont(doc.id, "Totally Fake")
    expect(documentFont(useTaskStore.getState().tasks[0]!)).toBe("Merriweather")
  })

  it("writes the full body to IndexedDB so it survives a wiped task store", async () => {
    const doc = createDocument("Keep me", "", "<p>secret body</p>")
    await setDocumentBody(doc.id, "<p>edited forever</p>")
    expect(await loadDocumentBody(doc.id)).toContain("edited forever")

    useTaskStore.setState({ tasks: [] })
    expect(listDocuments(useTaskStore.getState().tasks)).toHaveLength(0)

    await hydrateDocumentsFromIdb()
    const restored = listDocuments(useTaskStore.getState().tasks)
    expect(restored).toHaveLength(1)
    expect(restored[0]?.description).toBe("Keep me")
    expect(await loadDocumentBody(restored[0]!.id)).toContain("edited forever")
  })

  it("saves the body through doc-persist and keeps the renamed title and folder", async () => {
    const doc = createDocument("Scratch", "Inbox", "<p>seed</p>")
    expect(await setDocumentBody(doc.id, "<p>kept sentence</p>")).toBe(true)
    renameDocument(doc.id, "Field note")
    setDocumentFolder(doc.id, "Plans")

    const task = useTaskStore.getState().tasks.find((t) => t.id === doc.id)
    expect(task?.description).toBe("Field note")
    expect(documentFolder(task!)).toBe("Plans")
    expect(task?.body).toContain("kept sentence")

    await vi.waitFor(async () => {
      const rec = await getPersistedDoc(doc.id)
      expect(rec?.title).toBe("Field note")
      expect(rec?.folder).toBe("Plans")
      expect(rec?.body).toContain("kept sentence")
    })
  })
})
