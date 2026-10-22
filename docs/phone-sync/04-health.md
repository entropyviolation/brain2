# 04 · Health

_Last mapped: 2026-10-22_

**Wave 2.** Needs `00-core.md` and the upload path from `03-location.md`.

## Job

Steps, walking + running distance, flights, active energy, workouts, sleep, heart rate.

## Owns

- `ios/App/App/HealthPlugin.swift` (or a maintained Capacitor HealthKit plugin): read-only HealthKit queries, anchored so each run reads only new samples. Background delivery for steps and workouts.
- `lib/phone-sync/health.ts`: map to `health-day` totals and `health-sample` records. Workouts paint Activity intervals. Sleep feeds the existing sleep night.

## Path

Same sealed upload as location.

## Done

- Daily totals match the Health app for the same day.
- Re-uploading a day changes nothing.
