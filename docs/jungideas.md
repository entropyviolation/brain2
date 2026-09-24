# Jung × Brain2: Parallels and Roadmap

Sep 23, 2026 · @allie

Source essay. The build order is [`JungBrain2.md`](JungBrain2.md). How this sits with the map and the loop: [`MAP_LOOP_MEANING.md`](MAP_LOOP_MEANING.md). Execute the build file. Do not re-sequence the work from this essay. Product chrome never names Jung.

## Why Jung maps onto Brain2

Brain2 already runs two engines that Jung spent his late work putting side by side. The causal engine is its statistics: Calibration, Observatory's Pearson findings, streaks and plan-vs-reality. The meaningful engine is its item graph, where any record can be linked to any other by sense rather than by cause. Synchronicity argues that a full picture of a life needs both. The Stages of Life argues that the right balance between them changes as a life goes on.

**Sources.** *Synchronicity: An Acausal Connecting Principle* (Collected Works vol. 8, tr. R. F. C. Hull, Princeton/Bollingen 1973), read from `litrefs/Jung - Synchronicity.pdf`. Page numbers are the printed pages. *The Stages of Life* (in *Modern Man in Search of a Soul*, 1933) could not be read from `litrefs/modern-man-in-search-of-a-soul-stages-of-life-1.pdf`: about 4.4 million of its 19.8 million bytes are Unicode replacement characters, so it is corrupted. Points from that essay are paraphrased from general knowledge of it. They carry no page numbers and are marked (Stages).

**How to read this.** Each parallel gives the text first, then the Brain2 surface it matches, with a file path where one exists. The house style of [`ScienceandSanityBrain2.md`](ScienceandSanityBrain2.md) applies: a finding describes events, derived values stay labeled, and nothing here claims Jung is right about ESP or astrology. What Brain2 borrows is his method: take the rare, meaningful exception seriously without calling it a cause.

## Parallels from Synchronicity

Brain2 matches 19 of the book's structural ideas. The strongest overlap is how it treats statistics: Jung wants a rule-finder that still respects the exception, and Analytics already works that way.

1. **Two kinds of connection run through every event.**
   - Text: Following Schopenhauer, each event in a life sits in two chains at once. One is the objective causal chain. The other is a subjective connection that exists only for the person living it (pp. 20–21). Schopenhauer drew these as meridians crossed by parallels.
   - Brain2: Every Item has causal edges (dependencies, the critical path in `lib/critical-path.ts`, parent tasks, molecular steps) and meaning edges (tags, typed links, related items, counts-as chains). The Scheduler draws the meridians. Links and tags draw the parallels.

2. **Causality is only statistically true.**
   - Text: Natural laws are statistical truths, so the causal principle is only relatively valid. That leaves room for connections of another kind (pp. 14–15).
   - Brain2: Observatory shows Pearson r, never a cause, and watermarks findings with n below 7. Calibration reports a band, not a verdict. The app already treats its own rules as statistical.

3. **Experiments throw away the unique event.**
   - Text: The experimental method looks for repeatable events, so unique or rare events are ruled out. Every answer is shaped by the question asked (p. 15).
   - Brain2: Averages on Calibration and Habits hide the single day that mattered. Only the item History tab (`lib/item-activity.ts`), Docs and the morning review keep one-off events in full. That is the gap the features in [`JungBrain2.md`](JungBrain2.md) fill.

4. **The exception is as real as the rule.**
   - Text: In the astrology chapter, Jung calls the statistical picture one-sided. It shows only the average and leaves out the whole, so chance maxima and minima are facts worth studying (p. 56). Later he says the world is real, not statistical, and statistics need their exceptions to make sense (p. 71).
   - Brain2: Cross-section and the density calendars already show outlier days as cells. Nothing yet asks what was different about them. Outliers are rendered but never interviewed.

5. **Runs and series.**
   - Text: Kammerer's "law of series" collected clusters of repeated events. Jung notes they usually fall within chance, yet leave a strong impression (pp. 17–19).
   - Brain2: Streaks (`StreaksWidget.tsx`), duplicate-capture detection in BIM ("see / again / dismiss") and Markov transitions in `signal-stats.ts` all count runs. None separates a meaningful run from a mechanical one.

