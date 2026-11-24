# Geniuses: baby animal friends with a higher goal

_Last mapped: 2026-11-24_

Everything on this page is **Planned** unless it says **Built**. It turns the baby animal friend (`docs/FRIEND_COMPANION.md`) into a small council of **geniuses**. Each genius is a friend who cares about one area of your life. It gives you assignments in that area, argues for them, listens to your reasons, and remembers what you said.

The pixel game that used to live behind the friend panel is gone from Brain2. It is its own project now, in `~/baby-animal-game` (see "What left Brain2" at the end). Nothing on this page is a game. The friend is a way to put a face and a personality on your own goals.

## The idea in one paragraph

BIM and the BIMBIES are the tools. They receive, record, file and organize: a line in, a row out. A genius is not a tool. It takes a side. The habits genius wants your habits done. The money genius wants the budget kept and income grown. A project genius wants one project shipped. Each one reads the lists, habits and goals tied to its area, picks the next real step, asks you to take it, and answers when you push back. You decide. The genius remembers how it went.

## Why "genius"

The Romans gave every person and every place a _genius_, a guardian spirit that wanted it to thrive. The Greek word is _daimon_. A good life was _eudaimonia_: having a good daimon, flourishing. Socrates said his daimonion spoke up when he was about to go wrong. That is the job here: a small voice with a higher goal in mind, one per area, that speaks up.

Plural: **geniuses**. One genius per area. A new goal or project can get its own.

## Where the geniuses sit: id, BIM, ego, superego

The app already has three layers. This names them.

| Layer | In Freud | In Brain2 | What it does |
|---|---|---|---|
| **Id** | The drives; raw wanting and sensing | The sensory record: Tracking, Inbox, phone sync, texts, screen time, browser history, the stream log | Records what happened and what you said, unfiltered |
| **BIM and the BIMBIES** | (the senses and hands) | BIM chat, the routed flow, every BIMBY | Receives, parses, files, organizes. Proposes; never decides |
| **Ego** | The self that weighs and chooses | **You** | Accepts, declines, argues, decides |
| **Superego** | The ego ideal: who you mean to be | **The geniuses** | Holds the higher goals and argues for them |

The interplay is the point. The geniuses read what the id recorded (through the same stores BIM writes). They press the ego toward a goal. The ego answers. When the ego agrees, the write goes through the one write door (`task-store`), the same door the BIMBIES use. A genius never acts behind your back.

**One correction to Freud.** Freud's superego has two halves: the _conscience_, which punishes, and the _ego ideal_, which aspires. Geniuses are only the ego ideal. They never shame, scold, or take points away. That matches the friend's copy rule today: never shame overdue, describe the event and date it (`docs/FRIEND_COMPANION.md` "Copy").

## How a genius differs from what already exists

| Thing | Built? | Its job | How a genius differs |
|---|---|---|---|
| Today's friend | **Built** | One worn animal a week; offers a mission from habits, To Do, Next Actions | A genius is a friend bound to one area, with its own memory and charter |
| Coach BIMBY (`lib/coach-bimby/`) | **Built** | One general coach in BIM chat and Telegram: notes about you, a morning brief, the next step | A genius is one of several, each with a side to take. It lives in the friend UI, not in BIM chat |
| Overcome BIMBY (`lib/overcome-bimby/`) | **Built** | When you cannot start, logs the resistance and pushes you to begin | A genius may use the same tactics, but only for its own area, and keeps a relationship over weeks |
| Habit Helper, Finance BIMBY | **Built** | Record and organize habits and money from plain sentences | The habits and money geniuses _read_ what those record. They do not replace them or call them |

Geniuses read these modules. They do not change them. No file under `lib/bim-flow/`, `lib/ingest/`, `lib/agents/adapters/`, or any BIMBY folder changes for the slices below. A BIM chat handoff ("ask the money genius") is listed at the end as a separate decision.

## Starter council

Three geniuses ship first. Their names and faces are yours to pick; these are placeholders. A face is any card in the friend gallery, so its species personality still applies (`lib/baby-animal-personality.ts`).

