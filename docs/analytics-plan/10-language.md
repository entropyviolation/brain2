# Build brief — Language

New studio group. It reads sentences the vault already stores. It does not write them, and it does not replace a room that already counts them.

Source of the contract: `docs/analytics-vision/06-language.md`. This brief says how to build that intention. It does not rewrite the inventory.

**Later owner:** one language agent. New files only, plus a lazy entry in `components/Analytics/analytics-views.tsx` once the shell agent has added the view ids below. Do not edit `ReviewsView` or `RegretView` math. A link to those rooms is allowed. Do not edit `analytics-tabs.ts` from this wave; the shell agent owns ids.

## What already stands, and stays

Language is a new room beside two rooms that already count tokens.

| Room | Id | What stays |
| --- | --- | --- |
| Reviews | `reviews` | Help: “Saved period + morning reviews… Blocked-reason mosaic is counts, not a ranking.” `ReviewsView.tsx` is the rituals reader: morning (sun), start slices, end/night body, blocked-reason mosaic (Other shows the typed words), season label on quarter cards, and a dated list of why-it-didn't notes (push, missed task, habit, missed op, and the same ritual tokens) with counts by preset and by source. The mosaic stays the ritual chart. `PeriodArcReading.tsx` stays the week, month, season, and year reflections grouped by ritual headings, with inspiration photos from the attachment store. |
| Regret | `regret` | Help: “Accrued cost of important items sitting undone past due. Not a to-do list.” `RegretView.tsx` stays that ledger. The regret token is a copy of the preset onto the ledger. The free-text note stays on the review. |

Those pictures already answer “how many, of which token.” Language reads the same fields beside them. It does not recompute the mosaic, the dated why-it-didn't list, the arc headings, or the accrued cost.

Existing ids this group must not collide with: `reviews`, `regret`, `reflection`, `log`. Groups that already exist stay `behavior`, `time`, `accuracy`, `meta`, `library`. Meaning stays its own reserved group.

## Proposed view ids

A new group, **Language**. Suggested group id: `language`. Views, in this order:

| Id | Label | Corpus |
| --- | --- | --- |
| `gratitude` | Gratitude | Morning, evening, and start-of-period gratitude lines |
| `why` | Why | `Task.why`, with `Task.consequences` as the neighboring sentence |
| `why-not` | Why I didn't | Preset mosaic, then Other notes as the language corpus |
| `plan-prose` | Plan prose | Submitted day, week, month, and season plan entries |
| `other-prose` | Other prose | Each remaining field in §3.5, one corpus at a time |

Help for each id, when the shell adds it, names the corpus, says the classical picture is first, and says a further reading is a guess about the prose. One honest sentence per view, matching `ANALYTICS_TAB_HELP`.

## How every corpus is shown

Two layers, in this order. A person can stand on the classical picture with further reading closed. Closing it hides sentiment, clusters, model themes, and neighbors. It does not hide the lines, the counts, or the cloud that belongs to the classical layer.

**Classical, first.** Volume. Delay between the writing stamp and the day the words are about. Repeated phrases longer than one word. Exact find, then a small calendar of hits. Lists in the order they were written. Preset tokens as a partition, with `n`. These pictures do not guess.

**Further reading, closed by default, only on corpora that are actually prose.** Same family on every prose corpus. A method earns a place by answering a question the lines can support, and by staying labeled.

- **Sentiment, and later valence / arousal / lexicon scores.** A drift across the lines of that corpus. Caption: a guess about the prose. Never written back onto a mood pen, a joy point, a completion, or a claim that a plan was followed. A mean with half the lines unscored says how many were scored.
- **Machine learning on this vault’s own lines.** Phrase statistics, topics, classifiers, clusters. A cluster is a grouping. The lines that made it stay visible. A label the model invented is marked invented.
- **Large language models.** Group, compare, summarize, or propose a theme for a span the person asks about. A dated reading. Dismissible. Saving a sentence means the person kept it. Hosted or on-device. Each reading names the method. The vault text is the input. The reading is not stored as if it had been typed.
- **Vector embeddings.** Search and comparison: neighbors of this line, lines that resemble this span, how a corpus moved from one period to the next. Similarity is not a cause. Default neighbor search stays inside the same field. Crossing fields is an explicit comparison captioned with both names.
- **Show `n`.** A theme on three lines says three. No forecast from a thin corpus. No single language score for a day.

