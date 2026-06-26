import { afterEach, describe, expect, it, vi } from "vitest"
import { canExtractText, extractText, getDesktopFileBridge } from "@/lib/file-extract"
import type { FileValue } from "@/lib/types"

/** Build a base64 data URL from plain UTF-8 text. */
function textDataUrl(text: string, mime = "text/plain"): string {
  const b64 = Buffer.from(text, "utf-8").toString("base64")
  return `data:${mime};base64,${b64}`
}

function fileValue(over: Partial<FileValue> = {}): FileValue {
  return { id: "f1", name: "doc.pdf", mime: "application/pdf", uri: "data:application/pdf;base64,AAAA", ...over }
}

afterEach(() => {
  delete (window as unknown as { desktop?: unknown }).desktop
})

describe("extractText — text-like files (browser-safe)", () => {
  it("decodes a base64 text FileValue", async () => {
    const fv = fileValue({ name: "notes.txt", mime: "text/plain", uri: textDataUrl("hello world") })
    expect(await extractText(fv)).toBe("hello world")
  })

  it("decodes JSON content", async () => {
    const fv = fileValue({ name: "data.json", mime: "application/json", uri: textDataUrl('{"a":1}') })
    expect(await extractText(fv)).toBe('{"a":1}')
  })

  it("reads a raw text File", async () => {
    const file = new File(["plain file contents"], "a.txt", { type: "text/plain" })
    expect(await extractText(file)).toBe("plain file contents")
  })

  it("uses the file extension when the mime is missing", async () => {
    const fv = fileValue({ name: "readme.md", mime: "", uri: textDataUrl("# Title") })
    expect(await extractText(fv)).toBe("# Title")
  })
})

describe("extractText — PDFs", () => {
  it("returns '' in the browser (no desktop bridge)", async () => {
    expect(getDesktopFileBridge()).toBeUndefined()
    expect(await extractText(fileValue())).toBe("")
  })

  it("routes to the Electron extractor when window.desktop is present", async () => {
    const extractPdfText = vi.fn().mockResolvedValue("  Extracted PDF text  ")
    ;(window as unknown as { desktop: unknown }).desktop = { extractPdfText }

    const fv = fileValue({ uri: "data:application/pdf;base64,JVBERi0x" })
    const result = await extractText(fv)

    expect(result).toBe("Extracted PDF text")
    expect(extractPdfText).toHaveBeenCalledWith("data:application/pdf;base64,JVBERi0x")
  })

  it("degrades to '' when the IPC extractor throws", async () => {
    ;(window as unknown as { desktop: unknown }).desktop = {
      extractPdfText: vi.fn().mockRejectedValue(new Error("boom")),
    }
    expect(await extractText(fileValue())).toBe("")
  })
})

describe("extractText — unsupported files", () => {
  it("returns '' for binary/image files", async () => {
    const fv = fileValue({ name: "pic.png", mime: "image/png", uri: "data:image/png;base64,AAAA" })
    expect(await extractText(fv)).toBe("")
  })
})

describe("canExtractText", () => {
  it("is true for text-like files anywhere", () => {
    expect(canExtractText(fileValue({ name: "x.txt", mime: "text/plain" }))).toBe(true)
  })

  it("is false for PDFs without a desktop bridge", () => {
    expect(canExtractText(fileValue())).toBe(false)
  })

  it("is true for PDFs once the desktop bridge is present", () => {
    ;(window as unknown as { desktop: unknown }).desktop = { extractPdfText: vi.fn() }
    expect(canExtractText(fileValue())).toBe(true)
  })

  it("is false for images", () => {
    expect(canExtractText(fileValue({ name: "p.png", mime: "image/png" }))).toBe(false)
  })
})
