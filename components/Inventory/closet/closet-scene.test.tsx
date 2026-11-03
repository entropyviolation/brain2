import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { putImageDataUrl } from "@/lib/attachments"
import { useTaskStore } from "@/lib/task-store"
import { useWardrobeStore } from "@/lib/wardrobe"
import { resetAllStores } from "@/tests/test-utils"
import { ClosetScene } from "../closet-scene"

vi.mock("@/lib/remove-background", () => ({
  removeBackground: vi.fn(async () => "data:image/png;base64,cut"),
}))

vi.mock("@/lib/attachments", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/attachments")>()
  return { ...actual, putImageDataUrl: vi.fn(async () => "idb:new-piece") }
})

describe("ClosetScene", () => {
  beforeEach(() => {
    resetAllStores()
    useWardrobeStore.setState({ pieces: [], outfits: [], compositions: [] })
    vi.mocked(putImageDataUrl).mockResolvedValue("idb:new-piece")
  })

  it("shows the empty garment wall and its chips", () => {
    render(<ClosetScene />)
    expect(screen.getByTestId("closet-scene")).toHaveTextContent("0 pieces")
    expect(screen.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("button", { name: "Uncategorized" })).toBeInTheDocument()
    expect(screen.getByText("No pieces.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "New Item" })).toBeInTheDocument()
  })

  it("filters pieces onto the category chip, with other and no subtype as uncategorized", async () => {
    const user = userEvent.setup()
    useWardrobeStore.getState().addPiece({ name: "Wool coat", category: "layer" })
    useWardrobeStore.getState().addPiece({ name: "Loose button", category: "other" })
    useWardrobeStore.getState().addPiece({ name: "Silk scarf", category: "other", subtype: "Scarf" })
    render(<ClosetScene />)
    expect(screen.getByRole("button", { name: "Layers" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Other" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Tops" })).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Uncategorized" }))
    expect(screen.getByText("Loose button")).toBeInTheDocument()
    expect(screen.queryByText("Wool coat")).not.toBeInTheDocument()
    expect(screen.queryByText("Silk scarf")).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Layers" }))
    expect(screen.getByText("Wool coat")).toBeInTheDocument()
    expect(screen.queryByText("Loose button")).not.toBeInTheDocument()
  })

  it("lists wears, a planned line, and real packing rows", async () => {
    const user = userEvent.setup()
    const tee = useWardrobeStore.getState().addPiece({ name: "Black tee", category: "top" })
    useWardrobeStore.getState().addOutfit({
      dayKey: "2026-10-02",
      startMin: 9 * 60,
      photoUri: "idb:look",
      pieceIds: [tee!],
      note: "Cool morning",
    })
    useTaskStore.setState({
      lists: [{ id: "pack-1", name: "Packing", color: "#888888", createdAt: new Date() }],
      tasks: [{ id: "passport", title: "Passport", description: "Passport", lists: ["pack-1"], attributes: { packKind: "Documents" } }] as never,
      folders: [],
    })
    render(<ClosetScene />)

    await user.click(screen.getByRole("tab", { name: "Wears" }))
    expect(screen.getByText("Black tee")).toBeInTheDocument()
    expect(screen.getByText("Cool morning")).toBeInTheDocument()
    expect(screen.getByText(/2026-10-02/)).toBeInTheDocument()

    await user.click(screen.getByRole("tab", { name: "Lookbooks" }))
    expect(screen.getByText("Lookbooks are planned.")).toBeInTheDocument()
    await user.click(screen.getByRole("tab", { name: "Calendar" }))
    expect(screen.getByText("A planned-outfit calendar is planned.")).toBeInTheDocument()

    await user.click(screen.getByRole("tab", { name: "Packing" }))
    expect(screen.getByRole("button", { name: /Passport/ })).toBeInTheDocument()
  })

  it("saves a new piece from a photo, and keeps the original when the cutout fails", async () => {
    const user = userEvent.setup()
    const { removeBackground } = await import("@/lib/remove-background")
    vi.mocked(removeBackground).mockRejectedValueOnce(new Error("no subject"))
    render(<ClosetScene />)
    const file = new File([Uint8Array.from([1, 2, 3])], "linen-shirt.png", { type: "image/png" })
    await user.upload(screen.getByLabelText("Piece photo"), file)
    expect(screen.getByRole("checkbox", { name: "Cut out the background" })).toBeChecked()
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("linen shirt")
    await user.click(screen.getByRole("button", { name: "Save piece" }))
    expect(await screen.findByText("Kept the original photo.")).toBeInTheDocument()
    expect(useWardrobeStore.getState().pieces[0]).toMatchObject({
      name: "linen shirt",
      category: "top",
      imageUri: "idb:new-piece",
    })
  })

  it("shows an empty packing shelf when no packing rows exist", async () => {
    const user = userEvent.setup()
    render(<ClosetScene />)
    await user.click(screen.getByRole("tab", { name: "Packing" }))
    expect(screen.getByText("No packing lists.")).toBeInTheDocument()
  })

  it("places a piece on the board and reopens the saved look", async () => {
    const user = userEvent.setup()
    useWardrobeStore.getState().addPiece({ name: "Black tee", category: "top" })
    render(<ClosetScene />)
    await user.click(screen.getByRole("tab", { name: "Board" }))
    const surface = screen.getByTestId("closet-board-surface")
    surface.getBoundingClientRect = () =>
      ({
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        right: 200,
        bottom: 400,
        width: 200,
        height: 400,
        toJSON() {
          return {}
        },
      }) as DOMRect

    const trayPiece = screen.getByTestId("closet-tray").querySelector("button")
    expect(trayPiece).toBeTruthy()
    fireEvent.pointerDown(trayPiece!, { pointerId: 1, clientX: 10, clientY: 10 })
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 100, clientY: 200 })
    fireEvent.pointerUp(window, { pointerId: 1, clientX: 100, clientY: 200 })

    expect(screen.getByTestId("closet-board-surface").querySelector("button")).toBeTruthy()
    await user.type(screen.getByRole("textbox", { name: "Look name" }), "Rain")
    await user.click(screen.getByRole("button", { name: "Save" }))
    expect(useWardrobeStore.getState().compositions[0]?.name).toBe("Rain")
    expect(useWardrobeStore.getState().compositions[0]?.slots[0]).toMatchObject({ x: 0.5, y: 0.5 })

    await user.click(screen.getByRole("button", { name: "New board" }))
    expect(screen.getByTestId("closet-board-surface").querySelector("button")).toBeNull()
    await user.click(screen.getByRole("button", { name: "Rain" }))
    expect(screen.getByTestId("closet-board-surface").querySelector("button")).toBeTruthy()
  })
})
