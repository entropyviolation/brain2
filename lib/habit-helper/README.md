# `lib/habit-helper/` — the Habits BIMBY's flow

_Last mapped: 2026-11-07_

Named a BIMBY (BIM + baby: a small, single-job sub-agent; see `CLAUDE.md`). Code names say BIMBY (`useHabitsBimby`, `HabitsBimbyFlow`, `habitsBimbyBlueprint`). The paths the brief fixed keep `habit-helper`: `lib/habit-helper/`, `/lab/habit-helper`, the Blueprint id and surface, and the `habithelper-*` storage keys.

A BIMBY for daily habits, built the way the Tracking Helper was. It reads what was done or missed from
plain words, asks why habits get missed, nudges about open ones, and suggests shorthand names. Every change
is a proposal; nothing is written until the person accepts it. Reasoning and examples:
[`docs/HABIT_HELPER.md`](../../docs/HABIT_HELPER.md). The chat is
[`components/Home/Habits/helper/`](../../components/Home/Habits/helper/README.md). The bench is
[`components/Lab/HabitHelper/`](../../components/Lab/HabitHelper/README.md); its Blueprint is
`lib/agents/adapters/habit-helper.ts`.

## The flow

`ROUTE (code) → TAG (code) → MATCH (one model call) → COMPUTE (code) → PROPOSE (code)`

1. **ROUTE** (`run.ts` `routeOf`). `shorthand`, `reasons`, `nudge`, `question` by editable regexes; `answer`
   when a why-question is open (unless the message reads as a log: two habits named, or an amount); else `log`.
   A **word rule** (`rule.ts`, route `rule`) is checked first; see below. Only `log` reaches a model. Quotes around a message are stripped before routing. An `answer` that says the habit was done ("i did do that", `claimsDone`, no negation or "because") is not stored as a miss reason: it proposes the habit done on the day asked about, and the chat moves to the next question.
