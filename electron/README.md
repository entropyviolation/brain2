# `electron/` — Desktop shell

The Electron desktop wrapper around the static Next.js export (spec §2.1
"Option B — Electron"). In production it serves the contents of `out/` through a
custom `app://` protocol; in development it loads the Next dev server at
`http://localhost:3000`.

## Files

| File | Purpose |
|------|---------|
| `main.js` | Electron **main process**. Registers the privileged `app://` scheme, creates the `BrowserWindow` (`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`), loads the dev server (dev) or the `app://` static export (prod), resolves static files from `out/` (with `trailingSlash` `index.html` handling), opens external links in the system browser, and manages app/window lifecycle. IPC: PDF text extraction, module pop-out windows, Apple Notes ingest. |
| `preload.js` | **Preload script** (context-isolated). Exposes a minimal `window.desktop` API (`isElectron`, `platform`, `versions`, `extractPdfText`, `openModulePopout`, `fetchAppleNotes`) via `contextBridge`. |
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
COGS is **offline-first**: the renderer's local store (localStorage/Zustand) is
the working source of truth, so the main process stays a **thin shell** rather
than the data host. The IPC scaffolding under `ipc/` is preserved as *one
transport on the remote/sync side* — a way for a desktop renderer to reach a
remote `DataSource`/`MongoDataSource` (spec §3; **MongoDB Atlas**, replacing the
spec's original SQLite suggestion). When sync lands, the connection lifecycle and
`ipcMain.handle` registrations live here; see `ipc/README.md` and
`docs/SPEC_MAPPING.md` §3.
