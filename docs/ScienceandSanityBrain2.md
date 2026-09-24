Science and Sanity × Brain2
Sep 23, 2026 · @allie
Overview
Brain2 is already a working model of Korzybski's general semantics. The book never mentions software, but its central claims describe the app's design. A record is a map, not the life it describes. Every map leaves things out. Every claim should carry its date and its order of abstraction. A person is a time-binder who builds on what earlier states of themselves recorded.
Korzybski's core claim is in Chapter IV: "A map is not the territory it represents, but, if correct, it has a similar structure to the territory, which accounts for its usefulness" (p. 58). Brain2's first law, capture once, connect everywhere, and its second law, Analytics is the heart, are attempts to build a personal map with the structure of the life it maps.
How this sits with the other two books: [`MAP_LOOP_MEANING.md`](MAP_LOOP_MEANING.md). This file is the map instrument. Do not re-sequence the work from that brief.

How to read this doc. Part 1 lists the parallels, grouped by what they touch in Brain2: structure (the data model), function (what the rooms do), process (the loops) and future (the roadmap). Each parallel names the idea, quotes or cites the text, and names the Brain2 code or doc that already carries it. Part 2 proposes five new features and five changes that apply more of the book. Part 3 is the work order: ten slices, the files they land in, and what done means. Execute Part 3. Do not re-sequence the work from the essay. Page numbers are the book's own, from the fifth edition (1994) scan.
Book terms used below. Extensional means oriented by observed facts and instances. Intensional means oriented by definitions and words. s.r is Korzybski's abbreviation for semantic reaction: a whole-organism response to words and meanings.
Part 1 — The parallels
There are 26 parallels in four groups. In each: the book gives the idea and its source, and in Brain2 names where the app already does it.
A. Structure: the data model
1. The map is not the territory.
    ◦ The book: "A map is not the territory it represents, but, if correct, it has a similar structure to the territory" (p. 58). The fifth-edition preface adds a second and third premise: "no map represents all of 'its' presumed territory" and "maps are self-reflexive" (p. xvii).
    ◦ In Brain2: the vault is the map. Every Item, painted block and habit tick is a record about a life, never the life itself. The code already says so. In lib/sleep-inference.ts, a painted Sleep block says "I was asleep during these minutes". The file calls that "a weaker claim than 'I fell asleep at 11:30'", so a stated bedtime always wins.
2. The Structural Differential (event → object → label → label of label).
    ◦ The book: the model has a parabola for the event, "broken off to indicate its limitless extension". Under it hang a disk for the object and a label for the name. More labels hang from each other "in a series" (p. 399).
    ◦ In Brain2: the same stack appears in the data. The event is the raw process: ActivityWatch window events, a phone text to BIM, a minute of the day. The object is the painted block or captured Item. The label is the pen, type or tag. Labels of labels are pen parents under Counts as (lib/pen-tree.ts): Balboa Park → at the park → Out → Mexico. That chain is Korzybski's labels "hung, one to the other, in a series."
3. Orders of abstraction must not be confused.
    ◦ The book: "Once we abstract, we abstract in different orders, and so we order" (p. 404). Confusing the orders is "identification", which he treats as the root of mis-evaluation.
    ◦ In Brain2: docs/COUNTS_AS.md states the rule: "Painting still writes this pen." Nesting is "not a relabel". The stored block stays at its own order. Show as (displayDepth) only picks which order the grid and Analytics display: Country, Area or Exact. Higher-order rollups are computed at read time, so they never overwrite the lower-order record.
4. Non-allness: characteristics are always left out.
    ◦ The book: "Nature is inexhaustible; the events have infinite numbers of characteristics" (p. 375). On the Differential, the free-hanging strings show "characteristics left out, neglected, or forgotten in the abstracting" (p. 399).
    ◦ In Brain2: the design assumes the record is incomplete. Items take open-ended attributes and per-item schemas (itemAttributeDefinitions). The Tracking day-notes field holds jots "while you figure out where they belong." Untracked and AFK time is shown as untracked, not filled in. Screen Time says "0 blocks means AW had nothing usable yet, not a broken pipe." The README's "The graph has no ceiling" is the product version of non-allness.
5. Non-identity and indexing (Smith₁ is not Smith₂).
    ◦ The book: the index is the first extensional device (p. lx). Indexing narrows a feeling from a generalization down "to the individual Smith₁" (p. lxi). "Whatever one might say something 'is', it is not" (p. 409).
    ◦ In Brain2: every Item has its own id, so two open items both titled "milk" stay two items. BIM does not merge them silently; it asks see / again / dismiss. Merging is a separate, explicit operation (lib/item-merge.ts). The Company scope is kept apart from Activity ("not an Activity called hanging out"), which refuses to identify two different facts.
