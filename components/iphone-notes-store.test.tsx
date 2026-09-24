/**
 * IphoneNotesStore — header queue over Telegram-dumped On My iPhone notes.
 */
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores, resetLocalStorage } from "@/tests/test-utils"
import { ingestIncoming } from "@/lib/ingest/executor"
import { resetIphoneNoteContinuations } from "@/lib/ingest/apply-iphone-notes"
import { useIngestStore } from "@/lib/ingest/ingest-store"
import { useTaskStore } from "@/lib/task-store"
import { IPHONE_NOTES_STORE_FOLDER_NAME, IPHONE_NOTES_STORE_LIST_ID } from "@/lib/apple-notes"
import { IphoneNotesStore } from "./iphone-notes-store"

const NOW = new Date(2026, 8, 21, 16, 0, 0)

function dump(text: string) {
  return ingestIncoming(
    {
      source: { channel: "simulate", chatId: "sim" },
      text,
      receivedAt: NOW.toISOString(),
    },
    NOW,
  )
}

describe("IphoneNotesStore", () => {
  beforeEach(() => {
    resetAllStores()
    resetLocalStorage()
    resetIphoneNoteContinuations()
    useIngestStore.setState({ enabled: true, events: [] })
    useTaskStore.getState().addList({
      id: "g",
      name: "Groceries",
      color: "#10B981",
      createdAt: new Date(),
    })
  })

  it("renders the Phone Notes trigger", () => {
    render(<IphoneNotesStore />)
    expect(screen.getByRole("button", { name: /Phone Notes/i })).toBeInTheDocument()
  })

  it("shows Shortcut setup when the store is empty", async () => {
    const user = userEvent.setup()
    render(<IphoneNotesStore />)
    await user.click(screen.getByRole("button", { name: /Phone Notes/i }))
    expect(await screen.findByRole("dialog")).toBeInTheDocument()
    expect(screen.getByText(/Nothing parked yet/i)).toBeInTheDocument()
    expect(screen.getByText(/Dump iPhone Notes to Brain2\.shortcut/i)).toBeInTheDocument()
    expect(screen.getByText(/AirDrop/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Open in Lists/i })).toBeInTheDocument()
  })

  it("queues a dumped note and bulk-adds onto a named list", async () => {
    dump("iphone-notes:\nid: n1\ntitle: Weekend\n---\nWeekend\nMilk\nEggs")
    expect(useTaskStore.getState().tasks.some((t) => t.lists?.includes(IPHONE_NOTES_STORE_LIST_ID))).toBe(true)

    const user = userEvent.setup()
    render(<IphoneNotesStore />)
    await user.click(screen.getByRole("button", { name: /Phone Notes/i }))
    expect(await screen.findByText("Weekend")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: IPHONE_NOTES_STORE_FOLDER_NAME })).toBeInTheDocument()

    const editor = await screen.findByLabelText(/Bulk add/i)
    await user.clear(editor)
    await user.type(editor, "Groceries:\nMilk\nEggs")
    await user.click(screen.getByRole("button", { name: /Bulk add/i }))

    await waitFor(() => {
      const { tasks } = useTaskStore.getState()
      expect(tasks.map((t) => t.description).sort()).toEqual(["Eggs", "Milk"])
      expect(tasks.every((t) => t.lists?.includes("g"))).toBe(true)
      expect(tasks.every((t) => t.attributes?.source === "iphone-notes")).toBe(true)
    })
    expect(screen.getByText(/Bulk-added 2 items/)).toBeInTheDocument()
  })

  it("creates a new folder with a custom name from a two-colon header", async () => {
    dump("iphone-notes:\nid: n2\ntitle: Trip\n---\nPassport")

    const user = userEvent.setup()
    render(<IphoneNotesStore />)
    await user.click(screen.getByRole("button", { name: /Phone Notes/i }))

    const editor = await screen.findByLabelText(/Bulk add/i)
    await user.clear(editor)
    await user.type(editor, "Trip ideas: Packing:\nPassport\nChargers")
    expect(screen.getByText(/1 folder/)).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /Bulk add/i }))

    await waitFor(() => {
      const { folders, lists, tasks } = useTaskStore.getState()
      const folder = folders.find((f) => f.name === "Trip ideas")
      expect(folder).toBeDefined()
      const list = lists.find((l) => l.name === "Packing")
      expect(list).toBeDefined()
      expect(folder?.listIds).toContain(list!.id)
      expect(tasks.filter((t) => t.lists?.includes(list!.id)).map((t) => t.description).sort()).toEqual([
        "Chargers",
        "Passport",
      ])
    })
  })

  it("skip removes the parked note from the store", async () => {
    dump("iphone-notes:\nid: skip-me\ntitle: Doodle\n---\nskip this")
    const user = userEvent.setup()
    render(<IphoneNotesStore />)
    await user.click(screen.getByRole("button", { name: /Phone Notes/i }))
    await screen.findByText("Doodle")
    await user.click(screen.getByRole("button", { name: /^Skip$/i }))
    await waitFor(() => {
      expect(useTaskStore.getState().tasks).toHaveLength(0)
    })
    expect(screen.getByText(/Skipped 1/)).toBeInTheDocument()
  })

  it("Open in Lists jumps to the Parked list", async () => {
    const jumped: string[] = []
    const handler = (event: Event) => {
      jumped.push((event as CustomEvent<{ listId: string }>).detail.listId)
    }
    window.addEventListener("cogs-navigate-to-list", handler)
    const user = userEvent.setup()
    render(<IphoneNotesStore />)
    await user.click(screen.getByRole("button", { name: /Phone Notes/i }))
    await user.click(await screen.findByRole("button", { name: /Open in Lists/i }))
    window.removeEventListener("cogs-navigate-to-list", handler)
    expect(jumped).toEqual([IPHONE_NOTES_STORE_LIST_ID])
  })
})
