/**
 * lib/mobile/keyboard-bridge.ts — Tell the iPhone app the keycap deck is up
 *
 * The native side is `BrainKeyboard` in `ios/App/App/AppViewController.swift`.
 * While the deck is open the bottom screen edge is deferred, so taps on the
 * bottom row are not held back for a home swipe. Elsewhere this does nothing.
 */
import { Capacitor, registerPlugin } from "@capacitor/core"

interface BrainKeyboardPlugin {
  setDeck(options: { open: boolean }): Promise<void>
}

const BrainKeyboard = registerPlugin<BrainKeyboardPlugin>("BrainKeyboard")

export function setDeckOpen(open: boolean): void {
  if (Capacitor.getPlatform() !== "ios" || !Capacitor.isPluginAvailable("BrainKeyboard")) return
  void BrainKeyboard.setDeck({ open }).catch(() => undefined)
}
