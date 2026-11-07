# `lib/flight-bimby/` — The Flight BIMBY

_Last mapped: 2026-11-07_

A **BIMBY** (small, single-job sub-agent) that turns a pasted booking confirmation into a **Flight item** with its tracking details and a **calendar event**. No model call: it is rules, tables and, when a key is set, a live schedule lookup, so it gives the same answer every time.

Why it exists: a confirmation pasted into BIM Chat used to be logged as one long line. Nothing was filed, and the existing `parseFlightText` read a JFK→SAN flight as SAN→JFK and "Add to Calendar" as two cities.

## Flow

PASTE → ROUTE (`looksLikeFlightConfirmation`) → READ (`extract.ts`) → FILL (`lookup.ts`) → FILE (`file.ts`) → REPLY.

- **Route.** `bim-chat.ts` `tryFlights` runs after `answerAskBack` and before the fact and tell shapes, because a confirmation's clocks ("arrives 8:45 PM") would otherwise read as told facts. "need to book flights but im stuck" has no route, clock or number, so it stays a plan and goes on as before.
- **Read.** `cleanFlightPaste` undoes the copy: `J F K` → `JFK`, `A S 2 5` → `AS25`, `SAN11:48am` → `SAN 11:48am`. A paste is cut into one chunk per flight at a date line when the date is 2+ days away (or a new flight number follows), so a flight that lands next morning stays one. Direction comes from the strongest signal: "Departs from X … arrives Y", then `(X) to (Y)`, then a code beside a clock (first pair is takeoff), then order of appearance. The booking code is read after a label (even on the next line) or after a rewards number (noted as inferred). Chatter after the code on its line comes back as `leftover` and goes on through the normal ingest.
- **Fill.** `fillBlanks` adds airline from the flight-number prefix, city and code from `airports.ts`, and, with `NEXT_PUBLIC_AVIATIONSTACK_API_KEY`, missing times from `searchFlightInfo`. It never keeps the estimate `flight-lookup.ts` would build: a guessed time on a calendar is worse than a blank. What stays empty is in `draft.missing`, written into the item body and the event description.
- **File.** `fileFlightDraft` writes one Flight item (`FLIGHT_ATTR` fields, `booked` true) in the list that takes the Flight type, else a list named for flights, else a new "Upcoming flights". The id is `flight-{code}-{date}-{from}{to}`, so the same booking pasted twice comes back "Already had". An existing item is only ever filled where blank, and a "to book" item flips to booked. The event (`flight-event-{taskId}`) starts at the departure clock and is as long as the flight really is: both zones come from `airports.ts`, so 11:48 AM San Diego → 8:13 PM New York is 5h 25m, not 8h 25m. The landing clock goes in the description.
- **Reply.** One line per flight: `Filed JetBlue SAN → JFK (WTWUQC) · Thu, Nov 12, 11:48 AM → 8:13 PM. On the calendar. Still missing: flight number.`

## Tools

`addFlightFromInfo(text | draft)`, `fileFlightDraft(draft)`, `createEventFromFlight(taskId)`, `searchFlightInfo(number, date)`, `fillBlanks(draft)`, `extractFlights(text)`, `looksLikeFlightConfirmation(text)`. All exported from `index.ts`.

## Asking

`ask.ts` answers "when am I flying to new york?" straight from the Flight items: no model, no search. `bim-chat.ts` runs it right after `tryFlights`, before the fact shapes and the LLM router. It needs a when/what word, a flight word and a first-person word, matches upcoming flights by destination (city or code, "back" means the later leg), and lists every upcoming flight for a general ask. Nothing that fits returns null, so the line goes on to the router rather than getting a false "none". Before this, the router searched only logs and notes, so a filed flight and its event could not answer.

## Other doors

- The Plan BIMBY's flight row (`lib/plan-bimby/apply.ts` `fileFlight`) reads through the same extractor. A bare code with no route still files the old plain item.
- `backfill.ts`: `BimKey` (`components/Bim/bim-key.tsx`) replays the saved BIM Chat transcript once per device (`bimchat-flight-backfill-v2`) after the task and event stores load. It checks each event is still there before it sets the flag. Ids make a repeat harmless, and a repeat that adds nothing posts no chat line.

## Rules

- **Never invent.** Direction, times and codes come from the paste or a live lookup, else they stay blank.
- **Only add.** Existing values are never overwritten.
- The event store is not mirrored to the hub file in Electron (seed-sized stores skip the POST), so a flight event shows in the app but not in `data/shared-persist.json`. The Flight item does.

**Planned.** A chat line to fill a blank later ("my JetBlue flight is B6 623"); layover legs in one paste; a trip link so the event joins an Itinerary day.

## Files

- `types.ts`, `airlines.ts`, `airports.ts` (IATA → city and zone, zone math).
- `extract.ts`, `lookup.ts`, `file.ts`, `ask.ts`, `backfill.ts`, `index.ts`.
- `fixture.ts`: the two confirmations pasted on 2026-11-07, used by the tests.
- `extract.test.ts`, `file.test.ts`, `ask.test.ts`; the chat path is tested in `lib/ingest/bim-chat.test.ts`.
