/**
 * components/Docs/doc-actions.test.ts — Docs note mutations
 */
import { beforeEach, describe, expect, it } from "vitest"
import { useTaskStore } from "@/lib/task-store"
import { NOTE_TYPE_ID, NOTE_ATTR } from "@/lib/note-types"
import {
  createDocument,
  deleteDocument,
  documentFolder,
  documentFont,
  listDocumentFolders,
  listDocuments,
  renameDocument,
  setDocumentFolder,
  setDocumentFont,
} from "./doc-actions"

describe("doc-actions", () => {
  beforeEach(() => {
    useTaskStore.setState({ tasks: [] })
  })

  it("creates a note-typed document with starter body and defaults", () => {
    const doc = createDocument("Q3 plan", "Plans")
    expect(doc.type).toBe(NOTE_TYPE_ID)
    expect(doc.description).toBe("Q3 plan")
    expect(doc.body).toContain("Welcome to Brainclip Docs")
    expect(doc.body).toContain("<h1>")
    expect(doc.body).toContain("<ul>")
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
})
