# `components/Mobile/` — iOS / sideload Home shell

Mobile entry for the **Home** tab only (Habits, Plan, To Do, Goals, Tracking — including nested sub-tabs). Reuses `HomeDashboard` unchanged so desktop behavior and data stay intact.

## Live sync — paused

Continuous phone ↔ desktop **live sync is deprecated for now**. The existing
engine (`lib/live-sync.ts`, `components/LiveSync/`) is parked so it cannot
overwrite data while the rest of COGS is finished. After those surfaces are
solid, a dedicated **semi-mobile live sync** component will land.

Until then, phones use a **manual pull** (`MobilePullCard`) after the desktop
seeds the hub.

## Entry points

| Path | Role |
|------|------|
| `app/mobile/page.tsx` | Route `/mobile/` |
| `MobileApp.tsx` | Login gate + header + `HomeDashboard` / Lists |
| `MobileLogin.tsx` | Credentials: **admin** / **admin** |
| `MobilePullCard.tsx` | One-tap manual pull from the shared hub |
| `lib/mobile-auth.ts` | sessionStorage login (no app-data keys) |
| `lib/mobile-sync.ts` | HTTP client for the hub (`/api/sync` on the dev server) |

## Same data as desktop (manual, for now)

`npm run dev` serves **Next + the hub API on one port**. Desktop and phone do
**not** auto push/pull. To copy desktop data onto a phone:

1. On your Mac: stop old servers, then `npm run dev`
2. Open desktop COGS in the browser at the printed local URL
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
npm run mobile:ios        # build static site, sync, open Xcode
```

In Xcode: select your iPhone → **Signing & Capabilities** → your Team → Run. That installs/sideloads the app.

If `pod install` complains about UTF-8, the npm scripts already export `LANG=en_US.UTF-8`.

### B) Safari “Add to Home Screen”

1. `npm run dev`
2. Note the `phone:` URL printed (includes `/mobile/`)
3. Open it on iPhone → Share → **Add to Home Screen**
4. Use **Pull desktop data onto phone** after a desktop force-push

Login: `admin` / `admin`.
