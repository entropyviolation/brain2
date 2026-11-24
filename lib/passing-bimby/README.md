# Passing BIMBY

_Last mapped: 2026-11-24_

Much of what Tracking needs is said in passing, not as a command. "My new playlist i spent a few hrs or whatever building this morning", "ive been working on brain2 for a few hrs already", "before 2pmish when Elijah gets home". Before this BIMBY, no lane read those words for Tracking: the activity, how long, and the event's clock stayed in a chat line. Now each one goes on that day's Tracking notes (the day summary, `lib/day-notes-persist.ts`), so a later BIMBY or you can place it. Code only, no model.

## What it reads

| You say | Noted as |
|---------|----------|
| "spent a few hrs building playlists this morning" | `activity: building playlists, about 3 h, this morning` |
| "… building this morning (… id label the activity of that time 'music discovery/making playlists'" | `activity: music discovery/making playlists, about 3 h, this morning` (the label you gave wins) |
| "ive been working on brain2 for a few hrs already" | `activity: working on brain2, about 3 h, until now` |
| "walked the dog for 45 minutes with Marilyn" | `activity: walked the dog, 45 min, with Marilyn` |
| "Elijah gets home 2pm", "before 2pmish when Elijah gets home" | `event: Elijah gets home, 2 PM` (about, when hedged). A bare hour 1–7 is the afternoon |
| "was at the laundromat" | `place: the laundromat` |
| "hung out with Marilyn", "Marilyn came over" | `company: Marilyn` |
| "feeling so tired" | `mood: tired` |

"A few" and "several" are about 3, "a couple" about 2, "2-3 hours" about 2.5. Plans ("going to", "need to", "gonna", "will") are not activities, places or company; an event may be ahead. Nothing becomes a block.

## What it writes

One paragraph per message on the day's notes:

```
Said in passing at 9:25 AM:
- activity: music discovery/making playlists, about 3 h, this morning ("…the sentence…")
- event: Elijah gets home, about 2 PM ("…")
```

A note already on that day is not added again. BIM's reply gets one line: `Noted on today's Tracking: …`.

## Flow

Not a lane. `sendToBim` (`lib/ingest/bim-chat.ts`) calls `notePassing` after the reply and follow-through, before cues, on the line with secret spans cut out. Skipped when the turn already filed tracking (`TRACKING_KINDS`), for a Stream card (it proposes its own notes), a question asked back, a photo, an error, and KEEP / CORRECT. The Trace has a `passing` step.

## Files

| File | Role |
|------|------|
| `parse.ts` (+ `.test.ts`) | Pure. `readPassing`, `readLength`, `noteText`. Tests use the real dump of 2026-11-24 |
| `run.ts` (+ `.test.ts`) | `notePassing` (the write), `passingParagraph`, `passingForDay` (a day's notes as data, from your lines) |

## Limits

Rules only. A length needs a number word or "few / couple / several" next to hours or minutes. A sentence that only names a thing done ("got ice cream") with no length, no "spent" and no "been …ing" is not read. Moods are a fixed word list. Checked in the live chat (dev, browser) on 2026-11-24: the note showed in Tracking's Day summary. That run found one bug: after "spent … this morning," the activity took the next clause too ("building playlists , feeling so tired"). A "spent" activity now stops at the first comma; the line is a test.

**Planned:** the Tracking BIMBY reads `passingForDay` and proposes blocks from it ("about 3 h this morning" against Spotify use). The Day Log BIMBY reads it. Events go on the day's Plan.

Test: `npx vitest run lib/passing-bimby`
