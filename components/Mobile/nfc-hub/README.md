# NFC hub

_Last mapped: 2026-10-28_

Phone-only page at `/mobile/nfc/`. The desktop app does not grow a hub. On the phone it is the **NFC** item in the mobile nav, **NFC hub** on the home NFC card, and a link in Settings → NFC tags while the phone shell is open.

## What it does

Testing settings are the scan-door hub URL, the hub token, and the sync URL. **Write testing settings** saves them on this phone and writes one NDEF text record. The record’s `k` is `b2test` (`lib/mobile/nfc-settings.ts`). **Read tag** shows that record and can save it on this phone. Any other text is shown as text. A blank sticker says so. **Scan sticker** is the same log path as the home card: the hardware id, the chip map, a dose asks how many, and a door posts `nfc:{id}` to `POST /api/scan`.

The radio is the existing `BrainNfc` plugin (`lib/mobile/nfc-bridge.ts`, `ios/App/App/NfcPlugin.swift`): `scan`, `read`, and `write`. A browser and the Simulator have no radio. The page stays up and says so. A free Apple ID build leaves the NFC entitlement out, so a real phone still cannot use the radio until that capability is added back.

Buttons are plain, so a keycap pass can convert them without restyling the app header.

## Files

- `MobileNfcHub.tsx` — the page
- `nfc-hub.css` — this page only
- `MobileNfcHub.test.tsx` — write, read, a blank sticker, and a door scan, with the plugin mocked
- `app/mobile/nfc/page.tsx` — the route
