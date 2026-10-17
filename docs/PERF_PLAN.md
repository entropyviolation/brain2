# Performance plan

_Last mapped: 2026-10-16_

Reload, load, closing dialogs, and saving all feel slow and glitchy. This maps where that time goes, checked against the code at `f1848fc`. Status: **Planned**. Nothing here is done yet. The CI side is in [`CI_GREEN_PLAN.md`](CI_GREEN_PLAN.md). Phase 3 below depends on it.

I have not profiled a live vault. Numbers below come from a jsdom benchmark of the real `cogsStateStorage().setItem` on synthetic blobs. Step 0 measures the real thing.

---

## Where the time goes

_Last mapped: 2026-10-16_

### 1. The app always runs in dev mode

- `npm run electron:dev` starts `scripts/cogs-dev-server.mjs` with `next({ dev: true })`. Electron loads `http://localhost:3000` (`electron/main.js:~115`).
- Dev React is several times slower than production. Next compiles chunks on demand on each reload. The script sets `--max-old-space-size=8192`, and `next.config.mjs` comments describe heap OOMs and `ChunkLoadError` stalls.
- The vault lives in the `localhost:3000` origin's localStorage. The packaged build loads `app://local/`, a different origin, so the user stays on dev to keep their data.
- `next build` fails today on the 368 type errors (`ignoreBuildErrors: false`). There is no production build to switch to.

### 2. Each save does about ten full JSON parses on the UI thread

Every persisted store writes through `cogsStateStorage().setItem` (`lib/persist-storage.ts:~432`). For one edit it:

1. Reads the old blob back from localStorage.
2. `unionPersistSnapshots` (`lib/vault-guard.js:~747`) parses both the old and new blob and stringifies the union. This applies to the task, timegrid, ingest, and planned-actions stores.
3. `overlayHabitCompletions`, `shouldRejectContentDowngrade`, and `shouldRejectAppearanceDowngrade` parse again for habits and theme.
4. `stampAppearancePins` (`lib/vault-guard.js:~1592`) parses **every** blob before it checks the store name. It only does work for habits and theme.
5. Writes localStorage, then `postHub`.

Benchmark (jsdom, hub off):

| Store | Blob | `setItem` | One `JSON.parse` |
|-------|------|-----------|------------------|
| task-storage, 1,500 rows | 1.4 MB | 109 ms | 7 ms |
| task-storage, 4,000 rows | 3.8 MB | 195 ms | 18 ms |
| timegrid-store, 4,000 rows | 3.8 MB | 87 ms | 18 ms |
| sleep-store (no guards) | 3.8 MB | 23 ms | 24 ms |

So a task edit blocks the UI for about 200 ms before any network. The 48 ms coalescing timer doesn't help a single edit. On `pagehide`, all pending writes flush at once.

### 3. Each save is sent to the hub twice, and the hub rewrites its whole file each time

- `postHub` (`lib/persist-storage.ts:~377`) loops over `persistKeyAliases(name)`, which is `brain2-x` and `cogs-x`. It sends the full value once per alias.
- The hub's `writeVaultItem` (`scripts/persist-api.mjs:~142`) already writes both aliases from one POST. The second POST is pure duplication.
- The hub also stores every vault twice (both aliases) in one JSON file, which doubles its size.
- Each POST runs `upsertSharedPersistItem`: `readFileSync` + `JSON.parse` of the whole file, merge, `JSON.stringify` + `writeFileSync` of the whole file. All of it is synchronous, in the **same Node process that serves Next dev**. While it runs, page loads, chunk compiles, and HMR wait.
- In Electron, `postHub` also parses the value for `vaultRecordCount`. At send time, `staleAgainstLocalVault` parses the value and the local copy, once per alias.

### 4. Timers keep the save path busy

