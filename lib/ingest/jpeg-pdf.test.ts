import { describe, it, expect } from "vitest"
import { jpegPagesToPdf, jpegSize } from "./jpeg-pdf"
import { base64ToBytes } from "./bytes"

/** 1×1 JPEG with a SOF0 marker so jpegSize can read width/height. */
const PIXEL_JPEG =
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGcP//Z"

describe("jpegPagesToPdf", () => {
  it("wraps JPEG pages in a PDF 1.4 file", () => {
    const bytes = base64ToBytes(PIXEL_JPEG)
    const size = jpegSize(bytes)
    const pdf = jpegPagesToPdf([{ bytes, width: size.width || 1, height: size.height || 1 }])
    const head = new TextDecoder().decode(pdf.slice(0, 8))
    expect(head.startsWith("%PDF-1.")).toBe(true)
    const tail = new TextDecoder().decode(pdf.slice(-8))
    expect(tail).toContain("EOF")
  })
})
