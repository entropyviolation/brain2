# `components/PeriodSummary/` — Period summary plates and fields

_Last mapped: 2026-11-02_

The summary of a week, month, season, or year beyond its written text. Plan: [`docs/PERIOD_SUMMARY_PLAN.md`](../../docs/PERIOD_SUMMARY_PLAN.md).

Two doors read the same record (`lib/period-summary-store.ts`, keyed like the written summaries):

- **Data → Meta → Summary** (`components/Analytics/meta/PeriodSummaryView.tsx`) views it, and lists past summaries.
- **The end ritual's Summary step** (`components/Reviews/end/RitualSummaryStep.tsx`) shows the plates and edits the fields, for week and longer.

Songs come from a pasted playlist for now: a link (Spotify links embed a player) and songs pasted one per line, each with a note. The name defaults to "October Songs", "Week of Oct 26 Songs" and so on. **Planned:** songs from Spotify listening history ([`docs/SPOTIFY_LISTENING.md`](../../docs/SPOTIFY_LISTENING.md)), a palette suggested from photos, and an outfits plate.

| File | Purpose |
|------|---------|
| `period-summary-plates.tsx` | Read plates: playlist, photos (cover first), events, places, activity, company, palette and symbols. A plate shows only when it has rows. Also `usePhotosInRange`. |
| `period-summary-fields.tsx` | Edit fields: playlist name and link, paste songs, a note per song, palette, symbols, cover photo. Saves as you go. |
| `period-summary.css` | Neutral `ps-*` styles, so each room keeps its own chrome around them. |
| `period-summary.test.tsx` | Paste songs, note one, the plate reads it back. |
