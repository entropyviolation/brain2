/**
 * lib/mobile/nfc-bridge.ts — The JS side of the iOS NFC plugin
 *
 * The native side is `ios/App/App/NfcPlugin.swift` (jsName `BrainNfc`).
 * `scan` returns the sticker's hardware id as lowercase hex.
 * `read` returns the NDEF text record, or an empty string when the sticker
 * is blank. `write` stores one text record. The testing-settings payload
 * is built in `nfc-settings.ts`. The chip map and the hub post stay in
 * `nfc-scan.ts`.
 *
 * On the web and in Electron every call reports `available: false`.
 * The Simulator cannot scan a tag.
 */
import { Capacitor, registerPlugin } from "@capacitor/core"

interface BrainNfcPlugin {
  scan(): Promise<{ id: string }>
  read(): Promise<{ text?: string }>
  write(options: { text: string }): Promise<void>
}

const BrainNfc = registerPlugin<BrainNfcPlugin>("BrainNfc")

export function isNfcPluginAvailable(): boolean {
  return Capacitor.getPlatform() === "ios" && Capacitor.isPluginAvailable("BrainNfc")
}

function requirePlugin(): void {
  if (!isNfcPluginAvailable()) throw new Error("NFC is only in the iPhone app.")
}

/** One sticker. Rejects with "Canceled" when the sheet is dismissed. */
export async function scanNfcTag(): Promise<{ id: string }> {
  requirePlugin()
  const result = await BrainNfc.scan()
  const id = typeof result?.id === "string" ? result.id.trim().toLowerCase() : ""
  if (!id) throw new Error("This sticker has no id.")
  return { id }
}

/** NDEF text on the sticker. Empty when the sticker is blank or has no message. */
export async function readNfcTag(): Promise<{ text: string }> {
  requirePlugin()
  const result = await BrainNfc.read()
  const text = typeof result?.text === "string" ? result.text.trim() : ""
  return { text }
}

/** One NDEF text record. The native side refuses a sticker that is too small or locked. */
export async function writeNfcTag(text: string): Promise<void> {
  requirePlugin()
  const payload = text.trim()
  if (!payload) throw new Error("Nothing to write.")
  await BrainNfc.write({ text: payload })
}
