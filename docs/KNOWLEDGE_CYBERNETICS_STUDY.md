# Knowledge cybernetics, read against Brain2: a research note

_Last mapped: 2026-11-02_

**Suggestion only.** Nothing here is built, scheduled, or part of any plan. It is not linked from `docs/PLAN_OF_ACTION.md` on purpose. Ideas are labelled **Suggested**, not **Planned**. A later decision can promote any of them.

Source: Maurice Yolles, _Organizations as Complex Systems: An Introduction to Knowledge Cybernetics_, Information Age Publishing, 2006 (Managing the Complex, vol. 2). 885 pages. Page numbers below are the book's printed ones.

Read beside [`cyberneticsbrain2.md`](cyberneticsbrain2.md) (Wiener), [`MAP_LOOP_MEANING.md`](MAP_LOOP_MEANING.md), [`COGNITIVE_ARCHITECTURE_AS_BLUEPRINT.md`](COGNITIVE_ARCHITECTURE_AS_BLUEPRINT.md), [`BIMBY_IDEAS.md`](BIMBY_IDEAS.md), [`AGENT_LAB_PLAN.md`](AGENT_LAB_PLAN.md).

## 0. Scope and honesty

**Read:** contents, preface, introduction (pp. 1–17), most of ch. 6 (pp. 293–326), ch. 7.4 (pp. 353–362), ch. 8.4–8.5 (pp. 402–415).

**Not read:** ch. 1–5, the rest of ch. 6–8, and all of ch. 9–16 (semantic communication, action research, politics, ethics, culture, conclusions). Claims about those come from the table of contents only. A fuller study should read them, especially ch. 10 (semiotics) and ch. 14–15 (ethics, critical methods).

**Limits of the source.** It is soft-systems theory. Its propositions are argued, not tested. It is about organizations. Every move to one person's life is an analogy. The author says his approach is constructivist, so he does not claim falsifiability.

## 1. What the book adds that the house lacks

The existing docs use four instruments: map (Korzybski), loop (Wiener), meaning (Jung), and a cognitive-architecture vocabulary. Yolles adds a fifth axis: **viability and self-production**. The question is not only "does the loop steer" but "does the system keep itself alive without eating the thing it serves". It also adds a theory of **knowledge as locally re-created**, never transferred.

## 2. Idea A. Three domains as a lens

Yolles splits an autonomous system into three domains (pp. 301–306, 408–411):

| Domain | Contents | Brain2 reading |
|---|---|---|
| Phenomenal / behavioral | what happens: behavior, structure, energy | Tracking, ledger, completions |
| Noumenal / organizing | models, plans, rules, images of how things work | Plan, Scheduler, habit rules, pens and tags, BIM flow graphs, the graph |
| Existential / cognitive | worldview, values, identity, belief | Goals, `lib/belief-strength.ts`, People, `JungBrain2.md` |

The boundaries between domains are processes:

- **Autopoiesis** (noumenal and phenomenal): plans produce behavior, behavior regenerates plans.
- **Autogenesis** (existential and noumenal): the system rewrites its own governing principles.

**Suggestion.** Treat the domains as a reading lens on Reviews and Data, not as a stored field. Daily and weekly reviews are autopoiesis. A review that asks whether the rules are still mine is autogenesis. The house may have no rung for that second kind. That is a question worth testing before building anything.

## 3. Idea B. VSM as a viability audit

Beer's five functions as Yolles presents them (pp. 297–301):

| VSM | Job | Brain2 candidate |
|---|---|---|
| S1 | operations | To Do, Tracking, Habits |
| S2 | coordination, damps oscillation | Scheduler conflicts, overcommit warning |
| S3 | integration and control | priority ranking, time budgeting, morning walk |
| S3* | sporadic audit | plan-vs-reality, Calibration, clean-and-confirm screens |
| S4 | futures and development | Goals, forward reviews |
| S5 | policy and identity | standing rules, values, laws in `CLAUDE.md` |

**Suggestions.**

1. **Per-room audit.** For one room, list which S-function it lacks. A room with S1 and no S3* is the ataxic planner in `cyberneticsbrain2.md`. A one-room trial costs little and shows whether the lens finds anything real.
2. **Overhead ratio.** Yolles calls the main disease _pathological autopoiesis_: S2–S5 serve their own self-production at the expense of S1 (p. 295, p. 408). For a second brain that means a machine you tend instead of one that serves you. A derived measure could compare time spent organizing (Plan, list upkeep, Reviews) with time spent on the tracked thing. Per the "learn signals from data first" rule, mine own history first and test whether the signal exists. No model near it.
3. **Variety engineering.** Requisite variety (Ashby) gives two levers: attenuate incoming variety with filters, or amplify your own (p. 296). The BIM gate graph is an attenuator. The "quiet inside the band" rule is attenuation by design. This is a theory for rules already chosen, not a new feature.
4. **Recursion over BIMBIES.** Each BIMBY is a small viable system. A checklist for any new one: S1 does the job, S2 stops two helpers fighting over one item, S3 is the guard and approval gate, S3* is trace and eval replay, S4 is the lab's experiments, S5 is its closed list of what it may do. Fits `lib/agents/blueprint.ts` and the lab README as review text.

## 4. Idea C. Knowledge migration