6. Dating (Smith₁₉₂₀ is not Smith₁₉₃₃).
    ◦ The book: dates are the second extensional device. "In a four-dimensional world dating is only a particular temporal index" (p. lx).
    ◦ In Brain2: nearly everything carries a date, and the app is careful about which date. Sleep belongs to "the calendar day you are looking at, not 'last night'." Week and Infinite views label sunrise and sunset "from that row's date... not today's clock on every row." lib/item-activity.ts is an append-only ledger in which "entries are never rewritten". Each state of an item is dated and kept.
7. Non-elementalism: do not split verbally what cannot be split empirically.
    ◦ The book: language lets us "split 'body' and 'mind', 'emotion' and 'intellect', 'space' and 'time', etc., which as a matter of fact cannot be separated empirically" (p. lxii). Korzybski's answer is joined terms such as space-time and organism-as-a-whole.
    ◦ In Brain2: the first law, "Isolation is a bug", is non-elementalism. One Item primitive runs through Lists, Scheduler, Habits, Tracking, Modules and Analytics. Tags "belong to time rather than to pens", which joins Tracking and Habits. Opening a block shows what else was happening: the Activity, Location, Mood and Company views of those same minutes. It is one event seen from several sides, not four separate events.
8. Structure is the only content of knowledge.
    ◦ The book: "structure is the only possible content of science and of all human 'knowledge'" (p. 348). "We must realize that structure, and structure alone, is the only link between languages and the empirical world" (p. 50). Language is "names" plus "relational terms" (p. 250).
    ◦ In Brain2: meaning comes from structure. Typed links have inverses and derived backlinks (lib/links.ts). Formulas like LOOKUP, ROLLUP and COUNTIF compute across items. The module law "Item is the only noun" follows: modules add relations and views, not new kinds of stuff.
9. Undefined terms.
    ◦ The book: "all linguistic schemes, if analysed far enough, would depend on a set of undefined terms" (p. 21).
    ◦ In Brain2: the base type is the plain, undefined item. New list items default to it, and meaning is added later through user-defined types, attributes and links. The module law "config is layout, not domain" keeps the undefined core small.
B. Function: what the rooms do
10. Time-binding is Brain2's purpose.
    ◦ The book: Korzybski's definition of a human is "the capacity of each human generation to begin where the former generation left off. This capacity I called the time-binding function" (p. 539). "Animals are not time-binders" (p. 239).
    ◦ In Brain2: a second brain does time-binding at personal scale: each day's self starts where the last one stopped. Reviews (daily through yearly), the item History tab, the usually ~N duration glance and Calibration all pass one period's record to the next.
11. Description first, inference next.
    ◦ The book: "the natural survival order is 'senses' first, 'mind' next; object first, label next; description first, inference next." Reversing it, with "inferences evaluated as descriptions", is a symptom he finds in "practically all forms of 'mental' ills" (p. 317).
    ◦ In Brain2: this is the closest match in the codebase. Derived values are "labeled, never asserted". Each carries a FieldEstimate naming how it was produced (lib/estimated-values.ts), shows an est. chip, and waits for confirmation in the period review. Once confirmed, it is "sticky": a later derivation cannot overwrite it. Assumed Tracking blocks are drawn hatched, and Analytics can hide assumed time. In other words, Brain2 keeps observed data and inferred data in separate, marked orders.
12. Similar structure makes prediction possible, and prediction brings security.
    ◦ The book: "If the two structures are similar... our predictions are verified." If not, "we feel insecure, a floating anxiety, fear, worry, disappointment" (p. 269).
    ◦ In Brain2: Analytics checks the map against the territory. Plan-vs-reality gives a 0–100 "intention → outcome variance score". Calibration measures actual / estimated. Overcommit warns when day-pushes and logged minutes trend apart. Korzybski's link between bad maps and anxiety also explains the ADHD design: a planner that predicts badly causes distress, and one that predicts well is calming.
13. Infinite-valued evaluation, not either-or.
    ◦ The book: "I accept the many-valued, more general... 'logic of probability'... which in my non-el system becomes infinite-valued" (p. 93). He rejects "the two-valued, 'either-or' type of orientations" (p. xxxiii).
    ◦ In Brain2: evaluations are graded rather than binary. Belief strength is a continuous 0–1 value from trust-weighted evidence, with 0.5 meaning no net evidence (lib/belief-strength.ts). Completion tiers give bare minimum, goal and exceptional levels in place of done or not done. Habits earn daily grades and points, and Tracking blocks are either certain or assumed.
14. Training the organism-as-a-whole: seeing, handling, hearing.
    ◦ The book: the Differential exists as a physical relief model so the student "sees, he handles., the hanging strings, and he also hears about them... To affect the organism-as-a-whole, organism-as-a-whole methods must be employed" (p. 427).
    ◦ In Brain2: the interface is built to be handled: painting the day with pens, bead wells, photographed orbs, beveled Win95 keys, the friend animal, points. The Module Platform's "Beauty clause" and "skins stay feral" treat touch and look as part of the method, not decoration. The Tracking grid works like a Structural Differential you paint on.
