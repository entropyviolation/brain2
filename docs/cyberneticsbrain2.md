Brain2 as a Cybernetic System: Wiener Parallels & Roadmap
Sep 23, 2026 · @allie
Why Wiener
Brain2 is already a cybernetic machine. It senses, stores, compares and corrects. Wiener's Cybernetics (MIT Press, 2nd ed., 1961) gives the theory for that loop, and Brain2 can apply more of it.
Wiener named the field after the Greek word for steersman. It covers control and communication in both the animal and the machine (p. 11). His central claim is that purposeful action is circular. The nervous system acts on the world, senses how far it missed, and uses that miss as the next input (pp. 6–8). Brain2 does the same for a person's life. Capture and tracking are its sense organs. The vault is its memory. Plan, Scheduler and To Do act on the day. Plan-vs-reality, Calibration and Reviews feed the result back.
How this sits with the other two books: [`MAP_LOOP_MEANING.md`](MAP_LOOP_MEANING.md). This file is the loop instrument. Do not re-sequence the work from that brief.

How to read this doc. Part 1 lists 32 parallels in four groups: structure, function, process and future. Each parallel gives Wiener's idea with a page number, then where Brain2 already carries it in code or docs. Part 2 proposes five new features and five changes that bring in more of the book. Part 3 is the work order: eleven slices, the files they land in, and what done means. Execute Part 3. Do not re-sequence the work from Parts 1 or 2. A closing table maps each chapter to the Brain2 rooms it touches. It sits next to docs/ScienceandSanityBrain2.md, the Korzybski doc, and avoids repeating its proposals. [`PLAN_OF_ACTION.md`](PLAN_OF_ACTION.md) Wave 15 points here.
Source notes. Page numbers are the book's printed ones: roman numerals for the 1961 Preface and arabic numerals for the chapters. The book is paraphrased closely and cited by page, not quoted at length.
Terms used below.
• Feedback: the gap between the goal and what actually happened becomes the next input.
• Effector: the part that acts.
• Receptor: the part that senses.
• Homeostasis: a set of slow feedbacks that keeps a body within the narrow range where it can live.
• Information: the negative of entropy, measured in yes/no decisions. Entropy is disorder.
Part 1 — The parallels
Brain2 already carries 32 of Wiener's ideas. They fall into four groups: structure (the data model), function (what the rooms do), process (the loops) and future (the roadmap).
A. Structure: the data model
1. The message is a time series.
    ◦ Wiener: a message is a discrete or continuous sequence of measurable events spread over time. This is what statisticians call a time series (pp. 8–9). Every automaton records, keeps, sends and uses such series (p. 61).
    ◦ In Brain2: almost every record is a dated series. Tracking stores minute indices 0–1439 per day (lib/tracked-time.ts). Metrics, sleep, points and the append-only item ledger (lib/item-activity.ts) are also dated series. lib/metrics.ts treats them the way Wiener does, with trend, rolling slope and change-point detection.
2. Information is the negative of entropy.
    ◦ Wiener: the unit of information is one decision between two equally likely alternatives (p. 61). Information measures organization and entropy measures disorganization. Each is the negative of the other (p. 11, p. 62).
    ◦ In Brain2: Task.entropy (0–1) records how disorganized an item still is. lib/priority.ts ranks high-entropy tasks higher so that vague work comes up for clarification instead of rotting. The Inbox is the stage where entropy gets reduced. lib/metrics.ts measures the diversity of time use as Shannon entropy in bits.
3. Only a choice carries information.
    ◦ Wiener: information can only travel as a choice between alternatives. If only one outcome is possible, the cheapest message is none at all (p. 10).
    ◦ In Brain2: the app keeps real choices apart from defaults. In the morning walk grammar, a dash "leaves that slot unchanged" rather than creating a value (lib/morning-todo-walk.ts). Autofilled durations and times carry a FieldEstimate so they never pass as observed (lib/estimated-values.ts). An exempted habit period drops out of both sides of the fraction (lib/habit-exemption.ts).
4. Information is not matter or energy.
    ◦ Wiener: "Information is information, not matter or energy" (p. 132). Neurons, like vacuum tubes, run on a small outside power supply. What describes their work is a count of messages, not of energy (p. 42).
    ◦ In Brain2: the module law "Item is the only noun" treats a record's value as the connections it carries, not what it is made of. The first law makes the same point: an item is captured once, then used in as many rooms as it can serve. A grocery line is worth what it tells Lists, the pantry, BIM and Analytics.
5. Two kinds of memory.
    ◦ Wiener: working memory must record, read and erase quickly. The files are permanent and shape all future behavior. A machine is cleared between runs, but a brain never clears its past, so a life is like one long run (p. 121).
    ◦ In Brain2: lib/action-history.ts is the fast, erasable memory: an in-memory undo stack. lib/item-activity.ts is the files: an append-only ledger whose entries "are never rewritten". Append-log drafts can be edited, but submitted entries are read-only (components/append-log.tsx). Tracking day notes are the space between the two, jots kept "while you figure out where they belong."
6. Memory is stored as changed thresholds.
    ◦ Wiener: long-term memory is probably a change in how easily messages pass through a synapse. What is stored changes the paths that later messages take (p. 124, p. 130).
    ◦ In Brain2: stored history changes how later input is routed. lib/habit-priority.ts adds an automatic weight after each missed period, and that weight compounds. Pens sort by Recent by default. Inbox remembers recent target lists (lib/inbox-recent-lists.ts). A one-off block attachment can be promoted to a standing rule on the pen.
7. Redundancy and majority checking.
    ◦ Wiener: an important operation should not depend on one element. Machines run each step two or three times and compare the results. The brain likely does the same, in the spirit of the Snark's rule that what is said three times is true (pp. 145–146).
    ◦ In Brain2: sleep is read from two sources, the stated log and the painted grid. A stated bedtime always wins, and an inferred one is marked estimated (lib/sleep-inference.ts). BIM drops retried Telegram updates at the executor gate (lib/ingest/dedupe.ts). Day notes read both storage keys and merge them. When a save fails, PersistStatusBanner says so rather than pretending it worked.
8. Standard parts for frequent jobs, a switchboard for the rest.
    ◦ Wiener: mechanisms used often should be standard assemblies. Occasional ones should be built at the moment of use from general parts, allotted by a searching exchange like a telephone switch (pp. 131–132).
    ◦ In Brain2: the module platform follows this maxim. Frequent tools are standard assemblies: SheetGrid serves both Lists and Modules, and the agenda, timer and checklist views are reused. A workspace is assembled on demand from bound views over ordinary Items. The law "config is layout, not domain" keeps the parts general.
