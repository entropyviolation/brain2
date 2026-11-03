# Period summary — plan

_Last mapped: 2026-11-02_

**Partly built (2026-11-02).** Steps 1–4 are built, with a pasted playlist in place of Spotify history. This is section 9 of [`STREAM_LOG_PLAN.md`](STREAM_LOG_PLAN.md) and part of Wave 16 in [`PLAN_OF_ACTION.md`](PLAN_OF_ACTION.md). Spotify history, the palette suggestion, and outfits are still **Planned**.

## What you asked for

A summary of any period with:

- the most-played songs, a breakdown of them, and your comments on each: what you like about it and how it makes you feel;
- photos from that time;
- events that happened;
- location and activity facts;
- an outfits breakdown and a company breakdown;
- a color palette, if you give one, and any symbols you noticed;
- the day and week summaries already written, and the month summary. If the month has none yet, this is where you write it.

You **view** it in Data. You **add and edit** it in Rituals.

## What already exists

| Piece | Where | State |
|---|---|---|
| Written summaries per day, week, month, season, year, nested (a week shows its days, a month its weeks) | `components/Home/Tracking/day-summary/tracking-summaries.tsx`, stored in `lib/day-notes-persist.ts` (`brain2-tracking-day-notes`) | Built |
| End-ritual summary step for every period, editing that same text | `components/Reviews/end/RitualSummaryStep.tsx` | Built (2026-11-02) |
| Period stats and reflection questions in end rites | `components/Reviews/end/PeriodReviewStudio.tsx` | Built |
| `day:` over text adds a paragraph to the day summary | `docs/BIM_COMMANDS.md` | Built |
| Photos on a day: hand-attached plus any photo taken that day | `lib/day-photos-store.ts`, `day-summary/day-photos.tsx`, `lib/log-photo.ts` | Built |
| Time totals, company, places | `lib/tracking-summary.ts`, Data → Places | Built |
| A plain rundown of the shared Data range, plates shown only above a floor | `components/Analytics/meta/research-report.ts` | Built |
| Plan events | `lib/event-store.ts` | Built |
| Spotify login | Settings → Spotify accounts | Built |
| Spotify listening history | [`SPOTIFY_LISTENING.md`](SPOTIFY_LISTENING.md) | **Planned** — nothing reads plays yet |
| Outfit history | `components/Inventory/README.md` | **Planned** |
| Period record: pasted playlist and songs with notes, palette, symbols, cover | `lib/period-summary.ts`, `lib/period-summary-store.ts` (`brain2-period-summaries`) | Built (2026-11-02) |
| Plates and fields | `components/PeriodSummary/` | Built (2026-11-02) |
| Data → Meta → Summary, with Past summaries | `components/Analytics/meta/PeriodSummaryView.tsx` | Built (2026-11-02) |

## The shape

**One summary per period key**, the same keys the day notes and rituals already use (`YYYY-MM-DD`, week, month, season, year). The written text stays where it is (`day-notes-persist`). A new small record holds what is not text yet:

- `songNotes`: per track, your words for this period;
- `palette`: up to eight colors;
- `symbols`: short words or phrases;
- `cover`: one photo picked as the period's face.

Everything else is **read**, not stored again: songs from listening history, photos by date, events from Plan and named events, places and activity and company from Tracking, outfits from Inventory.

**Plates.** The summary is a stack of plates. A plate shows only when it has rows, the same floor rule as the Research report. Order:

1. Written summary (and the children: days in a week, weeks in a month).
2. Songs: the top tracks by plays, minutes listened, and first and last play in the period. Your note on each, if any.
3. Photos: a grid, with the cover first.
4. Events: Plan events that happened, and named-event instances.
5. Places and activity: top places by time, top activities by time, the share of time tracked.
6. Company: who you spent time with, by hours.
7. Outfits: pieces worn most, once outfit history exists.
8. Palette and symbols.

## Two doors

**Data → Summary (view).** A new Meta view on the shared Data range. Week, month, and season presets show one period; a custom range shows the plates over the range with no written summary. A "write it" key on an empty summary opens the ritual step for that period.

**Rituals (edit).** The existing summary step gets the same plates, read-only, above the text, plus three edit fields: a note per top song, palette, and symbols. If the month or season has no written summary, the step says so and opens on the text field. Because both doors read the same record, editing in one shows in the other at once.

## Steps

_Last mapped: 2026-11-02_ Steps 1–4 are built. Step 5 is replaced for now by a pasted playlist: a link (Spotify embeds a player) and songs pasted one per line, each with its own note for that period. A week can have one too. Song notes are per period, which answers the first open question for now. Symbols are free words. Data shows the written summary read-only and offers **write it here** when it is empty, instead of opening the ritual. The ritual step shows the plates and fields for week and longer, not for a day.

1. The small record (`songNotes`, `palette`, `symbols`, `cover`) keyed like day notes.
2. Plates from data that exists: written summary, photos, events, places and activity, company.
3. Data → Meta → **Summary** view.
4. The plates and fields in `RitualSummaryStep`.
5. Spotify readers first, from [`SPOTIFY_LISTENING.md`](SPOTIFY_LISTENING.md): the extended-history import, then recently played on a schedule. Then the Songs plate and song notes.
6. Palette: pick colors by hand, or suggest them from the period's photos.
7. Outfits plate, after Inventory's outfit history.

## Done when

- Data → Summary for October shows the month summary, photos, events, places, and company.
- The end-of-month ritual shows the same plates and saves a note on a song, a palette, and symbols.
- A month with no written summary says so in both doors.

## Open questions

- Should a song note be per period (how it felt that month) or one note per track that grows over time?
- Should symbols be free words, or a list you build up and pick from (so they can be counted across periods)?
