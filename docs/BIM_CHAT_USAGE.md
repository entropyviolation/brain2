# BIM chat usage map, from real logs

_Last mapped: 2026-11-21_

How the person really uses BIM and the BIMBIES, read from the log export in
`data/bim-log-export/` (made 2026-11-22 by `export.mjs`). It says what BIM did
with each kind of line, where it went wrong, how slow it was, and what to fix
first. Plans it checks against: `docs/BIM_CHAT_PLAN.md`,
`docs/BIM_CHAT_SWITCHBOARD_PLAN.md`, `docs/BIMBY_IDEAS.md`.

This repo is public. Every example below is paraphrased. No names, places,
numbers or private details are kept. The real lines stay in the gitignored
labelled set (last section).

## 1. What was read

| Source | Rows | Dates | What it is |
|---|---|---|---|
| `telegram-feed.jsonl` + ingest store events | 571 + 774 | Sep 22 – Nov 21 | Telegram and the phone BIM chat, through the executor. No model ever runs here |
| `bim-chat.jsonl` | 126 (61 typed) | Oct 30 – Nov 21 | The desktop BIM chat, with the switchboard (LLM mode) on most days from Nov 1 |
| `bimby-chats.jsonl` | 1015 | Sep 22 – Nov 21 | Habits, Tracking and Lists BIMBY chats, traces, verdicts, follow-through |
| `flow-runs-summary.jsonl` | 2393 | Oct 30 – Nov 21 | 2236 model calls, 23 chat traces, 104 flow tests, 17 suggestion verdicts |
| bench JSONs | 4 | Nov 1 | `real-feed` eval before and after, texts benches |

After merging the copies (same text within 3 minutes), there are **713 distinct
lines the person typed**: 587 on Telegram, 97 in BIM chat (desktop and phone),
29 inside a BIMBY chat. Each line got one expected lane by hand, and an outcome
from what BIM did and what the person did next (accepted, resent, answered a
question, dismissed).

Outcome words used below:

- **right**: BIM did what the line asked.
- **plain log**: filed as a bare `log:` event, though the line asked for
  something else (a block, a to-do, a habit, a reply).
- **misfiled**: went to the wrong room, or BIM read it as the wrong thing.
- **Inbox**: went to Inbox unsorted, when a list or room was clear.
- **asked**: BIM asked a question first; "too much" when the line was clear.
- **error**: a save, a model call or a fetch failed.

## 2. Kinds of line

Shares are of the 713 lines. Links are a third of everything, so the second
share leaves them out (480 lines).

| Kind | n | Share | No links | Right | Plain log | Misfiled / Inbox | Asked | Error |
|---|---|---|---|---|---|---|---|---|
| Link (reel, article, product) | 233 | 32.7% | — | 195 | 37 | 0 | 1 | 0 |
| Activity now (started, done, -ing, `o`) | 64 | 9.0% | 13.3% | 11 | 38 | 7 | 4 | 3 |
| Asks to improve BIM / Brain2 | 58 | 8.1% | 12.1% | 30 | 22 | 5 | 1 | 0 |
| Plain note, thought, observation | 43 | 6.0% | 9.0% | 40 | 1 | 2 | 0 | 0 |
| Command (info, skip, status, a digit) | 35 | 4.9% | 7.3% | 27 | 2 | 3 | 1 | 2 |
| Thing for a list (book, film, craft, lyric, cleaning) | 33 | 4.6% | 6.9% | 13 | 17 | 2 | 1 | 0 |
| To-do | 32 | 4.5% | 6.7% | 2 | 29 | 0 | 1 | 0 |
| Intake (pills, caffeine, food, smoking) | 29 | 4.1% | 6.0% | 5 | 21 | 1 | 2 | 0 |
| Feeling, symptom | 27 | 3.8% | 5.6% | 1 | 17 | 7 | 2 | 0 |
| Shopping, wants, "iso" | 24 | 3.4% | 5.0% | 3 | 16 | 5 | 0 | 0 |
| Plan for now / the day / intention | 22 | 3.1% | 4.6% | 7 | 10 | 4 | 0 | 0 |
| Photo, scan, journal page | 17 | 2.4% | 3.5% | 13 | 0 | 0 | 4 | 0 |
| Talk, venting, greeting (wants a reply) | 17 | 2.4% | 3.5% | 1 | 9 | 7 | 0 | 0 |
| Thought process (`tp:`) | 16 | 2.2% | 3.3% | 11 | 2 | 0 | 0 | 3 |
| Ask about own data | 12 | 1.7% | 2.5% | 3 | 2 | 4 | 0 | 2 |
| Habit done in words | 12 | 1.7% | 2.5% | 3 | 5 | 1 | 0 | 0 |
| Build (rule, wire, list, merge) | 11 | 1.5% | 2.3% | 6 | 2 | 2 | 0 | 0 |
| Texts and people (text back, what did X say) | 7 | 1.0% | 1.5% | 0 | 4 | 2 | 0 | 1 |
| Dream | 6 | 0.8% | 1.3% | 6 | 0 | 0 | 0 | 0 |
| Money (spent, receipt) | 4 | 0.6% | 0.8% | 1 | 3 | 0 | 0 | 0 |
| Long paste (recipe, AI answer) | 4 | 0.6% | 0.8% | 0 | 1 | 3 | 0 | 0 |
| Tell a fact | 3 | 0.4% | 0.6% | 1 | 0 | 2 | 0 | 0 |
| Hand-off to a BIMBY | 2 | 0.3% | 0.4% | 2 | 0 | 0 | 0 | 0 |
| Web question | 1 | 0.1% | 0.2% | 0 | 0 | 0 | 0 | 0 |
| Correction | 1 | 0.1% | 0.2% | 0 | 0 | 1 | 0 | 0 |

