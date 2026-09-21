# `electron/` — Desktop shell

The Electron desktop wrapper around the static Next.js export (spec §2.1
"Option B — Electron"). In production it serves the contents of `out/` through a
custom `app://` protocol; in development it loads the Next dev server at
`http://localhost:3000`.

## Files

| File | Purpose |
|------|---------|
| `main.js` | Electron **main process**. Pins `userData` to Application Support/`cogs` (`user-data-path.js`) before `ready`, then registers the privileged `app://` scheme, creates the `BrowserWindow` (`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`), loads the dev server (dev) or the `app://` static export (prod), resolves static files from `out/` (with `trailingSlash` `index.html` handling), opens external links in the system browser, and manages app/window lifecycle. IPC: PDF text extraction, module pop-out windows, Apple Notes ingest. |
| `user-data-path.js` | Stable Application Support folder (`cogs`). Electron would otherwise derive `userData` from package.json `name` / `productName` and boot an empty profile after a brand rename. The git folder name (`cogs copy` → `brain2`) does not move this path. |
| `preload.js` | **Preload script** (context-isolated). Exposes a minimal `window.desktop` API (`isElectron`, `platform`, `versions`, `extractPdfText`, `openModulePopout`, `fetchAppleNotes`) via `contextBridge`. Hydrates missing or seed-sized keys from the persist hub via `lib/vault-guard.js` without replacing a richer local vault. |
| `apple-notes.js` / `apple-notes.jxa` | Notes.app reader (iCloud / iPhone + On My Mac). Modes: `preview` (titles/dates), `snippet` (short body for swipe cards), `bodies` (full text for bulk-add / park). |
| `entitlements.mac.plist` | Hardened runtime + Apple Events so packaged Mac builds can ask to control Notes. |
| `ipc/` | **Scaffolding** for the future `DataSource` IPC bridge (Phase 10). `channels.js` holds the channel-name constants (mirror of `COGS_IPC_CHANNELS` in `lib/data/sources/ipc-data-source.ts`); not yet imported by `main.js`. See `ipc/README.md`. |

## Build & run
Driven by the root `package.json` (`main: "electron/main.js"`,
`electron:dev`/`electron:build` scripts, and the `build` config for
electron-builder). Output installers go to `dist/` (git-ignored).

## Apple Notes ingest

`ipcMain.handle("cogs:notes:fetchAppleNotes")` runs `osascript` against **Notes.app** (macOS only). iPhone notes appear once they have synced through iCloud. Packaged builds declare `NSAppleEventsUsageDescription` and Apple Events entitlements (`entitlements.mac.plist`). Restart `electron:dev` after changing the JXA/preload bridge.

The renderer UI is `components/notes-ingest.tsx` (header **From Notes**).

## Data & sync direction
**Vault path.** Renderer localStorage lives in Chromium `userData`, pinned to
`~/Library/Application Support/cogs` (Windows/Linux: `%APPDATA%/cogs`). It must
not follow package.json `name`, electron-builder `productName`, or a git folder
rename. Checking the repo out as `brain2` instead of `cogs copy` is safe. The
empty `brain2` / `BRAIN2` Application Support profiles from 2026-09-21 are
leftovers. A Settings export from that day (2437 items) is slightly behind the
live `cogs` profile (2455 items) — keep the live profile.

COGS is **offline-first**: the renderer's local store (localStorage/Zustand) is
the working source of truth, so the main process stays a **thin shell** rather
than the data host. The IPC scaffolding under `ipc/` is preserved as *one
transport on the remote/sync side* — a way for a desktop renderer to reach a
remote `DataSource`/`MongoDataSource` (spec §3; **MongoDB Atlas**, replacing the
spec's original SQLite suggestion). When sync lands, the connection lifecycle and
`ipcMain.handle` registrations live here; see `ipc/README.md` and
`docs/SPEC_MAPPING.md` §3.