| Genius | Area | Reads | Typical assignment |
|---|---|---|---|
| **Hearth** | Daily habits and rituals | Habits store, rituals, today's habit goals | "Two habits left today. Water first, it takes a minute." |
| **Coin** | Budget and making money | Budget, Finance BIMBY records, money goals and objectives | "You logged three takeout meals this week. Cook tonight, and log one income lead." |
| **Muse** | Creative work, or one project you name | The project's list and its items, creative objectives | "The album list has had no done step in nine days. Open the session file for ten minutes." |

More can follow from the same template: body and health, people and friendships, learning. Each new one is opt-in.

## What a genius is (data)

One record per genius. The face is an existing friend card, so nothing about the gallery changes.

```ts
type Genius = {
  id: string
  name: string                 // "Coin"
  animalId: string             // the face; personality comes from personalityFor(animalId)
  area: string                 // "Budget and making money", in your words
  charter: string              // what it wants for you, in your words, ≤ 280 chars
  bindings: {
    objectiveIds: string[]     // Goals tab objectives (an objective is already an "area of life")
    goalIds: string[]
    listIds: string[]
    habitIds: string[]
    rootItemIds: string[]      // a project's root items; their children count too
  }
  notes: GeniusNote[]          // what it remembers, each in your words, dated
  origin: "starter" | "goal" | "project"
  status: "active" | "resting" | "retired"
  createdAt: string
}

type GeniusNote = {
  id: string
  at: string
  said: string                 // your words, or a short quote of them
  about: { kind: "item" | "goal" | "habit" | "list"; id: string } | null
  source: "you" | "picked-up" // picked-up = the model kept it from a reply; shown marked
}
```

Missions stay the friend's `FriendMission` rows (`lib/friend-mission.ts`). One optional field is added: `geniusId: string | null`. Old rows read as `null`, so the journal, points and keepsakes keep working unchanged.

**Relationship is derived, not stored.** Bond today is computed from the mission log (`lib/friend-stats.ts`), and keepsakes are counted from it. A genius's relationship works the same way: a pure function over its missions. No counter can drift.

## How a genius picks an assignment

The picker stays code. It stays testable. The model never chooses the task.

1. Build the candidate pool the friend already builds (`lib/friend-suggestion.ts`): open habits, today's To Do, Next Actions, whims.
2. Keep only candidates inside the genius's bindings: an item on a bound list or under a bound root, a bound habit, an item that serves a bound goal or objective.
3. Score with the existing knobs (source weights, list bias, title loves, urgency), then add two genius terms:
   - **stalled area**: days since the last done step in this area, capped;
   - **declined this week**: a penalty, so a refused task is not pushed every day (the log already has it).
4. An empty pool is a real answer. The genius says what it would like to see ("There is no open step on the album list. Want to add one?") and offers a write through the card, not a made-up task.

## Relationship from sequences

You build a relationship with a genius by finishing things in its area, in order. All of these are computed from the log.

| Signal | Example | What it unlocks |
|---|---|---|
| **Streak** | Habits done five days running | Warmer lines; a keepsake |
| **Chain** | Step 1, 2 and 3 of a project finished in order | The genius may propose the next step itself (as a card) |
| **Comeback** | A done step after a stall of 7+ days | A celebrate line, never a "finally" |
| **Kept word** | You said "tomorrow" in a reply, and did it tomorrow | The genius trusts your plans: fewer pushes, more "your call" |
| **Breadth** | Every bound list moved this week | A weekly note in its journal |

Levels gate what a genius may do, not how much it likes you:

| Level | May do |
|---|---|
| 1 | Offer missions from its bindings. Scripted lines |
| 2 | Talk back (model replies). Keep notes you approve |
| 3 | Propose new steps under a bound root item (as a card) |
| 4 | Propose a weekly plan for its area; read other areas for conflicts |

## Talking back

This is the new part. Today the friend offers a mission and you accept or decline through a fixed ladder (smaller task, first step, a reason). With a genius, you can also just answer in words, and it answers you.

**The turn.**

1. Code picks the mission and builds a read: the charter, the chosen task, its notes, the last few lines of this mission, and a short snapshot of its area (open count, last done, streak). Coach BIMBY's `coachSnapshot` is the model for this read; a genius reads only its own area.
2. You type a reply: a reason, an argument, a counter-offer, or just how you feel.
3. The main local model (through `lib/bim-flow/chat-models.ts` and `ollama.ts`, read-only imports) writes one reply in the genius's tone. It must return closed JSON:

