# 03 · Location

_Last mapped: 2026-10-22_

**Wave 1.** Needs `00-core.md`. Sideloading from Xcode is OK (decided 2026-10-22).

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
