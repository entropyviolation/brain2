# `components/Mobile/` — iOS / sideload Home shell

Mobile entry for **Home** (Habits, Plan, To Do, Goals, Tracking — including nested sub-tabs), **Lists**, and **Inventory**. Native / PWA name is **BRAIN2**. Reuses `HomeDashboard` so desktop data stays intact. Moon, inside that dashboard, opens a phone sheet on this shell. Other widget details stay the desktop handheld. On this shell that handheld, and every other portaled dialog, starts below the status bar so the close key can be tapped. Electron does not mount this shell.

_Last mapped: 2026-10-28._ The page field behind the shell is the default Snowflake plate (`/pcb/mint.jpg`), including when a saved desktop pin is plain teal. The photograph scrolls; a fixed attachment does not paint on iOS.

## Manual hub (no always-on sync)

Phones copy desktop data with a **manual pull** (`MobilePullCard`) after the desktop
seeds the hub (`lib/mobile-sync.ts`). There is no continuous live-sync engine.
Texts, calls, and location are a different door: Settings → **Phone sync**
(`components/Settings/imports/PhoneSyncPanel.tsx`), on the Mac.

## Folders

_Last mapped: 2026-10-29_

- `location/` — iPhone location card and its test
- `health/` — iPhone Health import card and its test
- `moon/` — Phone Moon sheet. The tile still lives in `components/Home/home-moon-tile.tsx`. Inside this shell it opens the sheet (phase, illumination, neighboring major phases) instead of the desktop sky chart. Close and the dim scrim dismiss it. Escape does too. Desktop and Electron keep the sky dialog.
- `nfc/` — iPhone NFC card and its test
- `keyboard/` — `mobile-keyboard.tsx`, `mobile-keyboard.css`, `keyboard-logic.ts`, and their tests. The deck replaces the system keyboard while a text field is focused.
- `nfc-hub/` — phone NFC hub page, its CSS, and its test

## Entry points

_Last mapped: 2026-10-28_

| Path | Role |
|------|------|
| `app/mobile/page.tsx` | Route `/mobile/` |
| `MobileApp.tsx` | _Last mapped: 2026-10-28._ Login gate + sticky full-width topbar. Home, Lists, Inventory, and the NFC link are silver keycaps (44px). Inventory lazy-loads `InventoryPhoneScreen` from `components/Inventory/phone/inventory-phone.tsx`, the same phone room as the 767px gate. A shelf or packing tap opens this shell's item popup through `openItemDetailPopup`. The action row is the same cap: **Quick Add** (the desktop capture dialog, with Bulk and Plain on that sheet), Inbox, Bulk Add, From Notes, Phone Notes, Reviews, Log out. Listing Apple Notes still needs Mac Notes.app. Phone Notes is the Telegram Shortcut queue. |
| `phone-sheet-close.test.ts` | The shell sheet offset stays in `mobile.css`, and the full-viewport phone sheets stay off `100dvh`. |
| `use-in-mobile-shell.ts` | True only when `.cogs-mobile-app` is in the document. Shared tiles use it so Electron keeps the desktop tree. |
| `mobile.css` | _Last mapped: 2026-10-29._ Shell layout. Lists on this shell hides Import spreadsheet and keeps the Display codes on one 26px line. The rest of that phone chrome (title play, keycaps, Address folder toggle) lives with Lists and also runs on a phone-width full site. Wide desktop is unchanged. Portaled dialogs sit on `body`, outside `.cogs-mobile-app`, so the close fix is `html:has(.cogs-mobile-app)`. `--phone-sheet-top` is the status-bar inset and at least 59px when that inset is 0. Every portaled dialog starts below that band, so its header close can be tapped, and a strip of scrim under the band dismisses a dialog that listens for the overlay. Widget handhelds keep the corner key on screen (44px) while the detail scrolls. Electron does not load this file. Desktop dialogs are unchanged. |
| `keyboard/mobile-keyboard.tsx` | _Last mapped: 2026-10-29._ Mounted from `app/mobile/layout.tsx`. A focused text field, textarea, or contenteditable gets this deck instead of the system keyboard. Letter keys are silver keycaps. Shift, delete, 123, ABC, space, hide, and return are darker modifier caps. Shift latches once; a second tap within a moment locks caps, and that cap is the CRT. Return on a single line submits its form, or hides the deck. A phone pad is used for tel and number. |
| `moon/mobile-moon-sheet.tsx` | Phone Moon detail. Close, the scrim, and Escape dismiss it. The sky chart stays on the desktop dialog. |
| `MobileLogin.tsx` | Credentials: **admin** / **admin** |
| `MobilePullCard.tsx` | One-tap manual pull from the shared hub |
| `location/MobileLocationCard.tsx` | _Last mapped: 2026-10-28._ iPhone location, the primary share. Shows only in the iOS build. Upload setup (URL, upload-only token, capture public key), Save goes straight on to Turn on (asks While Using, then Always, then starts). Recording stays on across launches until Turn off. **Set to Always** opens iPhone Settings while only While Using is granted. Send now. The plugin keeps the setup; the card stores nothing. BIM Live Location paints only when this share did not. See [`docs/phone-sync/03-location.md`](../../docs/phone-sync/03-location.md). |
| `health/MobileHealthCard.tsx` | _Last mapped: 2026-10-28._ **Import all history**. On the iPhone app this reads Apple Health from the oldest sample to now, 30 days at a time: steps, walking and running distance, flights, active energy, heart rate, sleep, and workouts. The line under the button is the month in progress, then the imported counts, nothing new, an empty history, or access off. In the browser the same button says the import runs in the iPhone app. HealthKit is read only. See [`docs/phone-sync/04-health.md`](../../docs/phone-sync/04-health.md). |
| `nfc/MobileNfcCard.tsx` | _Last mapped: 2026-10-28_ iPhone NFC. Shows only in the iOS build (`BrainNfc`). Hub URL and hub token stay in the app. Scan reads the sticker’s hardware id. The first tap picks which saved tag that chip is (`brain2-nfc-chips`). A dose asks how many. Blank posts `nfc:{id}`. A door or a plain event posts with no question. `POST /api/scan` on `npm run phone:hub`. **NFC hub** opens `/mobile/nfc/`. The Simulator cannot scan. Shortcuts stay. See [`docs/shortcuts/nfc-tags.md`](../../docs/shortcuts/nfc-tags.md). |
| `nfc-hub/MobileNfcHub.tsx` | _Last mapped: 2026-10-28_ Phone-only NFC hub at `/mobile/nfc/`. Writes the hub URL, token, and sync URL onto a sticker, reads that record back, and scans a sticker the same way the home card does. See [`nfc-hub/README.md`](nfc-hub/README.md). |
| `lib/mobile-auth.ts` | sessionStorage login (no app-data keys) |
| `lib/mobile-sync.ts` | HTTP client for the hub (`/api/sync` on the dev server). A native shell cannot use `127.0.0.1` (that is the phone). It reads `public/mobile-hub.json` for the Mac's LAN address. A saved port 3847 is ignored. |