2. **TAG** (`tags.ts`). Clauses (comma, "and", "then", dash), each led by `[C1]`. Amounts `10 pages[N1]`
   (hours become minutes; word numbers only with a unit; clocks skipped), days `yesterday[D1]` (resolved by
   the Tracking Helper's `resolveDay`, carried forward), negations `didn't[X1]`, reasons `because …[B1]`. A
   "because" part stays on its clause, and its words are kept exactly.
3. **MATCH** (`match.ts`). One schema-bound call. Every field is an enum of ids that exist: clause, habit,
   maybe (a second habit = ask), kind, amount, day, reason. With no model, `matchByRules` scores each clause
   against the habits' words (`lexicon.ts`).
4. **COMPUTE** (`compute.ts`). Units convert to the habit's own; an amount in a unit the habit does not count,
   or no amount, sets the goal and says so; "another" adds; a day still ahead, a miss on a done cell, or a
   value already there is skipped with a note. A clause whose words score two habits the same is asked,
   whatever the model picked.
   The words beat the model (`trustWords`): when one habit's words clearly win a clause and the model picked a
   habit that scores lower, the words' habit is used and no ask is raised ("(skincare)" is Skincare, not the
   hemisync module). An ask lists word hits first, and the chat always adds **Other…**, a search over every
   daily habit; the pick runs through `computeItem`, so the habit's own kind decides what more is needed.
5. **PROPOSE**. A `Proposal` carries habit, day, old → new, the write, and the words it came from. A yes/no
   habit reads "undone" → "done". A goal habit with no usable amount carries `needs` ("How much (min)?") and is
   set to the goal until the person types one. Every part of a row can be changed before Accept through
   `reviseProposal` (habit, day, done/undone, amount, note, reason, start and end time); it re-reads the cell,
   so "old" stays true.

**Evidence from the BIM log** (`evidence.ts`, `logs.ts`). A minutes habit said done with no amount ("i did exercise
yesterday") does not get the goal if the person's own BIM lines for that day say when a session ended or began.
"home from my walk" sent at 6 pm means it ended at 6 pm (a cue like "home from", "finished", "heading out", plus an
activity word or the habit's own words; a clock in the line wins over the send time). The BIMBY keeps a
`PendingSpan` and asks for the other end. The reply is read in code (`readSpanAnswer`, route `span`): "started at
5 pm" is definite; "around 5" or "about an hour" is a guess, credited just the same. The proposal carries the
minutes and a `span`. On Accept, `applyProposals` writes the cell and paints the block on the habit's own Activity
pen (stamp `kw:helper:…`, so the keyword sync does not recount it), marked estimated for a guess. No cue, or no log:
the old goal default. Logs come from `bimchat-transcript` and the ingest log, read only.

**Evidence from the BIM log** (`evidence.ts`, `logs.ts`). A minutes habit said done with no amount ("i did exercise
yesterday") does not get the goal if the person's own BIM lines for that day say when a session ended or began.
"home from my walk" sent at 6 pm means it ended at 6 pm (a cue like "home from", "finished", "heading out", plus an
activity word or the habit's own words; a clock in the line wins over the send time). The BIMBY keeps a
`PendingSpan` and asks for the other end. The reply is read in code (`readSpanAnswer`, route `span`): "started at
5 pm" is definite; "around 5" or "about an hour" is a guess, credited just the same. The proposal carries the
minutes and a `span`. On Accept, `applyProposals` writes the cell and paints the block on the habit's own Activity
pen (stamp `kw:helper:…`, so the keyword sync does not recount it), marked estimated for a guess. No cue, or no log:
the old goal default. Logs come from `bimchat-transcript` and the ingest log, read only.

**A list in one message, and words from BIM chat.** _Last mapped: 2026-11-09_ "i did skincare, stretched, drank water, unfollowed 1 person" is four clauses and four proposals. Three things keep a part from being lost. A word written closed or open meets the other spelling (`lexicon.ts`: "skincare" hits "Skin care", "skin care" hits "Skincare"). A clause the model left out, whose words name a habit, gets the rules' item (`fillFromRules` in `match.ts`). A part that named no habit is said in the reply ("No daily habit matched “…”"), when the rest matched. BIM chat hands a message over with "tell habits bimby …" (`lib/ingest/bimby-handoff.ts`): `send(text, { fromBim: true })` runs it as a message of its own, never as the answer to an open why-question or span question, and marks the line `fromBim`. `awaitingFromBim` counts what still waits; the Inbox shows it (`components/inbox/helper-waiting.tsx`) and `open.ts` (`openHabitsBimby`) opens the chat from there.

Outside the message flow, all code (`history.ts`): `whyQueue` (a cell marked missed with no reason, then a
habit missed `threshold` of the last `window` days; one per habit; `maxQuestions` a day), `nudges` (one line
per open habit: usual time, amount so far, streak, rate, last done; most specific first), `reasonsOf`
(reasons with days, common words, themes). `shorthand.ts` names habits in code: no model.

_2026-11-11:_ `accept(lineId, ids, "ok")` is the **Neutral** accept (Habits chat and the BIM chat card): the same write, and the line keeps `grades[id] = "ok"` so the row is never a good example (`lib/accept-grade.ts`).

## Files

| File | Role |
|------|------|
| `types.ts` | `Tag`, `Clause`, `HabitBrief`, `MatchItem`/`Matching` (the model's shape), `Proposal`, `Ask`, `TraceStage` |
| `words.ts` | Stems (with an irregular-past table), stop words, units, `displayName` (contract rule) |
| `tags.ts` | `tagText`: clauses, tags, marked text |
| `lexicon.ts` | `scoreClause` (closed and open spellings meet), `tiedAtTop` |
| `match.ts` | `matchSchema`, `systemText`, `habitLines`, `match` (ladder via `escalate`), `matchByRules`, `fillFromRules`, `headOf` |
| `compute.ts` | `computeAll`, `computeItem`, `convert`, `editProposal`, `reviseProposal`, `trustWords` (private) |
| `evidence.ts` | `findEvidence`, `readSpanAnswer`, `spanQuestion`, `PendingSpan` |
| `auto.ts`, `auto.test.ts` | `readHabitLog`, `readsAsHabitLog`: does a plain BIM chat line read as a habit log (see "Automatic hand-off from BIM chat") |
| `logs.ts` | `bimLogs`: the person's BIM lines with times |
| `evidence.ts` | `findEvidence`, `readSpanAnswer`, `spanQuestion`, `PendingSpan` |
| `logs.ts` | `bimLogs`: the person's BIM lines with times |
| `history.ts` | `missDays`, `whyQueue`, `nudges`, `usualMinute`, `reasonsOf`, `pausedOn` |
| `shorthand.ts` | `candidates`, `suggestShorthands` |
| `flow.ts` | `HabitsBimbyFlow`, `starterFlow`, `loadFlow`/`saveFlow` (`habithelper-flow-v1`), `HABITS_BIMBY_REV` |
| `run.ts` | `runHabitsBimby`, `routeOf`, `looksLikeLog` |
| `accept.ts` | `briefOf`, `buildContext` (daily habits, 60 days, Tracking tag names), `applyProposals` (the only writer) |
| `store.ts` | `useHabitsBimby`: chat lines, proposals, decisions, asks, the open why-question (`habithelper-chat-v1`); `awaitingFromBim` |
| `open.ts` | `openHabitsBimby`, `useHabitsBimbyOpenRequest`: go to Home → Habits and open the chat |
| `tests.ts` | `FIXTURE` habits, `SHIPPED_TESTS`, `replay`, `byRules`; user cases in `habithelper-tests-v1` |
| `rule.ts` | `looksLikeWordRule`, `parseWordRule`, `pickHabitForRule`, `ruleText`: the words-in-a-document rule |
| `habit-helper.test.ts` | Every shipped case by replay and by rules, plus tags, compute, routes, history, shorthand |

## Word rules: a document's words count toward a habit

_Last mapped: 2026-11-07_

"Make it so that for every 300 words writing in the document called "pages writing" that are added in a day, it counts for 1 page written for that daily habit (write 3 pages)" is read in code (`rule.ts`: `looksLikeWordRule`, `parseWordRule`, `pickHabitForRule`; no model). The habit comes from the parenthesis, scored like a log line; a tie is asked, never guessed. The proposal is kind `rule`. On Accept, `applyProposals` saves `WeeklyTask.wordFeeds` (`lib/habit-word-feed.ts`) and seeds the document's word count, so what is already written does not count.

From then on every Docs save (`setDocumentBody` in `components/Docs/doc-actions.ts`) calls `noteDocWords` (`lib/habit-word-feed-apply.ts`). A small ledger (`brain2-doc-word-ledger`, localStorage) sums the words **added** today; deleting never takes credit back. Whole blocks earn the amount (650 words = 2 pages), and only the newly earned units are added to the day's cell, so Speed Read or a typed number in the same cell stay. A new day starts at zero.

Each credit goes through `applyModuleOutput` as module `doc-words` with `origin: "doc"`, verb "wrote", and the words behind it, so it is a logged action ("wrote pages writing") on the day, with a session and a clock time. On Accept the habit also gets a `doc-words` feed row and a double-click view: `sources`, `breakdown`, and an `entry` form (`attach: true`) for pages written by hand, which can carry scans or photos. Two habits fed by one document share that day's row total; **Planned:** split it per habit.

**Planned:** an editor for `wordFeeds` in the Add / Edit Habit window; word rules for weekly habits (they sum the daily one); a ledger that follows a renamed document by id; other measures (minutes typing).

## Automatic hand-off from BIM chat

_Last mapped: 2026-11-11_

BIM chat hands a plain line to this BIMBY without being told to when the line reads as a daily-habit log (`auto.ts`, `readHabitLog`; code only, the same tags and lexicon as the flow). A clause names a habit when the habit's words cover at least half of its content words. The line is taken when two or more clauses name habits and they are at least half of the clauses ("did skincare, stretched, drank water"), or when its one clause names a habit, covers every content word, has an amount and is not negated ("read 10 pages"). A question, a line with a colon or a clock, and more than one line are left to BIM's other lanes. It is strict because a line taken here is filed nowhere else.

The lane is `habit-auto` in `lib/ingest/bim-lanes.ts`, after the wire lane and before the report lane; `tryHabitAuto` (`lib/ingest/bimby-handoff.ts`) runs it. BIM's own `did <habit>` command keeps a one-habit line; `did` with two or more habits comes here. A busy BIMBY takes nothing. BIM chat draws the proposals under its reply (`components/Bim/habit-card.tsx`), so they can be accepted there. The rows live only in this store; the Habits chat shows the same line in the same state.

## Writes

`applyProposals` writes a cell through `useHabitsStore.updateCompletion` (`{ completed }`, `{ value }`,
`{ text }`, or `{ missedOpportunity: true, missReason }`) and a name through `updateTask({ shorthandName })`.
These are the same calls a hand edit makes. `TODO(A)`: pass `source: "llm-suggestion"` and the reason as the
change note once session A's store takes a source (contract `HabitCellChange`). The `shorthandName`,
`pauses`, `changes` and `HabitCellChange` types are the contract's stubs, added word for word.

## Changing the shipped flow

Edit `starterFlow` / `MATCH_SYSTEM` / `MATCH_EXAMPLES` in `flow.ts` and bump `HABITS_BIMBY_REV`. A browser
with an older saved copy gets the new one; its own is kept under `habithelper-flow-v1:backup:<old rev>`.

## Planned

- **Planned:** ask which log line when several fit; read a clock typed in the question itself.
- **Planned:** ask which log line when several fit.
- **Planned:** the automatic hand-off below also takes a lone miss ("didn't go outside because it was dark") and a lone yes/no habit ("stretched"); "that wasn't a habit" in BIM chat teaches it; a switch to turn it off.
- **Planned:** push or notification reminders for open habits.
- **Planned:** weekly, monthly and season habits; exemptions read when counting misses.
- **Planned:** swap `pausedOn` for session A's `isPausedOn`.
- **Planned:** the phone shell (iOS Habits has no Chat key yet).