```ts
type GeniusReply = {
  line: string                               // ≤ 2 sentences, in the genius's tone
  stance: "press" | "soften" | "split" | "reschedule" | "concede"
  smaller?: string                           // when stance is split: one smaller step
  when?: string                              // when stance is reschedule: a date or time you named
  keep?: { said: string; about: GeniusNote["about"] } // a note it would like to remember
}
```

4. Code checks the JSON. Bad JSON, a line over length, or a model that is down falls back to the scripted ladder that exists today. The mission title never changes.
5. Every write the reply implies is a **card** you accept: the smaller step, the new time, the note. This is the same pattern as BIM chat filings (propose, then accept).

**Rules for the voice.**

- It argues from _your_ reasons. It quotes your charter, your goals, what you said last time. It does not invent stakes.
- It may concede. "Concede" is a real stance, and it is logged as the decline reason. A genius that cannot lose an argument is a nag.
- No guilt, no shame, no fake urgency, no threats to the relationship. Describe events and dates.
- At most six exchanges on one mission. Then it concedes or reschedules.
- It never sees Secret items, and it never reads another genius's notes below level 4.

## Listening and recording

What you say in a reply often belongs somewhere: a reason a task is stuck, a next step, a number. A genius can offer to keep it.

| You say | The card offers | Where it goes |
|---|---|---|
| "I'm stuck because I don't have the stems" | Note on the task | The item's `notes` (append, dated, never overwrite) |
| "I made $40 from the print sale" | Progress on the goal | `setGoalProgress` on the bound money goal |
| "Next I need to email the venue" | A child step | A new child item under the mission's task |
| "I hate doing this at night" | Remember this | A `GeniusNote` on the genius |

Nothing is written until you press accept. Each write is one call through the existing stores and shows in the item's history.

**This changes one old rule.** `docs/FRIEND_COMPANION.md` says "Do not store chat transcripts. The friend is not an LLM session." For geniuses: the exchanges on one mission are kept on that mission's log (capped at twelve lines, each ≤ 280 characters), because remembering your argument is the feature. Nothing else is stored. There is still no free chat with a genius outside a mission.

## New geniuses for new goals and projects

When you add a goal or objective on the Goals tab, or mark a list as a project, a quiet offer appears: "Give this a genius?" Yes opens the charter card with the bindings filled in. No hides the offer for that goal. A genius is never made without that yes.

Limits: at most seven active geniuses. A genius whose goal is done can **retire**: it keeps its journal and keepsakes, stops offering missions, and shows in a small alumni row. **Resting** pauses one without losing anything.

## The council (later)

When two geniuses want the same evening (Coin wants a gig, Muse wants studio time), the council view shows both asks side by side with their reasons. You pick, and the pick is logged for both. Neither genius sees the other's notes; they see only that the evening went to the other area. This is the interplay between superegos, refereed by the ego.

## Implementation slices

Each slice is small, keeps the app working, and ends green: `npx tsc --noEmit`, the touched tests, and a browser check for any UI. Desktop UI follows `docs/DESIGN_STYLE.md`; the phone follows `docs/MOBILE_STYLE.md`. The one personality editor stays Gallery Details (FRIEND_COMPANION rule), so the charter editor goes there too.

### GN-0: clear the ground (**Built** 2026-11-24)

The pixel game, its lab pages, scripts, reference boards and docs left Brain2. The friend's two "play" keys are gone. This page and the doc updates were written.

### GN-1: the record

- `lib/geniuses/types.ts`, `lib/geniuses/sanitize.ts` (clamp lengths, drop dangling binding ids, cap notes at 200), `lib/geniuses/starters.ts` (the three templates, unbound).
- `lib/geniuses/store.ts`: a zustand persist slice under `persistKey("geniuses")`, version 1.
- Add the key to `lib/data/backup.ts` and its label map, and check `lib/vault-coverage.test.ts`.
- Tests: sanitize round trip; dangling ids dropped; an empty store loads.
- Done when the store survives a reload and a backup round trip. No UI yet.

### GN-2: missions know their genius