Core claim (pp. 10–13, 355–362): knowledge cannot be transferred. A message triggers local creation of knowledge through the receiver's worldview. The cycle has three phases: migration, accommodation, knowledgeable action. There are three knowledge types: identification (what things are), elaboration (how they relate), execution (how to do).

Brain2 readings:

- Items and people are identification. Links, lists, and the graph are elaboration. Habits, rituals, and flows are execution.
- Capture, Inbox, organized structure, use is a migration cycle. The Inbox is the migration stage.
- **Future-you is another worldview holder.** An old item is re-interpreted, not retrieved. The capture-time horizon (when, where, mood, what was open) is part of the knowledge.
- **Models are receivers too.** The swarm-and-reword idea in `BIMBY_IDEAS.md` #1 matches the cycle. The model rewords, the person picks, and the pick is the local creation. The reworded sentence is the trigger, the pick is the output.
- **Control criteria are beliefs.** Yolles (p. 360, Table 7.2) says that in complex settings, targets and norms are believed to be well defined, not shown to be. A goal target is the person's belief, so a miss may mean the target moved.

**Suggestions.**

- When an old item resurfaces, show its capture context and offer a one-tap restate in today's words ("re-migration"). First check what day-context data already exists.
- Let Calibration say "the target moved" as well as "missed".

## 5. Idea D. Weak and strong anticipation

- **Weak anticipation:** model-based prediction (pp. 402, 413). Forecasts, "usually ~N", estimates.
- **Strong anticipation:** predictability that comes from structure itself. Habits, standing blocks, rituals.
- **Anticipatory contradiction** (p. 412): the plan expects one thing, the structure does another. His example is a firm that bought an information system and changed no behavior.

**Suggestion.** Treat a slot that is planned and missed again and again as a contradiction between the two. The remedy it points at is structural: move the block, change a pen default, or retire it. More reminders do not fix it. It would sit beside `lib/plan-vs-reality.ts` and obey "one effector speaks per gap per day".

## 6. Idea E. Pathology catalog, observed not diagnosed

Yolles names several failure modes (pp. 406–413). Candidate Brain2 forms, all hypotheses:

| Pathology | Brain2 form | Observable |
|---|---|---|
| Colonization of the lifeworld (money and power replace meaning) | points and grades steering instead of intent | points rise while completions or time fall |
| Myth, false knowledge | stale "I never do X" belief | belief with no recent evidence |
| Arbitrary incremental change, untracked | the system's own settings and structure drift | no record of changes to the system |
| Paradigmatic schizophrenia | contradictory goals or habits | two active commitments that cannot both fit |
| Projective anticipation | reacting to old damage | regret weight against current outcomes |
| Pathological autopoiesis | overhead beats doing | the overhead ratio |

Rules that apply: show counts and dates. Do not label the person. The person decides what a pattern means. Test each signal on own history before it earns a place anywhere.

## 7. Idea F. Habermas's three interests

Yolles builds on three knowledge-constitutive interests (pp. 310–312): **technical** (control), **practical** (understanding), **emancipatory** (seeing the constraints and distortions you act under).

- Technical is covered by analytics, Science and Sanity, and cybernetics.
- Practical is covered by the Jung and meaning work.
- **Emancipatory is the gap.** The question is where a commitment came from: chosen, inherited, or imposed, and what changes if it is dropped.

**Suggestion.** First check whether `lib/capture-origin.ts` already answers "where did this come from". Add a field only if it cannot.

His 3×3 "organizational patterning" table (Tables 6.4 and 6.10, pp. 309, 324) crosses the three interests with motion, direction, and possibility. It could serve as a completeness checklist for a goal or project. It would stay a checklist, not a screen, in line with "a control diagram does not belong on a screen".

## 8. Idea G. Autonomy and structural coupling

For Yolles an autonomous system is perturbed by its environment but does not take its changes from it (pp. 403–405). His list of radical autonomy: own boundaries, own code, own programs, own reproduction of elements, own laws.

For Brain2: Instagram, texts, ActivityWatch, and the phone perturb. They land through the same writes and the same approval gate. They never decide. This matches "the person keeps the means". No new work. It is a way to defend those laws in review.

## 9. Tensions with existing laws

- **No new noun.** Every idea above is a derived view or a checklist. None needs a stored type for a domain, a pathology, or a contradiction.
- **Silence.** The pathology list tempts a dashboard of warnings. The house stays quiet inside the band. Observations are for Data, on request.
- **Meaning is not cause.** Pathology rows are patterns, not reasons. Same rule as `JungBrain2.md`.
- **Third-order cybernetics** (p. 3: observation influences the observed) repeats the Wiener warning that measuring a person changes the person. It supports the optional "show the math" settings.

## 10. Open questions

1. Does an autogenesis rung already exist, in the yearly review or elsewhere?
2. Is there real data to compute an overhead ratio, and does it separate good weeks from bad?
3. Does any single room show a clean S3* gap, or does the lens add nothing there?
4. What would ch. 10 (semantic versus symbolic communication) change for BIM text handling?
5. Is the emancipatory idea one the person wants, or an imported academic frame?

## 11. If any of this were ever chosen

Not a plan. Only a rough order of cost:

- Cheapest, text only: BIMBY viability checklist; the S1–S5 audit of one room.
- Cheap, data first: overhead ratio; anticipatory contradiction flag; capture-context glimpse.
- Needs design: change ledger for the system itself; emancipatory pass; the pathology table as a Data view.
