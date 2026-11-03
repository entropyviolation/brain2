import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/remove-background", () => ({
  removeBackground: vi.fn(async () => "data:image/png;base64,cut"),
}))

import { removeBackground } from "@/lib/remove-background"
import { piecePhotoDataUrl } from "./piece-photo"

function imageFile(): File {
  return new File([Uint8Array.from([1, 2, 3])], "linen-shirt.png", { type: "image/png" })
}

describe("piecePhotoDataUrl", () => {
  it("uses the cutout when removal works", async () => {
    vi.mocked(removeBackground).mockResolvedValueOnce("data:image/png;base64,cut")
    const photo = await piecePhotoDataUrl(imageFile(), true)
    expect(photo).toEqual({ dataUrl: "data:image/png;base64,cut", keptOriginal: false })
  })

  it("keeps the original photo when removal fails", async () => {
    vi.mocked(removeBackground).mockRejectedValueOnce(new Error("no subject"))
    const photo = await piecePhotoDataUrl(imageFile(), true)
    expect(photo.keptOriginal).toBe(true)
    expect(photo.dataUrl.startsWith("data:image/")).toBe(true)
  })
})
