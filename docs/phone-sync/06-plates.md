# 06 · Phone plates

_Last mapped: 2026-10-22_

**Wave 2.** Follows [`../analytics-plan/07-phone.md`](../analytics-plan/07-phone.md) and [`../analytics-plan/11-viz.md`](../analytics-plan/11-viz.md).

## Job

Show the synced data in the Phone room: texts and calls per person per day, a location map and trail, Health days, and screen time.

## Owns

New plate files beside `components/Analytics/time/TextPipelineView.tsx`. Adds `generatedBy.kind === "phone-sync"` to the Phone room's stamp allow-list. The shell agent registers view ids.

## Done

- Every plate names its grain and source in the corner.