The sentence stays the record. A reading is derived. It does not become a pen, a mood, a phase, a completion, or a new line the person did not write.

**Word cloud, where a cloud is named below.** Size follows count after a light normalize that does not rewrite the stored line. “Quiet stacks” and “quiet stacks ” group. Show the newest spelling. Two clouds when a cloud is wanted: everyday function words set aside, and function words kept, so “the” and “I” are available and are not the accidental finding. The cloud is a way in. The line is what was written.

## Corpora

Each corpus stays its own corpus. Pooling is a toggle, and only where this brief names a toggle. The default is unpooled.

### `why` — Why I want to do it

Unit: one `Task.why`, joined to that item’s title, list, and whether the item was finished. Empty `why` stays empty. Do not infer a motive from the title.

**Classical.** The lines themselves, newest spelling when two wordings collapse under the light normalize. Repeated phrases. Exact find. `n`.

**Neighboring sentence.** `Task.consequences` can sit on the same card. It is not pooled into the why corpus. It is not the reason the task was skipped.

**Further reading.** Recurring reasons by embedding neighborhood. Clusters (“people,” “money,” “the body,” “because I said I would”) whose names are not stored as the reason. Sentiment of the why-line as a guess, beside importance / resistance / excitement when those numbers exist. The numbers were asked. The sentiment was inferred. The card says which is which. Search: “lines like this why.”

### `why-not` — Why I didn't

Two layers. They are not one soup.

**Tokens, classical, and first.** Presets the person chose: `no-energy`, `missing-input`, `procrastination`, `no-time`, `blocked-by-other`, `other`. The picture is the mosaic: counts, by period, by task, with `n`, and the share that is Other-with-words versus Other-blank. Sources that already carry this shape stay labeled as sources, not merged into one sentence: `PeriodReview.blockedReasons`, `SchedulePlacement.missReason` (dismiss does not write it), `Task.missReason` beside `missedAt` (not `Task.why`), `TaskCompletion.missReason` (a free string; grades do not read it), `OperationReview.blockedReasons` (after-action sentences stay on `summary`, `whatWorked`, `whatFailed`, and `lessons`), and `RegretEntry.reason` (the token only). A bar of tokens does not pretend a one-word preset is a paragraph. Other with no note is a count, not a sentence.

This mosaic is Language’s own reading of those fields. It does not replace the Reviews mosaic or the Regret ledger. Link to `reviews` and `regret`. Do not reimplement their charts.

**Notes, the language corpus.** Words typed under Other, and any later free-text reason for an action not taken. A cloud of notes must not swallow the six tokens. Notes in the order of the nights they were written, each still tied to the task title. Then the further reading: cloud (both function-word modes), sentiment as a guess about the notes and never a substitute for the token the person picked, clusters, neighbors across weeks, and a dismissible theme for a span the person asks about.

### `gratitude` — Gratitude

Unit: one line in a list.

| List | Where |
| --- | --- |
| Evening | `PeriodReview.gratitude` |
| Morning | `PeriodReview.morning.gratitude` (often ten lines) |
| Start of period | `PeriodReview.start.gratitude` (week and longer) |

Morning, evening, and start-of-period stay distinguishable. Pooling is a toggle, not the default. Ten short morning lines and one evening paragraph are not the same gesture.

