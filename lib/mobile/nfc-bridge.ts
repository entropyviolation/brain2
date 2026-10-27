/**
 * lib/mobile/nfc-bridge.ts — The JS side of the iOS NFC plugin
 *
 * The native side is `ios/App/App/NfcPlugin.swift` (jsName `BrainNfc`).
 * One foreground read returns the sticker's hardware id as lowercase hex.
 * The chip stays blank. Which tag that id is, and the hub post, live in
 * `nfc-scan.ts` and `MobileNfcCard`.
 *
 * On the web and in Electron every call reports `available: false`.
 * The Simulator cannot scan a tag.
 */
import { Capacitor, registerPlugin } from "@capacitor/core"

interface BrainNfcPlugin {
  scan(): Promise<{ id: string }>
}

const BrainNfc = registerPlugin<BrainNfcPlugin>("BrainNfc")

export function isNfcPluginAvailable(): boolean {
  return Capacitor.getPlatform() === "ios" && Capacitor.isPluginAvailable("BrainNfc")
}

/** One sticker. Rejects with "Canceled" when the sheet is dismissed. */
export async function scanNfcTag(): Promise<{ id: string }> {
  if (!isNfcPluginAvailable()) throw new Error("NFC is only in the iPhone app.")
  const result = await BrainNfc.scan()
  const id = typeof result?.id === "string" ? result.id.trim().toLowerCase() : ""
  if (!id) throw new Error("This sticker has no id.")
  return { id }
}