B. Function: what the rooms do
9. Receptors, effectors, and a center between them.
    ◦ Wiener: modern automata have sense organs and effectors. Between them sits a central system that recombines what comes in to produce the response wanted. That system stores information for later and changes its own rules based on the past (pp. 42–43).
    ◦ In Brain2: the receptors are BIM on Telegram, the iPhone Shortcuts, ActivityWatch Screen Time, receipt OCR, gps:, weather and the desktop capture bar. The center is the vault and the pure logic in lib/. The effectors are Plan, Scheduler, To Do, the friend's suggestion and BIM's replies. The README calls Brain2 "the meaning layer, not a window watcher". That is the central system's job.
10. The telltale in the signal tower.
    ◦ Wiener: a signalman must not assume his switches obeyed him, since snow may have bent a signal arm. Each effector reports its real state back to the tower. The navy does the same when a subordinate repeats an order back (p. 96).
    ◦ In Brain2: the plan is never trusted as the record. Day Log draws plan ghosts beside solid tracked time. BIM replies with what it filed. The day-notes well says when a jot did not save "instead of pretending it saved." PersistStatusBanner shows the last successful save.
11. Ataxia: strong muscles, no report.
    ◦ Wiener: in tabes dorsalis, the patient's muscles work but their position sense is gone, so they walk by watching their feet (pp. 95–96). A prosthetic limb removes paralysis but leaves ataxia unless it reports back to the skin (p. 26).
    ◦ In Brain2: a planner with no tracking is ataxic. It can act but cannot feel where it is. Tracking, sleep inference and lib/completion-window.ts supply the missing sense. That file names the old failure mode: a noon timestamp was "a placeholder masquerading as data."
12. Homeostasis runs on slow loops.
    ◦ Wiener: life holds only inside narrow bands of temperature, blood chemistry, pressure and more. A set of internal thermostats keeps it there, and these homeostatic loops are slower than voluntary ones (pp. 114–115).
    ◦ In Brain2: fast loops and slow loops are separate. The fast ones are Working Now, the 2-minute Just Start timer and live Tracking. The slow homeostatic ones are sleep reconciliation, habit week grades, the Overcommit early warning (lib/overcommitment.ts), regret accrual, the habit auto-weight and the weekly to yearly reviews.
13. Affective tone and its totalizer.
    ◦ Wiener: learning may run on a scale from pain to pleasure. A totalizer sums recent tone and broadcasts it back, which lowers thresholds for processes underway when tone rises and raises them when it falls. Hormones carry such "to whom it may concern" messages (pp. 127–129).
    ◦ In Brain2: the points ledger and the regret ledger (lib/regret-store.ts) are the two poles of affective tone. Habit points and grade bonuses (lib/habit-points.ts) act as the totalizer. The grade tubes, habit LEDs and the friend in the title bar broadcast to the whole house, not to one item.
14. Prediction is an operator on the past.
    ◦ Wiener: predicting a curve means running an operation on its past. A short past sets the forecast, and a long past of many similar cases sets the rules of forecasting (pp. 6, 8–9, 173).
    ◦ In Brain2: the "usually ~N" glance takes the median of past durations for the same title or type. Missing bedtimes fall back to the user's median over the last month (lib/sleep-sync.ts). Calibration trends the median actual-to-estimated ratio (lib/calibration.ts). The short past drives Working Now and the long past drives these glances.
15. Stars and clouds.
    ◦ Wiener: a star is an object you can count and catalogue. A cloud has no lasting identity, and a meteorologist reports it as a statistic, such as the sky being 38% overcast (pp. 30–33).
    ◦ In Brain2: Items are stars, each with an id, a history and an identity. Mood, Company, Location and time use are clouds. Analytics reports them as statistics: occupancy percentages, the hour-by-day atlas in CircadianView and the Markov transition matrix in TransitionsView.
16. Gestalt: bring it to a standard position.
    ◦ Wiener: perception first pulls an object into a standard position and size, and reduces it toward an outline. Only then does it compare it with stored forms. The resulting universals are not sharp; they shade into one another (pp. 134–138).
    ◦ In Brain2: capture does the same with text. lib/smart-parse.ts, lib/parse-event-text.ts and BIM's name-resolve turn many phrasings into one standard item. Similar items are compared with a tolerance: identical open grocery lines ask "see / again / dismiss". Pen trees and tags let categories overlap instead of forcing hard classes.
17. Memory is not a lock with one key.
    ◦ Wiener: the memory and association areas accept impressions from any sense. That is why replacing a lost sense is possible (p. 142).
    ◦ In Brain2: one item can arrive by text, iPhone Notes dump, receipt photo, forwarded PDF, gps:, Screen Time or the desktop. All of them "land through the same writes as the desktop." The vault does not care which sense brought the message.
One more function belongs here: the observer is inside the system. Wiener warns that social statistics come in short runs and that studying a market upsets it (pp. 24–25, 163–164). Self-tracking has both problems. Analytics already guards the first with sample floors: CorrelationExplorer hides its ranked links until the overlap clears a minimum, and TransitionsView keeps "empty/thin frames" honest.
C. Process: the loops
18. Negative feedback: read the output and subtract it.
    ◦ Wiener: the output is read and subtracted from the input, and that difference drives the effector (p. 97, p. 102). We do not will each muscle. We will to pick up the pencil, and the motion is steered by how far it is from done (pp. 7, 97).
    ◦ In Brain2: lib/plan-vs-reality.ts is the subtractor. It computes an attainment for tasks, time and points, then rolls the gap into a 0–100 variance score. Calibration subtracts the estimate from the actual. Habit percentages subtract done from goal. Goals are held as outcomes to steer toward, not lists of steps, the way Wiener's will aims at the pencil and not the muscles.
19. Too much feedback: hunting and purpose tremor.
    ◦ Wiener: feedback that is too sharp, or that arrives late, overshoots. It then overcorrects the other way until the system swings wildly. In a person, cerebellar damage produces a purpose tremor that spills a glass of water (pp. 7–8, 95–97).
    ◦ In Brain2: the push counters are a tremor sensor. Task.daysPushed and weeksPushed count each overcorrection. Needs Attention flags a "zombie" at a high push count (lib/needs-attention.ts). The Overcommit view rebuilds day-pushes as a daily series. Brain2 can see the oscillation but does not yet damp it (Part 2b, change 1).
20. Anticipatory feedback: aim where the target will be.
    ◦ Wiener: when duck shooting, you close the gap to where the bird will be, not where it is. A lagging effector needs a predictor in the loop (pp. 5, 112–113).
    ◦ In Brain2: the Overcommit early warning looks at the trend and slope of load, not just today. Days Until counts down to what is coming. Sunrise and sunset lines on the Plan agenda show the edges of the day before you reach them.
