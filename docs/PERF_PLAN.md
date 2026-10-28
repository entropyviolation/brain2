# Performance plan

_Last mapped: 2026-10-24_

Reload, load, closing dialogs, and saving all feel slow and glitchy. This maps where that time goes, checked against the code at `f1848fc`. Status: **Planned**, except Step 1, which is done in code (2026-10-20). The CI side is in [`CI_GREEN_PLAN.md`](CI_GREEN_PLAN.md). Phase 3 below depends on it.

The table in section 2 is a jsdom benchmark of `cogsStateStorage().setItem` on synthetic blobs. A reading of the live vault on 2026-10-24 is the next section. Step 0 is still the DevTools measurement.

---

## Where the time goes

_Last mapped: 2026-10-27_

### 1. The app always runs in dev mode

- `npm run electron:dev` starts `scripts/cogs-dev-server.mjs` with `next({ dev, hostname, port, turbopack: true })` when `NODE_ENV` is not `production`. Dev now requests Turbopack. `experimental.optimizePackageImports` still applies. Turbopack ignores the webpack watch-ignore hook, so hub writes under `data/` refreshing the skin is the regression to watch. Electron loads `http://localhost:3000` (`electron/main.js:~115`).
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

_Last mapped: 2026-10-27_

- A running work session or pen session checks the grid every 15 s (`WORK_SESSION_TICK_MS`, `lib/operation-work-session.ts`). Since Step 4, `liveEntryUpToDate` skips the write when the painted block already ends at the active minute. The block still grows about once a minute, and that growth takes the full timegrid save. Typing an objective used to take that same save on every character (2026-10-24 note). `GrowText` now waits 400 ms, and flushes on blur and unmount, so a burst of typing is one save. Hub posts are one per edit after Step 1, not two.
- In a browser tab (not the Electron desktop ingest), `hooks/useMessageIngest.ts:~179` polls the hub every 1 s with 2–3 fetches to the same dev server.
- With the phone hub up, `pushVault` PUTs the whole vault every 60 s.

### 5. Startup waits on the hub

In Electron, `getItem` races a hub GET against an 800 ms cap (`PERSIST_HUB_WAIT_MS`) for every missing or seed-sized key, and always for plan-text keys. The GET returns the whole double-stored file.

What is fine: store subscriptions use selectors (two whole-store hooks, both in `components/Home/Plan/dialogs/settings-dialog.tsx`). Tabs are `lazy()` in `app/page.tsx`.

---

## Observed on the live vault (2026-10-24)

_Last mapped: 2026-10-27_

While a pen-color **Working on right now** session was open, the whole window lagged: closing a popup, typing, and clicking a button. The same lag may also be attributable to the computer being overloaded at the time. The seams below are in the code either way.

The session blob itself is small (about 1.6 KB). The one-second clock does not walk the vault. `usePenColorSessionClock` (`components/Home/Tracking/pen-color-now-strip.tsx`) only updates the elapsed label in the components that call it: the header Now rows (loaded only while a session is live), the Tracking strip, and the focus bar when a task is on the clock. Each mounted caller starts its own one-second interval and its own 15-second tick. A three-second sample of the Electron renderer showed the main thread waiting, not spinning.

The vault beside that small session is large. Read from the Electron localStorage log that evening (`brain2-task-storage`, `brain2-timegrid-store`):

| Store | JSON | On disk (UTF-16) | Rows |
|-------|------|------------------|------|
| Tasks | 6.4 MB | 12.8 MB | 11,853 tasks |
| Time grid | 3.6 MB | 7.1 MB | 9,566 entries, 691 pens |

Typing in an objective was the expensive app path that day. `GrowText` in `now-objectives-list.tsx` called `onEditText` on every change. For the pen clock that is `editPenColorNowObjectiveText`, which mirrors the list onto the painted block through `updateEntry`. `updateEntry` maps the whole `entries` array. About 48 ms later `createCogsJSONStorage` stringifies `brain2-timegrid-store` and writes it. The Operations clock uses the same editor and the same mirror (`editWorkNowObjectiveText`). Dozens of views select `s.entries` (the time grid, the dash faces, the home tiles, and others) and re-render when that array changes. A task-store edit stringifies the 6.4 MB task blob the same way.

That typing path is now debounced in `GrowText` (`components/Home/Tracking/now-objectives-list.tsx`). The field keeps the letters locally. `onEditText` — pen `editPenColorNowObjectiveText`, Operations `editWorkNowObjectiveText`, and the block editor, since they share this list — runs after a 400 ms pause, immediately on blur, and on unmount so the last characters are kept. One pause still takes the full timegrid save.

The dev window in that session was `npm run electron:dev`, compiling on the order of 9,000 modules, with full reloads. That matches section 1.

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

_Last mapped: 2026-10-20_

