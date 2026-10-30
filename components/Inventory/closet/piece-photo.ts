import { removeBackground } from "@/lib/remove-background"

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ""))
    reader.onerror = () => reject(reader.error ?? new Error("Could not read photo"))
    reader.readAsDataURL(file)
  })
}

/** Cutout defaults on. A failed removal keeps the original photo and says so. */
export async function piecePhotoDataUrl(file: File, cutout: boolean): Promise<{ dataUrl: string; keptOriginal: boolean }> {
  const original = await readFile(file)
  if (!original.startsWith("data:image/")) throw new Error("Photo was not read")
  if (!cutout) return { dataUrl: original, keptOriginal: false }
  try {
    const cut = await removeBackground(file, { subject: "photo", size: 512 })
    if (typeof cut === "string" && cut.startsWith("data:image/")) return { dataUrl: cut, keptOriginal: false }
  } catch {
    // The original photo is still a piece.
  }
  return { dataUrl: original, keptOriginal: true }
}