- `FriendMission.geniusId` (optional, sanitized to `null`), in `lib/friend-mission.ts` and the store's sanitize.
- `lib/geniuses/pool.ts`: `inArea(genius, candidate, vault)` and `geniusPick(genius, pool, log, now)`, wrapping `friend-suggestion.ts` without changing its default path.
- Tests: an old mission row loads; a candidate outside the bindings is never picked; declined-this-week lowers a score; an empty area returns an empty-pool line.

### GN-3: see and edit a genius

- Gallery Details gains a **Genius** tab: area, charter, bindings (pickers for objectives, goals, lists, habits, root items), status.
- The header friend: when the worn friend's card is a genius's face, the bubble speaks as that genius and picks from its area. Otherwise it behaves as today.
- Tests: the tab saves and reverts like the other tabs; a bound worn friend offers only in-area missions.

### GN-4: relationship

- `lib/geniuses/relationship.ts`: streaks, chains, comebacks, kept words, breadth, and the level, all pure over the mission log.
- Shown on the instrument where bond is today; new keepsakes join the existing keepsake list.
- Tests: fixture logs for each signal.

### GN-5: talking back

- `lib/geniuses/voice.ts`: builds the prompt from the read; `lib/geniuses/reply.ts`: validates `GeniusReply`, falls back to the ladder.
- A reply box on the mission sheet, level 2 and up. Each turn records a Trace through `lib/agents/trace.ts` (read-only import).
- A Blueprint for the geniuses with `mind: "policy"` (the kind the Blueprint already reserves for the friend). Registering it in `lib/agents/registry.ts` is a one-line addition; ask before making it, since that file is shared with the BIMBIES.
- Tests: bad JSON falls back; an over-long line is refused; the mission title never changes; six exchanges end in concede or reschedule.
- Live check on the real model, as Coach BIMBY's learning was checked: three arguments, logged with the model's replies.

### GN-6: listening and recording

- Cards for note-on-task, goal progress, child step, and remember-this. Each calls the existing store action.
- Tests: nothing writes before accept; a note appends and never overwrites.

### GN-7: new geniuses

- The "Give this a genius?" offer on the Goals tab and on a project list; the seven-active cap; retire and rest.

### GN-8: council and clock

- The side-by-side conflict view. Unsolicited lines on the friend clock that FRIEND_COMPANION already plans (quiet hours, cadence, pushiness).

## Open decisions

These are yours. Each has a default the slices above assume.

1. **Names and faces of the starter three.** Default: placeholders Hearth, Coin, Muse, faces picked by you in Gallery.
2. **Weekly rotation.** Default: the Monday-worn friend stays. A genius speaks in the header only when its face is the worn card. Alternative: the header shows whichever genius has the most urgent ask.
3. **Transcript on the mission.** Default: twelve lines kept per mission, as above. Alternative: keep only the notes you accept.
4. **BIM chat handoff.** "Ask Coin whether I can afford this" from BIM chat would need a line in the BIM handoff code. Default: not built, and not started without your OK, since it touches BIM.
5. **Telegram.** Default: geniuses never text you. Coach BIMBY stays the one voice there.

## What left Brain2

On 2026-11-24 the Baby animal game was removed from Brain2. It had been copied into its own repo, `~/baby-animal-game`, on 2026-11-07 (commit `d43900e`), and has grown there since. Before removal every Brain2 game file was checked against that repo: all present, differing only in its `lib/host/` imports. Brain2 had no game commits after the split. The repo's `data/baby-game-gens.json` holds every note Brain2's copy had, plus more.

Removed: `lib/baby-game/`, `components/BabyGame/`, `components/Lab/BabyFx/`, the `/lab/baby-play`, `/lab/baby-world`, `/lab/baby-casa`, `/lab/baby-fx`, `/lab/baby-gens` and `/lab/tmp-props` pages, the `scripts/baby-*` scripts and `/api/baby-gens`, `homedesignref/`, `naturerefs/`, and the `BABY_GAME_*` and `CASA_FURNISHING_HANDOFF` docs. Git history still has all of it.

Kept, because it is the friend and not the game: the gallery, the pack, personalities, missions, points, the instrument, and every `baby-animal-*` and `friend-*` file in `lib/` and `components/`.

The game's own direction (a generative, endless world where model-driven characters are shaped by the books they are given, styled after farming-village games, with cybernetics) is `~/baby-animal-game/docs/CONCEPT.md`.