21. Informative feedback on an icy road.
    ◦ Wiener: on ice, a driver taps the wheel with small, quick pulses. The pulses are too small to cause a skid but big enough to feel how the road will respond. The driver then steers by what they learned (p. 113).
    ◦ In Brain2: Just Start (components/Focus/JustStartMode.tsx) is this move. It offers the smallest next step and a 2-minute timer, which is a small probe of how a stalled task will respond before any real commitment. lib/molecular.ts breaks work into probes that size.
22. Learning changes the rules of operation.
    ◦ Wiener: an automaton can change its rules as it runs, based on the data it has received (p. 43). A learning machine works by non-linear feedback (p. 173).
    ◦ In Brain2: learning is deliberately kept visible and in the user's hands. "usually ~N" "never rewrites estimatedDuration". A confirmed estimate is "sticky": later derivations cannot overwrite it (lib/estimated-values.ts). The habit auto-weight is the one place where the rules already adapt by themselves.
23. The machine that takes time off to replay its games.
    ◦ Wiener: every few games, a checker machine stops playing and reviews every recorded game. It finds the weights that most often led to a win, then plays on as a new, better machine that can no longer be beaten by the same trick twice (p. 172). The playing is first-order programming, and the review is second-order (p. 173).
    ◦ In Brain2: daily to yearly Reviews, the Morning Review, gm over text and per-task post-mortems are the time off. Today the human does the re-weighting (Part 2a, feature 3).
24. Circulating memory, malignant worry, and the clearing of sleep.
    ◦ Wiener: functional mental disorders are disorders of memory, meaning the information that keeps circulating in the active brain. A worry loop can recruit more and more of the neuron pool until normal thought has no room. Of normal processes, sleep comes nearest to clearing it, which is why we sleep on a problem (pp. 147–148).
    ◦ In Brain2: this is why a second brain exists. Capture moves circulating items out of working memory and into the files. The Inbox, day notes and Phone Notes hold loose loops so they stop circling. Sleep is a first-class boundary: the day belongs to the calendar date, and gm opens the next run.
25. Traffic jams near the edge of overload.
    ◦ Wiener: if a call passes n switching stages, each stage must succeed with probability p^(1/n) for the whole call to succeed with probability p. Long chains therefore work fine until they fail all at once. People run close to that edge, and the longest chains, the "higher" functions, fail first (pp. 150–152).
    ◦ In Brain2: dependency chains, critical path (lib/critical-path.ts) and Gantt are chains of stages. cognitiveLoad and the Overcommit sentence watch for the edge. lib/available-tasks.ts blocks work whose prerequisites are still open.
26. A community reaches only as far as its messages.
    ◦ Wiener: a community extends only as far as information actually moves within it. Its autonomy can be measured by comparing decisions made inside the group with decisions entering from outside (pp. 157–158). Leibniz's monads "have no windows" and only seem to act together (p. 41).
    ◦ In Brain2: "Isolation is a bug." Rooms must have windows. An installed module is "not a guest" because its writes reach Lists, search, Scheduler, Habits, points and Analytics. The one-way Module Lists projection is a window that opens in only one direction so far.
D. Future: the roadmap
27. The white box that learns to be the black box.
    ◦ Wiener: a black box does a known job by an unknown structure. A white box is built to a plan. Feed both the same random input, compare the outputs, and let feedback adjust the white box until it acts like the black box, even though its insides differ (pp. x–xi, 180). Blueprint machines are specific, while living systems organize themselves (p. xv).
    ◦ In Brain2: the planned install wizard in docs/MODULE_PLATFORM.md is this process. A pasted .tsx app is the black box. Brain2's Items, views and bridges are the white box, fitted to it once at install time. The result is a reviewable manifest and diff.
28. Self-reproduction means copying the function, not just the shape.
    ◦ Wiener: making a copy that merely looks the same is not self-reproduction. The copy must be able to do the same work (pp. 177–178).
    ◦ In Brain2: a module definition (blueprint) can be saved, re-created and exported (lib/module-definitions.ts). Templates scaffold working lists, schemas, seed data, views and workflows, not screenshots. A copied module runs on the same Item graph as its parent.
29. Literal-minded magic.
    ◦ Wiener: the sorcerer's apprentice, the genie and the monkey's paw teach one lesson. Magic grants exactly what you ask, so you must ask for what you really want, not what you think you want. Learning machines are just as literal. Turning one off also requires knowing when the danger point has come (pp. 175–177).
    ◦ In Brain2: the module laws answer this. They are "deterministic after install", the LLM runs only once at install, and the output is a reviewable manifest. Workflows ("Zapier for your data") are the sorcerer's broom, and they fire on real item changes. Brain2's undo stack and append-only history are its words of power.
30. Rhythms that pull each other into step.
    ◦ Wiener: the body's natural cycle of roughly 23½ hours is pulled into the 24-hour day by outside cues. Oscillators near the same frequency attract into clumps and leave gaps elsewhere, as fireflies may do when they flash together (pp. 199–200). A sharp rhythm serves as a clock that gates when messages can combine (pp. 197–198).
    ◦ In Brain2: sun times are computed per date (lib/sun-times.ts). The day anchor, median bedtime and CircadianView treat the day as a rhythm. The friend's daily mission and the morning gm act as outside cues that set the phase.
31. Parallel generators govern each other.
    ◦ Wiener: generators wired in parallel on shared busbars pull each other into step. Together they act as a virtual governor more accurate than any one of them. Generators wired in series repel each other and fail (pp. 201–202).
    ◦ In Brain2: the shared bus is the tag system. Habits, Tracking, Plan and points all read the same tagged minutes (lib/tracked-time.ts), so each corrects the others. Wiring rooms in series, each waiting on the previous one, would be the unstable design.
32. Who owns the means of communication.
    ◦ Wiener: control of communication is the strongest anti-homeostatic force in a society (p. 160). Any organism is held together by its means of acquiring, using, keeping and passing on information (p. 161). He asked for a society built on values other than buying and selling (p. 28).
    ◦ In Brain2: the app is offline-first, with the local store as the source of truth. Cloud sync is optional and "never blocks offline use." Backups are plain JSON. The person keeps the means of communicating with their own past.
