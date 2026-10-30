/**
 * Phone closet — chips, a new piece, wears, and a tapped composition.
 */
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { putImageDataUrl } from "@/lib/attachments"
import { OPEN_ITEM_POPUP_EVENT } from "@/lib/points-ledger-nav"
import { useTaskStore } from "@/lib/task-store"
import { useWardrobeStore } from "@/lib/wardrobe"
import { resetAllStores } from "@/tests/test-utils"
import { ClosetPhone } from "./closet-phone"

vi.mock("@/lib/remove-background", () => ({
  removeBackground: vi.fn(async () => "data:image/png;base64,cut"),
}))

vi.mock("@/lib/attachments", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/attachments")>()
  return { ...actual, putImageDataUrl: vi.fn(async () => "idb:new-piece") }
})

describe("ClosetPhone", () => {
  beforeEach(() => {
    resetAllStores()
    useWardrobeStore.setState({ pieces: [], outfits: [], compositions: [] })
    vi.mocked(putImageDataUrl).mockResolvedValue("idb:new-piece")
  })

  it("filters uncategorized pieces and keeps a subtype on Other", async () => {
    const user = userEvent.setup()
    useWardrobeStore.getState().addPiece({ name: "Wool coat", category: "layer" })
    useWardrobeStore.getState().addPiece({ name: "Loose button", category: "other" })
    useWardrobeStore.getState().addPiece({ name: "Silk scarf", category: "other", subtype: "Scarf" })
    render(<ClosetPhone />)

    expect(screen.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByText("Wool coat")).toBeInTheDocument()
    expect(screen.getByText("Loose button")).toBeInTheDocument()
    expect(screen.getByText("Silk scarf")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Uncategorized" }))
    expect(screen.getByText("Loose button")).toBeInTheDocument()
    expect(screen.queryByText("Wool coat")).not.toBeInTheDocument()
    expect(screen.queryByText("Silk scarf")).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Other" }))
    expect(screen.getByText("Silk scarf")).toBeInTheDocument()
    expect(screen.queryByText("Loose button")).not.toBeInTheDocument()
  })

  it("saves a new piece and keeps the original photo when the cutout fails", async () => {
    const user = userEvent.setup()
    const { removeBackground } = await import("@/lib/remove-background")
    vi.mocked(removeBackground).mockRejectedValueOnce(new Error("no subject"))
    render(<ClosetPhone />)
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

  it("shows wears and saves a look from tapped pieces", async () => {
    const user = userEvent.setup()
    const tee = useWardrobeStore.getState().addPiece({
      name: "Black tee",
      category: "top",
      imageUri: "data:image/png;base64,tee",
    })
    const skirt = useWardrobeStore.getState().addPiece({ name: "Navy skirt", category: "bottom" })
    useWardrobeStore.getState().addOutfit({
      dayKey: "2026-10-02",
      startMin: 9 * 60,
      photoUri: "data:image/png;base64,wear",
      pieceIds: [tee!],
    })
    useWardrobeStore.getState().addComposition({
      name: "Rain",
      slots: [{ pieceId: tee!, x: 0.2, y: 0.8 }],
    })
    render(<ClosetPhone />)
    await user.click(screen.getByRole("tab", { name: "Outfits" }))

    expect(screen.getByText("2026-10-02 · 9:00")).toBeInTheDocument()
    expect(screen.getByText("Black tee", { selector: "p" })).toBeInTheDocument()
    const slot = screen.getByTestId(`closet-look-slot-${useWardrobeStore.getState().compositions[0].id}-${tee}`)
    expect(slot).toHaveStyle({ left: "20%", top: "80%" })

    await user.click(screen.getByRole("button", { name: "Navy skirt" }))
    await user.click(screen.getByRole("button", { name: "Black tee" }))
    await user.type(screen.getByRole("textbox", { name: "Look name" }), "Tuesday")
    await user.click(screen.getByRole("button", { name: "Save look" }))
    const saved = useWardrobeStore.getState().compositions.find((row) => row.name === "Tuesday")
    expect(saved?.slots).toEqual([
      { pieceId: skirt, x: 0.25, y: 0.5 },
      { pieceId: tee, x: 0.75, y: 0.5 },
    ])
    expect(skirt).toBeTruthy()
  })

  it("says lookbooks are planned and lists packing without editing it", async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(window, "dispatchEvent")
    useTaskStore.setState({
      lists: [{ id: "pack-list", name: "Packing", color: "#888", createdAt: new Date() }],
      folders: [],
      tasks: [{ id: "socks", title: "Socks", description: "Socks", lists: ["pack-list"] }] as never,
    })
    render(<ClosetPhone />)
    await user.click(screen.getByRole("tab", { name: "Lookbooks" }))
    expect(screen.getByText("Lookbooks are planned.")).toBeInTheDocument()

    await user.click(screen.getByRole("tab", { name: "Settings" }))
    expect(screen.getByText("Uncategorized is Other with no subtype.")).toBeInTheDocument()
    expect(screen.getByText("Tops")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Socks" }))
    const event = spy.mock.calls.map((call) => call[0]).find((item) => item.type === OPEN_ITEM_POPUP_EVENT) as CustomEvent
    expect(event.detail).toEqual({ id: "socks" })
  })
})