15. Delayed reaction.
    ◦ The book: in his classroom demonstration, ten percent of students "delayed their evaluations" (p. xlvi). "Orientations by extension induce an automatic delay of reactions" (p. lviii).
    ◦ In Brain2: capture is separated from classification, so nothing has to be judged on reflex. The Inbox is the unclarified stage (stage === "inbox"). A text that names no list "parks" in Phone Notes "rather than answering with a picker of near-misses." Day notes wait "while you figure out where they belong."
16. Plan and outcome are never identified.
    ◦ The book: non-identity applies to our own statements too. A plan is a higher-order abstraction and is "static while the world is dynamic" (p. 294).
    ◦ In Brain2: the Day Log draws the plan as ghosts and tracked time as solid color, side by side, and never merges them. The usually ~N glance "never rewrites estimatedDuration." The plan stays a plan, and reality is recorded next to it.
C. Process: the loops
17. Consciousness of abstracting.
    ◦ The book: "Animals... abstract; but... they do not know that they abstract" (p. xvi). Consciousness of abstracting is "remembering that we abstract in different orders with omission of characteristics" (p. 417).
    ◦ In Brain2: the interface keeps showing which level you are looking at and how a value was made. Examples: the Show as depth, the est. chip, hatched assumed blocks, the ancestor path in the Counts-as picker (Home › Ocean Beach › San Diego), and the provenance sentence on each FieldEstimate.
18. Self-reflexiveness: maps of maps.
    ◦ The book: "we can map our maps indefinitely. Also, every map is at least... a map of the map-maker" (p. xvii). "If the map could be ideally correct, it would include... the map of the map" (p. 58).
    ◦ In Brain2: Analytics is a map of the vault, and Calibration is a map of your estimates, which are themselves maps. item-activity records changes to the map. Every data point also maps its maker: what you chose to capture shows your habits of attention.
19. The spiral of knowledge, and its failure mode.
    ◦ The book: the structure of knowledge is "circular... or of spiral structure... an 'effect' becomes a causative factor for future effects" (p. 12). How we formulate at one date shapes how we abstract next: "healthfully if our abstracting is open, non-finalistic... pathologically if not" (p. xviii).
    ◦ In Brain2: the loop is plan → track → review → plan. Habits feed points, points feed priority, and priority feeds the next plan. The code also guards against the pathological spiral. sleep-inference ignores blocks the sleep log generated itself, "or the log would end up reading its own output back as evidence."
20. The extensional devices, one by one (full comparison in the table below this list).
    ◦ The book: "Indexes, Dates, Etc., Quotes, Hyphens", which "should be used habitually and permanently" (p. lx).
    ◦ In Brain2: each device already has a counterpart; see the table.
21. Logical fate: change the premises to change the behavior.
    ◦ The book: "conclusions constitute behaviors... If we want to change behaviors, we must first change the premises which gave birth to the behaviors" (p. xvii–xviii).
    ◦ In Brain2: the Objectives → Goals → Actions layer puts premises first (lib/objectives.ts). The Direction Report flags days "whose completed tasks served no goal." Implied-action rules (lib/implied-actions.ts) and module workflows state premises as data: when X happens, Y follows.
22. Multiordinal terms.
    ◦ The book: for multiordinal terms, "the 'meaning' is strictly a function of the order or level of abstraction at which the term is used" (p. xvi).
    ◦ In Brain2: review, done, habit and plan mean different things at different orders. A daily review is not a yearly review, and a weekly habit is "the sum across the period." The period switcher (day / week / month / quarter / year) is how the user states which order a word is used at.
| Device | Korzybski's use | Brain2 counterpart today |
|--------|-----------------|--------------------------|
| Index (Smith₁, Smith₂) | Each individual differs from others with the same label | Item ids; duplicate-title prompt in BIM; pen variants that split a category into its instances |
| Date (Smith₁₉₂₀) | The same individual differs across time | createdAt, append-only item History, per-day notes, per-row sun times, dated sleep stretches |
| Etc. | No statement covers everything | Open attributes, day notes, "the graph has no ceiling"; Infinite scroll on the Time Grid |
| Quotes ('sex', 'mind') | Marks a term as suspect or elementalistic | UI Names (rename any label); a block's display name that defaults to the pen but can differ |
| Hyphen (space-time) | Joins what language splits | Tags on time joining Tracking and Habits; secondary pens; "what else was happening" across scopes |
D. Future: the roadmap
23. The module platform is time-binding between people.
    ◦ The book: time-binding is cumulative, and Korzybski argues its growth follows "an exponential function of 'time', with indefinitely accelerating accelerations" (p. xxxv).
    ◦ In Brain2: reusable module definitions can be exported and re-imported, and the goal is to "install any app into your brain." Once one person builds a Tidy or Book Tasting structure, the next person starts from it. The README's "a brain that can grow organs forever and still be one body" describes cumulative, non-elementalist growth.