Part 2a — Five new features
Each feature turns one of Wiener's mechanisms into a working room of the house. None needs a new noun: all of them read and write ordinary Items, tags, Tracking minutes and ledgers.
1. The Homeostat: setpoints with slow corrective loops
From the text. Life continues only inside narrow bands. The body holds them with a bank of thermostats and governors that act slowly, through hormones and other diffuse channels (pp. 114–115). A thermostat compares a setting with the actual reading and acts on the difference. A badly designed one swings the house into oscillation (pp. 96–97).
What it does. The person sets a band, not a single target, for a few vital variables. Examples: sleep 7–9 h, screen time under 3 h, Inbox under 25 items, tracked deep work 2–4 h, and a mood floor. A Home panel shows each variable as a needle inside its band, using a 7-day rolling mean so it responds slowly. When a needle leaves its band, one corrective message goes to one effector. The friend suggests the fix, Plan offers a block, or BIM sends a single line. Inside the band, nothing happens.
Where it lands. A pure lib/homeostat.ts reads the metrics store, lib/sleep-inference.ts, lib/screentime/ and lib/tracked-time.ts. The panel is a Home widget (lib/home-widgets.ts) plus an Analytics view. Bands are stored on the metric definitions.
Done when. Each band shows its reading, the band edges and the days out of band. At most one correction fires per variable per day. A test shows a variable that returns to its band stops generating messages.
2. Telltales: every planned order reports back
From the text. A signalman needs a telltale for each switch because snow may have bent a signal arm. Sailors repeat orders back (p. 96). Without that report, action becomes ataxic (pp. 95–96). A prosthesis should report through a vibrator on intact skin (p. 26).
What it does. Each planned block and each task scheduled for today gets a telltale lamp. It is dark before the block, then turns green, amber or red at the block's end. Green means tracked time or a completion confirms the order. Amber means partial. Red means nothing came back. On red, BIM sends a one-tap readback to the phone, such as "2–3 PM Writing: done / partial / didn't / moved". The answer is recorded as observed, not estimated. The Day Log already draws the ghost; the telltale closes the loop on it.
Where it lands. lib/telltale.ts derives lamp state from Plan (lib/plan-text.ts, lib/planned-actions.ts) against lib/tracked-time.ts and completions. BIM readback goes through lib/ingest/deliver-reply.ts, with a new apply-readback.ts beside the other apply-* handlers.
Done when. Every planned block ends with a lamp. A readback reply writes a real record with no estimate chip. Plan-vs-reality can split its variance score into confirmed, partial and unreported.
3. The Re-weighting Pass: second-order programming in the weekly review
From the text. Every few games, the checker machine stops playing and replays its recorded games to find the weights that led to wins. It learns from its own failures and its opponents' successes, then plays as a new machine (p. 172). This second-order programming uses a long past to set the policy the short past runs on (p. 173). Chess needs separate weights for the opening, middle game and endgame (pp. 172–173). Because learning machines are literal-minded, the goal must be stated as what is really wanted (p. 177).
What it does. The weekly review gains a step that replays the week's records and proposes new weights. It fits the four lib/priority.ts weights (urgency, importance, load, entropy) to what actually got finished and to what the user marked as mattering. It adds a per-type estimate multiplier from lib/calibration.ts, and habit point values from how often each habit was done against its difficulty. Weights can be set separately by phase of the day or phase of an Operation. The user sees old weights, proposed weights and the evidence count, then accepts or rejects each one. Nothing changes silently.
Where it lands. A pure lib/reweight.ts with a least-squares or logistic fit and a sample floor. It adds one step to lib/services/review-service.ts and shows in the Reviews dialog. Accepted weights write to user settings with a dated entry in the activity ledger.
Done when. The review shows at least one proposal once the sample floor is met, and none below it. Accepting a proposal changes the To Do order the next day. Every accepted change is dated and can be undone.
4. Maxwell's Demon: a negentropy ledger
From the text. Maxwell's demon sorts fast molecules from slow ones at a gate. It can only do this by acting on information, and information is negative entropy (pp. 57–58). Living things are metastable demons: their stable state is to be dead, so they must keep sorting (p. 58). Information is measured in decisions between alternatives (p. 61). Noise drives the information in a message toward zero (p. 64).
What it does. It is a third ledger beside points and regret, counting the order the person creates. Filing an Inbox item, lowering a task's entropy, merging a duplicate, answering a clarifying question and splitting a vague task into molecular steps each earn negentropy. The amount is the entropy drop, measured in bits of decisions resolved. A per-channel view shows which receptors (BIM, Shortcuts, ActivityWatch, desktop) deliver signal and which deliver noise: the share of captures that were clarified and used versus deleted or left to rot.
Where it lands. lib/negentropy.ts hooks into lib/services/item-mutation-service.ts wherever entropy or stage changes. Analytics gets a Channels view. The ledger mirrors the append-only pattern of lib/regret-store.ts.
Done when. Sorting a full Inbox shows a rising curve for the day. The Channels view lists each capture channel with a signal share and an n. The measure is labelled as derived.
5. The Rhythm Lab: autocorrelation, entrainment and gating
From the text. Wiener read hidden structure out of brain waves with autocorrelation and its power spectrum. The method revealed a sharp clump near 10 cycles per second with a gap beside it, where nearby oscillators pull together (pp. 183–199). A sharp rhythm is a clock that gates when messages can combine (pp. 197–198). A 23½-hour body rhythm is pulled into the 24-hour day by outside cues (p. 200).
What it does. An Analytics view runs autocorrelation over any daily or minute series: sleep midpoint, first tracked minute, mood, habit completion, screen time. It plots the power spectrum and names the periods that stand out (24 h, 7 d, about 28 d), along with clumps and gaps. For sleep it estimates free-running drift: how far bedtime slides per day when the cues weaken, as on weekends or trips. It also finds gating windows, the hours when completions actually cluster, so Plan can place hard work where the gate is open.
Where it lands. Autocorrelation and the spectrum go into lib/metrics.ts next to trend and change-points. The view goes under Analytics → Time, beside CircadianView, and reuses the shared range store and sample floors.
Done when. A synthetic 7-day series shows a peak at 7 in tests. The view reports its n and hides peaks below the floor. The gating-window list can be sent to Plan as suggested blocks.
Part 2b — Five key changes
These change behavior Brain2 already has. Each one fixes a place where a loop is open, too sharp or silent.
1. Damp the push loop (anti-hunting)
From the text. Feedback that is too sharp overshoots, then overcorrects the other way, until the system hunts and breaks down. In a person this is purpose tremor (pp. 7–8, 95–97). A long-run average of the input can lower the gain until the swing settles (p. 110).
Today. Pushing a task to tomorrow has the same full gain on the fifth push as on the first. daysPushed counts the swings, and Needs Attention labels the result a "zombie", but nothing reduces the gain.
Change. Make each push cost more as the count rises. After two pushes, the push menu drops "tomorrow" as its default and offers damped options instead:
• Break into a smaller molecular step (Just Start).
• Widen the due date from a day to a week.
• Move to Someday.
• Keep the date, with the reason recorded.
The Overcommit view marks any task that has swung between dates or lists three or more times as hunting.
Where. lib/services/scheduling-service.ts, the push controls in To Do and Plan, and lib/needs-attention.ts.
2. Put a compensator in front of the plan (anticipatory feedback)
From the text. A lagging effector needs a predictor in the loop, so the error closed is between aim and expected position (pp. 112–113). Compensation and feedback work best combined (pp. 111–112).
Today. Calibration and Overcommit report after the fact in Analytics. The plan is drawn at face value.
Change. Plan and the Scheduler day view show a compensated total as the plan is built: "Planned 4 h → likely 5 h 10 m at your ratio of 1.29 (n = 41)." Each block gets a faint tail showing its likely overrun. The Overcommit sentence appears inside Plan when the compensated total exceeds waking hours minus tracked routine. The raw estimate stays unchanged. The compensation is labelled as derived and never overwrites estimatedDuration.
Where. lib/calibration.ts (per-type median ratio), lib/plan-vs-reality.ts, the Plan agenda and DayAgenda.tsx.
3. Collate sources and file a minority report
From the text. A reliable machine runs a step on two or three mechanisms and accepts the majority. It also signals where and how the minority differed, so the fault can be found (p. 145).
Today. When sources disagree, Brain2 resolves the conflict quietly. A stated bedtime beats painted sleep. A completion time comes from the best available evidence. The losing source leaves no trace.
Change. Wherever two or more sources report the same fact (sleep, time on a task, location, a completion), a pure collator records agreement or disagreement. A disagreement larger than a tolerance becomes a small "minority report" chip on the record, stating both values and their sources. The period review lists that week's minority reports so the person can see which receptor is drifting, for example a Shortcut that stopped firing.
Where. A pure lib/collate.ts called from lib/sleep-inference.ts, lib/completion-window.ts and Screen Time sync. Chips reuse the est. chip styling. The list goes in lib/services/review-service.ts.
4. Every workflow ships with its words of power
From the text. The sorcerer's apprentice started the broom but had forgotten the words that stop it. Magic, like a learning machine, is literal-minded: you must ask for what you really want. You cannot turn a machine off in time unless you have information about when the danger point has come (pp. 175–177).
Today. Workflows (WorkflowTrigger to WorkflowAction in lib/types.ts) fire on real item changes and on schedules. They have no stated purpose, rate limit or preview.
Change. A workflow cannot be saved until it has four things:
• Intent: one sentence stating what the person really wants.
• Dry run: a replay over the last 30 days of item changes, showing how many times it would have fired and on what.
• Circuit breaker: a limit on fires per hour and per day. Crossing it pauses the workflow and raises a lamp.
• Run log: an append-only list of each firing, with one-click undo through lib/action-history.ts.
Workflows that write to habits, points or Tracking cannot trigger each other in a loop. The same rules apply to modules installed through the wizard.
Where. components/Modules/workspace/WorkflowBuilder.tsx, WorkflowStepEditor.tsx, the workflow runner, and docs/MODULE_PLATFORM.md (add as a law).
5. Merge points and regret into one affective-tone totalizer
From the text. Affective tone runs on one scale from pain to pleasure. A totalizer sums the recent tone and sends it back to every process underway. Rising tone lowers their thresholds and falling tone raises them. The broadcast goes "to whom it may concern", like a hormone (pp. 127–129).
Today. Points (lib/points-store.ts) and regret (lib/regret-store.ts) are two separate ledgers. They are displayed but not fed back into anything.
Change. A totalizer combines both ledgers into one signed tone series over a short window, for example the last 3 days. The tone is fed back into two places:
• Priority: the cognitiveLoad weight in lib/priority.ts follows the tone. Falling tone raises quick wins so momentum can return. Rising tone lets heavier, high-importance work come first.
• The friend: lib/friend-suggestion.ts picks its tone and its candidates from the same signal.
One header lamp shows the tone. The formula stays transparent: priorityBreakdown shows the tone's contribution as its own line.
Where. A new lib/affective-tone.ts (pure) that reads both ledgers, plus changes to lib/priority.ts, lib/friend-suggestion.ts and the title bar.
Chapter map
Every chapter of the book lands in at least one Brain2 room. Chapter IV, on feedback, supplies the most proposals.
Chapter (pages)
Core idea
Brain2 rooms
Parallels
Proposals
Preface, 1961 (vii–xvi)
Learning machines; black box and white box; blueprint vs self-organizing
Modules install wizard, Reviews
23, 27
2a-3
Introduction (1–29)
Feedback in voluntary action; the message as time series; information as negentropy
Plan, Tracking, Analytics
1, 2, 3, 18, 19
2b-1
I. Newtonian and Bergsonian Time (30–44)
Stars vs clouds; time runs one way; sense organs, effectors and memory
Items vs Tracking scopes; the append-only ledger
9, 15
—
II. Groups and Statistical Mechanics (45–59)
Maxwell's demon; organisms as metastable
Inbox triage, entropy
2
2a-4
III. Time Series, Information, and Communication (60–94)
Unit of information is one decision; noise; prediction from the past
Metrics, capture channels, estimates
1, 3, 14
2a-4, 2a-5
IV. Feedback and Oscillation (95–115)
Negative feedback, hunting, anticipatory and informative feedback, homeostasis
Plan-vs-reality, Calibration, Overcommit, Just Start, sleep
10–12, 18–21
2a-1, 2a-2, 2b-1, 2b-2
V. Computing Machines and the Nervous System (116–132)
Two memories; memory as thresholds; affective tone; standard assemblies
Undo vs History, habit weights, points and regret, SheetGrid
4–6, 8, 13, 22
2b-5
VI. Gestalt and Universals (133–143)
Standard position; universals that shade into each other; sensory prosthesis
Smart parse, BIM, pen trees, multi-channel capture
16, 17
—
VII. Cybernetics and Psychopathology (144–154)
Majority checking; circulating memory and worry; sleep clears; traffic jams
Dedupe, sleep reconciliation, Inbox, dependencies
7, 24, 25
2b-3
VIII. Information, Language, and Society (155–168)
Community bounded by communication; autonomy; observer effects; who controls the channels
Module law, Analytics sample floors, offline-first
26, 32
—
IX. On Learning and Self-Reproducing Machines (169–180)
Second-order programming; literal-minded magic; self-reproduction of function
Reviews, Workflows, module definitions
23, 28, 29
2a-3, 2b-4
X. Brain Waves and Self-Organizing Systems (181–203)
Autocorrelation; frequencies that attract; clocks that gate; the virtual governor
Circadian view, sun times, tags as shared bus
30, 31
2a-5
Part 3 is that work order.

