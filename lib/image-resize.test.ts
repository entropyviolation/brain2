/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { resizeImageForDoc } from "@/lib/image-resize"

function mockImage(naturalWidth: number, naturalHeight: number) {
  class MockImage {
    naturalWidth = naturalWidth
    naturalHeight = naturalHeight
    width = naturalWidth
    height = naturalHeight
    onload: ((ev?: unknown) => void) | null = null
    onerror: ((ev?: unknown) => void) | null = null
    set src(_v: string) {
      queueMicrotask(() => this.onload?.(null))
    }
  }
  vi.stubGlobal("Image", MockImage as unknown as typeof Image)
}

describe("resizeImageForDoc", () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => "blob:mock")
    URL.revokeObjectURL = vi.fn()

    // Minimal canvas stub that reports a shrinking blob size as quality drops.
    let qualitySeen = 1
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      fillStyle: "",
      fillRect: vi.fn(),
      drawImage: vi.fn(),
    })) as unknown as typeof HTMLCanvasElement.prototype.getContext

    HTMLCanvasElement.prototype.toBlob = vi.fn(function (
      this: HTMLCanvasElement,
      cb: BlobCallback,
      _type?: string,
      quality?: number,
    ) {
      qualitySeen = typeof quality === "number" ? quality : 1
      const size = Math.floor(3_000_000 * qualitySeen * ((this.width * this.height) / (4000 * 3000)))
      cb(new Blob([new Uint8Array(Math.max(1000, size))], { type: "image/jpeg" }))
    }) as unknown as typeof HTMLCanvasElement.prototype.toBlob

    HTMLCanvasElement.prototype.toDataURL = vi.fn(() => "data:image/jpeg;base64,aaaa")

    // FileReader for blob → data URL
    vi.stubGlobal(
      "FileReader",
      class {
        result: string | null = null
        onload: ((ev?: unknown) => void) | null = null
        onerror: ((ev?: unknown) => void) | null = null
        readAsDataURL(_blob: Blob) {
          this.result = "data:image/jpeg;base64," + "a".repeat(100)
          queueMicrotask(() => this.onload?.(null))
        }
      },
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("downscales a huge photo instead of rejecting it", async () => {
    mockImage(4000, 3000)
    // Pretend WebP unsupported so we take JPEG path
    const orig = HTMLCanvasElement.prototype.toDataURL
    HTMLCanvasElement.prototype.toDataURL = vi.fn((type?: string) => {
      if (type === "image/webp") return "data:image/png;base64,xx"
      return "data:image/jpeg;base64,aaaa"
    }) as unknown as typeof HTMLCanvasElement.prototype.toDataURL

    const file = new File([new Uint8Array(5_000_000)], "big.jpg", { type: "image/jpeg" })
    const result = await resizeImageForDoc(file, { maxEdge: 1920, maxBytes: 1.5 * 1024 * 1024 })
    expect(result.dataUrl.startsWith("data:image/")).toBe(true)
    expect(Math.max(result.width, result.height)).toBeLessThanOrEqual(1920)
    expect(result.resized).toBe(true)
    HTMLCanvasElement.prototype.toDataURL = orig
  })
})