6. **Numinosity grows with the length of a series.**
   - Text: Jung's fish series reached six events in 24 hours, then a seventh as he wrote about it. The sense of meaning grows with the number of terms (p. 19 and note 10).
   - Brain2: A tag or word that turns up across Inbox, Docs, BIM texts and Tracking in one day is a fish series. The vault holds that data; no view counts cross-room recurrences yet.

7. **Interest drives the result; boredom kills it.**
   - Text: In Rhine's card tests, scores dropped after the first attempts and rose again when interest was renewed. Boredom was a negative factor and hope a positive one (pp. 27, 33). Rhine needed a constant renewal of interest (p. 74).
   - Brain2: This is the ADHD design problem the app is built around. Today's friend rotates missions, habit gems and points reward the week, Just Start uses a 2-minute timer, and the design style asks for an "impossible" motion now and then. Novelty is treated as fuel.

8. **Affect narrows consciousness and lets the unconscious in.**
   - Text: Archetypes carry a specific charge that shows up as affect. Affect brightens one content and darkens the rest, an abaissement du niveau mental that opens a gap for the unconscious (p. 29).
   - Brain2: Mood pens, the Mood field view (`MoodFieldView.tsx`) and the four post-mortem scales (satisfaction, resistance, focus, distraction) measure that narrowing. Nothing links a spike in affect to what was captured during it.

9. **The "impossible" situation is where change starts.**
   - Text: The scarab arrived when treatment had stalled and three doctors had failed. Jung says archetypal material appears most reliably when a person is stuck in a rationally insoluble impasse (pp. 32–34).
   - Brain2: Regret (`RegretView.tsx`) and the Overcommit warning find the impasse: important items sitting undone and days pushed again and again. Just Start answers it with the smallest step. The text suggests another response: an irrational prompt when rational pushing has failed.

10. **The definition: a psychic state meets an outer event of the same meaning.**
    - Text: Synchronicity is a coincidence in time of two or more causally unrelated events with the same or similar meaning. Jung separates it from synchronism, which is mere simultaneity (p. 34).
    - Brain2: Cross-section lines up many stores on one date axis. That is synchronism. Synchronicity would require a shared meaning, such as a tag, type or word, across two causally unrelated records.

11. **An omen is built from earlier coincidences.**
    - Text: The wife read the birds as a death omen only because two similar coincidences came before. At the grandmother's death there was no omen yet, just the coincidence (p. 35).
    - Brain2: A pattern needs a dated history before it counts, which is the rule behind Analytics' sample floors and the "usually ~N" glance. Brain2 applies it to durations. Jung applies it to meanings.

12. **The unconscious often knows more than consciousness.**
    - Text: Jung suggests the wife's unconscious had already sensed the danger (p. 35). He later speaks of an a priori knowledge, an immediacy of events with no causal basis (p. 40).
    - Brain2: Implied actions, `FieldEstimate` values and the est. chip let the system know something before the user confirms it, and label it as unconfirmed. That is the right form for any "the vault noticed this" message.

13. **Space and time are psychic co-ordinates.**
    - Text: Space and time are concepts made by the discriminating conscious mind, essentially psychic in origin, and they become elastic in these experiments (pp. 28–29).
    - Brain2: The Tracking pen paints time as the user experienced it, with counts-as nesting places inside places ([`COUNTS_AS.md`](COUNTS_AS.md)). The period cursor and custom analytics ranges let the user set the frame.

14. **Grasp the whole situation, not the detail.**
    - Text: The I Ching sees the detail as part of a whole and relies on sensation and intuition. It is an experiment-with-the-whole that imposes the fewest conditions (pp. 43–45).
    - Brain2: Cross-section and the Observatory are the whole-picture views. The morning review's circumstances, best day and gratitude fields gather the whole day before any ranking starts.

15. **Mantic methods create the conditions for meaning.**
    - Text: Oracles work by stirring interest, curiosity, expectation, hope and fear. That emotion tips the balance toward the unconscious (pp. 74–75).
    - Brain2: The Affirmations ritual draws five random lines from a list, and Module randomizers and today's friend pick by chance. Brain2 already uses chance to start motion. It does not yet use chance to start reflection.

