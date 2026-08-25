# `components/Mobile/` — iOS / sideload Home shell

Mobile entry for the **Home** tab only (Habits, Plan, To Do, Goals, Tracking — including nested sub-tabs). Reuses `HomeDashboard` unchanged so desktop behavior and data stay intact.

## Entry points

| Path | Role |
|------|------|
| `app/mobile/page.tsx` | Route `/mobile/` |
| `MobileApp.tsx` | Login gate + header + sync bar + `HomeDashboard` |
| `MobileLogin.tsx` | Credentials: **admin** / **admin** |
| `MobileSyncBar.tsx` | Pull/push against the local sync server |
| `lib/mobile-auth.ts` | sessionStorage login (no app-data keys) |
| `lib/mobile-sync.ts` | HTTP client for `scripts/mobile-sync-server.mjs` |

## Same data as desktop (continuous live sync)

`npm run dev` serves **Next + sync on one port**. Desktop and phone both auto push/pull every few seconds (live sync chip in the header).

1. On your Mac: stop old servers, then `npm run dev`
2. Open desktop COGS in the browser at the printed local URL (keep that tab open — it seeds/uploads your data)
3. Phone (same Wi‑Fi): open the printed `http://<mac-lan-ip>:<port>/mobile/` → login `admin` / `admin`
4. Wait a couple seconds for the green **Live sync** chip — data should appear and stay in sync both ways

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
4. Keep the Mac desktop tab open so live sync stays connected

Login: `admin` / `admin`.
