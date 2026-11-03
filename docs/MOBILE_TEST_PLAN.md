# Mobile test plan

_Last mapped: 2026-11-01._

How the iOS app is tested: what the unit tests cover, what Playwright covers at a phone viewport, and what needs a real iPhone. The rules being checked are `docs/MOBILE_STYLE.md`. The code map is `components/Mobile/README.md`.

## Layers

| Layer | Runs with | What it proves |
|------|------|------|
| Pure logic | `npx vitest run lib/mobile lib/phone-window* components/Mobile/keyboard` | Hub rows, keyboard rules, outbox order, window merge |
| Components | `npx vitest run components/Mobile` | Cards with mocked `fetch`, plugins, and the phone window |
| Phone e2e | `npx playwright test --project=phone` | The shell at 375×812 with touch, against `npm run dev`. Every `/api/**` call is mocked, so a run never touches the real vault. |
| Real iPhone | Manual, below | NFC, HealthKit, Always location, Local Network, sideload expiry |
| Swift | **Planned** XCTest target | `StaticExportRouter` path mapping (`ios/App/AppTests/`) |

Mock data builders for vault snapshots, outbox rows, patches, and a hub `fetch` are in `tests/phone-builders.ts`. Capacitor plugins are mocked with `vi.mock("@capacitor/core")` (see `lib/mobile/health-bridge.test.ts`) or by mocking the bridge module (see `components/Mobile/health/MobileHealthCard.test.tsx`).

## Flows and where each is tested

| # | Flow | Unit / component | E2E (phone) | Device |
|---|------|------|------|------|
| 1 | Login, Mac key ✓ … ✕, status line | `lib/mobile-auth.test.ts`, `components/Mobile/MobileApp.test.tsx` | `e2e/phone-shell.spec.ts` sign in, refused token | — |
| 2 | Cold start, Mac quiet: cache paints, stale, no seed boot | `lib/phone-window.test.ts`, `lib/phone-window-outbox.test.ts` (stale after a live load) | quiet Mac | Mac asleep |
| 3 | Edit → patch queued → survives a miss → reaches the Mac in order | `lib/phone-window.test.ts`, `lib/phone-window-outbox.test.ts` | **Planned**: edit a habit at phone width | — |
| 4 | Refresh refills every store; token saved on Refresh | `lib/phone-window.test.ts` (refill), `components/Mobile/MobilePullCard.test.tsx` | — | — |
| 5 | Health import: months, counts, nothing new, empty, denied, browser line | `lib/phone-sync/health.test.ts`, `lib/mobile/health-bridge.test.ts`, `MobileHealthCard.test.tsx` | — | Yes |
| 6 | Location: Save → Turn on → steps → Send now; Set to Always | `MobileLocationCard.test.tsx`, `lib/mobile/location-bridge.test.ts` | — | Yes |
| 7 | NFC: first tap binds, dose asks how many, blank posts `nfc:{id}` | `MobileNfcCard.test.tsx`, `lib/mobile/nfc-scan.test.ts`, `MobileNfcHub.test.tsx` | — | Yes, paid account |
| 8 | Mobile hub rows, summary, 15 s recheck | `lib/mobile/hub-checks.test.ts`, `components/Mobile/hub/MobileHub.test.tsx` | — | — |
| 9 | Keycap deck: focus, shift, caps, return, no fall-through | `keyboard-logic.test.ts`, `mobile-keyboard.test.tsx` | types, shift once, hide | Tap fall-through on iOS |

## Real iPhone steps

Install with `BRAIN2_IOS_TEAM_ID=25YWDVDMKT npm run ios:reinstall -- --force`. Run `npm run electron:dev` on the Mac. Same Wi-Fi.

**Local Network.**
1. Delete the app, reinstall, open it. iOS asks for Local Network. Tap Don't Allow.
2. Menu → Phone. The Mac key shows ✕. The line names the host and the error.
3. Settings → Privacy & Security → Local Network → Brain2 on. Back in the app, tap the Mac key. It shows ✓.

**Mac asleep, other Wi-Fi.** Load once (✓). Sleep the Mac. Kill and reopen the app. The habits from the last load paint. The line says Saved copy. Edit one habit. Mobile hub shows 1 waiting. Wake the Mac, tap Reload. The edit lands on the Mac and the count is 0. Repeat with the phone on cellular.

**Health.** Health card → Import all history. Allow every type. The line names each month, then counts. Run it again: nothing new. Health app → Sharing → Apps → Brain2 → turn all off. Import: access off, with Open iPhone Settings. Kill the app mid-import, reopen, import again: it finishes, with no double counts on Data → Health.

**Location.** Save the upload setup. Turn on. Allow While Using, then Change to Always. Send now: the queue is 0. Settings → Brain2 → Location → While Using. Reopen: the card offers Set to Always, which opens Settings. Set Never: the card says denied and does not start.

**NFC** (paid account build only). Scan a new sticker: it asks which saved tag. Pick a dose: it asks how many, then posts. Scan a blank chip: it posts `nfc:{id}`. Scan a door: it posts with no question. Tap Scan twice fast: one sheet.