16. **The subject's state shapes what chance selects.**
    - Text: In the astrology experiment, three people chose horoscopes by lot. Each set's excess matched the chooser's emotional problem: Mars for intense emotion, the ascendant axis for asserting personality, sun–moon conjunction for uniting opposites (pp. 67–68).
    - Brain2: What a person captures, tags and skips on a given day reflects their state. Calibration by list and type already shows that estimates bend with context. Mood-conditioned views would show how other patterns bend.

17. **The microcosm reflects the whole.**
    - Text: Leibniz called souls living mirrors of the universe, and the tradition treats each person as a microcosm (pp. 84, 93).
    - Brain2: The first law of the README says an item is captured once and used in every room it can serve. Each room is a mirror of the same graph, and a module is a new mirror.

18. **The quaternio adds a fourth principle beside cause.**
    - Text: Space, time and causality become a quaternio with synchronicity added. Jung and Pauli's version sets causality against synchronicity (pp. 107–109). New viewpoints tend to come from out-of-the-way, disreputable places (p. 108).
    - Brain2: The Analytics studio has groups for causal and temporal views. It has no group for acausal views: coincidence, recurrence, symbol. Brain2's own out-of-the-way places, such as dreams in the morning review, phone notes and parked captures, are where that group would draw from.

19. **Acts of creation in time.**
    - Text: Psychic orderedness differs from the timeless order of numbers because it happens as acts of creation in time. That is why Jung stressed time and chose the word synchronicity (pp. 110–112).
    - Brain2: Everything in the vault is dated, and Brain2 treats dating as law. A synchronicity layer would keep the moment itself as data, not only the item.

## Parallels from The Stages of Life (Stages)

The essay reads as a spec for Brain2's period system. A life has phases with different aims, a problem is never finished, and what worked in the morning fails in the afternoon. Brain2 handles days through years well. It has nothing yet for the arc of a whole life. Points are paraphrased; see Sources above.

1. **Problems come with consciousness.**
   - Text: Instinct needs no problems. Problems begin when consciousness separates a person from nature, and each one brings both a chance to widen consciousness and a loss of childlike unconsciousness.
   - Brain2: Capture is how a vague unease becomes a problem. The Inbox, BIM and Quick Add turn felt pressure into named items. That act is the step from instinct to consciousness.

2. **A serious problem is never fully solved.**
   - Text: Jung says the meaning of a problem lies in working at it continually, not in solving it. A solution that ends the work can dull a person.
   - Brain2: Objectives in Goals have no target and no deadline by design ("Read a lot", "Be healthy"). Habits recur. GS-9's graded completion replaces done/not-done with degrees. The app already refuses to call a life direction finished.

3. **The ego grows out of continuous memory.**
   - Text: In early childhood consciousness exists as scattered islands. An ego forms when those islands join into a continuous memory.
   - Brain2: This is the time-binding purpose in [`ScienceandSanityBrain2.md`](ScienceandSanityBrain2.md): History, reviews and the handoff join each day to the last so the next self does not restart from zero.

4. **Youth restricts itself to the attainable.**
   - Text: The first half of life asks a person to establish themselves in the world. They succeed by narrowing to what can be achieved, and many parts of the personality are left in storage.
   - Brain2: Prioritized objectives (with the per-period cap `MAX_PRIORITIES_PER_PERIOD`), 3–5 morning priorities and points multipliers are all tools for narrowing. The Direction report's "neglected" list is the storage room: objectives left unserved.

5. **Natural aim, then cultural aim.**
   - Text: The first half serves nature: work, family, standing. The second half serves culture: meaning, reflection, the inner life.
   - Brain2: Points, streaks and plan-vs-reality measure the natural aim. Reflection scores, Docs, Source and Belief types (`lib/belief-strength.ts`) and period reviews serve the cultural aim. Both are present; nothing weighs one against the other.

6. **The afternoon cannot run on the morning's program.**
   - Text: Jung's sun rises, peaks at noon and then descends. Values that were right in the morning of life turn false in the afternoon, and holding on to them causes the crises of middle age.
   - Brain2: Objectives, habits, affirmations and list rules persist until someone edits them. There is no review that asks whether a standing rule still fits the current season of life.

