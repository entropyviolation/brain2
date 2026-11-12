# Social BIMBY

_Last mapped: 2026-11-11_

Keeps track of your friendships. One line in BIM chat about a person ("serious potential new friend Masha, dmd her yesterday (loureedstrash) asking her to hang out … I need to hang out with her as soon as I get back") becomes a **plan card**: one proposed change per effect, each with why, evidence, editable fields, and Accept / Reject. **Nothing is saved until Accept.**

For the Masha line the card holds:

| Kind | Card label | What Accept writes |
|------|-----------|--------------------|
| `person` | PERSON | Masha in People I Know (or the one already there), Instagram `loureedstrash`, relation "serious potential new friend" |
| `person-note` | NOTE | The message, word for word, on her Notes log (`Task.noteLog`), dated now |
| `reminder` | REMIND | "Hang out with Masha" on the Reminders list at 11 am the day after your flight home from New York, linked to her |
| `plan-entry` | PLAN | The same line in that week's Week Plan log, stamped `SOCIAL BIMBY` |

A birthday ("Jo's birthday is March 3") adds a `birthday` effect. An invite you are going to ("invited me to her show on Saturday") adds a Day Plan entry; one you can't make stays in the note only.

## Flow

- **Lane.** `social` in `CHAT_LANES` (`lib/ingest/bim-lanes.ts`), after `stream` and before `texts`, `fact` and `tell`, which would read "on Friday" as a fact. Plain BIM chat lines reach it with no command.
- **Hand-off.** "send this to social bimby: …" (`lib/ingest/bimby-handoff.ts`) runs it `forced`: a name is enough, no social cue needed.
- **Info.** "social bimby info" answers from the Blueprint (`lib/agents/adapters/social-bimby.ts`).
- The plan is kept in `useReportStore` and drawn by `components/Bim/report-card.tsx`, the same card, store and accept queue as the Report and Stream BIMBIES. `lib/report-bimby/apply.ts` sends the five kinds here.

## Files

| File | Role |
|------|------|
| `parse.ts` | Rules, no model. `readSocial(text, people, { forced })`: the person (known by name, first name, nickname or handle; else a capitalized name after "friend", "met", "dmd", "with" …), the handle (`Name (handle)`, `@handle`, "ig: handle", or a lone `(handle)` in a DM line), relation, a hang-out wanted and when, a trip, invites, a birthday, warm words. A question, or "friend" with nothing to do, is not social |
| `plan.ts` | Pure. `buildSocialPlan`. "As soon as I get back" is placed from your Flight items (the flight leaving the trip's city, else the last upcoming one within three weeks); with none, next Monday, and the card says so. "Next week" or no day is next Monday; a weekday is the next one |
| `apply.ts` | One writer per kind, one undo step each. A found person keeps every field; relation and birthday fill only a blank (a different birthday is refused, not overwritten). The Instagram handle moves off anyone else, as `linkInstagramToPerson` always does, and the card says so first. A note, birthday or reminder finds the person by name, or makes them |
| `run.ts` | `trySocial`, `knownPeople`, `storeSocialDeps` (flights, airport cities, handle owner) |
| `social-bimby.test.ts` | The Masha line end to end, the flight-home date, reuse of a known person, the lane order, the hand-off, the Blueprint |

## Planned

- **Planned:** birthday nudges (a reminder a few days before each birthday), "friends you haven't seen" from Company time, texts and calls, social events as calendar events, a model read for phrasing the rules miss, several people in one line.

Test: `npx vitest run --exclude '.claude/**' lib/social-bimby`