24. Deterministic after install: the map-maker stays visible.
    ◦ The book: "every map is at least... a map of the map-maker: her/his assumptions, skills, world-view" (p. xvii).
    ◦ In Brain2: the planned install wizard lets an LLM map a foreign app onto Items once. Its output is "reviewable artifacts — a manifest and a diff", and nothing runs through the model after that. The map-maker's assumptions become an artifact you can inspect, not a hidden process.
25. Concept items should be "formulations".
    ◦ The book: "Students of general semantics are strongly advised never to use the elementalistic term 'concept', but the non-elementalistic 'formulation' instead" (p. lxii).
    ◦ In Brain2: the idea bank plans a Concept item type (idea #74) with "understanding maps" (#76) and "relations as their own objects" (#77). Korzybski would agree with #77, since relations carry the structure. He would rename the type: a formulation has an author and a date, where a concept suggests something outside time.
26. Conscious and subconscious surfacing.
    ◦ The book: intensional orientation trains "a split between the functions of the cortical and thalamic regions", while "orientations by extension involve the integration of cortico-thalamic functions" (p. lviii).
    ◦ In Brain2: idea-bank section L plans "an automatic background process that surfaces relevant memories/beliefs/resources to inform the deliberate one." Today, needs-attention (overdue, stale, blocked, zombie) and the friend's nudges already raise lower-level signals into deliberate review, and each one says why it was raised.
Part 2a — Five new features
Each feature brings one of the book's methods into the app. The goal is for the user to practice general semantics while using Brain2, without having to read about it.
1. The Structural Differential inspector
What it is. A new Differential tab on item detail and on any painted block. It draws Korzybski's model for that one record, as a vertical stack:
• Event: the raw source, such as the ActivityWatch window events, the BIM text as sent, the receipt photo or the painted minutes.
• Object: the record Brain2 made from it.
• Label: the pen, type and tags.
• Higher labels: Counts-as parents, the goals it serves, and the Analytics rollups it feeds.
Beside the stack hang strings: characteristics this record left out. Examples are scopes with nothing painted for those minutes (no Mood, no Company), empty attributes, and an unconfirmed est. value. Clicking a string captures that characteristic.
From the text. "The free hanging strings (Bₙ) indicate the most important characteristics left out, neglected, or forgotten in the abstracting" (p. 399). The strings, Korzybski says, "help to train in non-identity" (p. 427). He called the Differential "the first structurally appropriate model of the abstracting process" (p. xvii).
Where it lands. components/ItemDetail/ (new tab) and the block dialog in Tracking. It reads lib/pen-tree.ts, lib/links.ts, lib/estimated-values.ts and the "what else was happening" query. Drawn in the Win95 chrome, it becomes a Differential you can handle.
2. Extensional check (an is-of-identity and allness detector)
What it is. An optional check in Docs, journal pages, reviews and BIM messages. It highlights is of identity ("I am lazy", "this project is a disaster") and allness words (always, never, everyone, nothing). It then offers two things:
• An indexed, dated rewrite: for example, "I skipped the gym on Mon and Tue this week (2 of 5 planned)."
• The evidence: the vault's own counts for that claim, pulled from Habits, Tracking and To Do → Done.
The user can keep the original sentence. The check only places the map next to the territory.
From the text. "Whatever one might say something 'is', it is not" (p. 409). "The 'is' of identity forces us into semantic disturbances of wrong evaluation" (p. 409). On indexing a generalized feeling, he writes: "by indexing we allocate or limit the 'hate' to the individual Smith₁, instead of a 'hate' for a generalization which spreads over the world" (p. lxi). He adds that this frees "positive affective energy". For an ADHD user with rejection-sensitive self-talk, this may be the book's most practical therapeutic device.
Where it lands. A pure lib/extensional-check.ts (a pattern list plus a vault-evidence lookup), shown as a gutter mark in components/Docs/DocumentEditor.tsx and as an optional step in components/Reviews/. BIM could answer I always forget X with the actual count.
3. Description → inference review
What it is. The evening and weekly reviews get a two-step order that the user cannot skip.
1. Describe. The review shows only what was recorded: tracked blocks, completions, texts, sleep, without labels or scores. The user adds missing facts.
2. Infer. Only after that does it ask what the user concludes. Each conclusion is saved as its own Inference item, linked inferred-from to the descriptions it rests on.
Later reviews can show inferences whose supporting facts changed. For example, "I'm a night person" loses support when Tracking shows three weeks of morning work.
From the text. "Object first, label next; description first, inference next" (p. 317). "Once we differentiate, we discriminate between descriptions and inferences... only from description of facts do we tentatively form inferences" (p. 404). The inferences are tentative, which is why they are linked items and not fixed facts.
Where it lands. components/Reviews/ (morning review already exists), a new relation pair inferred-from / supports-inference in lib/links.ts, and a strength value computed like lib/belief-strength.ts.
4. Dated formulations (the Concept type, redone)
What it is. Build idea #74 (Concept) as a Formulation item type. Every Formulation and Belief keeps dated versions: the wording, the derived strength and the user's certainty at each date. Item detail shows a small timeline, belief₁ on 2026-03 and belief₂ on 2026-09, with the sources added between versions. Relations between formulations are first-class items (idea #77) and carry their own certainty.
From the text. Korzybski's advice is: "never to use the elementalistic term 'concept', but the non-elementalistic 'formulation' instead" (p. lxii). His example of a label that hides change over time is one word applied at birth, at age one and at age two. These "are obviously different in life, but the differences are hidden by the one abstract definitional term" (p. lxi). "Structure is the only 'content' of knowledge" (p. xvi) is the reason relations should be stored as items.
Where it lands. lib/second-brain-types.ts (new type), a dated snapshot array on the item via lib/item-activity.ts, and a timeline panel in components/ItemDetail/.
5. Time-binding handoff
What it is. Every period review ends by writing a short handoff: what I learned, which premises changed, and what the next self should start from. The next period opens on that handoff, with the previous one below it, so the record forms a chain. On a longer scale, the user can export their structure as a module definition (types, pens, rules and views, without personal data) that another person can install.
From the text. Korzybski's definition of a human is "the capacity of each human generation to begin where the former generation left off" (p. 539). His "Logical Fate" says that to change behaviors "we must first change the premises" (p. xviii), so the handoff asks for premises, not just tasks. Beginning where one left off is also a direct fix for the ADHD pattern of restarting from zero each week.
Where it lands. lib/reviews-store.ts (handoff record), the Home Plan rail (shows the latest handoff), and lib/module-definitions.ts for the export.
Part 2b — Five key changes
These change behavior that already ships. Each one takes a principle Brain2 applies in one room and applies it everywhere.
1. Extend "labeled, never asserted" to every derived value
Today. FieldEstimate provenance covers time fields: duration, and where a habit sat in the day. Belief strength, habit grades, points, Analytics sentences and Counts-as rollups are also derived, but they show no est. mark and no provenance sentence.
Change. Give every value an order: observed (from an event: ActivityWatch, a timestamp), recorded (entered by the user), derived (computed from other values) or inferred (guessed). The order is stored on the value and drawn the same way everywhere, with a small mark and a sentence on hover. Analytics can then filter by order the way it can already hide assumed time.
From the text. "Inferences evaluated as descriptions" is the reversal Korzybski finds behind most mis-evaluation (p. 317). Consciousness of abstracting means "remembering that we abstract in different orders" (p. 417). The UI can do the remembering.
2. Counts-as ladders for every label, not just pens
Today. Only Tracking pens nest. Types, tags, lists and goals are flat labels, and Analytics can roll up time by depth but not items.
Change. Apply lib/pen-tree.ts's rule, "Painting always writes the specific pen. Display depth decides which ancestor", to item types, tags and folders. For example, a Novel counts as a Book, which counts as Reading. Add one global Show as control in Analytics, so every chart can move up and down the same ladder. Records keep their exact label, and rollups are computed at read time.
From the text. Labels "are hung, one to the other, in a series" (p. 399). "We could hang on the 'animal' object as many levels of labels, which stand for higher order abstractions, as" we need (p. 394). The ladder already exists for time, and this change gives it to everything else.
3. Infinite-valued completion by default
Today. CompletionStatus has six values (active, done, partial, deferred, cancelled, missed), but the main To Do action is a two-valued checkbox. Completion tiers exist only when a type opts in.
Change. Make completing something a graded action by default: a quick 0–100% slider or bare / goal / exceptional on every task, with a single click still meaning goal. Partial work is credited to points, habits and plan-vs-reality instead of counting as zero.
From the text. Korzybski replaces "the two-valued, 'either-or' type of orientations" (p. xxxiii) with "infinite-valued" evaluation (p. 93). He notes that either-or works only "on the gross level" (p. xxxiii), which is where a checkbox belongs, not as the default for all work.
4. Index and date every Analytics statement, and show what it leaves out
Today. Insight sentences are written as undated, unindexed generalizations. lib/calibration.ts produces "You typically underestimate by 40% — tasks take longer than you plan." The sentence has no date range, no sample size and no indication of which kinds of task. Overcommit already does better, with a sentence plus n.
Change. Every Analytics sentence carries three extensional devices:
• Index: which subset, for example "writing tasks".
• Date: the range, for example "Aug 1–Sep 20".
• Etc.: coverage, for example "n = 34; 61% of tasks had no estimate".
For example: "From Aug 1 to Sep 20, writing tasks₁ ran 1.4× your estimate (n = 34). Errands ran 0.9×. 61% of tasks had no estimate." A pure lib/extensional-copy.ts helper builds these sentences for every card.
From the text. The extensional devices "should be used habitually and permanently" (p. lx). A generalization without indexes spreads "over the world"; an indexed one is limited to "the individual Smith₁" (p. lxi). Non-allness: "no map represents all of 'its' presumed territory" (p. xvii). The coverage figure states that limit in numbers.
5. Rewrite judgment copy in extensional language, throughout the app
Today. The friend-copy rules already say "Never shame overdue". Elsewhere the app still names things by identity: the Needs Attention reason zombie, the Analytics Regret view, and insight sentences that begin "You typically…".
Change. Audit all user-facing strings (friend, BIM replies, Needs Attention reasons, Reviews, Analytics). Describe the event instead of labeling the person or the item. For example, "Zombie" becomes "pushed 9 times since Jul 3", and a habit streak ends as "done 4 of the last 5 days; not yet today", not as a loss. Add a lint test that fails on new copy containing always, never or you are followed by a trait.
From the text. Korzybski's whole theory is about semantic reactions: words produce whole-organism responses. "We say 'this is a pencil'... unconditionally false to facts... Thus our s.r are at once trained in delusional values" (p. 35). Copy that labels a person trains the same reaction his students showed. Copy that describes events and dates them trains "an automatic delay of reactions" (p. lviii).

Part 3 — The plan

Status: not started. Parts 1 and 2 are the reasons. This part is what to build, in order. [`PLAN_OF_ACTION.md`](PLAN_OF_ACTION.md) Wave 13 points here and does not restate the slices.

The product never names the book. No tab, tooltip, or empty state says Korzybski, general semantics, or structural differential. The user practices the method by capturing, painting, reviewing, and reading a sentence that knows its own limits.

Where it sits. GS-1 and GS-2 may start as soon as they reuse the est. mark from Wave 4 of the plan of action (`~`, dashed amber, hatch, hover sentence). They do not invent a second chip. Every later slice that draws UI follows the screen law in that plan and in [`DESIGN_STYLE.md`](DESIGN_STYLE.md): look at Home → Habits, keep Lists as the cabinet, do not open this wave by adding a lecture. Ontology slices (GS-8, GS-10) do not restart the field-of-record work in Wave 10.

Decisions locked here, so the next agent does not relitigate them:

- One new item type, `formulation`. An inference and a belief are roles on it (`inference`, `belief`), not two types and not a type named Concept. Idea #74 in the idea bank keeps its number and loses that name.
- Four orders, stored on the value and drawn one way: **observed** (an event wrote it: ActivityWatch, a timestamp, a message as sent), **recorded** (the person entered it), **derived** (computed: rollup, grade, points, formula), **inferred** (guessed: sleep inference, an assumed block, usual duration).
- A single click still completes at goal. The grade is how partial work is credited. The checkbox stays; it is the gross-level either-or, not the only evaluation.
- Code ids may keep old names (`zombie`, the Regret view id, `regret-store`). User-facing sentences change. The on-screen Regret heading does not say the person is regretful.
- The extensional check never blocks a save and never rewrites the sentence by itself.
- Counts-as stays single-parent. Parallel chains stay the unanswered design in [`COUNTS_AS.md`](COUNTS_AS.md).
- No model in the check, the differential, the handoff, or the sentence helper. Deterministic after the words are written, same as a module after install.

### GS-1 — One order on every derived value

Part 2b change 1. Lane: Estimates (`lib/estimated-values.ts` and the call sites that already show est.).

Grow `FieldEstimate` with `order` rather than a second provenance type. Time fields already carry the estimate; this slice gives the same order and the same hover sentence to belief strength, habit grades, points, Counts-as rollup labels, and any Analytics number that is computed. A user-typed number stays **recorded** and gets no est. mark.

Done when a derived number on an open screen shows the existing mark plus a sentence naming the order and how the value was made, and a unit test locks the four order names. Analytics can filter by order the way it can already hide assumed time.

Do not design a new chip. Do not mark a typed value as inferred.

### GS-2 — Extensional sentences

Part 2b change 4. Lane: Analytics. Depends on the shared range in `analytics-range-store.ts`. May proceed beside GS-1.

Add `lib/extensional-copy.ts`. Every interpretive sentence is built from three parts: the date range, the indexed subset, and the coverage (n, and the share of the set the claim does not cover). Calibration is the first consumer. Overcommit already has a sentence plus n; route it through the helper. Then plan-vs-reality and the Regret view's prose.

The shape to hit: "From Aug 1 to Sep 20, writing tasks ran 1.4× your estimate (n = 34). Errands ran 0.9×. 61% of tasks had no estimate." Real dates, real subset, real n.

Done when Calibration speaks in that shape and a test fails if a builder omits the range or n.

Do not rewrite view names in the changer. Do not present a thin window as a finding; Wave 1's sample floors stay.

### GS-3 — Extensional judgment copy

Part 2b change 5. Depends on GS-2's helper for any sentence that states a count. Three lanes, three pulls, no shared files:

- Home interiors: `lib/needs-attention.ts` and `NeedsAttention.tsx`. The visible reason "Zombie" becomes a dated count, for example "pushed 9 times since Jul 3". The id `zombie` may stay.
- Analytics: insight lines that begin "You typically…". A habit streak ends as "done 4 of the last 5 days; not yet today".
- Friend and BIM: `lib/friend-copy.ts` and BIM reply strings. The existing rule stands — never shame overdue — and extends: describe the event, date it, do not say what the person is.

Done when those surfaces no longer ship an identity label, and a lint test over the files this slice touched fails on a new string matching `always`, `never`, or `you are` plus a trait. Start the lint on those files. Do not sweep the repository in the same change.

Do not replace a label with a pep talk.

### GS-4 — Extensional check

Part 2a feature 2. Depends on GS-2 so the offered rewrite can cite the vault in the same sentence shape. Lane: a pure `lib/extensional-check.ts` first, then Docs (`components/Docs/DocumentEditor.tsx`), then Reviews, then BIM.

The check highlights an is-of-identity ("I am lazy", "this project is a disaster") and allness words (always, never, everyone, nothing). It offers an indexed, dated rewrite and the vault's own count from Habits, Tracking, and To Do → Done. The original sentence stays unless the person applies the rewrite. BIM, asked "I always forget X", answers with the count.

Done when a fixture document shows the gutter, saving the original still works, and tests cover one identity sentence and one allness sentence against a fixture vault.

Do not block save. Do not auto-apply. Do not call a model.

### GS-5 — Description, then inference

Part 2a feature 3. Depends on GS-1 so a formulation's strength is order **inferred**. Lane: Reviews, plus `lib/links.ts` and `lib/second-brain-types.ts` in that order inside one slice.

Evening and weekly reviews gain two steps. Morning review keeps the order it has.

1. Describe. Show only what was recorded: blocks, completions, texts, sleep. No grades in this step. The person adds missing facts.
2. Infer. Conclusions save as `formulation` items with role `inference`, linked `inferred-from` / `supports-inference` to the descriptions they rest on. Strength is computed in the manner of `lib/belief-strength.ts` and stays marked inferred.

A later review can show an inference whose supports changed: "I'm a night person" loses support when Tracking shows three weeks of morning work.

Done when the weekly review refuses to open Infer before Describe has been confirmed, the new link pair round-trips, and a formulation with role `inference` is creatable without a second item type.

Do not add the two-step to the morning ritual. Do not store the conclusion as a loose string on the review with no link.

### GS-6 — Time-binding handoff

Part 2a feature 5. The handoff record can land with GS-5 or immediately after it. Lane: `lib/reviews-store.ts` first, then the Home Plan rail.

`PeriodReview` gains a handoff: what I learned, which premises changed, what the next period should start from, and `writtenAt`. The next period opens on that handoff, previous handoff below it. The Plan rail shows the latest.

Module-definition export is already a blueprint. This slice checks that an export is structure only (types, pens, rules, views) and strips personal item bodies if any leak. It does not build a second exporter.

Done when a finished weekly review writes the three lines, the next week shows them first, Plan shows the latest, and a test round-trips the record.

Do not summarize the week with a model.

### GS-7 — Structural Differential

Part 2a feature 1. Depends on GS-1. Pen ladders only; GS-8 extends the higher-label rung. Lanes, in order: Item detail tab, then the Tracking block dialog. Both read `lib/pen-tree.ts`, `lib/links.ts`, `lib/estimated-values.ts`, and the existing "what else was happening" query.

A vertical stack for one record: event (raw source), object (the item or painted block), label (pen, type, tags), higher labels (Counts-as parents, goals served, rollups fed). Beside it, strings for characteristics left out: a scope with nothing painted on those minutes, an empty attribute, an unconfirmed est. Clicking a string opens the capture that already exists for that characteristic.

Drawn as Win95 furniture you can handle, in the language of the Habits interior. Not a textbook figure, not a page number, not a SaaS diagram.

Done when a painted block and an item each show the stack, at least one string opens an existing capture, and the lower-order record is unchanged by opening the tab.

Do not teach the diagram. Do not wait on GS-8 to ship the pen version.

### GS-8 — Ladders for every label

Part 2b change 2. Depends on GS-7 so the differential grows a rung instead of a second inspector. Lane: Item (`lib/pen-tree.ts`'s rule, applied beside it — do not overload the pen graph with types).

Types, tags, and lists get a single parent. A Novel counts as a Book, which counts as Reading. Painting, creating, and tagging still write the exact label. One Show as control in Analytics moves charts up and down that ladder at read time. Goals already hang from objectives; do not give them a second parent pointer.

Done when Novel rolled up to Reading in that control is still stored as Novel, and a test proves the rollup is computed on read.

Do not implement parallel parents. Do not rewrite stored ids. Do not start a new nesting UI per label kind; one parent picker, three callers.

### GS-9 — Graded completion by default

Part 2b change 3. Depends on GS-1 so a partial completion is **recorded**, not inferred. Lane: Completion. High blast radius: `lib/completion-tiers.ts`, the completion dialog, points, habit credit, plan-vs-reality. One agent.

Completing offers a 0–100 value or bare / goal / exceptional on every task. One click means goal. Partial work counts in points, habits, and plan-vs-reality. Types that already opt into tiers keep their tiers.

Done when a type that never opted in still grades, a single click still completes at goal, a partial is not zero in those three consumers, and existing tier tests still pass.

Do not remove the checkbox. Do not make the slider the only control.

### GS-10 — Dated formulations

Part 2a feature 4. Depends on GS-5's `formulation` type and on the append-only ledger in `lib/item-activity.ts`. Lane: Item, then a timeline panel on item detail.

Each wording change keeps the previous wording, the derived strength, and the person's certainty, dated. Item detail shows belief-on-March beside belief-on-September and the sources added between them. A relation that needs its own certainty is itself a formulation (idea #77), not a new column on `ItemLink` beyond the link pair GS-5 added.

Done when editing a formulation's wording leaves the previous wording dated and visible, and a relation formulation can hold its own certainty.

Do not auto-extract a concept dictionary (idea #75). Do not name the type Concept. Do not make the graph rewrite itself when a source arrives (idea #83).

### Lanes

Claim one slice. GS-3's three surfaces are three claims. GS-7's item tab and block dialog are sequential, not parallel, because they share the stack component.

| Slice | Owns | Does not touch |
|-------|------|----------------|
| GS-1 | `lib/estimated-values.ts`, est. call sites | New chip CSS |
| GS-2 | `lib/extensional-copy.ts`, Analytics prose | Chart frames, view names |
| GS-3 | The one surface claimed (needs-attention, Analytics prose, or friend/BIM copy) | The other two |
| GS-4 | `lib/extensional-check.ts`, then Docs, Reviews, BIM | Auto-rewrite |
| GS-5 | Reviews evening/weekly, `lib/links.ts`, `lib/second-brain-types.ts` | Morning review order |
| GS-6 | `lib/reviews-store.ts`, then Home Plan rail | A new exporter |
| GS-7 | Item detail Differential, then Tracking block dialog | Type/tag/list parents |
| GS-8 | Parent pointer for types, tags, lists; Analytics Show as | Pen graph internals, multi-parent |
| GS-9 | Completion, points, habit credit, plan-vs-reality | Checkbox removal |
| GS-10 | Formulation snapshots via `lib/item-activity.ts`, item-detail timeline | Concept extraction |

### Done for the wave

A person can see the order of a number, read an Analytics sentence that names its subset, its dates, and what it leaves out, keep a generalized sentence if they want it, describe a period before they conclude, hand the next period a premise, and open a differential on one block. The chrome still does not mention the book.

## Source notes

The book. Alfred Korzybski, *Science and Sanity: An Introduction to Non-Aristotelian Systems and General Semantics*, fifth edition (Institute of General Semantics, 1994), from the local scan `alfred-korzybksi-science-and-sanity.pdf` (910 pages). The scan has no text layer, so it was OCR'd in full. Quotes are checked against that OCR. A few may have small transcription errors, and subscripts in the original (Smith₁) come out as commas in the OCR.

| Book section | Pages | Used for |
|--------------|-------|----------|
| Preface to the fifth edition | xvi–xviii | The three map premises, multiordinality, structure as content, spiral of knowledge, Logical Fate |
| Preface to the third edition | xxxiii, xxxv | Two-valued orientation, exponential growth of time-binding |
| Introduction to the second edition | xlvi, lviii–lxii | Delayed evaluation, cortico-thalamic integration, the five extensional devices, indexing, 'concept' → 'formulation' |
| Ch. I–II, Aims / Terminology | 7–12, 21, 35 | Time-binding, undefined terms, spiral structure, the 'is' of identity |
| Ch. IV–VI, Structure | 50, 58, 93–94 | Map and territory, structure as the only link, infinite-valued semantics |
| Ch. XVIII–XX, Mathematics / Psychophysiology | 250, 269, 294, 317, 348 | Relational terms, similarity of structure and prediction, description before inference |
| Ch. XXIV–XXVI, Abstracting / Structural Differential / Consciousness of abstracting | 375, 387–427 | Infinite characteristics, the Differential and its strings, non-allness, orders of abstraction |
| Concluding remarks | 539 | Definition of time-binding |

Brain2. Read from the working tree on 2026-09-23: README.md, docs/COUNTS_AS.md, docs/MODULE_PLATFORM.md, docs/BRAIN2_FEATURE_IDEAS.md, and the header comments of lib/estimated-values.ts, lib/sleep-inference.ts, lib/pen-tree.ts, lib/belief-strength.ts, lib/second-brain-types.ts, lib/plan-vs-reality.ts, lib/calibration.ts, lib/objectives.ts, lib/needs-attention.ts, lib/item-activity.ts, lib/links.ts, lib/completion-tiers.ts and lib/types.ts. Part 3 was added the same day as the work order; it does not change those readings.