# Phone sync briefs

_Last mapped: 2026-10-22_

One brief per build agent for [`../PHONE_SYNC_PLAN.md`](../PHONE_SYNC_PLAN.md). Status (_Last mapped: 2026-10-25_): Wave 0 (core) and Wave 1 (texts, calls, location) are built. Settings → Phone sync lists every source. Wave 2 is **Planned**. Each brief has its own status section.

| Brief | Agent | Wave |
| --- | --- | --- |
| [`00-core.md`](00-core.md) | Sync core | 0 |
| [`01-texts.md`](01-texts.md) | Texts | 1 |
| [`02-calls.md`](02-calls.md) | Calls | 1 |
| [`03-location.md`](03-location.md) | Location | 1 |
| [`04-health.md`](04-health.md) | Health | 2 |
| [`05-screen-dms-email.md`](05-screen-dms-email.md) | Screen Time, DMs, email | 2 |
| [`06-plates.md`](06-plates.md) | Phone plates | 2 |

## Rules for every agent

- Read your brief, the plan, and the README of every folder you touch.
- Touch only the files your brief names. Need a shared hook? Ask the core agent; do not edit its files.
- Every record has a stable source id and the stamp `generatedBy: { kind: "phone-sync", source }`. Re-reading the same data writes nothing new.
- Reads are read-only. Never write to `chat.db`, `CallHistory.storedata`, HealthKit, or Notes.
- Nothing readable leaves your devices. Anything sent through Oracle is sealed to the public key first (`scripts/sealed-box.mjs`), the same as BIM texts ([`../ORACLE_CAPTURE_BOX.md`](../ORACLE_CAPTURE_BOX.md)).
- Tests land with the code (vitest, fixtures under `tests/fixtures/phone-sync/`). Fixtures are made up; never commit real messages.
- Update the folder README you changed, per `CLAUDE.md`.
