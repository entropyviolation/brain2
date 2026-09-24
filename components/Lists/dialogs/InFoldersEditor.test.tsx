/**
 * InFoldersEditor — add/remove folders, nested inherited chips, cycle guard.
 */
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useTaskStore } from "@/lib/task-store"
import type { Folder, List } from "@/lib/types"
import { InFoldersEditor } from "./InFoldersEditor"

const list = (id: string, name: string): List => ({
  id,
  name,
  color: "#3B82F6",
  description: "",
  createdAt: new Date("2026-01-01"),
  order: 0,
})

const folder = (partial: Partial<Folder> & Pick<Folder, "id" | "name">): Folder => ({
  createdAt: new Date("2026-01-01"),
  listIds: [],
  ...partial,
})

describe("InFoldersEditor", () => {
  beforeEach(() => {
    resetAllStores()
    useTaskStore.getState().setLists([list("dishes", "Dishes")])
    useTaskStore.getState().setFolders([
      folder({ id: "house", name: "House", color: "#f59e0b" }),
      folder({ id: "kitchen", name: "Kitchen", color: "#ef4444", parentFolderId: "house", listIds: ["dishes"] }),
      folder({ id: "studio", name: "Studio", color: "#8b5cf6" }),
    ])
  })

  it("shows direct folders and can add/remove them", async () => {
    const user = userEvent.setup()
    render(<InFoldersEditor listId="dishes" />)

    expect(screen.getByRole("button", { name: "Remove from Kitchen" })).toBeInTheDocument()
    expect(screen.queryByText("nested")).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Studio" }))
    expect(useTaskStore.getState().folders.find((f) => f.id === "studio")?.listIds).toContain("dishes")
    expect(screen.getByRole("button", { name: "Remove from Studio" })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Remove from Kitchen" }))
    expect(useTaskStore.getState().folders.find((f) => f.id === "kitchen")?.listIds).not.toContain("dishes")
  })

  it("Show nested reveals inherited ancestors as non-removable chips", async () => {
    const user = userEvent.setup()
    render(<InFoldersEditor listId="dishes" />)

    await user.click(screen.getByRole("switch", { name: "Show nested folders" }))
    expect(screen.getByText("nested")).toBeInTheDocument()
    expect(screen.getByLabelText("Folder membership")).toHaveTextContent("House")
    expect(screen.queryByRole("button", { name: "Remove from House" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Remove from Kitchen" })).toBeInTheDocument()
  })

  it("clicking an inherited ancestor files the list there directly", async () => {
    const user = userEvent.setup()
    render(<InFoldersEditor listId="dishes" />)
    await user.click(screen.getByRole("switch", { name: "Show nested folders" }))
    await user.click(screen.getByRole("button", { name: "House" }))
    expect(useTaskStore.getState().folders.find((f) => f.id === "house")?.listIds).toContain("dishes")
    expect(useTaskStore.getState().folders.find((f) => f.id === "kitchen")?.listIds).toContain("dishes")
    expect(screen.getByRole("button", { name: "Remove from House" })).toBeInTheDocument()
  })

  it("does not offer a folder whose id matches the list (cycle guard)", () => {
    useTaskStore.getState().setFolders([
      folder({ id: "dishes", name: "Dishes Folder" }),
      folder({ id: "kitchen", name: "Kitchen" }),
    ])
    render(<InFoldersEditor listId="dishes" />)
    expect(screen.queryByRole("button", { name: "Dishes Folder" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Kitchen" })).toBeInTheDocument()
  })

  it("creates a folder and files the list in it", async () => {
    const user = userEvent.setup()
    render(<InFoldersEditor listId="dishes" />)
    await user.click(screen.getByRole("button", { name: "New folder" }))
    await user.type(screen.getByLabelText("New folder name"), "Pantry")
    await user.click(screen.getByRole("button", { name: "Create" }))
    const created = useTaskStore.getState().folders.find((f) => f.name === "Pantry")
    expect(created?.listIds).toContain("dishes")
    expect(screen.getByRole("button", { name: "Remove from Pantry" })).toBeInTheDocument()
  })

  it("Selected count is direct membership only, even with nested on", async () => {
    const user = userEvent.setup()
    render(<InFoldersEditor listId="dishes" />)
    expect(screen.getByText("Selected (1)")).toBeInTheDocument()
    await user.click(screen.getByRole("switch", { name: "Show nested folders" }))
    expect(screen.getByText("Selected (1)")).toBeInTheDocument()
  })
})