## Part 3 — The plan

Status: not started. Parts 1 and 2 are the reasons. This part is what to build, in order. [`PLAN_OF_ACTION.md`](PLAN_OF_ACTION.md) Wave 15 points here and does not restate the slices.

The product never names the book. No tab, tooltip, or empty state says Wiener, cybernetics, homeostasis, feedback theory, or Maxwell's demon. The user steers by living in the house: a band that stays quiet while it holds, a block that reports whether it happened, a push that gets gentler as it swings, a plan that shows where the day is likely to land, and a weekly hour in which the house proposes new weights and waits.

Where it sits. Wave 15 does not wait on Wave 13 or Wave 14. GS slices and JG slices share no required order with these. Where a file is claimed by more than one wave, the slice below names the seam. UI follows the screen law in the plan of action and in [`DESIGN_STYLE.md`](DESIGN_STYLE.md): look at Home → Habits. Needles, lamps, and tubes. A control diagram does not belong on a screen.

The one idea. Brain2 already senses, stores, compares, and acts. The miss is computed in Analytics and then left there. This wave makes the miss the next input. One derived value, the **gap**, circulates. Fast loops, day loops, and slow loops all read it. They do not invent a private difference type, and they do not wait on each other. Rooms stay wired in parallel, the way tagged minutes already are (`lib/tracked-time.ts`). The gap is a second bus, for errors. It does not replace the tag bus, and it is not an Item.

