# `components/Mobile/` — iOS / sideload Home shell

Mobile entry for the **Home** tab only (Habits, Plan, To Do, Goals, Tracking — including nested sub-tabs). Native / PWA name is **BRAIN2**. Reuses `HomeDashboard` unchanged so desktop behavior and data stay intact.

## Manual hub (no always-on sync)

Phones copy desktop data with a **manual pull** (`MobilePullCard`) after the desktop
seeds the hub (`lib/mobile-sync.ts`). There is no continuous live-sync engine.
Texts, calls, and location are a different door: Settings → **Phone sync**
(`components/Settings/PhoneSyncPanel.tsx`), on the Mac.

## Entry points

| Path | Role |
|------|------|
| `app/mobile/page.tsx` | Route `/mobile/` |
| `MobileApp.tsx` | Login gate + sticky full-width topbar (incl. **From Notes**, **Phone Notes**, shelf shadow) + `HomeDashboard` / Lists. Listing Apple Notes still needs Mac Notes.app. Phone Notes is the Telegram Shortcut queue. |
| `MobileLogin.tsx` | Credentials: **admin** / **admin** |
| `MobilePullCard.tsx` | One-tap manual pull from the shared hub |
| `MobileLocationCard.tsx` | iPhone location. Shows only in the iOS build. Upload setup (URL, upload-only token, capture public key), Save goes straight on to Turn on (asks While Using, then Always, then starts). Recording stays on across launches until Turn off. **Set to Always** opens iPhone Settings while only While Using is granted. Send now. The plugin keeps the setup; the card stores nothing. See [`docs/phone-sync/03-location.md`](../../docs/phone-sync/03-location.md). |
| `MobileNfcCard.tsx` | _Last mapped: 2026-10-27_ iPhone NFC. Shows only in the iOS build (`BrainNfc`). Hub URL and hub token stay in the app. Scan reads the sticker’s hardware id. The first tap picks which saved tag that chip is (`brain2-nfc-chips`). A dose asks how many. Blank posts `nfc:{id}`. A door or a plain event posts with no question. `POST /api/scan` on `npm run phone:hub`. The Simulator cannot scan. Shortcuts stay. See [`docs/shortcuts/nfc-tags.md`](../../docs/shortcuts/nfc-tags.md). |
| `lib/mobile-auth.ts` | sessionStorage login (no app-data keys) |
| `lib/mobile-sync.ts` | HTTP client for the hub (`/api/sync` on the dev server) |

## Same data as desktop (manual, for now)

`npm run dev` serves **Next + the hub API on one port**. Desktop and phone do
**not** auto push/pull. To copy desktop data onto a phone:

1. On your Mac: stop old servers, then `npm run dev`
2. Open desktop Brain2 in the browser at the printed local URL
3. Settings → **Force push now** (seeds `data/mobile-sync.json`)
4. Phone (same Wi‑Fi): open the printed `http://<mac-lan-ip>:<port>/mobile/` → login `admin` / `admin`
5. Tap **Pull desktop data onto phone**

Hub file: `data/mobile-sync.json` (gitignored). The server never deletes Electron/browser storage by itself.

## Sideload onto iOS

### A) Capacitor native app (recommended)

Requires macOS + Xcode + a free Apple ID + CocoaPods (`brew install cocoapods`).

```bash
npm install
npm run mobile:ios:init   # first time only — adds ios/ project
npm run mobile:ios        # static site, sync, launch an iPhone Simulator
```

`npm run mobile:ios` can run while `npm run dev` is up. Next's static export always compiles into `.next`, which the dev server already owns, so the iOS script builds in `.mobile-build` and copies `out/` back (`scripts/mobile-static-build.mjs`). It then syncs `ios/` and launches an iPhone Simulator (`scripts/mobile-ios-sim.mjs`). A booted iPhone is used when one is already running; otherwise the first available iPhone. To install on a physical iPhone, open `ios/App/App.xcworkspace` in Xcode → **Signing & Capabilities** → your Team → Run. NFC reading also needs the **NFC Tag Reading** capability on the App ID `com.cogs.mobile`. A free Apple ID can still install the app. It cannot scan a sticker. The Simulator cannot scan one either. The entitlement is `ios/App/App/App.entitlements` (`NDEF` and `TAG`). This build reads the chip and does not write it.

If `pod install` complains about UTF-8, the npm scripts already export `LANG=en_US.UTF-8`.

### B) Safari “Add to Home Screen”

1. `npm run dev`
2. Note the `phone:` URL printed (includes `/mobile/`)
3. Open it on iPhone → Share → **Add to Home Screen**
4. Use **Pull desktop data onto phone** after a desktop force-push

Login: `admin` / `admin`.
