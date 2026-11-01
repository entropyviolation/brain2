# Tracking Helper

_Last mapped: 2026-11-01_

A specialised chat bot for one task: tracking. It is the second place a model meets Brain2 (BIM chat is the first), and the
first with its own flow, bench and tests. Desktop only today: Home → Tracking → **Chat**.

## What it does

The person tells it a stretch of time in their own words, across days if they like:

> on Friday I was definitely walking around Ocean beach at least from 4:30 - 5 pm but potentially longer, maybe until 5:30, FOR SURE left at 4:30. from sometime after 5:55, I started doing the dishes, which i did until 6:19, then I took out the trash … by 6:22 the trash stuff was done. seem to have maybe been scrolling from 6:30 - 7:19 ish around 7:34 started actually working on foxtide cd stuff. not sure for how long though. And then october 31st went for a walk from around 5:50ish until exactly 6:27 scrolled until about 7:30

It answers "Timeblocks detected: 7" and draws them: a ruler per day, one bar per block, a place strip under it, then an editable card each. For the account above (told on Sunday 1 Nov 2026):

| Day | Activity | Start | End | Place |
|-----|----------|-------|-----|-------|
| Fri 10/30 | walking | 4:30 PM certain | 5:00 PM est (note: may have run until 5:30 PM) | Ocean Beach (stated) |
| Fri 10/30 | dishes | 5:55 PM est | 6:19 PM certain | Home (assumed) |
| Fri 10/30 | taking out trash | 6:19 PM certain (from the dishes) | 6:22 PM certain | Home (assumed) |
| Fri 10/30 | scrolling | 6:30 PM est | 7:19 PM est | — |
| Fri 10/30 | foxtide cd work | 7:34 PM est | 8:04 PM est, **end not given** | — |
| Sat 10/31 | walking | 5:50 PM est | 6:27 PM certain | — |
| Sat 10/31 | scrolling | 6:27 PM certain (from the walk) | 7:30 PM est | — |

(This table is the shipped test `friday-two-days`, replayed with no model on every test run.) Notes carry what the words imply
("overcame resistance; took out a neighbor's trash too (good deed)") after "Created from Tracking helper.". Add writes the blocks as
one undo step; a place becomes a Location block over the same span.

## The idea: the model points, code computes

A model asked to "extract time blocks" has to read clocks, pick am/pm, resolve "Friday", judge how sure each edge is, and
infer neighbours. Small models do all of that badly, and every wrong clock looks plausible. So the model does only what code cannot:
**decide which tagged time belongs to which thing, and name the thing.**

1. **Tag the times in code** (`tokens.ts`): `4:30[T1]`, `Friday[D1]`, `for an hour[U1]`. Hedge and strong words near each clock set its
   certainty here ("sometime after 5:55" hedge; "FOR SURE … 4:30" strong; "ish" after a clock; a dash joins a range).
2. **One schema-bound call** (`wire.ts`). Each tag field is an enum of the tags that exist, so the model cannot invent a time.
3. **Code does the rest** (`assemble.ts`): continuity places am/pm without asking (an evening told in order only climbs), days resolve by
   calendar, neighbours chain (a block with no start begins where the previous ended), unused clocks are adopted by the entry beside them, a
   missing end becomes a flagged 30-minute stand-in rather than a silent guess.

Cheap: one call of about 40 output tokens per activity, cached on identical prompts; with Ollama off a rules reader (`wireByRules`) still
produces blocks. Reliable: every number on a card was written by the person. Debuggable: the lab shows the tags, the exact prompt, the model's
raw pointers and the result, stage by stage.

### Hidden solutions worth keeping

- **Continuity beats am/pm guessing.** The first clock of a day uses a sentence word, then waking-hour sense; every later clock is the earliest
  reading not before the one before it.
- **Chaining is information.** "by 6:22 the trash stuff was done" and "dishes until 6:19" give the trash both edges; the card says `from neighbour`.
- **Certainty is asymmetric.** The model may soften an edge ("at least", "potentially longer") but can never make one firmer than the words did.
  A strong word on one mention of a time firms every mention of it.
- **Places are learned from the person's own data first** (`places.ts`): where this activity usually overlapped, ≥2 sightings and ≥60%. Chores with
  no history are assumed Home, and marked `assumed`. See [`BIM_SIGNALS_PLAYBOOK.md`](BIM_SIGNALS_PLAYBOOK.md): learn the fact, then hand it over.
- **Corrections need no second schema.** A revise re-reads the earlier account with the correction last; later words win.
- **Gaps are shown, not filled.** An end never given is dashed with a `?`; the stand-in length is a flow setting.

## The flow, and how it gets better

`ROUTE → TOKENIZE → WIRE → PLACE → WHERE` lives in `lib/tracking-helper/flow.ts` as one editable object; `/lab/tracking-helper` edits it (routing
regexes, the WIRE prompt, examples, model ladder, defaults), runs a message through it with a per-stage trace, and runs tests. **Replay** runs the code stages on
a recorded model answer (free, exact); **Live** asks the model again. Add a case with **Save run as test**. Details: [`components/Lab/TrackingHelper/README.md`](../components/Lab/TrackingHelper/README.md).

First live finding (14B, Friday account): it chose the "maybe" time as the walk's end, skipped the "by 6:22" link, and reused a tag as a "maybe end". The prompt
gained an example; code now adopts orphan clocks and drops a maybe-end that is another entry's edge. Each is a unit test.

## Where things are

| Piece | Path |
|-------|------|
| Logic, flow, tests | [`lib/tracking-helper/`](../lib/tracking-helper/README.md) |
| Chat dialog and proposal board | [`components/Home/Tracking/helper/`](../components/Home/Tracking/helper/README.md) |
| Flow lab | [`components/Lab/TrackingHelper/`](../components/Lab/TrackingHelper/README.md), route `/lab/tracking-helper` |
| Shared model plumbing | `lib/bim-flow/ollama.ts`, `crew.ts` (`escalate`), `chat-models.ts` |

## Limits and Planned

- Needs Ollama for best results; without it the rules reader handles clean text only.
- A block over midnight is written as one entry per day; an end earlier than its start is treated as never given.
- Account of the past only. Future plans belong to the Scheduler.
- **Planned:** BIM-flow graph form of this flow; kept lab runs and the person's verdicts as few-shot examples; a `drive` note when a task was resisted;
  other kinds from one account (intake, mood, company, a person); a ghost preview of proposals on the Time Grid; the phone shell.