### Decisions locked

- No new noun. A gap is computed. It is not stored as an item, not a ledger row of its own, and not a fifth order of abstraction.
- Four orders, the same names as GS-1: **observed**, **recorded**, **derived**, **inferred**. CY-1 defines the union if GS-1 has not shipped. GS-1 adopts it. Neither slice adds a fifth name or a second chip.
- `gain` runs from 0 to 1. Zero means silence. A correction may not push harder than the gap's gain.
- Three speeds, and a fast loop never writes a slow setpoint. A telltale cannot change a weight. A band cannot move a block. Second-order changes happen in the weekly review, and only after an accept.
- One effector speaks per gap key per day. Friend, Plan, and BIM are the effectors. They do not all text about the same sleep.
- Inside a band, the house sends nothing. A day that holds, and whose blocks have reported, produces no message. That is the success test for the wave.
- Learning is visible. Nothing rewrites a weight, an estimate, a plan, or a habit point by itself. An accept is dated and undoable.
- Information is not points. Order made (bits of decisions resolved) never enters `lib/points-store.ts` or the tone series. Tone never enters the points total. The two scales stay two scales.
- Compensation, order made, and a likely tail are **derived**. They wear the existing est. treatment. They never overwrite `estimatedDuration`.
- A split reading does not change the winner. Stated bedtime still wins. The chip only shows the minority.
- Sample floors stay. A thin window is not a finding. Spectrum's floor (14) and Overcommit's floor (7) are not lowered.
- No model in the fit, the dry run, the collator, the spectrum, or the tone. Deterministic after the person has written an intent or accepted a weight.
- Existing workflows that lack an intent pause. They do not keep firing until someone writes the sentence. Manual runs still work.

Labels on screen:

| Idea in the essay | Label on screen |
| --- | --- |
| Gap / error signal | Shown as the reading and the edges, not as a type name |
| Homeostat | Bands |
| Telltale after the block | Confirmed / Partial / Silent |
| Hunting, purpose tremor | A dated count: "swung 4 times since Jul 3" |
| Compensator | Likely |
| Re-weighting pass | Weights, inside the weekly review |
| Negentropy ledger | Order |
| Channel signal share | Channels |
| Minority report | Split |
| Affective tone | Low / Even / High |
| Gating window | Gate |
| Circuit breaker | Paused |
| Autocorrelation view | Spectrum (the view that already exists) |

Already in the house. Do not rebuild these, and do not add a second copy:

- Spectrum already computes lag autocorrelation, a naive periodogram, and sleep CV (`lib/metrics.ts`, `components/Analytics/SpectrumView.tsx`). CY-8 extends that view.
- Overcommit already rebuilds pushes and writes a sentence with n (`lib/overcommitment.ts`). CY-4 adds the damper. It does not add a second warning tab.
- Calibration already trends the actual-to-estimated ratio (`lib/calibration.ts`). CY-5 shows it on the plan. It does not fork the math.
- Just Start is the small probe (`components/Focus/JustStartMode.tsx`). CY-4 offers it. It does not grow a new timer.
- "usually ~N" never rewrites `estimatedDuration` (`lib/estimated-values.ts`). Likely tails follow that law.
- A stated bedtime beats a painted one (`lib/sleep-inference.ts`). CY-9 reports the loser. It does not elect a new winner.
- The person keeps the files: offline-first store, optional sync, plain JSON backup. No slice in this wave moves that.

### CY-1 — The gap

Lane: `lib/error-signal.ts` and `lib/error-signal.test.ts`. No UI. No store. Nothing else imports it until a later slice.

A gap is `{ key, intention, reading, signed, at, order, gain }`. `reading` and `signed` are null when the block has ended and nothing came back. Null is not zero. Zero would say the effector reported nothing-done. Null says the tower never heard.

`order` is observed, recorded, derived, or inferred. If `FieldEstimate` already carries `order`, use that union. If not, define it here.

Three constructors, pure, fixture-tested:

- `blockGap` — a planned action (`lib/planned-actions.ts`) against tracked minutes and a completion. Null reading when the block has ended with neither.
- `ratioGap` — actual minus estimate, from a calibration point. Order derived. Gain 0. A ratio is a measurement. It is not yet a correction.
- `swingGap` — from `daysPushed` and the reconstructed push dates Overcommit already knows how to build.

The caller passes `gain`. This file does not choose policy.

Done when the three constructors round-trip, a missing report is null rather than 0, and no component imports the module.

Do not persist gaps. Do not add a tab. Do not name the type on a screen.

### CY-2 — Bands

Part 2a feature 1. Depends on CY-1. One agent, in this order: `lib/homeostat.ts`, then `lib/user-settings-store.ts`, then a Home widget, then one Analytics view.

The person sets a band, not a point, on a few vital variables: sleep 7–9 h, screen under a cap, Inbox under a count, tracked deep work inside a range, a mood floor. Each band stores its edges and which single effector may speak: the friend, a Plan offer, or one BIM line. The default is the friend.

