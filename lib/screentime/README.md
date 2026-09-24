# `lib/screentime/` — ActivityWatch meaning layer

Brain2 turns ActivityWatch window + AFK (+ optional web-watcher) events into
**estimated** Tracking blocks on the **Screen Time** scope. This folder is the
meaning layer only: apps become pens under category parents; AFK stays
untracked; Activity / Location / Mood / Company are never painted. It is not a
window watcher and does not import Scolect.

Prefs live on `brain2-screentime-prefs` (`cogs-screentime-prefs` alias), not
inside the timegrid blob. Window titles stay off unless `storeWindowTitles` is
on. Re-sync replaces only that day's `generatedBy.kind === "screentime"`
stamps; hand-painted time and iPhone Screen Time / Calls / Texts survive. A
second run does not double minutes.

| File | Purpose |
|------|---------|
| `app-categories.ts` | App name → category pen; slugs; browser + domain helpers |
| `prefs.ts` | Dedicated persist key, loopback URL, lookback / min duration |
| `map-events.ts` | Pure AW events → local-day intervals (not `TimeEntry` yet) |
| `sync.ts` | Fetch client + idempotent paint onto the Screen Time scope |

## Behavior

- **Intersection:** window events ∩ `data.status === "not-afk"` only. Missing AFK status is unknown, not counted.
- **Drop** clipped pieces shorter than `minDurationSec` (default 15).
- **Pens:** category roots are seeded (`st-cat-work` … `st-cat-other`). App pens are `st-app-{slug}`. Browser + overlapping web URL → domain child `st-app-{browser}-{domain}` under the browser app.
- **Midnight:** split on the local calendar; `startMin` / `endMin` are minutes past midnight, end exclusive.
- **Merge** adjacent same-pen slices, then `mergeAdjacent` on the stamped day.
- **Precision:** `"estimated"`. Entry ids `st-te-{date}-{start}-{end}-{penId}`.
- **Fetch:** Electron `window.desktop.fetchScreenTime`, else localhost `POST /api/screentime` (health `GET /api/screentime/health`). Inject `deps` in tests — no network.
- **Lookback** default 14 days. Callers who want the live edge use `screenTimeOngoingDates()` (today + yesterday).
- **Empty success:** a reachable ActivityWatch with 0 mapped blocks is `ok: true`, not an error. ActivityWatch only records from the moment its watchers run — it cannot import Apple Screen Time or anything from before install. `describeScreenTimeSync` distinguishes “no window events yet” from “events arrived but AFK / min-duration dropped them.” Settings persists that sentence as `lastSyncNote`.
- **Failure:** fetch error returns `ok: false` and does not wipe existing generated blocks.

Tests: `npx vitest run lib/screentime`.
