import { render, screen, fireEvent, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetLocalStorage } from "@/tests/test-utils"
import { useBabyAnimalsStore } from "@/lib/baby-animals-store"
import { FRIEND_PACK } from "@/lib/friend-pack-manifest"
import { BabyAnimalFriendGallery } from "./baby-animal-gallery"

vi.mock("@/lib/baby-animal-friend", () => ({
  rollBabyAnimalFriend: vi.fn(async () => null),
  requestBabyAnimalFriend: vi.fn(async () => null),
  uploadFriendPicture: vi.fn(),
  ensureWeeklyFriend: vi.fn(async () => null),
}))

function skunkCard() {
  const name = screen.getByRole("textbox", { name: /Name for (cute small|tiny baby) skunk/i })
  return name.closest(".baby-friend-card") as HTMLElement
}

describe("BabyAnimalFriendGallery", () => {
  beforeEach(() => {
    resetLocalStorage()
    useBabyAnimalsStore.getState().resetGallery()
    useBabyAnimalsStore.getState().addAndWear({
      id: "p1",
      animalId: "skunk",
      displayName: "cute small skunk",
      query: "cute baby skunk",
      sourceUrl: "https://cdn.example/s.jpg",
      via: "openverse",
      uri: "https://cdn.example/s.jpg",
      foundAt: "2026-09-20T12:00:00.000Z",
    })
  })

  it("lists the gallery and can wear, rename, and delete", async () => {
    render(<BabyAnimalFriendGallery />)
    expect(screen.getByText(/Current:/)).toHaveTextContent("cute small skunk")
    const name = screen.getByRole("textbox", { name: /Name for cute small skunk/i })
    fireEvent.change(name, { target: { value: "tiny baby skunk" } })
    fireEvent.blur(name)
    expect(useBabyAnimalsStore.getState().displayName).toBe("tiny baby skunk")
    fireEvent.click(within(skunkCard()).getByRole("button", { name: "Remove" }))
    expect(useBabyAnimalsStore.getState().photos.some((p) => p.id === "p1")).toBe(true)
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
    expect(useBabyAnimalsStore.getState().photos.some((p) => p.id === "p1")).toBe(true)
    fireEvent.click(within(skunkCard()).getByRole("button", { name: "Remove" }))
    expect(screen.getByText(/Are you sure you want to delete tiny baby skunk/i)).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Delete" }))
    expect(useBabyAnimalsStore.getState().photos.some((p) => p.id === "p1")).toBe(false)
  })

  it("lets you name a preapproved pack friend", () => {
    render(<BabyAnimalFriendGallery />)
    const unnamed = screen.getAllByPlaceholderText("Name this friend").filter(
      (el) => !(el as HTMLInputElement).value.trim(),
    )
    expect(unnamed.length).toBe(FRIEND_PACK.length)
    fireEvent.change(unnamed[0]!, { target: { value: "Little Rock Hyrax" } })
    fireEvent.blur(unnamed[0]!)
    expect(useBabyAnimalsStore.getState().photos.some((p) => p.displayName === "Little Rock Hyrax")).toBe(true)
  })

  it("opens details with history and personality settings", async () => {
    render(<BabyAnimalFriendGallery />)
    fireEvent.click(within(skunkCard()).getByRole("button", { name: "Details" }))
    expect(screen.getByRole("heading", { name: "cute small skunk" })).toBeTruthy()
    expect(screen.getByText(/worn/i)).toBeTruthy()
    fireEvent.click(screen.getByRole("tab", { name: "Personality" }))
    fireEvent.click(screen.getByRole("radio", { name: "Coach" }))
    fireEvent.click(screen.getByRole("button", { name: "Save personality" }))
    expect(useBabyAnimalsStore.getState().personalities.skunk?.tone).toBe("coach")
  })

  it("requests a baby animal by name", async () => {
    const { requestBabyAnimalFriend } = await import("@/lib/baby-animal-friend")
    render(<BabyAnimalFriendGallery />)
    fireEvent.change(screen.getByRole("textbox", { name: "Name a baby animal" }), {
      target: { value: "Tiny Cute Striped Polecat" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Name" }))
    expect(requestBabyAnimalFriend).toHaveBeenCalledWith("Tiny Cute Striped Polecat")
  })

  it("uploads a replacement picture for a gallery card", async () => {
    const { uploadFriendPicture } = await import("@/lib/baby-animal-friend")
    render(<BabyAnimalFriendGallery />)
    const file = new File(["png"], "skunk.png", { type: "image/png" })
    const input = skunkCard().querySelector("input[type=file]") as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })
    expect(uploadFriendPicture).toHaveBeenCalledWith(file, "p1")
  })

  it("offers no web picture search — pack cards and uploads only", () => {
    render(<BabyAnimalFriendGallery />)
    expect(screen.queryByRole("button", { name: /find another picture/i })).toBeNull()
    expect(within(skunkCard()).getByRole("button", { name: "Change picture" })).toBeTruthy()
  })
})
