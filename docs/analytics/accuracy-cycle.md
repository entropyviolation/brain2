# Accuracy → Cycle (stall and pushes)

_Last mapped: 2026-10-23_

File: `components/Analytics/CycleView.tsx`. Not the menstrual Cycle phase view (that is Time → Cycle phase). Math: `signal-stats.ts` (`openItemAges`, survival curve), `accuracy-stats.ts` (`doneRateByPushes`, `AGE_BANDS`).

## Information
- `daysPushed`, `weeksPushed`, `monthsPushed` per item (all time, not windowed, except "Pushed in window").
- Open items with importance ≥ 3, their age since `createdAt`.
- Completed in window with an `estimates` record: how many still carry an estimated time.

## Plates
- Readouts, items by days pushed (title was the code name `daysPushed`), age readouts, share-still-open trace, age beeswarm, Open in Lists.
- **New, does a push still get done?** Done share per push bucket (0, 1–2, 3–6, 7+), all time.
- **New, most-pushed items** (IIB *Mountains Out of Molehills*): named peaks, height = day pushes, done peaks faded. Slider for 3–20 peaks.
- **New, open stock unit grid** (IIB *Plane Truth*): one square per open item, colored by age band (< 1 wk, 1–4 wk, 1–3 mo, 3 mo +). Importance slider 0–5. Click a square to open it.

## Research notes
- Procrastination grows with delay and low value (Steel 2007, temporal motivation theory). If done share falls as pushes rise, a push is a quiet drop.
- Open stock ages are a censored sample. The trace is S(t) of what is still open, not a Kaplan–Meier fit.

## Ideas not built
- True Kaplan–Meier with completed items as events, once push dates are stored.
