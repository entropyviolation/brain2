# BIM flow: test pass and fixes to try

_Last mapped: 2026-10-30_

All 22 named tests were run from the lab's Tests sheet on `qwen2.5:14b-instruct` (hub vault copy). Unit tests: 39 pass (`npx vitest run lib/bim-flow lib/health-report.test.ts`). `tsc` shows no errors in the BIM files.

**Where the runs are kept.** Every model call and test result was appended to `data/bim-flow-runs/2026-10-30.jsonl` (git-ignored). The browser copy is `bimflow-tests-v1` (22 runs). Two results (`log-confit`, `log-latest-grouped`) had not reached the file by themselves, so they were posted to `/api/bim-flow-archive` by hand. All 22 are now on disk.

Scores: 2 pass, 19 review (no checks to score), 1 fail (`ask-unknown`). Slowest: `log-latest-grouped` 164 s, `log-confit` 79 s.

## Cases, with fixes to prompts or structure

**1. `ask-unknown` (fail): "what color were my socks on my trip to mars?"** All four fact gates said no, so no retrieve and no answer node ran. The run ended with no answer at all.
- Structure: give the Ask flow a default lane. When every fact gate is no, run READ over the plain word terms, then SAY. SAY already says "the notes do not record it".
- The check then becomes testable: confidence `none`.

**2. `ask-shirt` family: same question, four answers.** Plain and + semantic say "milf shirt, 5 times". + search and + related say "the notes do not record it". One of those is wrong, and the plain answer contradicts itself in the same paragraph.
- Prompt: add to `ANSWER_SYSTEM` a rule that the answer must agree with its own evidence. If the repeated-words tally comes from days, not from the thing asked, say so and stop.
- Structure: the "While with someone?" lane counts words from whole days with Elijah. Rows should only count if the shirt word and the person fall in the same message or the same hour block.
- Add checks to the four tests so they differ on a score, not on reading: `answerNotContains: ["milf shirt"]` for the ones that should refuse.
- The plain run took 9 s in SAY and 13 s in CHECK. CHECK costs more than the answer. Run CHECK only when the draft cites a count or date.

**3. `log-routed-phone` and `ask-shower`: "last time I showered".** Correct (2026-10-28, 2 days). Fine. Two problems in the evidence: the search matches "show" rows ("Wrapping up show rn", "How was the show"), and the answer says "2 days before TODAY" literally.
- Code: match whole words, or a short alias list per word, in `vault-search.ts` and `retrieve.ts`. Do not match by prefix.
- Prompt: rule 2 of `ANSWER_SYSTEM` should say "say 'two days ago', not 'before TODAY'". Pass today's date as a date, not the word TODAY.

**4. `log-routed-confit` and `log-confit`: garlic confit.** Both pass. The input says "starting walk" at 14:05 and "back, called elijah" at 14:40, so the walking block is correct. (An earlier draft of this file called it invented. That was wrong.) The routed run makes 2 blocks; the parallel run makes 3 and adds a "phone call (est.)" block from "called elijah". Both add a "No habit picked" proposal that writes nothing (now dropped).
- Add checks `blocksContain: ["walk"]` so a missing walk fails.
- Display bug: `lib/bim-flow/tests.ts` sliced the ISO string, which is UTC. A 13:30 message showed as `20:30`. Now local `HH:MM`.

**5. `log-routed-latest` and `log-latest-grouped`: latest BIM day.** The grouped run took 164 s and gave one `watching a video (est.)` block at `09:28`. That is the UTC display bug in item 4: 09:28 UTC is 02:28 local, inside the day's 02:23–04:32 messages. One block for a 2-hour day is still thin. Proposals include a whole-day paste as one "Add" item (`02:23 Prevent mold…`). That is the group text written as a task.
- Structure: in grouped mode the ADD-to-list lane should run per line, not per group.
- Prompt: gate "Keep on a list?" should say a task or idea is one thing the person wants to do later, not a log of what happened.
- Speed: 164 s is the 10-way gate fan-out repeated per group. Run the cheap code-only lanes (FIND, LINK) first and skip gates whose search came back empty.

**6. `reason-triage`: "no time, too much going on".** It returned a pattern and a question ("What is the real reason you have not processed the inbox…"). The question assumes the stated reason is false.
- Prompt: in `INSIGHT_SYSTEM`, a question must not contradict what the person wrote. Ask about a named row or a gap instead.
- Structure: a reason typed beside a task should also write the reason against the task. It only produced analysis.

**7. `night-worry`: "Didn't finish the foxtide stuff again."** One generic question about perfectionism, medium confidence. The input never says perfect.
- Prompt: require every insight to quote words from the message or from an evidence line, and drop it when the quote is not found in the text. This is a code check, not a model ask.
- Prompt: `thought_pattern` should be allowed only with 2 or more evidence rows. Here the pattern comes from the phrase "again" alone.