**Status: done in code, not yet measured on the real vault.** Tests: `npx vitest run lib/persist-storage lib/vault-guard lib/vault-coverage` (90 pass). Run Step 0 before and after to get real numbers. A jsdom spot check on a 3.5 MB task blob (long repeated strings, so parse is unrealistically cheap) showed about 3 ms per `setItem`. That is not comparable to the table above.

1. **One hub POST per edit. Done.** `postHub` now sends `hubPostKeys(name)` (`lib/persist-storage.ts`). `writeVaultItem` (`scripts/persist-api.mjs:~142`) writes every `persistAliases(name)` from one POST, which I checked. One exception: a bare plan-text key (`monthPlan-…`) has no twin in the hub's `persistAliases`, so it keeps a second POST for its `brain2-` key. `cogs-` is covered by that one.
2. **`stampAppearancePins` returns before parsing. Done.** Only habits, theme, and the friend gallery stamp anything.
3. **Parse once. Done.** `setItem` parses `value` once, and `previous` at most once, and only for vaults in `vaultNeedsParsedGuards` (unioned vaults, habits, theme, friend gallery). Sleep, Metrics, and the like are never parsed. `lib/vault-guard.js` has `…Parsed` / `…Root` variants of the union, habit overlay, appearance/content/ingest downgrade guards, ingest overlay, stamp, and record-count functions. The string functions delegate to them, so the hub and the tests behave as before. An identical write returns before any parse.
4. **Skip the read-back union. Done, with a stricter rule than "string matches".** `lastWritten` keeps the last string and record count this tab wrote for timegrid, task, planned-actions, and telegram-feed. The union is skipped only when localStorage still holds that exact string **and** the new blob's record count did not drop. A smaller count (a delete, or a stale rehydrate) still takes the full union path. Habits, theme, and ingest never skip: their other guards need the stored copy.

**Risk to know.** With the skip on, a write that swaps rows (same count, different ids, no tombstone) is no longer healed by the union. That needs a stale writer inside the same tab after it has already written once. Boot-time seed writes have no cache entry, so they take the full path.

Left for later: `staleAgainstLocalVault` still parses the value and the local copy once per hub POST, 250 ms after the edit.

Each step has a test in `lib/persist-storage.test.ts` or `lib/vault-guard.test.ts`. These guards exist because data was lost before. Nothing they refuse was loosened.

Expected result: a task edit drops from about 200 ms toward about 40 ms (one parse, one stringify, one write).

### Step 2 — Take the hub off the dev server's critical path

1. Keep the parsed hub vault in memory in `scripts/persist-api.mjs`. Read the file once at start.
2. Write it back debounced (about 1 s) with `fs.promises.writeFile` + rename, not `writeFileSync` per POST.
3. Store one copy per vault, not both aliases. Answer reads for either alias from that one copy.

Keep the shrink and resurrection guards and `journalVaultDrop` as they are.

**Status: done in `scripts/persist-api.mjs`** (not yet run in the live dev server).
_Last mapped: 2026-10-20_

- The hub file is read once. Memory is the source of truth. A POST/PUT only mutates memory and schedules one write ~1 s later (`fs.promises.writeFile` to a unique `.tmp`, then `rename`). Edits during a write get the next window.
- Memory holds one copy per vault, under the `brain2-*` name. **Disk and the API still carry both** `brain2-*` and `cogs-*`: the Electron preload, `lib/persist-storage.ts`, and the phone hub look up either name, and old files have twins. Reads expand the one copy to both. If a twin pair disagrees on disk, `brain2-*` wins (same as every merge before).
- Other processes (phone hub, `dump-chrome-localstorage.mjs`) write the same file. Each read or write stats the file; if it changed, memory reloads. With unwritten edits, the disk copy is reloaded and those edits are merged back through the hub guards. A window of up to ~1 s of staleness between two long-lived hub processes remains.
- Flush on `exit`, `SIGINT`, `SIGTERM`, `SIGHUP` (sync write). `SIGKILL` or a crash loses at most ~1 s of edits.
- Unchanged writes no longer rewrite the file or bump its mtime (`mergeSharedPersistItems` used to always write). Guards and `journalVaultDrop` are unchanged. New exports: `flushSharedPersist`, `flushSharedPersistSync`, `_resetSharedPersistForTests`.

### Step 3 — A production mode that keeps the vault

Depends on `next build` passing ([`CI_GREEN_PLAN.md`](CI_GREEN_PLAN.md) Phase 1).

Add `npm run electron:local`: `next build`, then the same server on `:3000` with `NODE_ENV=production`, serving `out/` as static files plus the existing `/api/*` handlers. Electron keeps loading `http://localhost:3000`, so the origin and the vault stay the same. No data migration is needed. Keep `electron:dev` for coding.

This is probably the single largest win for reload and open/close lag. Do it only after a backup export.

### Step 4 — Calm the timers

_Last mapped: 2026-10-25_ — **Done.**