**Classical.** The lines, in the order written, with the period key. Repeated phrases. A calendar of days and longer periods that have a list, and the length of each list. Morning beside evening when both exist for the same day. A word cloud is wanted, both function-word modes. `n`.

A night-review gratitude list is not stamped with a source. The cloud exists on the gratitude itself. Do not cross it with the next day’s habits, and do not caption it as Telegram. BIM text-pipeline labeling stays where Reviews already shows it; Language does not invent a channel.

**Further reading.** Sentiment across periods, labeled as a guess about the lines. An embedding map inside gratitude: neighbors, clusters, and a comparison of one span of lists to another. A model theme for a span the person asks about, dated, and dismissible.

### `plan-prose` — Day, week, month, and season plan text

Unit: one submitted entry’s `text`, joined to its period key, its `createdAt`, and its `stampSuffix` when present.

| Log | Key |
| --- | --- |
| Day | `dayPlan-${YYYY-MM-DD}` |
| Week | `weekPlan-${monday_sunday}` (an older ISO week key aliases onto it) |
| Month | `monthPlan-${YYYY-MM}` |
| Season | `quarterPlan-${YYYY-Qn}` |

Each entry is `{ id, createdAt, text, stampSuffix? }`. `text` is immutable after submit. `createdAt` is when it was written, which may be another day. `stampSuffix: "from text"` is a message (`plan for rn` and the morning ritual). Ordinary Submit omits it. The morning ritual’s `dayPlanText` is the paragraph that was appended to `dayPlan-*`, not a second corpus.

Day, week, month, and season stay distinguishable. Pooling a day plan into the week plan that contains it is a toggle, not the default. They are different documents that share a calendar. A day plan may sit beside the week plan and the month plan that cover that day, as three texts. That side-by-side is a comparison of documents.

**Classical.**

- How many times the period was rewritten (entry count). A later entry does not record that it replaces an earlier one. Both remain.
- Lead: `createdAt` against the start of the period the words are about.
- Desk submits versus `from text`.
- A draft sitting unsent, shown as a draft. Drafts stay drafts. They are not mixed into the submitted log.
- Module-sync lines (`• {item title} [{module title}]`) are their own labeled cloud and their own count. The link to the item is the sentence, not an id. They do not enter the cloud of the person’s paragraphs.
- Volume of the person’s paragraphs. A word cloud is one picture of those paragraphs, both function-word modes. Newest spelling when two wordings collapse under the light normalize. Repeated phrases. A calendar of days, weeks, and months that have a log, and how long each log is.

Empty log is empty. A month-key tombstone (empty string on the key) is “no plan,” not a paragraph to score. Do not infer a theme from scheduled task titles.

**Further reading**, on the person’s submitted paragraphs only.

- Sentiment across periods of one grain, labeled as a guess about the writing. It is not adherence, and it is not how the period felt.
- An embedding map within one grain: this week’s plan near that week’s, this October near last October. Neighbors are other plan entries, not gratitude lines and not why-lines, unless the person asks for a cross-corpus comparison and the card names both corpora.
- A model theme for a span the person asks about, dated, and dismissible. It does not become a new plan entry.

Do not extract tasks, clocks, or places out of a paragraph onto the calendar. Inbox dates parsed at capture are already a different path. Do not turn a sentence into an Activity pen, a location, or a mood.

`PeriodReview.planReflection` and `nextPlans` use the same period keys and are not this log. Laying a reflection beside the plan is a comparison of two texts. It is not a score of whether the prose was followed.

### `other-prose` — The other stored prose

Each field is its own corpus. The view is a picker of those corpora, not one blended cloud and not one score for the day. Classical counts first. Further reading beside them, closed until opened. A neighbor search defaults to the same field. Crossing fields is an explicit comparison, captioned with both names.

