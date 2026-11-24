# Social BIMBY

_Last mapped: 2026-11-21_

Keeps track of your friendships. One line in BIM chat about a person ("serious potential new friend Masha, dmd her yesterday (loureedstrash) asking her to hang out … I need to hang out with her as soon as I get back") becomes a **plan card**: one proposed change per effect, each with why, evidence, editable fields, and Accept / Reject. **Nothing is saved until Accept.**

For the Masha line the card holds:

| Kind | Card label | What Accept writes |
|------|-----------|--------------------|
| `person` | PERSON | Masha in People I Know (or the one already there), Instagram `loureedstrash`, relation "serious potential new friend" |
| `person-note` | NOTE | The message, word for word, on her Notes log (`Task.noteLog`), dated now |
| `reminder` | REMIND | "Hang out with Masha" on the Reminders list at 11 am the day after your flight home from New York, linked to her |
| `plan-entry` | PLAN | The same line in that week's Week Plan log, stamped `SOCIAL BIMBY` |

A birthday ("Jo's birthday is March 3") adds a `birthday` effect. An invite you are going to ("invited me to her show on Saturday") adds a Day Plan entry; one you can't make stays in the note only.

## Future lines: a few people, what you want to do with each

_Last mapped: 2026-11-21_ (asks and Contacts revised the same night)

"in terms of the future I am excited to hang out with Masha and I want to go on a trip with marilyn; note texts and dms from each" used to fall through to the follow-through question ("how much do you want to?") and be logged. `future.ts` now reads it first. It takes a line with two people or more, a trip, or a request to go over texts. One person with only a hang-out still goes to `parse.ts`.

Per person, the card holds:

| Kind | Card label | What Accept writes |
|------|-----------|--------------------|
| `person` | PERSON | Made in People I Know when new. When they have no Instagram and exactly one of your Instagram mutuals matches the name, that handle is filled in, with the mutual as evidence. A known person with a handle is not touched |
| `person-note` | NOTE | Their clause, word for word, on their Notes log |
| `intention` | INTENT | "Hang out with Masha" / "Go on a trip with Marilyn" on `personProfile.intentions`, with kind and horizon (week, season, year) |
| `plan-entry` | PLAN | A hang-out goes to the Week Plan for the week starting next Monday. A trip goes to the Season Plan (`quarterPlan-YYYY-Qn`). "This year" or "someday" goes to the Year Plan |
| `plan-entry` | PLAN | A trip also offers "Maybe: go on a trip with marilyn" on the Year Plan (`yearPlan-YYYY`). Reject it if the season is enough |

After the card, BIM follows up (`session.ts`, lane `social-follow`):

1. **Contacts first.** _2026-11-21:_ before the card is built, anyone with no number is looked up in your Mac Contacts (`/api/phone-contacts`, `cardsNamed` in `lib/phone-sync/contact-names.mjs`). "Marilyn" finds a card saved as "Marilyn" or "Marilyn Monroe", and the other way round. Cards with the same name are one person, every number kept. One match is assumed: its numbers go in the PERSON change's Phone field, and a longer card name goes in Full name. Several matches become lettered choices.
2. **Asks, all at once.** _2026-11-21:_ every open question is listed together, numbered ("1. masha's number or @handle? 2. Which is Marilyn? a. … b. …"). Before, BIM asked one at a time and repeated the question at any line it could not read. Answer any of them in any order: "1 951 201 5076 @loureedstrash 2 a and b", "marilyn: @one @two", or one per line. Each answer can hold several numbers, several handles ("igs are x and y"), picks, and "last name Monroe". Each answered person becomes a one-change PERSON card. "skip" drops them all, "2 skip" one, and "go" leaves them for the texts review. A line that answers nothing goes to the other lanes and the asks stay open.
3. **Texts and DMs.** "go" shows the last four conversations with each person, oldest first. Texts come from the hub (`/api/phone-texts`, one-to-one only) and DMs from the Instagram archive (`/api/instagram/dms`, `electron/instagram-archive.js` `dmsWith`). A conversation ends after an hour of quiet. Each one ends with a question ("What do you want to remember about Masha from this?"). What you type about that person is kept: a line that names them, says she / he / her / him, or says we / they and is not a to-do. _2026-11-21:_ any other line goes on to the other lanes and the review stays open. Before, every line was kept as a note, so "need to clean house before elijah gets back … order brow bleach" became a note for Marilyn (`isNote` in `session.ts`). "next" shows the next conversation, "skip" moves to the next person, and "done" stops. Your notes come back as a NOTE card when that person is finished.

The PERSON change's Phone and Instagram fields may hold several, split by commas. Every number is added to `personProfile.phones`, and to the Phone Number attribute when that is set, so it shows on the page. The first handle is the main `instagram` when they have none. The rest go to `personProfile.otherInstagrams` (`addInstagramToPerson` in `lib/instagram-person-links.ts`), shown under Instagram on the person page. Full name goes to `personProfile.fullName`; the item keeps its name.