- Done: `tickWorkSession` and `tickPenColorSession` skip the write when the live Tracking block already ends at the rounded active end (`liveEntryUpToDate` in `lib/operation-work-session.ts`). A moved or missing block still repaints.
- Done: `hooks/useMessageIngest.ts` browser hub poll is a self-scheduling timeout: 1 s while messages arrive, 5 s when the queue is empty, paused while the tab is hidden, and snapped to an immediate poll when it becomes visible.
- Done: hidden-tab guards added to the 1 s tick in `useNow` (`components/Home/ToDo/session-planner/use-now.ts`, loaded through `SessionPlanner.tsx`), the 15 s tick in `components/header-reminder-bell.tsx`, and the 2 min poll in `hooks/use-screentime-sync.ts`.
- Left alone (cheap or intentional): `components/Home/home-dashboard.tsx` 60 s clock (only with Follow the clock), `TidyView.tsx` 1 s tick (returns early unless a timer runs), `JustStartMode.tsx` 1 s (focus screen), Settings face fields at 200 ms (only on that screen), `dash-faces.tsx`, the 15-60 s clocks in `append-log`, `home-days-until`, `home-solar-tile`, `home-moon-tile`, `home-overview`, `day-view`, `agenda-grid`, `time-grid`, `week-grid`, `trk-time-markers`, `FriendDetailsPanel`. Each re-renders one component, but none pause while hidden. Candidates for a shared `useNow` hook that pauses when hidden.

### Later — Stop rewriting whole stores (**Do not start** without a design pass)

_Last mapped: 2026-10-27_

The root cost is one localStorage blob per store, rewritten whole on every edit. Typing an objective is one case: after the 400 ms pause in `GrowText` (or on blur or unmount), that edit still rewrites `brain2-timegrid-store` whole (see the 2026-10-24 note). Moving `task-storage` and `timegrid-store` to IndexedDB with per-record writes would make an edit cost one record, not the vault. That changes backup (`lib/data/backup.ts`), the hub sync, and every vault guard. It needs its own redesign doc.

---

## Render and load audit

_Last mapped: 2026-10-27_

Static read of the React side. No profile taken. Short version: rendering is mostly healthy (tab panels lazy, Data views lazy, selectors used, `use-todo-desk-board.ts` memoizes its period lists). The slow feel is dominated by dev mode and the save path above, not React.

### Fixed in this pass

- `components/Home/Plan/dialogs/settings-dialog.tsx`: it destructured the whole `useTaskStore()` and `useEventStore()` and scanned every `localStorage` key on each render. It is mounted always (`plan-panel.tsx:~310`), so every task edit re-rendered it. Now it subscribes to counts only, reads full arrays via `getState()` on export, and counts plan keys in a `useMemo` only while open.
- `next.config.mjs`: added `experimental.optimizePackageImports` for `lucide-react` (127 importing files), `date-fns`, `recharts`, and three Radix packages. It still applies with Turbopack. Cuts dev compile time and chunk size. Payoff: medium in dev, small in prod.

### Not fixed, ranked by payoff

1. **Dev mode** (section 1 above) remains the largest cost. Estimated payoff: large.
2. **Clock dial PNGs** (`components/ui/clock-picker/clock-dials.ts`): the 17 PNGs, about 13 MB, are no longer statically imported. `loadDial` dynamic-imports the selected dial, so the dev compiler does not walk every painting with this module. Resize or convert to WebP is still open. Payoff of that resize: memory. The compile cost of importing every dial here is done.
3. **`katex`** is statically imported in `components/Home/Habits/panel/willpower-gems.tsx:39` with its CSS. Habits is already lazy, so it only costs on opening Habits. Switch to `import("katex")` inside the render helper if Habits open feels slow. Payoff: small.
4. **129 files subscribe to `s.tasks`** (`useTaskStore((s) => s.tasks)`). Each task edit re-renders all mounted ones. Fine while only one tab is mounted. Item detail keeps the tab desk mounted (hidden) (`app/page.tsx` header), so hidden tabs still re-render. Consider unmounting or `Activity`/deferring hidden tabs. Payoff: medium, needs care (scroll and state restore).
5. **`app/page.tsx` eager imports**: `PenSettingsHost`, `TagSettingsHost`, `StepItemStack`, `CaptureDoorHost` load on first paint. Convert the settings hosts to `lazy` mounted on first open. Payoff: small to medium on first load.
6. **Startup idle hooks** (`useSystemHomeListPins`, `usePeopleIKnowList`, instagram lists) run after `brain2-nav-ready`, each scanning task and list arrays. Merge into one idle pass. Payoff: small.
7. **Many small `localStorage.getItem` reads in render paths** (`ToDo/CardSection.tsx:17`, `TaskCardSide.tsx:734`, `NeedsAttention.tsx:66`). They are inside lazy initializers or effects, so cheap. Leave.