**Sideload.** Mobile hub shows App install with the days left. Seven days after a free-account install the app stops opening. Reinstall from the Mac.

**Background.** Open a long list, switch to another app for 10 minutes, come back. If iOS dropped the WebView the page reloads: the cache paints, then ✓. No edit is lost.

## UI and accessibility checklist

Against `docs/MOBILE_STYLE.md`. ✓ = an automated check exists.

- [ ] Every key, cap, and row button is at least 44×44 pt. ✓ for Sign in (`e2e/phone-shell.spec.ts`). **Planned**: sweep every `button` on `/mobile/` and `/mobile/hub/`.
- [x] Inputs are at least 16px (Username, Password). ✓
- [x] Pinch zoom stays on: no `user-scalable=no`, no `maximum-scale=1`. ✓
- [x] No sideways scroll at 375px. ✓ on the login page.
- [ ] Safe areas: the top bar clears the Dynamic Island, the bottom deck clears the home indicator, every portaled dialog starts at `--phone-sheet-top`. Partly in `phone-sheet-close.test.ts`; check by eye on an iPhone with a Dynamic Island.
- [ ] No hover-only action. Check by eye: long-press and tap reach everything a desktop hover shows.
- [ ] Text grows without clipping: iPhone Settings → Display → Text Size at the largest. Rows wrap; no fixed-height box cuts a line.
- [ ] VoiceOver: each keycap reads its `aria-label` (letters, shift, caps, delete, numbers, space, hide keyboard, return label). The deck is a group named Keyboard. Note: keys are `tabIndex=-1`, so VoiceOver reaches them by swipe, not Tab.
- [ ] Every dialog's close key sits below the status bar and can be tapped (Moon sheet, item popup, handhelds).
- [ ] No `100dvh` sheet with the close at the top (`phone-sheet-close.test.ts`).

## Edge cases and failure modes

| Case | Expected | Covered |
|------|------|------|
| Local Network denied | ✕ with host and error; hub row bad with the Settings fix | Unit (row), device |
| Mac asleep, other Wi-Fi | Stale, cache painted, edits held | Unit, e2e, device |
| Wrong token | `answered 401 (hub token)` | Unit, component, e2e |
| No token | Request goes without `Authorization`; the hub decides | **Planned** test |
| Cache older than the Mac | The Mac copy replaces it on load; unsent edits replay on top | `lib/phone-window.test.ts` |
| Vault near 5 MB web storage | The vault is never written to `localStorage`; the IndexedDB launch cache drops itself on a quota error | `lib/phone-window-cache.test.ts` |
| Outbox order | Oldest first; a miss holds that store's later rows | `lib/phone-window-outbox.test.ts` |
| Outbox duplicates | A row acked once is never sent again, even if delete failed | `lib/phone-window.test.ts`, outbox test |
| Double tap Refresh | One canon request | Outbox test, `MobilePullCard.test.tsx` |
| Double tap Scan / Save | **Planned**: component tests for NFC and Location |
| App killed mid-import | Pages already written stay; the next run finishes | `health-bridge.test.ts` (fails, keeps written), device |
| Permission revoked in Settings | Card says denied, does not start | Location and Health card tests |
| Sideload expiring | Hub row warn in the last 7 days, bad in the last 2 | `hub-checks.test.ts` |
| WebView dropped in background | Reload paints cache, then live | Device |
| `100dvh` regression | Sheets stay off `100dvh` | `phone-sheet-close.test.ts` |
| Timer and listener leaks | Hub leaves no 15 s or 6 s timer after unmount | `MobileHub.test.tsx` |

## Bugs found while writing this

1. **Outbox sent out of order.** `listOutbox` returned IndexedDB rows in key order, and keys are random UUIDs. A failed row was also skipped while later rows of the same store went out. An older patch could land last and undo a newer edit on the Mac. Fix: rows get a `seq` on enqueue and `orderOutbox` sorts on it (`lib/phone-window-cache.ts`). `flushPhoneOutbox` holds a store's later rows behind a miss (`lib/phone-window.ts`). Regression: `lib/phone-window-outbox.test.ts`.
2. **Hub ping left a timer behind.** Each ping raced a 6 s timeout that was never cleared, so each 15 s recheck left one running. Fix: clear it in `finally` (`components/Mobile/hub/MobileHub.tsx`). Regression: `MobileHub.test.tsx`.

Open, not fixed:
- A row the Mac refuses for good (a 400) now holds that store's later edits until it is removed. The hub row shows the count. Dropping or showing a refused row is **Planned**.
- The Swift plugins (`HealthPlugin.swift`, `LocationPlugin.swift`, `NfcPlugin.swift`) were not reviewed for argument parsing. Plugin tests are **Planned** with the XCTest target.

## Swift tests (Planned)

`ios/App/AppTests/StaticExportRouterTests.swift` maps `/mobile/`, `/mobile`, `/mobile/nfc/`, `/mobile/hub/`, a flat `.html` page, the root, an unknown path, and files with an extension. To run it, add a Unit Testing Bundle target named `AppTests` hosted by `App` in Xcode, add the file, and press ⌘U on a Simulator.
