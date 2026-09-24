import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { FriendDetailsPanel } from "@/components/friend-details"
import { useBabyAnimalsStore } from "@/lib/baby-animals-store"
import { useTaskStore } from "@/lib/task-store"
import { resetLocalStorage } from "@/tests/test-utils"
import type { BabyAnimalPhoto } from "@/lib/baby-animal-photos"

const photo: BabyAnimalPhoto = {
  id: "p-hedge",
  animalId: "hedgehog",
  displayName: "Little Baby Hedgehog",
  query: "hedgehog",
  sourceUrl: "https://cdn.example/h.jpg",
  via: "pack",
  uri: "https://cdn.example/h.jpg",
  foundAt: "2026-09-20T12:00:00.000Z",
}

describe("FriendDetailsPanel", () => {
  beforeEach(() => {
    resetLocalStorage()
    useBabyAnimalsStore.getState().resetGallery()
    useTaskStore.getState().clearAllData()
    useTaskStore.getState().setLists([
      { id: "garden", name: "Garden", color: "#6a8", createdAt: new Date("2026-09-01") },
    ])
  })

  it("keeps Save off until a title love changes, then saves without closing", async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<FriendDetailsPanel photo={photo} onClose={onClose} />)

    const save = screen.getByRole("button", { name: "Save personality" })
    expect(save).toBeDisabled()

    await user.click(screen.getByRole("tab", { name: "Personality" }))
    await user.type(screen.getByLabelText("Add a title love"), "reading")
    await user.keyboard("{Enter}")
    expect(screen.getByRole("button", { name: "Remove reading" })).toBeInTheDocument()
    expect(save).toBeEnabled()

    await user.selectOptions(screen.getByLabelText("Add a favorite list"), "garden")
    await user.click(save)

    const stored = useBabyAnimalsStore.getState().personalities.hedgehog
    expect(stored?.titleLoves).toContain("reading")
    expect(stored?.listBias.garden).toBe(50)
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole("button", { name: "Save personality" })).toBeDisabled()
    expect(screen.getByText("Saved")).toBeInTheDocument()
  })

  it("labels the preview Chat, folds personality, and opens a mission card", async () => {
    const user = userEvent.setup()
    useBabyAnimalsStore.getState().offerMission({
      animalId: "hedgehog",
      displayName: "Little Baby Hedgehog",
      title: "Brush fur",
      line: "Tick Brush fur today.",
      blurb: "Habit",
      source: "habit",
      taskId: "habit:h1",
      kind: "mission",
      points: 5,
      effect: "whisper",
    })
    render(<FriendDetailsPanel photo={photo} onClose={vi.fn()} />)

    expect(screen.getByRole("button", { name: "Chat" })).toHaveAttribute(
      "title",
      "Preview a line with these settings. Nothing is logged.",
    )

    expect(screen.queryByRole("slider", { name: "Habits" })).not.toBeInTheDocument()
    await user.click(screen.getByRole("tab", { name: "Personality" }))
    expect(screen.getByRole("slider", { name: "Habits" })).toBeInTheDocument()
    await user.click(screen.getByRole("tab", { name: "Today" }))

    await user.click(screen.getByRole("button", { name: "Open mission Brush fur" }))
    expect(screen.getByRole("dialog", { name: "Mission from Little Baby Hedgehog" })).toBeInTheDocument()
    expect(screen.getByText("Tick Brush fur today.")).toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: "Accept" }).length).toBeGreaterThan(0)
    expect(screen.getByRole("button", { name: "Something smaller" })).toBeInTheDocument()
  })

  it("asks before closing a dirty draft", async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false)
    render(<FriendDetailsPanel photo={photo} onClose={onClose} />)

    await user.click(screen.getByRole("tab", { name: "Personality" }))
    await user.type(screen.getByLabelText("Add a title love"), "reading")
    await user.keyboard("{Enter}")
    await user.click(screen.getByRole("button", { name: "Close" }))
    expect(confirm).toHaveBeenCalledWith("Discard unsaved personality changes?")
    expect(onClose).not.toHaveBeenCalled()

    confirm.mockReturnValue(true)
    await user.click(screen.getByRole("button", { name: "Close" }))
    expect(onClose).toHaveBeenCalledOnce()
    confirm.mockRestore()
  })
})