**8. `morning-plan`: finished in 2 ms.** The rule "needs 3 rows" fired on two June rows. It is a good guard, but the answer is "Too few rows" for a plan typed today.
- Structure: also look at the last 14 days of pushed tasks and logged blocks, not only past ritual rows.
- Structure: when the guard fires, still write the plan as a proposal. Only the "is this new?" insight needs the history.

**9. `build-habit-home`, `build-item`, `build-list`, `build-list-described`: build requests.** None is built. Results:
- `build-habit-home`: gate "A command or question?" said no, so the whole request was added as an item to brain2.
- `build-item`: "Add 'replace bike tube' to my errands" wrote the full sentence as the item to "COGS, to do". It should write `replace bike tube` to Errands.
- `build-list`: ran the Ask lane and said "the notes do not record you making a list".
- `build-list-described`: the whole sentence became an item.
- Prompt: the command gate's examples all start with remind/when/add. Add "make a…", "add … to my …", "I need somewhere to keep …" as taught Y examples, and the two failures above as taught N→Y.
- Structure: after the command gate say yes, add a ROUTE with `ask`, `add-item`, `make-list`, `make-habit`. The `add-item` lane should PULL `{item, list}` and PICK the list by name. The list name must be an enum from FIND, so a made-up list name cannot come out.
- Structure: never let a command fall into the log lanes. When the route is none, propose nothing.

**10. `topic-brain2`, `topic-elijah`, `day-latest`.** The summaries read well and cite dates. One risk: the Elijah summary joins "departure noted October 19" and "plans to visit New York" into one story. (Not checked against the rows.) `day-latest` merges a body symptom into a day recap.
- Prompt: `SUMMARIZE_SYSTEM` says three to six lines. The Elijah one is a paragraph. Add "one line per theme, start each with its date range".
- Prompt: for a day recap, leave out body and health rows unless asked.

**11. `ask-hours`: 10.17 hours, 7 days.** Plausible, taken from code counts. It takes 43 s. The only fix: show the count rows next to the answer so a number can be checked.

## Across all cases

- **Speed.** A single gate takes 0.7–1.7 s on this model; the Ask flow always runs four fact gates. Merge the four into one `{ last, count, withPerson, other }` extract call, which is one call instead of four.
- **Checks.** 19 of 22 tests have none. Adding a `checks` entry for each makes the sheet pass or fail without reading. The ones above give a start: `answerNotContains`, `blocksContain`, `proposalsContain`.
- **Autosave.** The archive file was missing the first and last result of this run (cause not found). Post the result before the next test starts, and flush on `beforeunload` (`archive.ts` already uses `keepalive`).
- **Test labels.** `flow-tests.tsx` should show a delta against the previous run of the same test, so a prompt change shows what moved.


## Scenario pass, 2026-10-30 (made-up week, scripted and live)

_Last mapped: 2026-10-30_

New nodes (`compute`, `guard`, `clarify`), two flows (`ask-calc`, `log-grammar`), 350 passing
tests under `lib/bim-flow/` (about 290 new), and a live run on `qwen2.5:14b-instruct` over the
fixture week in `lib/bim-flow/scenarios.ts`.

**Bugs the tests found (fixed):**
1. `blocks.ts`: a "finished" or "did earlier" with no start reached back 30 min over the block before it, so two blocks held the same minutes. It now starts where the last block ended, and is dropped if under a minute remains.
2. `run-flow.ts` `check` node: when two lanes joined at one SAY, the check sat on one lane's path and re-read only that lane's rows and facts, so the second lane's numbers vanished from the final answer. The check now keeps the draft's rows first (citations still line up) and adds anything else on its path.
3. `compute.ts`: "more than last week this week" took "last week" as the window. A `compare` now uses the latest span the text names.
4. Clarify showed the mention as typed ("Which elijah"); it is now capitalized.

**Live, ask-calc (7 questions, 10 calls each, 6–25 s):** 6 of 7 right on the first try, every number
repeated exactly as code counted it (630 min, 5-day streak, 2 days, +3h 15m, 3 walks, 45 min). The miss: the
"longest without" gate said no to "longest i have gone without the gym this month", so no lane ran and
nothing answered. Fix: the gate now names that shape in its Yes examples; it passes. **Lesson:** when every
gate says no, the flow ends silently. Add a fallback lane (plain Ask) for "no lane fired".

**Structure notes:**
- A join node runs once, at its first arrival. In BFS that is after sibling lanes of the same depth, but a longer lane on one side would be missed. Joins should wait for all live parents.
- 150 random wirings (cycles, self-loops, unreachable nodes, gates wired one-sided) all end, run each node at most once, and never run an unreachable node.
- Grammar first: 24 lines of BIM's own grammar (`log:`, `intake:`, `dh:`, link first, read commands) route by code with zero model calls. `check out https://…` is not a link-first line and goes on as plain.

**Planned (not built):** a fallback lane when no gate fires; join-waits-for-all-parents; feed the `compute` facts into the morning plan; a `compute` fn for habit adherence rate; run `ask-calc` against the real hub vault in the lab and score it against hand counts.