`lib/homeostat.ts` reads the metrics store, `lib/sleep-inference.ts`, `lib/screentime/`, `lib/tracked-time.ts`, and the inbox count. The reading is a 7-day rolling mean. Inside the band, gain is 0 and the gap produces no message. Outside, gain rises with days out of band and stays capped. At most one message per variable per day. A test shows that a variable which returns to its band stops.

The Home widget id is `bands`. First migrate tucks it, the way later tiles were tucked in `lib/home-widgets.ts`. The open instrument is a needle between two edges, in the language of the Habits tubes. The Analytics view is **Bands**, added under Behavior beside Overcommit in `components/Analytics/analytics-tabs.ts`. It shows the same readings, the edges, and the days out. It does not send the message. The widget's effector does.

Done when each band shows its reading, its edges, and its days out; a return to band stops messages; the widget can be hidden; a day inside every band sends nothing.

Do not nag inside the band. Do not reschedule the day. Do not let two effectors speak for one variable. Do not put this on a new Analytics group.

### CY-3 — Reports

Part 2a feature 2. Depends on CY-1. May proceed beside CY-2. No shared files with CY-2. Lane: `lib/telltale.ts`, then the Plan agenda, then BIM, then a split of the variance counts in `lib/plan-vs-reality.ts`.

Each planned block, and each task scheduled for today, carries a lamp. It is dark before the block ends. After the end it is **Confirmed** (tracked time or a completion), **Partial**, or **Silent** (a `blockGap` with a null reading). Color stays inside the Habits tube hues: confirmed takes the good hue, partial the middle, silent stays dark. The word is always there.

On Silent, if BIM is paired, one readback goes out through `lib/ingest/deliver-reply.ts`: "2–3 PM Writing: done / partial / didn't / moved". A new `lib/ingest/apply-readback.ts` sits beside the other apply handlers. The answer is stored as observed. It wears no est. mark.

`computePlanVsReality` gains a split of its counts into confirmed, partial, and unreported. CY-3 owns the counts. If GS-2 later wraps the sentence, it consumes these counts. This slice does not rewrite Calibration prose.

Done when every ended block has a lamp, a readback writes an observed record with no estimate chip, and a test splits variance three ways.

Do not draw a new chip. Do not send a band's message from this slice. Do not turn Silent into a shame line.

### CY-4 — Ease

Part 2b change 1. Depends on CY-1 so the mark is a `swingGap`. Lane: `pushTaskOnePeriod` in `lib/item-utils.ts`, `lib/services/scheduling-service.ts`, the push menus in To Do and Plan, `lib/needs-attention.ts`, and the Overcommit view's hunting mark.

The first push may still offer tomorrow. After two, tomorrow is not the default. The menu offers four damped moves:

- A smaller step, which opens Just Start.
- Widen the due date from a day to a week.
- Move to Someday.
- Keep the date, and record a reason.

Overcommit marks any task that has swung between dates or lists three or more times. The visible sentence is a dated count, for example "swung 4 times since Jul 3". The internal id may be `hunting`. If GS-3 has already replaced the visible word "Zombie" with a dated count, do not put that word back. Add the swing sentence beside the existing one.

Done when a test locks the menu from the push count, the fifth push does not default to tomorrow, and a three-swing task is marked on Overcommit.

Do not delete the task. Do not split it automatically. Do not raise the gain as the count rises.

### CY-5 — Likely

Part 2b change 2. Depends on CY-1 so the tail is a `ratioGap` with gain 0. Lane: a per-type median ratio on `lib/calibration.ts` (extend it), the Plan agenda, and `DayAgenda.tsx`.

As the plan is built it shows a compensated total: "Planned 4 h → likely 5 h 10 m at your ratio of 1.29 (n = 41)." Each block may grow a faint tail for its likely overrun. When the compensated total exceeds waking hours minus tracked routine, the Overcommit sentence appears inside Plan. The raw estimate stays on the block. The tail is labelled derived and uses the existing est. treatment.

Hide a type's tail when that type has n under 7. Fall back to the overall ratio when the type is thin and the overall clears 7. Hide the whole line when both are thin.

Done when the agenda shows the likely total with n, a thin type draws no tail, and a test proves `estimatedDuration` was not written.

Do not overwrite the estimate. Do not auto-place the overrun. Do not treat the likely total as the plan.

### CY-6 — Weights

Part 2a feature 3. Lane: `lib/reweight.ts`, then `lib/services/review-service.ts`, then the weekly step in the Reviews dialog, then the existing To Do formula panel (the control that already says it can reweight).

The fit looks at the last 8 weeks. It proposes new values for the four `lib/priority.ts` weights, fit to what was finished and to what was marked as mattering. It also proposes a per-type estimate multiplier from `lib/calibration.ts`, and habit point values from how often each habit was done against its difficulty. The floor is 24 completed tasks that carry the four fields. Below the floor, no proposal. A phase of day (before noon, noon to 5, after 5) is offered only when that phase has at least 12. An Operation phase is offered only when that phase has at least 8. Otherwise the row is absent.

The person sees old weight, proposed weight, and the evidence count, and accepts or rejects each one. Accept writes `priorityWeights` through the task store and a dated activity entry. Undo restores the previous blob. The formula panel lists the four weights as their own lines. If CY-11 has already added a tone line, leave it.

Done when a proposal appears only above the floor, accepting one changes the next day's To Do order in a test, and the change is dated and undoable.

Do not fit overnight. Do not call a model. Do not apply a proposal the person has not accepted.

### CY-7 — Order

Part 2a feature 4. Lane: `lib/negentropy.ts` (pure, given before and after snapshots), then an append-only ledger in the shape of `lib/regret-store.ts`, called from `lib/services/item-mutation-service.ts` only to record. The view is **Channels**, under Meta, beside Observatory, in `analytics-tabs.ts`.

Filing an inbox item, lowering `Task.entropy`, merging a duplicate, answering a clarifying question, and splitting a task into a molecular step each append a derived amount: the bits of the decision just closed. A yes-or-no clarification is 1 bit. The day's curve can rise. The number is labelled derived.

Channels are BIM, Shortcuts, ActivityWatch, desktop, and other. Signal share is the share of captures that were clarified and used, against those deleted or still in the inbox after 7 days. Each row shows the share and n. Under n = 7 the row says the window is thin and does not rank itself.

Done when a fixture inbox sort produces a rising curve for the day, each channel shows a share and an n, and a test proves the amount was not written into points.

Do not add the bits to points, regret, or tone. Do not make a streak of it. Do not rank the person.

### CY-8 — Gates

Part 2a feature 5. Lane: `lib/metrics.ts` and `components/Analytics/SpectrumView.tsx` only. The view keeps its name and its place under Meta.

