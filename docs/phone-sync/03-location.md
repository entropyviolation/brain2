# 03 · Location

_Last mapped: 2026-10-22_

**Wave 1.** Needs `00-core.md`. Sideloading from Xcode is OK (decided 2026-10-22).

## Status

_Last mapped: 2026-10-22_

**Built and on the phone, not yet switched on.** _Last mapped: 2026-10-22._ Recording is on by default once set up and allowed (`keepOn()` in `LocationPlugin.swift`, called when the app comes to the front). The code is in and wired. On 2026-10-22 the app compiled in Xcode 26.6 (iOS 26.5 SDK) with no changes and was installed on allie's iPhone with a free personal team. That means a reinstall from the Mac every 7 days. Still to do: the box needs the new file and token, then the **Location** card on the phone's Home (`components/Mobile/MobileLocationCard.tsx`) takes the upload URL, upload token and capture public key, asks for Always, and starts recording.

| Piece | File | State |
| --- | --- | --- |
| Native plugin | `ios/App/App/LocationPlugin.swift` | Built. Compiles clean (Xcode 26.6) and runs on device. `LocationRecorder` does significant-change + `CLVisit`, a queue file (5,000 events, oldest dropped and counted), sealing, upload. The plugin is a thin bridge. |
| Registration | `ios/App/App/AppViewController.swift`, `Main.storyboard`, `project.pbxproj` | Built. The storyboard uses `AppViewController`, which registers the plugin in `capacitorDidLoad`. |
| Relaunch | `ios/App/App/AppDelegate.swift` | Built. `resumeIfEnabled()` at launch, `flush()` when the app comes forward. |
| Info.plist | `ios/App/App/Info.plist` | Built. Both usage strings and `UIBackgroundModes` → `location`. |
| JS bridge | `lib/mobile/location-bridge.ts` | Built. No-op off the phone. `locationChip` gives the chip words, shown on the Location card. |
| Box upload | `scripts/capture-upload.mjs` | Built as its own file, mounted by `capture-box.mjs`. An ack names its kind, so it never drops another kind's rows. |
| Hub drain | `lib/phone-sync/location-drain.ts` | Built. `scripts/phone-hub.ts` starts it when `COGS_CAPTURE_BOX_URL` is set. |
| Rows | `lib/phone-sync/location.ts` | Built. See [`lib/phone-sync/README.md`](../../lib/phone-sync/README.md) → Location. |

Changes from the brief:

- **Its own door, not `applyPhoneRecords`.** `types.ts` has a `location` source but no location record, and `write.ts` writes only texts and calls. `location.ts` writes Location itself, with the same ids and stamp helpers.
- **Visits are blocks, moves are instants.** `gps:` paints a short block ending at each fix. A significant move is not a stay, so it is an instant. A closed visit is a block from arrive to leave. Nothing between events is filled in.
- **Its own queue on the box.** Uploads go to `uploads.jsonl` with their own sequence numbers, not the Telegram queue, so the Telegram drain is untouched. Routes: `POST /upload`, `GET /uploads`, `POST /uploads/ack`.
- **Two tokens.** The phone holds `COGS_CAPTURE_UPLOAD_TOKEN`, which can only add. The hub pulls and acks with `COGS_CAPTURE_TOKEN`. A lost phone cannot read or empty the queue.
- **The phone seals.** Swift CryptoKit builds the same `v1.` sealed form as `scripts/sealed-box.mjs` (X25519, HKDF-SHA256, AES-256-GCM). `scripts/capture-upload.test.ts` builds a seal the Swift way and checks `open` takes it.

Honest gaps:

- iOS wakes the app on a move of roughly 500 m or more and on visits. Short trips, indoor moves, and a phone that sits still leave gaps. Gaps stay gaps.
- iOS reports visits late, sometimes minutes after you leave, and drops some.
- Uploads need the phone on the tailnet. With Tailscale off, events wait in the queue and go up later. Past 5,000 waiting events the oldest are dropped; the status shows how many.
- If the person swipes the app away, iOS still relaunches it for significant changes. If they turn off Background App Refresh or pick "While Using", recording stops in the background.
- The token sits in the app's `UserDefaults`, not the Keychain.
- App Transport Security may refuse a plain `http://` upload URL. The safe choice is HTTPS through `tailscale serve` on the box. A bare `http://100.x.y.z:8788/upload` is untested.
- Visit blocks can overlap a hand-made Location block in the same minutes.

To switch it on:

1. On the VM, copy `capture-box.mjs` and `capture-upload.mjs` into `/opt/brain2-capture/`, set `COGS_CAPTURE_UPLOAD_TOKEN` in `/etc/brain2-capture.env`, and restart the box. From the Mac:
   ```bash
   scp scripts/capture-box.mjs scripts/capture-upload.mjs <you>@<vm>:/tmp/
   ssh <you>@<vm>
   sudo cp /tmp/capture-box.mjs /tmp/capture-upload.mjs /opt/brain2-capture/
   echo "COGS_CAPTURE_UPLOAD_TOKEN=$(openssl rand -hex 32)" | sudo tee -a /etc/brain2-capture.env >/dev/null
   sudo grep -E 'UPLOAD_TOKEN|PUBLIC_KEY' /etc/brain2-capture.env   # the two values the phone needs
   sudo systemctl restart brain2-capture && systemctl status brain2-capture --no-pager
   ```
   Then from the Mac: `curl http://brain2-capture:8788/health`.
   Install Tailscale on the iPhone too, signed in to the same account. The box is reachable only on the tailnet, so the upload URL is `http://brain2-capture:8788/upload`.
2. Run the hub with `COGS_CAPTURE_BOX_URL` set. It drains location uploads beside the Telegram queue.
3. In Xcode: build to the phone. On the Location card, fill in and save Upload setup; saving goes straight on to asking for location and starting. Allow location, and pick "Always" when iOS offers it. iOS may grant "While Using" first and offer "Always" later; recording starts either way, and the chip says "set to Always" until then.

## Job

Record every significant move and every visit (arrive / leave), including while the Mac is asleep. This is not continuous GPS: iOS wakes the app on a move of roughly 500 m or more and on visits, so short trips and indoor moves can leave gaps.

## Owns

- `ios/App/App/LocationPlugin.swift` + its Capacitor registration: background location with significant-location-change and `CLVisit` monitoring. Batches points in a local queue and uploads when online.
- `lib/mobile/location-bridge.ts`: the JS side, permission flow ("Always"), and a status chip.
- `lib/phone-sync/location.ts`: map uploads to `location` records and hand them to `applyPhoneRecords`, which paints Location like `gps:`.

## Path

```
iPhone app → seals each batch to the public key → Oracle capture box POST /upload (core owns this endpoint)
          → Mac/desktop hub drains it like Telegram texts → vault
```

The Oracle box never sees coordinates in the clear. Over Tailscale only; the phone joins the tailnet.

## Notes

- Significant-change and visits are light on battery. Continuous GPS is not used.
- Info.plist needs `NSLocationAlwaysAndWhenInUseUsageDescription`, `NSLocationWhenInUseUsageDescription`, and background mode `location`.
- A free Apple ID signs the app for 7 days; a paid developer account lasts a year.
- Fallback before the app ships: Telegram Live Location (already supported).

## Done

- A day with the phone in a pocket and the laptop shut paints Location for the visits iOS reported, once the hub drains. Gaps stay gaps; nothing is filled in.
