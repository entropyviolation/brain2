/**
 * lib/ingest/ocr.ts — Local Tesseract OCR for receipt and journal photos
 *
 * No hosted vision API. Worker is lazy so the main bundle stays light until
 * a scan actually arrives.
 */

import type { PSM, Worker } from "tesseract.js"

let workerPromise: Promise<Worker> | null = null

async function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import("tesseract.js")
      const worker = await createWorker("eng")
      return worker
    })()
  }
  return workerPromise
}

export async function ocrImage(dataUrl: string, mode: "receipt" | "page" = "page"): Promise<string> {
  if (!dataUrl || !dataUrl.startsWith("data:")) return ""
  try {
    const worker = await getWorker()
    await worker.setParameters({
      tessedit_pageseg_mode: (mode === "receipt" ? "4" : "6") as PSM,
    })
    const { data } = await worker.recognize(dataUrl)
    return String(data.text || "")
      .replace(/\u000c/g, "\n")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  } catch {
    return ""
  }
}

export async function ocrImages(dataUrls: string[], mode: "receipt" | "page" = "page"): Promise<string[]> {
  const out: string[] = []
  for (const url of dataUrls) {
    out.push(await ocrImage(url, mode))
  }
  return out
}