7. **Opposites reverse in midlife.**
   - Text: Jung observed traits swapping in the second half of life, with long-neglected sides of a person coming forward.
   - Brain2: Direction coverage and the 30-day lamp tape show which objectives are served or drifting. Over years the same data would show a reversal as neglected objectives rise and dominant ones fade.

8. **The unlived life returns.**
   - Text: What was pushed aside to meet youth's demands does not go away. It comes back later as restlessness or symptoms.
   - Brain2: Regret measures the cost of important items left undone, and Parked items and archived lists hold the rest. Brain2 can already show the unlived life. It just never shows it as one body of material.

9. **There are no schools for forty-year-olds.**
   - Text: Jung says there is no training for the second half of life. People enter the afternoon with the morning's tools.
   - Brain2: Reviews teach a person their own day, week and year. A longer review on the scale of life seasons would be a school for the afternoon, written from their own record.

10. **Death as a goal, not an end.**
    - Text: Jung treats the second half of life as a descent toward a goal. Someone who refuses the descent stays stuck at noon, and staying alive in later life means going along with that curve.
    - Brain2: Each period review closes a period on purpose. Archive, completion and post-mortem let things end with a record rather than be dropped. The same design would let whole chapters end.

## Parallels in Brain2's processes and future

Several of Brain2's own processes and plans already follow the book's shape, including the rename, the vault and the module platform.

| Brain2 process or plan | Jung's idea | Where it lives |
| --- | --- | --- |
| Rename from Cogs to Brain2, with cogs kept in persist keys | A symbol of rebirth arrives at a stuck point (the scarab and Khepri, p. 32). The old name still works underneath, like the old film under the new exposure (p. 24). | `lib/app-brand.ts`; README naming note |
| Vault pinned so a rename cannot wipe lists and habits | Continuous memory makes a self. A break in memory takes identity with it (Stages). | Electron vault pin, commit `f43f3ec` |
| One Item noun in every room | The microcosm: each part mirrors the whole (pp. 84, 93). | README law 1; `lib/types.ts` |
| Analytics as the heart | The statistical method, useful and one-sided at once (pp. 56, 71). | `components/Analytics/` |
| Labeled estimates, never asserted | Knowledge that comes before confirmation, shown as knowledge the conscious mind has not confirmed yet (p. 40). | `lib/estimated-values.ts`, est. chip |
| Module install wizard; an LLM maps once, then the module runs deterministically | A tertium comparationis: a shared form lets two unrelated systems line up (the I Ching's even and odd numbers, p. 45). The manifest is that shared form. | `MODULE_PLATFORM.md` |
| Today's friend: chance picks, a personality, missions | Mantic procedure: chance plus expectation calls up the unconscious (pp. 74–75). The animal is a guide figure. | `lib/friend-*.ts`, `FRIEND_COMPANION.md` |
| Morning review logs dreams | Dreams carry the earliest signal of what is coming. The scarab dream came the day before the beetle (pp. 31, 40). | `components/Reviews/MorningReview.tsx` |
| Journal-page OCR and phone-note parking | Out-of-the-way places, where new viewpoints show up (p. 108). | `MESSAGE_INGEST.md` |
| Design style: a vintage machine that knows it is a painting, with rare impossible motion | The numinous: a rare charged moment that breaks routine attention and renews interest (pp. 19, 33). | `DESIGN_STYLE.md` |
| Time-binding handoff (GS-6) | The ego as a chain of memory islands joined over time (Stages). | `ScienceandSanityBrain2.md` |
| Thin-window refusal: n shown, below the floor withheld | Jung's own care: the fish series stays chance until it exceeds probability (p. 19). | `analytics-range.ts` `SAMPLE_FLOORS` |

Where Brain2 goes past Jung: it refuses to treat any coincidence as evidence, and it should keep that refusal. The features in [`JungBrain2.md`](JungBrain2.md) show meaning without claiming a cause, which Jung himself asks for when he calls synchronicity acausal orderedness rather than an archetype's effect (p. 110).