A command (`log: …`) or a long line that answers nothing passes to the other lanes. A session left idle for 30 minutes is dropped. Lines the Social BIMBY answers never get the follow-through question.

## Flow

- **Lane.** `social` in `CHAT_LANES` (`lib/ingest/bim-lanes.ts`), after `stream` and before `texts`, `fact` and `tell`, which would read "on Friday" as a fact. Plain BIM chat lines reach it with no command.
- **Hand-off.** "send this to social bimby: …" (`lib/ingest/bimby-handoff.ts`) runs it `forced`: a name is enough, no social cue needed.
- **Info.** "social bimby info" answers from the Blueprint (`lib/agents/adapters/social-bimby.ts`).
- The plan is kept in `useReportStore` and drawn by `components/Bim/report-card.tsx`, the same card, store and accept queue as the Report and Stream BIMBIES. `lib/report-bimby/apply.ts` sends the six kinds here (`intention` added 2026-11-21).
- **Follow-up lane.** `social-follow` sits after `commands` and before `web-home` / `ask-back`. While a session is open, "go", "skip" and a note about the person are its; anything else falls through.

## Files

| File | Role |
|------|------|
| `parse.ts` | Rules, no model. `readSocial(text, people, { forced })`: the person (known by name, first name, nickname or handle; else a capitalized name after "friend", "met", "dmd", "with" …), the handle (`Name (handle)`, `@handle`, "ig: handle", or a lone `(handle)` in a DM line), relation, a hang-out wanted and when, a trip, invites, a birthday, warm words. A question, or "friend" with nothing to do, is not social |
| `plan.ts` | Pure. `buildSocialPlan`. "As soon as I get back" is placed from your Flight items (the flight leaving the trip's city, else the last upcoming one within three weeks); with none, next Monday, and the card says so. "Next week" or no day is next Monday; a weekday is the next one |
| `apply.ts` | One writer per kind, one undo step each. A found person keeps every field; relation and birthday fill only a blank (a different birthday is refused, not overwritten). The Instagram handle moves off anyone else, as `linkInstagramToPerson` always does, and the card says so first. A note, birthday or reminder finds the person by name, or makes them |
| `future.ts` | Pure. `readFuture` (clauses, then every "hang out with X" / "trip with X" in each, with the horizon read from that hit's own words) and `buildFuturePlan` (the card, plus the asks and the people to review) |
| `mutuals.ts` | `mutualsFrom` (the Instagram mutuals list, or someone you follow who follows back) and `mutualCandidates` (every word of the name in the display name, else the first name in the handle) |
| `birthday-reply.ts` | Pure. A reply to a BIRTHDAY card (`lib/report-bimby/card-reply.ts`): `readBirthdayReply` (the year said or counted back from "22 years ago" / "turned 22", a day said outright, or the event it fell on and when: "last weekend", "yesterday", "in october" → `windowOf`), `datesIn` (dates written on a page), `pickEventDate` (the day the pages put next to the event's words, inside the window first) |
| `session.ts` | The follow-up after a future card: numbered contact asks (`splitAnswers`, `readContactAnswer`), then the texts and DMs review. In memory. Loaders are passed in |
| `apply.ts` | Also writes `intention`, a `phone` on `person`, and `plan-entry` for `quarter` (Season Plan) and `year` (Year Plan) |
| `run.ts` | `trySocial` (async: future, then group, then single), `contactCardsFor` (Mac Contacts by name, from the hub), `knownPeople`, `storeSocialDeps` (flights, airport cities, handle owner), `liveSessionDeps` (hub texts, archive DMs, the card store) |
| `social-bimby.test.ts` | The Masha line end to end, the flight-home date, reuse of a known person, the lane order, the hand-off, the Blueprint. The end-to-end tests pin the clock to 2026-11-11 (before that, the reminder fell in the past after 2026-11-18 and Accept refused it) |
| `future.test.ts` | The exact 2026-11-21 line and its follow-up answers (numbered, by name, several handles and numbers, lines that answer nothing, a Contacts match): reading, the card, mutual matching, the asks, the review session, Accept writing week, season and year, and a run through `sendToBim` |

## Planned

- **Planned:** birthday nudges (a reminder a few days before each birthday), "friends you haven't seen" from Company time, social events as calendar events, a model read for phrasing the rules miss.
- **Planned:** with LLM on, a model question per conversation in the review instead of the four fixed ones, and a one-line summary of what each conversation was about.
- **Planned:** make People I Know items for saved Contacts you have texted both ways lately, as one Accept card.
- **Planned:** show `personProfile.intentions` on the person page and mark one done when a Company block with them lands.

Test: `npx vitest run --exclude '.claude/**' lib/social-bimby`