## Same data as desktop (manual, for now)

`npm run dev` serves **Next + the hub API on one port**. Desktop and phone do
**not** auto push/pull. To copy desktop data onto a phone:

1. On your Mac: stop old servers, then `npm run dev`
2. Open desktop Brain2 in the browser at the printed local URL
3. Settings → **Force push now** (seeds `data/mobile-sync.json`). The snapshot’s `app` is `brain2`. The hub also still accepts an older `cogs` file. A push that would shrink the hub’s task list to under a quarter of what it holds is refused.
4. Phone (same Wi‑Fi): open the printed `http://<mac-lan-ip>:<port>/mobile/` → login `admin` / `admin`
5. Tap **Pull desktop data onto phone**. Settings → **Force pull now** on the iOS app does the same pull. The hub serves that phone copy to an iPhone even when the app asks for the full snapshot. The phone saves into a small web-storage box of about 5 MB, separate from free space on the device. Opening the full site (Home, Lists, Docs, Scheduler) on that phone uses the same box. Saves there keep a short name (also stored as the description), when the item was created, and which list it is on, plus about a week of the time grid. A row already pulled without those fields is filled in on the next save, so the hub can open. Photos, notes, and item attributes stay on the Mac. When the box is full, side vaults over 100 KB are dropped so the save can finish, and the red banner clears on the next save. Reload the phone page once so this build is the one running. Habits, goals, the sun, and today's friend stay. If the device already has more tasks than the snapshot, pull stops and leaves it alone.

Hub file: `data/mobile-sync.json` (gitignored). The server never deletes Electron/browser storage by itself.

## Sideload onto iOS

### A) Capacitor native app (recommended)

Requires macOS + Xcode + a free Apple ID + CocoaPods (`brew install cocoapods`).

```bash
npm install
npm run mobile:ios:init   # first time only — adds ios/ project
npm run mobile:ios        # static site, sync, launch an iPhone Simulator
```

`npm run mobile:ios` and `npm run build` can run while `npm run dev` is up. Next's static export always compiles into `.next` (a custom `distDir` becomes the export folder, and the compile directory is forced back to `.next`). The Turbopack dev server already owns `.next`, and sharing it makes page-data collection load a dev `/_document`. `npm run build` (`scripts/static-export-build.mjs`) stages a copy in `.mobile-build`, runs `next build` there, and copies `out/` back. The iOS script (`scripts/mobile-static-build.mjs`) writes the LAN hub hint first, then uses that same stage. It then syncs `ios/` and launches an iPhone Simulator (`scripts/mobile-ios-sim.mjs`). A booted iPhone is used when one is already running; otherwise the first available iPhone. To install on a physical iPhone, open `ios/App/App.xcworkspace` in Xcode → **Signing & Capabilities** → your Team → Run. NFC reading needs the **NFC Tag Reading** capability on the App ID `com.cogs.mobile`. A personal team cannot sign a profile that includes it, so `ios/App/App/App.entitlements` leaves that key out and a free Apple ID can install the app. It cannot scan a sticker. The Simulator cannot scan one either. On a paid Apple Developer account, add `com.apple.developer.nfc.readersession.formats` with `NDEF` and `TAG`. Scan reads the chip’s hardware id. NFC hub can also write and read one testing-settings text record. Without that capability the radio stays off.

Health import needs the HealthKit capability (`com.apple.developer.healthkit` in `ios/App/App/App.entitlements`). A personal team that cannot sign HealthKit will not install until that key is removed, and then the import cannot read Health. A signed build asks for read access to steps, walking and running distance, flights, active energy, heart rate, sleep, and workouts. It does not write Apple Health. Only a phone with Health data can prove a real import.

If `pod install` complains about UTF-8, the npm scripts already export `LANG=en_US.UTF-8`.

### B) Safari “Add to Home Screen”

1. `npm run dev`
2. Note the `phone:` URL printed (includes `/mobile/`)
3. Open it on iPhone → Share → **Add to Home Screen**
4. Use **Pull desktop data onto phone** after a desktop force-push

Login: `admin` / `admin`.
