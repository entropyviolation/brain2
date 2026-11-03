# 13 — Local readings

_Last mapped: 2026-10-28._

How the Data tab may group and compare sentences the person already wrote, with tools that stay on this machine. This brief does not change a view, a store, or a chart. It narrows [`10-language.md`](10-language.md) and [`docs/analytics-vision/06-language.md`](../analytics-vision/06-language.md): those files allowed a hosted model. That is no longer in scope.

## Law

Free and local only. No API key, no hosted model, no vault text leaving the machine.

A reading is a guess about prose that is already stored. It does not become a pen, a mood, a grade, a phase, a completion, a why, a blocked reason, or a plan entry. It does not write a sentence back as if the person had typed it. Classical counts stay the record. The sentence stays the sentence.

Opening Data, and every chart that already ships, works with these tools absent. A missing local model is an empty frame with one sentence, not a failure of the list beside it.

## First reading — groups of why it wasn't done

The corpus already exists. `lib/miss-reason-corpus.ts` builds one dated list for the analytics window: push placements, missed tasks, habit miss notes, missed operations, and ritual blocked reasons. Data → Reviews already draws that list, the preset mosaic, and the counts by token and by source. Those three stay. This reading sits under the list.

**What gets grouped.** The longform note, not the preset.

| Kept out of the groups | Why |
| --- | --- |
| The six tokens (`no-energy`, `missing-input`, `procrastination`, `no-time`, `blocked-by-other`, `other`) | The person already chose these. The mosaic counts them. |
| Other with no note | A count, not a sentence. |
| A habit `missReason` that is only a preset label | Same partition. |

**What goes in.** The words after a preset (`No energy — couldn't get out of bed`), a ritual Other note, a habit miss note that is not just a preset label, and the same shape on a push, a missed task, and a missed operation. Each line stays tied to its date, source, and subject (the item or habit name). Sources are not merged into one sentence. They can sit in one grouping because the question is the same: why the thing was not done. The card names the sources in the group.

Empty stays empty. Do not invent a reason from the item title.

### How a group is made

Three layers, in this order. Each layer names itself. A later layer does not hide an earlier one.

1. **Repeated phrases.** Trim and case-fold for the match only. Show the newest spelling. A phrase has to be longer than one word, and it has to occur on more than one note. This needs no model. If the same words keep coming back, this is the finding.

2. **Term groups.** Bag of words on the notes in the window (term frequency, common function words set aside). Cosine distance, agglomerative, a fixed distance cut rather than a chosen number of groups. A group needs **3** notes. The corpus needs **8** prose notes in the window before any group is drawn. Below that, the plate says how many notes it has and draws nothing else. Singletons stay listed as still on their own, not forced into a group. The label of a group is the distinctive words in its notes. Those words are a caption, not a stored reason.

3. **Embedding groups.** Same cut, same minimums, on vectors from a local model. This is the layer that can put “couldn't get out of bed” near “too tired to start” when the words do not match. Similarity is not a cause. The plate says which model made the vectors. If that model is not installed, layer 2 remains and the plate says the embedding pass is waiting.

New notes join a neighborhood or stay alone. They do not rename yesterday's group. Cache the vector by a hash of model id plus the exact text, outside the vault (IndexedDB is enough). The cache is derived. Deleting it changes nothing the person wrote. A different model is a different cache.

Do not pick a fixed *k*. Do not forecast. A group of three says three. Show every line in the group.

### Where it appears

One new plate under the existing why-it-didn't list on Reviews. The mosaic, the token counts, the source counts, and the dated list do not change. The plate can be closed. Closed, Reviews looks as it does today.

The math of the groups lives in a new pure module with tests that feed fixture vectors. Tests do not need a model process. Reviews keeps owning the list. The later Language room (`why-not` in [`10-language.md`](10-language.md)) reuses this module. It does not grow a second corpus.

### What runs it

| Piece | Choice |
| --- | --- |
| Phrase and term groups | TypeScript in the app. No install. |
| Embeddings | [Ollama](https://ollama.com) on this Mac, `http://127.0.0.1:11434` only. Model: `nomic-embed-text` (a one-time local pull). The same daemon the Texts report already uses for chat (`scripts/texts-analysis/llm_pass.py`). Vault notes do not go through the Texts server or the Texts jobs. |
| Naming a group | Optional, and only when asked. A local chat model already used by Texts (`qwen2.5:14b-instruct`, or whichever local instruct model is present) may propose a short label. The label is marked invented, dated, and dismissible. It is not saved onto the note. |
| When it runs | A **Group these notes** control. Not on tab open, and not on a timer. Data stays quick when Ollama is off. |

No Transformers.js in the app bundle for this pass. A second runtime is a later choice if a daemon is the wrong host. Until then, phrase and term groups are the reading that always works.

## Other readings, same law

Same engine, one corpus at a time. Do not pool them into a score for the day. Do not put an embedding on the Links tab. Neighbors default to the same field.

Worth doing, after the why-it-didn't plate is honest:

1. **Neighbors of one note.** Pick a why-it-didn't line and list the nearest others, with the distance labeled as similarity. This is the question the vectors answer on a small corpus, before a group of three exists. Same plate, same button.

2. **Why I want to do it.** `Task.why`, joined to the item title and whether it was finished. Own groups. `Task.consequences` can sit beside a line and is not pooled in. Do not infer a motive from the title.

3. **Gratitude, span against span.** Morning, evening, and start-of-period stay separate unless a toggle says otherwise. Compare the center of one month's lines to another month's. The caption is “these lines sit near those,” with `n` on each side. It is not a mood and not a grade.

4. **Plan prose, one grain.** This week's submitted plan near other weeks, this month near other months. Day, week, month, and season stay separate by default. Module-sync lines (`• title [module]`) stay out of the person's paragraphs. Do not pull tasks or times out of a paragraph.

5. **A lexicon beside the groups.** A small word list in the repo (valence only), counted locally, captioned as a guess about the wording. No download. Never written onto a mood pen or a completion. Show how many lines were scored.

6. **A theme when asked.** One span, one corpus, one local chat call. Dated, dismissible, `n` visible. Saving a sentence means the person kept it as their own note, not as a plan entry or a blocked reason.

7. **Habit prioritize-why.** `WeeklyTask.priorityEvents[].reasoning` on manual presses only. Dated lines first. Groups only once that corpus itself has 8 prose notes. Grades and priority weight do not read it.

8. **After finishing.** Completion-review prose (`feelings`, reflect notes) is its own corpus: what was written once the item was done. It is not mixed into why it wasn't done.

Later, and only as search: a box on one corpus, “lines like this.” Crossing corpora is an explicit comparison that names both.

## Refused

A hosted model, including a “free tier.”

A group label stored as the reason the item was skipped.

Predicting whether an item will be finished from its text.

Ranking items, links, or search by an embedding.

Fine-tuning a model on the vault.

One language score for a day, mixed from why-lines, skip notes, gratitude, and the plan.

A cloud of notes that swallows the six tokens.

Running the Texts conflict or mood jobs on these notes.

## Build order

Still a brief. No view change in this file.

1. Pure grouper (phrases, term groups, and the same cut on supplied vectors) and tests. No UI.
2. The Reviews plate, mounted under the existing list, with Group these notes. Ollama embeddings when `127.0.0.1:11434` answers, term groups otherwise.
3. Neighbors of one note, on that plate.
4. The other corpora above, one at a time, reusing the grouper. Each waits for its own 8 notes.

Do not edit the mosaic math, `ReviewsView` list rendering beyond the mount, or `RegretView`. Do not add a canonical field.
