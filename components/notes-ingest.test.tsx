/**
 * NotesIngest — date-range dialog, parse/skip, bulk add or park full notes.
 */
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { resetLocalStorage } from "@/tests/test-utils"
import { useTaskStore } from "@/lib/task-store"
import { NOTES_TO_INGEST_LIST_NAME, persistIngestedNoteIds } from "@/lib/apple-notes"
import { NotesIngest } from "./notes-ingest"

const sampleNotes = [
  {
    id: "n1",
    title: "Weekend",
    body: "Weekend\nMilk\nEggs",
    folder: "Notes",
    account: "iCloud",
    createdAt: "2026-08-20T12:00:00.000Z",
    modifiedAt: "2026-08-22T12:00:00.000Z",
  },
  {
    id: "n2",
    title: "Random doodle",
    body: "skip this scribble that is long enough to preview",
    folder: "Notes",
    account: "iCloud",
    createdAt: "2026-08-20T12:00:00.000Z",
    modifiedAt: "2026-08-21T12:00:00.000Z",
  },
]

describe("NotesIngest", () => {
  beforeEach(() => {
    resetLocalStorage()
    useTaskStore.getState().clearAllData()
    useTaskStore.getState().addList({
      id: "g",
      name: "Groceries",
      color: "#10B981",
      createdAt: new Date(),
    })
    ;(window as unknown as { desktop: unknown }).desktop = {
      fetchAppleNotes: vi.fn().mockImplementation(async (query: { mode?: string; ids?: string[] }) => {
        if (query?.mode === "snippet" || query?.mode === "bodies") {
          const ids = new Set(query.ids ?? [])
          return { ok: true, notes: sampleNotes.filter((n) => ids.has(n.id)) }
        }
        return { ok: true, notes: sampleNotes.map((n) => ({ ...n, body: "" })) }
      }),
    }
  })

  afterEach(() => {
    delete (window as unknown as { desktop?: unknown }).desktop
  })

  it("renders the From Notes trigger", () => {
    render(<NotesIngest />)
    expect(screen.getByRole("button", { name: /From Notes/i })).toBeInTheDocument()
  })

  it("opens a date-range dialog immediately", async () => {
    const user = userEvent.setup()
    render(<NotesIngest />)
    await user.click(screen.getByRole("button", { name: /From Notes/i }))
    expect(await screen.findByRole("dialog")).toBeInTheDocument()
    expect(screen.getByLabelText(/Date range/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Preview notes/i })).toBeInTheDocument()
  })

  it("parses one note and parks the full text on notes to ingest", async () => {
    const user = userEvent.setup()
    render(<NotesIngest />)
    await user.click(screen.getByRole("button", { name: /From Notes/i }))
    await user.click(screen.getByRole("button", { name: /Preview notes/i }))

    await screen.findByText("Weekend")
    await user.click(screen.getByRole("button", { name: /^Parse$/i }))

    await screen.findByText("Random doodle")
    await user.click(screen.getByRole("button", { name: /^Skip$/i }))

    await screen.findByRole("button", { name: /Save for later ingestion/i })
    await user.click(screen.getByRole("button", { name: /Save for later ingestion/i }))

    await waitFor(() => {
      const { tasks, lists, folders } = useTaskStore.getState()
      expect(lists.some((l) => l.name === NOTES_TO_INGEST_LIST_NAME)).toBe(true)
      expect(folders.some((f) => f.name === "iPhone Notes Ingest")).toBe(true)
      expect(tasks).toHaveLength(1)
      expect(tasks[0].description).toContain("Milk")
      expect(tasks[0].description).toContain("Eggs")
      expect(tasks[0].body).toContain("Milk")
    })
    expect(screen.getByText(/Saved 1 note/)).toBeInTheDocument()
  })

  it("bulk-adds edited list:item syntax onto named lists", async () => {
    const user = userEvent.setup()
    render(<NotesIngest />)
    await user.click(screen.getByRole("button", { name: /From Notes/i }))
    await user.click(screen.getByRole("button", { name: /Preview notes/i }))
    await screen.findByText("Weekend")
    await user.click(screen.getByRole("button", { name: /^Parse$/i }))
    await screen.findByText("Random doodle")
    await user.click(screen.getByRole("button", { name: /^Skip$/i }))

    const editor = await screen.findByLabelText(/Bulk add/i)
    await user.clear(editor)
    await user.type(editor, "Groceries:\nMilk\nEggs")
    await user.click(screen.getByRole("button", { name: /Bulk add/i }))

    await waitFor(() => {
      const { tasks } = useTaskStore.getState()
      expect(tasks.map((t) => t.description).sort()).toEqual(["Eggs", "Milk"])
      expect(tasks.every((t) => t.lists?.includes("g"))).toBe(true)
      expect(tasks.every((t) => t.attributes?.appleNoteId === "n1")).toBe(true)
    })
  })

  it("does not show Apple Notes that were already ingested", async () => {
    persistIngestedNoteIds(["n1", "n2"])
    const user = userEvent.setup()
    render(<NotesIngest />)
    await user.click(screen.getByRole("button", { name: /From Notes/i }))
    await user.click(screen.getByRole("button", { name: /Preview notes/i }))
    expect(await screen.findByText(/already ingested/i)).toBeInTheDocument()
  })

  it("surfaces a Notes permission error from the desktop bridge", async () => {
    ;(window as unknown as { desktop: { fetchAppleNotes: ReturnType<typeof vi.fn> } }).desktop.fetchAppleNotes =
      vi.fn().mockResolvedValue({
        ok: false,
        code: "permission",
        error: "macOS blocked access to Notes.",
      })
    const user = userEvent.setup()
    render(<NotesIngest />)
    await user.click(screen.getByRole("button", { name: /From Notes/i }))
    await user.click(screen.getByRole("button", { name: /Preview notes/i }))
    expect(await screen.findByText(/macOS blocked access to Notes/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Retry/i })).toBeInTheDocument()
  })
})