Add a series choice: sleep midpoint, first tracked minute, mood, habit completion, screen time. Name the periods that clear the floor. On a daily series those are 7 days, and about 28 days when n is long enough to support it. A 24-hour peak is stated only for a minute-grained series, and the caption says which. For sleep, estimate free-running drift: how many minutes bedtime slides per day on weekends against weekdays, with n. List gating windows, the hours where completions actually cluster.

"Suggest on Plan" creates planned blocks the person can delete. They wear the est. mark. They are not placed by themselves.

Done when a synthetic 7-day series peaks at 7 in a test, a peak under the floor is hidden, and a suggestion arrives as a deletable planned block.

Do not add a second spectrum tab. Do not forecast. Do not auto-place. Keep the view's statement that the math is classical.

### CY-9 — Split

Part 2b change 3. Lane: `lib/collate.ts`, called from `lib/sleep-inference.ts`, `lib/completion-window.ts`, and Screen Time sync. The chip reuses the est. chip family. The review list is a step on `lib/services/review-service.ts`.

Wherever two or more sources report the same fact, the collator records agreement or disagreement and keeps the current winner. A disagreement beyond tolerance becomes a **split** chip. The hover states both values and both sources. Tolerances: sleep 30 minutes, a completion time 15 minutes, screen time 20% relative. Inside tolerance, no chip.

The weekly review lists that week's splits so a drifting receptor can be seen (a Shortcut that stopped firing, a painted night that keeps losing to the log).

Done when a stated bedtime and a painted bedtime 90 minutes apart show both values, a 10-minute gap shows no chip, the winner is unchanged, and the weekly review lists the week's splits.

Do not elect a new winner. Do not chip every near-miss. Do not block the save.

### CY-10 — Pause

Part 2b change 4. Lane: `components/Modules/workspace/WorkflowBuilder.tsx`, `WorkflowStepEditor.tsx`, the workflow runner, and a sixth law in [`MODULE_PLATFORM.md`](MODULE_PLATFORM.md).

A workflow cannot be saved, and an existing workflow cannot keep firing, until it has four things:

- Intent: one sentence that says what the person actually wants.
- Dry run: a replay over the last 30 days of item changes, showing how many times it would have fired and on which items.
- A limit per hour and per day. Crossing it pauses the workflow and raises a lamp. The on-screen word is **Paused**.
- A run log: append-only, each firing undoable through `lib/action-history.ts`.

`runWorkflow` is refused when both the caller and the target write to habits, points, or Tracking. The check is on the action kinds, not on a hope that the user will be careful. Installed-module workflows follow the same four fields when a wizard exists. This slice does not build the wizard.

Workflows already saved without an intent open in a needs-intent state and do not fire on item changes until the four fields exist. A manual run still runs.

Done when a workflow without an intent cannot be saved, an old workflow without an intent does not fire, a dry run shows a count, a limit pause is tested, and a mutual trigger between two ledger-writers is refused.

Do not call a model. Do not delete the old workflow. Do not build the install wizard here.

### CY-11 — Tone

Part 2b change 5. Lane: `lib/affective-tone.ts` (pure), then `lib/priority.ts`, then one call from `lib/friend-suggestion.ts`, then one lamp in the title bar.

The function reads `lib/points-store.ts` and `lib/regret-store.ts` over the last 3 days and returns one signed series. It does not merge the stores. Falling tone raises the `cognitiveLoad` weight so quicker work comes first. Rising tone lets importance lead. `priorityBreakdown` shows the tone's contribution as its own line. If CY-6 has not shipped, add the line to the formula panel anyway. If it has, do not remove the weight rows.

The friend calls `toneBias` from this module and nothing else in `lib/friend-suggestion.ts`. JG-8 owns mission copy and retirement. This slice does not edit mission text.

One header lamp reads **Low**, **Even**, or **High**. The gap key is `tone`. The formula stays on the breakdown, not in the lamp.

Done when a falling fixture tone moves the order toward lower cognitive load, the breakdown shows the tone line, the friend score moves on the same fixture, and neither ledger's stored entries change.

Do not merge the stores. Do not say what the person is. Do not feed tone into points, or points into order.

### Lanes

Claim one slice. CY-2's four files are sequential, one agent. CY-3's Plan lamps and BIM readback are sequential, one agent. CY-6 lands the formula panel's weight rows; CY-11 may land before or after it and only adds or keeps the tone line.

| Slice | Speed | Owns | Does not touch |
| --- | --- | --- | --- |
| CY-1 | — | `lib/error-signal.ts` | UI, persist |
| CY-2 | Slow | `lib/homeostat.ts`, user settings, Home widget `bands`, Analytics → Behavior → Bands | Plan blocks, BIM readback |
| CY-3 | Fast | `lib/telltale.ts`, Plan lamps, `apply-readback.ts`, variance split | Band messages, chip CSS |
| CY-4 | Day | Push menus, scheduling service, needs-attention swing sentence, Overcommit hunting mark | Auto-split, the word Zombie |
| CY-5 | Fast | Per-type ratio, Plan likely total and tails | Writes to `estimatedDuration` |
| CY-6 | Slow | `lib/reweight.ts`, weekly review, formula-panel weight rows | Silent apply, a model |
| CY-7 | Slow | `lib/negentropy.ts`, ledger, Analytics → Meta → Channels | Points, tone |
| CY-8 | Slow | `lib/metrics.ts`, SpectrumView | A new tab, auto-place |
| CY-9 | Day | `lib/collate.ts`, split chip, weekly list | Winner rules |
| CY-10 | Slow | Workflow builder, runner, module law 6 | The install wizard |
| CY-11 | Day | `lib/affective-tone.ts`, priority weight, friend score call, header lamp | Mission copy, ledger merge |

After CY-1, these may proceed together: CY-2 with CY-3; CY-4 with CY-5; CY-7, CY-8, CY-9, and CY-10 with either, since they do not share files. CY-6 and CY-11 share the formula panel only at the tone line, as the table says.

### Done for the wave

A person can set a band and hear nothing while inside it. A planned block ends as confirmed, partial, or silent, and silence can be answered in one tap. A task pushed twice is offered a smaller move. The plan shows a likely total that does not replace the estimate. Once a week the house proposes new weights and waits. Sorting the inbox draws a curve of order made, apart from points. Spectrum names a gate and can suggest a block the person may delete. Two receptors that disagree leave both values visible, and the old winner stands. A workflow says what it wants, shows what it would have done, and can sit paused. One lamp carries the last three days of tone into what comes first.

A day inside every band, with every block reported, sends no message.

The chrome still does not mention the book.