| Corpus | Where it lives | Unit | First picture |
| --- | --- | --- | --- |
| Day notes | `brain2-tracking-day-notes` | One append entry’s `text`, with `createdAt` against the day key | Volume, and the delay between writing stamp and day key. Then the prose tools, including a cloud. |
| Thought process | Activity instant, `eventKind: "thought-process"` | The title and the note | Clock order. A strand through a minute (what you are doing, what you expect next, how it lands). A cloud is not the first picture. Sentiment and neighbors may sit beside the list, labeled. |
| Review summary | `PeriodReview.summary` | One paragraph for that period | The paragraph, then the prose tools. |
| Plan reflection | `PeriodReview.planReflection` | One paragraph | Own corpus. Not the plan log. |
| Next plans | `PeriodReview.nextPlans`, and `start.nextPlans` | What the ritual said would come next | Own corpus. Not the plan log. |
| Went well / improve / learned | `PeriodReview.reflections` | One answer per question id | The three questions stay separate. |
| Longer arc | `PeriodReview.arc` | One answer per question (wins, lessons, obstacles, joy, fear, and the rest) | Each question is its own small corpus. Photos on `inspiredPhotos` are not text. `PeriodArcReading` still owns the ritual grouping; this view reads the answers as prose beside that. |
| Morning intentions | `morning.intentions` | A list of lines | Same list pictures as gratitude, including a cloud. |
| Week-and-longer intention | `start.summary` | One paragraph | Kept separate from morning intentions. |
| Affirmations | `morning.affirmations` | The lines shown and kept | Distinct from intentions. |
| Must not / excited | `morning.mustNotDo`, `morning.excitedAbout` | One field each | Short field. Empty stays empty. |
| Wake reminder, what matters, time note | `wakeReminder`, `tomorrowMatters`, `timeReflection` | One short field each | Short field. Empty stays empty. |
| Start priorities and must-do | `start.priorities`, `start.mustDo`, `start.undoneNotes` | Planning prose for the coming period | Not the plan log. |

`bestDayWhy` (`PeriodReview.morning.bestDayWhy`) is one prose field, not a list. It belongs on this view as its own corpus (why a best day would be a best day), not inside gratitude.

## Implementation notes

Still a brief. No code in this file.

- **New files only.** A language view module (and a pure reader/normalizer beside it, with tests) under `components/Analytics/`. One lazy chunk per view in `analytics-views.tsx`, wired only after the shell agent has added `language` / `gratitude` / `why` / `why-not` / `plan-prose` / `other-prose`. Do not fork Reviews or Regret helpers. Do not edit `ReviewsView.tsx` or `RegretView.tsx`.
- **The sentence stays the record.** Readings are derived and cached as labeled readings. They are not canonical fields. Cache entries name the method, the model or lexicon, the corpus, the span, the date of the reading, and `n`. Dismiss removes the reading. A sentence the person saves is a sentence the person kept, stored as their own note, not as a plan entry, a why, a gratitude line, or a blocked reason.
- **Do not write back.** Never onto a mood pen, a joy point, a completion, a grade, a phase, or a plan log. An embedding is derived. It is not a canonical field.
- **Normalize for the cloud only.** Light normalize for grouping (trim, case-fold). Show the newest spelling. Do not rewrite the stored line.
- **Empty stays empty.** No inferred motive from a title. No theme from scheduled task titles. A tombstone month key is “no plan.” Other with no note is a count. A thin corpus gets `n` and no forecast.
- **Studio kit.** Plates, mosaic, density calendar, and lists already in the studio. A word cloud is the one new picture, in a white plot well, size by count. Further reading sits on a plate that can be closed. Help names the corpus and the guess.

## What this room refuses

A clever reading that the person cannot trace back to the lines.

An embedding distance sold as a cause.

A model paragraph stored as if it were gratitude, a why, a reason for skipping, or a plan entry.

A word cloud as the only view of a list or a plan log, or as the first view of a thought-process strand.

A cloud of notes that swallows the six tokens.

A single language score for a day, mixed from why-lines, skip notes, gratitude, and the plan.