**Overall, links left out:** 186 of 480 right (39%), 201 plain logs (42%), 58
misfiled or unsorted (12%), 16 asked first, 11 errors. Telegram, which has no
model, is 358 of those lines: 133 right, 167 plain logs. BIM chat is 93: 35
right, 34 plain logs, 14 misfiled, 4 errors.

### What BIM did, kind by kind

- **Links.** Right since Oct 22. The 37 plain logs are bare reels from Oct 15–22,
  before link routing. The person often adds a few words after the link ("dial
  display idea"). Those words are kept as the note, but nothing picks the list
  they belong to. The Link BIMBY guessed lists twice, once with "no model
  reachable".
- **Activity now.** The biggest miss. "Starting dishes", "walking since 4:46",
  "shower rn", "starting to clean house rn", "home from walk" are filed as plain
  logs or Inbox captures. Only `doing:`, `now` and `start` lines make a block.
  Twice BIM asked "which activity?" for a clear line. "Starting dishes" and
  "took a pill before the walk" got a "needs clarification" with no follow-up.
- **Asks to improve BIM.** With `Brain2:` in front they land on the Brain2 list
  (30). Without it ("be able to say to BIM…", "brain2 idea –", "also brain2
  allow…") they are plain logs (22). The person types these in the middle of a
  day stream, often mid-sentence.
- **Notes and thoughts.** Plain logs are right here. Dreams are logged as plain
  notes; there is no dream room, which is fine.
- **Commands.** Work. Misses: "X" in the Today menu read as "bought";
  "skip" after a question logged as an event (twice); "hi" dumped the habits
  list (twice).
- **Things for a list.** Book, film and craft titles ("a book title",
  "cold porcelain") are plain logs unless typed with a list path. Prefixed
  ones (`Cleaning: bedroom: …`, `Merch: …`, `Lyric: …`) land right.
- **To-dos.** 29 of 32 are plain logs: "need to book the trip", "take out
  trash", "make a list of stuff to do before the trip", and one line with
  three "to do later" items. Only `To do:` lines land.
- **Intake.** "Took another pill (2)", "taking a pill right now", "2nd energy
  drink of the day" are plain logs. Counts ("14 left") are lost. The `Intake:`
  verb and pen triggers work. Two NFC trigger lines failed: the tag was not set up.
- **Feelings.** "Tired", "crying", "making me happy", "randomly nauseous" are
  plain logs or Inbox captures. Mood is set only by `mood:` or a check-in. Twice
  a cooking note was asked "which mood?" because it said "feeling".
- **Shopping.** `g`, `grocery list:`, `Get:` and `iso:` work. "Need more X",
  "want to find a new rug", "order candy" are plain logs. "grocery list: maple
  syrup" in BIM chat was read as a mood line and the next digit set a mood.
- **Plans.** `Plan for rn:` works and the Plan BIMBY ran it. "Plan for today:"
  made a plan event with a broken title. "Today I really need to…" and "today
  was…" opened the Today snapshot. The long day plan on Nov 12 went to Inbox as
  one capture, not a day card.
- **Talk.** Greetings and venting were filed. The chat lane answered none of
  the 17. With LLM on, the router said `chat` 3 times, and all 3 were logged
  (one after 25.7 s).
- **Ask.** 12 asks. 3 right (the trip question, flight time, days since an
  event). 3 errors (aborted at 121.5 s, empty JSON at 74.6 s, and a failed fetch on a
  texts question the Ask lane took).
  "When am I flying?" said "I don't know" five minutes after both flights were
  filed. "What is the command to start the LLM server?" said "I don't know":
  BIM cannot read its own setup.
- **Habits.** Said in words in BIM chat ("played guitar and exercised today
  and yesterday", "also just stretched") they are plain logs, 42–90 s each.
  Through "tell habits bimby …" they work.
- **Texts.** "What did my friend last say to me?" without the word "text" went
  to the router (TELL) and was logged after 64 s. With "text" it matched the
  person's own "self" item twice. The fourth try answered in 3.3 s.
- **Pastes.** A recipe became 114 items on the General list. A pasted AI answer
  became 15 items. A flight confirmation became a General list, and the Flight
  BIMBY filed it three days later on backfill.
- **Thought process.** Works. Three "Could not save that thought process"
  errors, and two "Could not save that log note" for `log: o`.

### How the person talks

- Short and fast: median 7 words. Often several lines in a minute that belong
  together ("also…", "^", "thus…", a follow-up after a link).
- Many lines are two or three things at once: an activity, an intake and a
  feeling ("finished the dishes, now hitting the pen, going to clean more").
- Statements about the past with a time: "4 hours ago stopped…", "from 12:07
  to 12:23 was practicing guitar", "yesterday I…".
- Corrections are never typed as "no, …". The person **resends** the same line,
  or a reworded one, instead (about 12 real resends). Route verdicts from the
  correction lane: none in the logs.
- Questions to BIM are rare (12) and personal: when, what did someone say,
  what was yesterday like.

## 3. Speed, model calls, errors

Wall time is from the person's line to BIM's reply in `bim-chat.jsonl`. The
chip time is what the route chip printed. Model calls per turn come from the
chip hops, the traces and the model-call archive for the same days.

| Lane (chip) | Turns | Wall p50 | Wall p95 | Chip p50 | Model calls / turn |
|---|---|---|---|---|---|
| Grammar only (no chip) | 29 | 0.3 s | 27.8 s | — | 0 |
| LOG | 7 | 44.7 s | 53.1 s | 8.3 s | 1–2 (3B, then 14B) |
| ASK | 6 | 46.6 s | 112.9 s | 46.5 s | 5–9 (plan, words, answer, check) |
| CHAT | 3 | 9.7 s | 26.9 s | 4.3 s | 1–2 |
| CORRECT (router label) | 3 | 37.7 s | 52.8 s | 4.6 s | 2 |
| HANDOFF | 2 | 22.0 s | 25.3 s | — | BIMBY's own |
| REPORT | 2 | 6.4 s | 6.5 s | 6.3 s | 0 (rules) |
| TEXTS | 2 | 0.1 s | 0.1 s | 0.0 s | 0–1 |
| TELL (router label) | 1 | 64.0 s | — | 30.4 s | 2 |
| BUILD (router label) | 1 | 50.2 s | — | 14.3 s | 2 |
| RESISTANCE | 1 | 20.4 s | — | — | 1 |
| STREAM | 1 | 155.1 s | — | 155.1 s | 2 (14B) |
| WIRE, FOLLOW | 2 | 0.0–0.1 s | — | — | 0 |

- **LLM mode turns:** 31. Wall p50 25.7 s, p95 100 s. 14 of 31 took over 30 s.
  3 of 31 failed (10%): one abort, one empty JSON, one failed fetch.
- **The chip hides most of the wait.** "also just stretched." shows
  `LOG · q2.5 3b · 8.3s`, but the trace's `ladder` step took 44.6 s and the
  line was still only logged. The gap is 35–45 s on every LOG, CORRECT, TELL and
  BUILD turn on Nov 21. No archived model call explains it. Likely a model load
  or swap, or the log flow after the route. It needs step timing.
- **The router escalates nearly always.** The 3B said `sure: low` on 9 of 13
  routed lines, so the 14B ran too. The 14B's `why` drifted into Chinese
  characters twice.
- **The trace cost is wrong.** Traces report `calls: 0` on turns that called
  two models. Only the Ask flow's own trace counts its calls.
- **Every lane after the router fell back.** The router picked CORRECT for "need
  more of my prescription", "mark that I regretted…" and a one-word answer;
  BUILD for three "to do later" items; TELL for "what did my friend last say";
  LOG for habits. All of them ended as a plain log. So the label is not the
  main problem: the lanes behind LOG, CORRECT, BUILD and TELL do nothing yet.
- **Evals are slow and flat.** One `real-feed` eval run takes 12–20 minutes.
  The 14B scored 73 → 71 of 108 on line family, 4 → 9 of 20 on activity, 8 → 15
  of 37 on lists, and fell from 86 to 65 of 88 on "no invented block" after the
  Nov 1 change. That last one is a regression nobody saw.
- **Flow tests:** 104 results. Ask p50 33 s (5 pass, 7 fail, 14 review),
  `log-phone` p50 22 s, `log-routed` p50 15 s, `day` p50 62 s.
- **Texts as a signal:** the activity-from-texts bench got 1 of 60 right, with
  46–51 unknown. The mood-from-texts bench is mostly `sure: none`. Not usable yet.

## 4. The BIMBIES

- **Tracking BIMBY** (7 lines). Best result in the logs. A long account of an
  afternoon became 7 blocks, all added. A hand-off from BIM chat added its block.
  One sleep block ("bed at 9, woke at 1:30") was proposed and never added.
- **Habits BIMBY** (14 lines). Proposals are accepted when it reads right.
  Misses: when it asks "what got in the way?", an answer like "I did drink water
  yesterday" is saved as the reason (dismissed twice; the person resent it).
  "Can you check my BIM logs to see when?" set the habit to its goal without
  reading the log. Ambiguous asks offer wrong options (skincare → "hemisync or
  study"; "woke up early, went for a long walk" → three choices). A pages rule
  failed twice ("could not find the document"), then was accepted twice, so it
  may now exist twice.
- **Lists BIMBY** (8 distinct lines, 30 taps). Duplicate merge worked: 16 of 16
  merged in a row of taps. "How many Book items lack an author?" was answered
  four ways: by the open merge prompt, from the wrong list in focus (71), from
  every item (54,219), then right (1,097). Duplicates across all items gave 200
  candidates; six skips, then the person stopped.
- **Report, Stream, Wire, Day.** Report read a day account as 7 changes in 6 s.
  Stream read an evening update as 23 filings in 155 s with 10 things to confirm;
  the person answered "skip all". Wire made the reading-habit plan instantly.
- **Resistance (Overcome BIMBY).** "I need to book the trip but I'm stuck" was
  logged the first time (20 s). Resent, it got the resistance reply.
- **Suggest (LLM tab).** 17 verdicts, 17 accepted, 0 rejected, all time blocks
  (13 from Screen Time). There is no negative signal to learn from yet.
- **Follow-through.** 29 actions recorded, mostly Speed Read sessions.
- **Bench and game calls.** Most model calls on Nov 3 and Nov 7 were reading
  lenses and the baby animal characters, on the same 14B chat uses.

## 5. Top 15 failures

Ranked by how often times how much it hurt (slow, wrong write, or the person
had to redo it).

1. **Lanes after the router do nothing, slowly.** LOG, CORRECT, BUILD, TELL end
   as a plain log after 38–64 s. 13 of 31 LLM turns. _"Played guitar and
   exercised today and yesterday" → logged after 42 s._ _Three "to do later" items in
   one line → BUILD, logged after 50 s._
2. **Activity lines are not blocks.** 45 of 64. _"Starting to clean house rn"
   → logged._ _"Walking since 4:46" → Inbox._
3. **To-dos are not on To Do.** 29 of 32. _"Also really need to book the trip"
   → logged._ _"Take out trash" → logged._
4. **Intake is not intake.** 22 of 29, counts lost. _"Taking another pill, N
   left now" → logged._ _"Took the pill btw (2)" → a pen event, no dose._
5. **Habits said in words are not marked** outside the named hand-off. 9 of 12.
   _"Both today and yesterday I played guitar (counts for the habit)" → logged
   after 90 s._
6. **Feelings and talk get nothing back.** 40 of 44 logged or misfiled, no
   reply. _A long line about feeling sad → logged._ _"oh what's up"
   → logged after 25.7 s._
7. **Ask is slow and fails.** p50 47 s, max 126 s, 3 of 6 failed, and "I don't
   know" when the answer was filed. _"When am I flying?" → "I don't know."_
8. **Grammar prefix collisions.** About 12 lines. _"grocery list: maple syrup"
   → asked which mood._ _"Today I really need to…" → Today snapshot._ _"Stop
   feeling sorry for yourself" → stop command._ _"hi" → habits list._
9. **Pastes explode into list items.** 4 lines, heavy cleanup. _A recipe → 114
   General items._ _A flight confirmation → a General list._
10. **Texts lane finds the wrong person** or is not reached. 7 lines, 1 right.
    _"What did my friend last say to me over text?" → "self has no phone
    number…"_ (twice).
11. **Shopping and wants are logged.** 21 of 24 not on a list. _"Need more
    of a clothing item" → logged._ _"Want to find a new rug" → logged._
12. **Brain2 ideas without the prefix are lost in the log.** 22. _"Be able to say
    to BIM 'I want to scroll less'" → logged._ _"Brain2 idea – it should link the
    IG list" → logged._
13. **Save errors.** 11. _"Could not save that thought process"_ (3), _"Could
    not save that log note"_ for `log: o` (2), NFC tag not set up (2), model
    fetch failed (1), a stream update with no reply (1), two Ask failures (abort,
    empty JSON).
14. **BIMBIES misread the thread.** 8. _Habits: "I did drink water yesterday"
    saved as why it was missed._ _Lists: a count answered from the list still in
    focus._
15. **Asking too much, or the wrong question.** 9. _"Starting dishes" → "needs
    clarification"._ _A stream update → 10 things to confirm → "skip all"._ _"At
    the show, hungry" → which location?_

## 6. Asks to BIM itself

Every feature request or complaint the person typed to BIM, deduped. ✓ = built
since, by the READMEs.

**How BIM should think**
- Be totally local, self-improving, grounded in the person, with a "secret"
  mark for private things. (Oct 30) ✓ secrets.
- Route better before the LLM suggests blocks; prune odd artifacts. (Oct 31)
- Small editable "cognitive processes": plain text plus logic, run as steps; the
  person can edit them or ask for new ones. (Oct 31)
- BIM is the intake for every kind of input and routes all of it. (Oct 31)
- Let a flow ask for message context as a tool; "are these two lines
  connected?" (Oct 31) ✓ `context` node.
- Keep every production flow run for review. (Oct 31) ✓ runs with origin.
- Allow reasons when rejecting suggested blocks. (Oct 31) ✓
- Use the app chat, not Telegram. (Oct 31)
- Know its own setup: "what is the command to start the LLM server?" (Nov 21)

**Things to say and have done**
- "I want to scroll less" → a goal. (Oct 24, Oct 30)
- Any line starting with "Stop" is flagged. (Oct 31) Care: self-talk starting
  "Stop…" already runs the stop command.
- "text {} back", "text back {}", "respond to {}" → texts to send. (Oct 27)
- "X is waiting on Y" → a waiting-on status, applied. (Oct 22)
- "Add to existing item" when the same to-do is said again. (Oct 24)
- Mark a past event with regret or satisfaction ("mark that I regretted not
  reading that text"); use regret to find resistance. (Oct 24, Nov 21)
- "Finished cleaning" checks off the cleaning habit; log done habits by words.
  (Sep)
- Look up a plant watering schedule and add it. (Nov 7)
- "Check my BIM logs to find when I exercised." (Nov 7, Habits BIMBY)
- Speed reader pages → reading habit, book item, time. (Nov 7) ✓ wire.
- Words in a doc → pages habit. (Nov 7) ✓ rule.
- Long typed text → a mirror doc. (Nov 7) ✓ rule.

**Rooms and signals**
- Morning plan question, night summary, the same for other periods. (Oct 24)
- Track outfits and outfit changes. (Oct 21)
- NFC tags for water, food, pills, smoking, going outside. (Oct 24, 27)
- Habit completion tiers (bare minimum counts). (Oct 25)
- Richer habits, more habit types. (Oct 27)
- Chore importance and points; link the cleaning module to "clean 15 min". (Oct 23)
- Detailed people profiles with secret marks. (Oct 27)
- Estimated blocks may overlap. (Oct 30)
- Link a reel from the IG list; count clicks to strengthen links. (Oct 31)
- Expand autolink; search by contact or display name. (Oct 25)
- Location, call and text autotracking. (Sep)
- Lab panels as health data; bank statements. (Oct 21, 23)

**Complaints**
- The Today menu is broken; "x" answers as grocery. (Oct 16)
- Not every photo is a journal page; fix how BIM takes images. (Oct 24)
- The morning review needs fixing. (Sep)
- A long thought process crashed quick add. (Oct 23)
- Lag marking an objective done. (Oct 25) ✓ freezes fixed Nov 11.
- Always-on hub and real-time two-way sync. (Oct 30)

## 7. Fixes, ranked

Step 3 is speed, reliability and the learning loop. Step 4 is new tools and
BIMBIES. "Matches" names the plan item it is.

| # | Fix | Step | Fixes failures | Matches |
|---|---|---|---|---|
| 1 | Time every step of a turn and put the total on the chip; find the 35–45 s gap; keep the 3B and 14B warm (`keep_alive`), one big model at a time | 3 | 1, 7 | Switchboard §4 "Keeping models warm"; BIM_CHAT_PLAN "Latency per layer" |
| 2 | A code **day-stream grammar** before the router: `-ing` + now / started / done / since / home from → Activity block; "took / taking / Nth" + a known pill or drink → intake with count; "need to / have to / to do later / gotta" → To Do; "need more / want / iso / order" → wants list. Split "also" and "," into parts | 3 | 2, 3, 4, 11 | BIM_CHAT_PLAN L0 "new grammar from the person's own habits"; real-feed `family` misses |
| 3 | Habit words in plain BIM chat go to the Habits BIMBY automatically (`habit-auto` exists but passed on every line) | 3 | 5 | `lib/habit-helper/README.md` automatic hand-off |
| 4 | Make LOG, BUILD, TELL lanes do something or say nothing fast: LOG shows the `log-routed` cards; BUILD → to-do or list cards; a wrong label falls to step 2's grammar, not a log | 3 | 1, 3 | Switchboard phases 5 and 6 |
| 5 | A resend is a verdict: the same or near-same line within 30 min marks the first reply wrong and keeps both as a route example | 3 | learning loop | Switchboard §7 "Route verdicts"; BIMBY_IDEAS 8.1 |
| 6 | Run `real-lines.labelled.jsonl` as the routing eval (code rules, 3B, 14B), per lane; block a merge that drops a lane, as the "no invented block" drop should have been | 3 | all | Switchboard phase 0; BIMBY_IDEAS 8.2, 8.6 |
| 7 | Ask: answer from filed flights, plan events and facts first in code; one retry on empty JSON; 30 s budget, then say what was found | 3 | 7 | BIMBY_IDEAS 7.1, 10.1; Switchboard §7 budgets |
| 8 | Fix the grammar collisions: "grocery list:" before mood; "today" + a verb is not the snapshot; "Stop" only alone or with an open thing; "hi" greets; "skip" with nothing open is a no-op | 3 | 8 | `lib/ingest/README.md` "Ladder guards" |
| 9 | Paste guard: over ~400 chars or many lines with no list path → one doc or note, with a "split into items?" key; flight and receipt shapes go to their BIMBY first | 3 | 9 | Flight BIMBY backfill; Stream BIMBY |
| 10 | Texts: "what did X say / last say" routes to texts without the word "text"; never match "me" to the self item | 3 | 10 | Components/Bim "Texts", **Planned** follow-ups |
| 11 | BIMBY thread guards: an answer that says "I did" is a done, not a reason; a Lists count clears the old focus; dedupe a rule that already exists | 3 | 14 | Habits / Lists BIMBY READMEs |
| 12 | Save errors: find why thought-process and `log: o` saves fail; offer NFC tag setup from the error | 3 | 13 | — |
| 13 | **Talk BIMBY reply** for feelings and venting: one or two warm lines, never filed unless "log it", offers the mood row | 4 | 6 | Switchboard §5 chat lane; BIM_CHAT_PLAN talk lane |
| 14 | **Brain2 Ideas BIMBY**: lines about BIM / Brain2 / "be able to" / "idea –" go to the Brain2 list, deduped against open ideas, linked to this doc's asks list | 4 | 12 | BIM_CHAT_PLAN "do" lane |
| 15 | **Media and wants BIMBY**: a bare title or "want X" picks a list (Reading, Watch, Crafts, Wants, Goodwill) from closed ids, as a card | 4 | 11, list kind | BIMBY_IDEAS 7.4 "the model proposes, code places" |
| 16 | **Intake BIMBY**: dose, count left, refill reminder when low ("N left") | 4 | 4 | KG plan intake room |
| 17 | **Goal BIMBY**: "I want to scroll less" → a goal wired to Screen Time | 4 | asks | BIM_CHAT_PLAN phase 5 "I want to …" |
| 18 | **Texts-to-send**: "text X back", "call X", "respond to X" → the correspondence list | 4 | asks | BIM_CHAT_PLAN L0 |
| 19 | **Regret and satisfaction marks** on a past event, by words | 4 | asks | Follow-through FEEL blocks |
| 20 | **Self-knowledge tool** for Ask: BIM reads its own docs and commands (`docs/BIM_COMMANDS.md`, READMEs) for "how do I…" questions | 4 | 7 | — |
| 21 | Fewer questions: a stream card asks at most 3 things; no clarify on a line step 2 can file | 3 | 15 | BIM_CHAT_PLAN "Quiet by default" |

**Do first:** 1, 2 and 5. Step 2 alone would have filed about 110 of the 201
plain logs with no model, at grammar speed. Step 1 turns 45 s turns into a few
seconds or shows where the time goes. Step 5 is the learning signal the person
already gives: they resend instead of correcting.

## 8. The labelled real-line test set

`data/bim-log-export/real-lines.labelled.jsonl` (gitignored, never committed).
514 distinct real lines: all 442 distinct non-link lines plus 72 links (every
link with words and a sample of bare reels).

Each row: `text`, `ts`, `source` (`telegram`, `bim-chat`, `bim-chat-ingest`,
`habits-bimby`, `tracking-bimby`, `lists-bimby`), `expectedLane`,
`expectedAction`, `notes`, `labelConfidence` (0.3–1.0), plus `actual` (kind,
status, route) and `outcome` from section 1.

Labels come from the line and from what the person did next: a resend, an
accepted or dismissed card, the answer to BIM's question. Short fragments with
no context have low confidence (0.3–0.5). Lanes in the set:

| Lane | Rows | Lane | Rows |
|---|---|---|---|
| link | 72 | chat | 15 |
| meta (asks to improve) | 58 | thought | 15 |
| track | 57 | habit | 12 |
| log | 43 | ask | 11 |
| list | 33 | build | 10 |
| todo | 32 | texts | 7 |
| intake | 29 | photo, dream | 6 each |
| mood | 26 | money, paste | 4 each |
| shopping | 24 | tell | 3 |
| plan-day | 22 | handoff | 2 |
| command | 21 | web, correct | 1 each |

**Planned:** load it in `lib/bim-flow/real-feed.ts` beside the 108 hand lines,
score code-only, 3B and 14B per lane, and show it in the Tests sheet.

## Limits

- One person, two months, mostly Telegram. Only 31 turns ran with LLM mode on.
- The iPhone BIM chat transcript is not in the export. Its lines show only
  through the ingest store (`bim-chat-ingest`), without replies.
- Outcomes are read from logs, not from the vault. A capture moved by hand
  later still counts as where BIM put it.
- Labels are one reader's. Treat a confidence under 0.6 as a guess.
