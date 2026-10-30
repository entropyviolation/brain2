# 04 · Health

_Last mapped: 2026-10-28_

**Wave 2.** The iPhone import is built. The Mac hub still does not pull Health. A sealed upload to the box, like location, is **Planned**.

## Job

Steps, walking and running distance, flights, active energy, heart rate, workouts, and sleep. The whole history, not a recent window.

## Owns

- `ios/App/App/HealthPlugin.swift` (jsName `BrainHealth`): read-only HealthKit. `earliest` is the oldest sample (limit 1, no date predicate). `readPage` is one window: daily statistics, plus sleep samples and workouts that overlap that window. No sample limit inside the page. The JS side turns the windows into pages (`healthPages` in `lib/phone-sync/health.ts`, 30 days).
- `lib/mobile/health-bridge.ts` and `components/Mobile/health/MobileHealthCard.tsx`: **Import all history** on `/mobile/`. Progress is the month and the page count. The result is the imported counts, nothing new, empty, or permission denied.
- `lib/phone-sync/health-apply.ts`: sleep mornings when that morning is empty, workouts on Activity → Exercise, daily totals in `health-store.ts`.

## Path

The phone writes its own stores. Desktop Electron does not run this import.

## Done

- The query is not capped to the last few days or a single sample.
- Re-importing a page does not duplicate workouts or replace a morning you logged.
- The card says what happened, including an empty history and a denied permission.