- A running work session or pen session writes the time grid every 15 s (`WORK_SESSION_TICK_MS`, `lib/operation-work-session.ts:~45`). Each tick takes the full timegrid save path and sends 2 hub POSTs.
- In a browser tab (not the Electron desktop ingest), `hooks/useMessageIngest.ts:~179` polls the hub every 1 s with 2–3 fetches to the same dev server.
- With the phone hub up, `pushVault` PUTs the whole vault every 60 s.

### 5. Startup waits on the hub

In Electron, `getItem` races a hub GET against an 800 ms cap (`PERSIST_HUB_WAIT_MS`) for every missing or seed-sized key, and always for plan-text keys. The GET returns the whole double-stored file.

What is fine: store subscriptions use selectors (two whole-store hooks, both in `components/Home/Plan/settings-dialog.tsx`). Tabs are `lazy()` in `app/page.tsx`.

---

## Plan

_Last mapped: 2026-10-16_

### Step 0 — Measure the real vault (no code change)

Run this in the app's DevTools console (Cmd-Opt-I) and save the output:

```js
Object.keys(localStorage).map(k => [k, (localStorage[k].length / 1e6).toFixed(2) + " MB"]).sort((a, b) => parseFloat(b[1]) - parseFloat(a[1])).slice(0, 15)
```

Then record one slow action in the Performance tab. This shows whether time goes to save (`setItem`, `JSON.parse`), to React rendering, or to waiting on the server.

Optionally, add a dev-only `console.warn` in `setItem` when one write takes over 50 ms, with key and size.

### Step 1 — Quick wins in the save path (small, low risk)

1. **One hub POST per edit.** Send `persistKey(name)` once, not once per alias. The hub already fans out to twins.
2. **`stampAppearancePins`: check the store name before parsing.** Return early unless the store is habits or theme.
3. **Parse each blob once per `setItem`.** Parse `value` and `previous` once at the top and pass the objects to the guards. The guards in `lib/vault-guard.js` take strings today, so add object-taking variants and keep the string ones for the hub and tests.
4. **Skip the read-back.** Keep the last string this tab wrote per key in memory. When localStorage still holds that exact string, the union with "previous" is a no-op. That covers most edits, since only another window changes it underneath.

Each step needs a test that keeps the guard's behavior (`lib/persist-storage*.test.ts`, `lib/vault-guard*.test.*`). These guards exist because data was lost before. Don't loosen what they refuse.

Expected result: a task edit drops from about 200 ms toward about 40 ms (one parse, one stringify, one write).

### Step 2 — Take the hub off the dev server's critical path

1. Keep the parsed hub vault in memory in `scripts/persist-api.mjs`. Read the file once at start.
2. Write it back debounced (about 1 s) with `fs.promises.writeFile` + rename, not `writeFileSync` per POST.
3. Store one copy per vault, not both aliases. Answer reads for either alias from that one copy.

Keep the shrink and resurrection guards and `journalVaultDrop` as they are.

### Step 3 — A production mode that keeps the vault

Depends on `next build` passing ([`CI_GREEN_PLAN.md`](CI_GREEN_PLAN.md) Phase 1).

Add `npm run electron:local`: `next build`, then the same server on `:3000` with `NODE_ENV=production`, serving `out/` as static files plus the existing `/api/*` handlers. Electron keeps loading `http://localhost:3000`, so the origin and the vault stay the same. No data migration is needed. Keep `electron:dev` for coding.

This is probably the single largest win for reload and open/close lag. Do it only after a backup export.

### Step 4 — Calm the timers

- Skip the 15 s session tick write when the rounded end time has not changed.
- Make the 1 s browser ingest poll back off to about 5 s when the queue is empty.

### Later — Stop rewriting whole stores (**Do not start** without a design pass)

The root cost is one localStorage blob per store, rewritten whole on every edit. Moving `task-storage` and `timegrid-store` to IndexedDB with per-record writes would make an edit cost one record, not the vault. That changes backup (`lib/data/backup.ts`), the hub sync, and every vault guard. It needs its own redesign doc.
