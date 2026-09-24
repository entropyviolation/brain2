import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { resetAllStores, resetLocalStorage } from "@/tests/test-utils"
import {
  IPHONE_NOTES_STORE_FOLDER_NAME,
  IPHONE_NOTES_STORE_LIST_ID,
  IPHONE_NOTES_STORE_SOURCE,
  ingestedIphoneNoteIds,
  iphoneNoteAttrId,
} from "@/lib/apple-notes"
import { useTaskStore } from "@/lib/task-store"
import {
  applyIphoneNotes,
  parseIphoneNoteDump,
  resetIphoneNoteContinuations,
} from "./apply-iphone-notes"

const DUMP = `id: note-abc
title: Grocery
folder: On My iPhone
account: On My iPhone
modified: 2026-09-21T16:00:00Z
---
milk
eggs`

describe("parseIphoneNoteDump", () => {
  it("reads headers and body after ---", () => {
    const parsed = parseIphoneNoteDump(DUMP)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.dump.id).toBe("note-abc")
    expect(parsed.dump.title).toBe("Grocery")
    expect(parsed.dump.body).toBe("milk\neggs")
    expect(parsed.dump.partIndex).toBe(1)
    expect(parsed.dump.partTotal).toBe(1)
  })

  it("reads a continuation index from the first line", () => {
    const parsed = parseIphoneNoteDump("2/3:\nid: note-abc\n---\nmore body")
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.dump.partIndex).toBe(2)
    expect(parsed.dump.partTotal).toBe(3)
    expect(parsed.dump.body).toBe("more body")
  })

  it("synthesizes id from title|folder|modified when id is missing or pipe-only", () => {
    const parsed = parseIphoneNoteDump(
      "id: ||\ntitle: Grocery\nfolder: Quick Notes\nmodified: 2026-09-21T16:00:00Z\n---\nmilk",
    )
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.dump.id).toBe("Grocery|Quick Notes|2026-09-21T16:00:00Z")
  })

  it("rejects a dump with no id, title, or body", () => {
    const parsed = parseIphoneNoteDump("account: On My iPhone\n---\n")
    expect(parsed.ok).toBe(false)
  })
})

describe("applyIphoneNotes", () => {
  beforeEach(() => {
    resetAllStores()
    resetLocalStorage()
    resetIphoneNoteContinuations()
  })

  afterEach(() => {
    resetIphoneNoteContinuations()
  })

  it("parks a dump on iPhone Notes Store / Parked", () => {
    const result = applyIphoneNotes(DUMP)
    expect(result.status).toBe("ok")
    if (result.status !== "ok") return
    expect(result.reply).toMatch(/Parked in iPhone Notes Store: Grocery/)
    const { tasks, lists, folders } = useTaskStore.getState()
    expect(folders.some((f) => f.name === IPHONE_NOTES_STORE_FOLDER_NAME)).toBe(true)
    expect(lists.some((l) => l.id === IPHONE_NOTES_STORE_LIST_ID)).toBe(true)
    expect(tasks).toHaveLength(1)
    expect(tasks[0].title).toBe("Grocery")
    expect(tasks[0].description).toContain("milk")
    expect(tasks[0].body).toContain("eggs")
    expect(tasks[0].lists).toContain(IPHONE_NOTES_STORE_LIST_ID)
    expect(tasks[0].attributes?.source).toBe(IPHONE_NOTES_STORE_SOURCE)
    expect(tasks[0].attributes?.appleNoteId).toBe(iphoneNoteAttrId("note-abc"))
    expect(ingestedIphoneNoteIds(tasks).has(iphoneNoteAttrId("note-abc"))).toBe(true)
  })

  it("skips a dump that was already parked", () => {
    applyIphoneNotes(DUMP)
    const second = applyIphoneNotes(DUMP)
    expect(second.status).toBe("ok")
    if (second.status !== "ok") return
    expect(second.reply).toMatch(/Already stored: Grocery/)
    expect(useTaskStore.getState().tasks).toHaveLength(1)
  })

  it("joins continuation parts until n/n", () => {
    const first = applyIphoneNotes("1/3:\nid: long-note\ntitle: Journal\n---\nHello ")
    expect(first.status).toBe("ok")
    if (first.status === "ok") expect(first.reply).toMatch(/Got part 1\/3/)
    expect(useTaskStore.getState().tasks).toHaveLength(0)

    const second = applyIphoneNotes("2/3:\nid: long-note\n---\nthere, ")
    expect(second.status).toBe("ok")
    if (second.status === "ok") expect(second.reply).toMatch(/Got part 2\/3/)

    const third = applyIphoneNotes("3/3:\nid: long-note\n---\nworld")
    expect(third.status).toBe("ok")
    if (third.status !== "ok") return
    expect(third.reply).toMatch(/Parked in iPhone Notes Store: Journal/)
    const task = useTaskStore.getState().tasks[0]
    expect(task.body).toBe("Hello there, world")
    expect(task.description).toContain("Hello there, world")
  })
})
