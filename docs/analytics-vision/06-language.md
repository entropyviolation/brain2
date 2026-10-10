# Analytics vision — Language

This is an **intention**. It is not a surface that ships, and it is not a claim that a model has already read the vault.

The other files in this folder say what Tracking, Habits, Plan, Now, and Telegram already store, and which classical pictures those records can support: counts, calendars, joins, exact find. This file says how the **sentences** inside those records should be read. The classical pictures stay. Beside them, the same text is meant to be read with sentiment analysis, machine learning, large language models, vector embeddings (search and comparison), and later methods of the same family.

The sentence stays the record. A model reading is a labeled reading. It does not become a pen, a mood, a phase, a completion, or a new line the person did not write.

---

## 1. What is already written

These fields exist. The tools below read them. They do not invent a second copy.

| Corpus | Where it lives | What the person was answering |
|---|---|---|
| Why I want to do it | `Task.why` | Why this task needs to be done. |
| What happens if I don't | `Task.consequences` | The neighboring sentence. It is not the reason the task was skipped. |
| Why I didn't (ritual) | `PeriodReview.blockedReasons` | Task id → a preset token (`no-energy`, `missing-input`, `procrastination`, `no-time`, `blocked-by-other`, `other`), or `{ reason, note }` when there are words. Blank Other is the token `"other"` and is not a paragraph. |
| Why a push left | `SchedulePlacement.missReason` | The same preset or `{ reason, note }` on the placement being left. Dismiss does not write it. |
| Why a task was missed | `Task.missReason` | The same shape, beside `missedAt`. Not `Task.why`. |
| Why a habit cell was missed | `TaskCompletion.missReason` | A free string (typed note, or the preset label). Grades do not read it. |
| Why a habit was prioritized | `WeeklyTask.priorityEvents[].reasoning` | Optional free text on a manual prioritize press. Absent when the note was skipped. Ritual and permanent presses do not store it. |
| Why an operation was missed | `OperationReview.blockedReasons` | Operation id → the same preset or `{ reason, note }`. The after-action sentences stay on `summary`, `whatWorked`, `whatFailed`, and `lessons`. |
| Regret token | `RegretEntry.reason` | The same preset, copied onto the regret ledger when a night records a block. The free-text note stays on the review. |
| Evening gratitude | `PeriodReview.gratitude` | A list of lines. |
| Morning gratitude | `PeriodReview.morning.gratitude` | Often ten lines. Distinct from the evening list. |
| Start-of-period gratitude | `PeriodReview.start.gratitude` | Week and longer planning. |
| Best day | `PeriodReview.morning.bestDayWhy` | Why a best day would be a best day. One prose field, not a list. |
| Day plan | `dayPlan-${YYYY-MM-DD}` | Append-only paragraphs for that day. |
| Week plan | `weekPlan-${monday_sunday}` | The Monday–Sunday range. An older ISO week key aliases onto it. |
| Month plan | `monthPlan-${YYYY-MM}` | The local month. An empty string on the key is a tombstone (“no plan”), not a blank paragraph. |
| Season plan | `quarterPlan-${YYYY-Qn}` | The same log, one quarter. Named here because it is the same record as the day, week, and month logs. |

Each plan entry is `{ id, createdAt, text, stampSuffix? }`. `text` is immutable after submit. `createdAt` is when it was written, which may be another day. `stampSuffix: "from text"` is a message (`plan for rn` and the morning ritual). Ordinary Submit omits it. The draft beside the entries is unsent writing. Module sync appends day lines of the form `• {item title} [{module title}]`; the link to the item is the sentence, not an id.

The same pictures also apply to the other stored prose in §3.5. A tool that is honest on gratitude is the same tool on a plan paragraph. Each corpus stays its own corpus.

---

## 2. Two kinds of reading, side by side

### Classical, already specified

Volume. Delay between the writing stamp and the day the words are about. Repeated phrases. Exact find, then a small calendar of hits. Lists in the order they were written. Preset tokens as a partition, with `n`.

Those pictures answer: what was written, when, and how often. They stay the first picture, because they do not guess.

### Further reading, intended and unbuilt

The same lines are also meant to be read with methods that interpret, group, and compare.

| Method | What it is for | How it has to appear |
|---|---|---|
| Sentiment, and later scored readings (valence, arousal, emotion lexicons) | A drift across mornings, across why-lines, or across the plans of a season. | Caption: a **guess about the prose**. Never written back onto a mood pen, a joy point, a completion score, or a claim that the plan was followed. |
| Machine learning on this vault's own lines | Token and phrase statistics, topic structure, classifiers, clusters. | A cluster is a grouping. The lines that made it stay visible. A label the model invented is marked as invented. |
| Large language models | Group, compare, summarize, or propose a theme across a corpus ("what the why-lines have been about this season," "what these week plans keep returning to"). | A dated reading. It does not replace `why`, a gratitude line, a blocked note, or a plan paragraph. Saving a sentence means the person kept it. |
| Vector embeddings | Search and comparison: neighbors of this line, lines that resemble this week, how a corpus moved from one period to the next. | Similarity, not a cause. An embedding is derived. It is not a canonical field until a later decision says so. |
| Whatever comes next in that family | Summarization, phrase linking, change in the vector space, and later tools that still leave the sentence intact. | The set is open. A method earns a place by answering a question the lines can support, and by staying labeled. |

A word count and an embedding neighbor answer different questions. Neither replaces the line. A person should be able to stand on the classical picture with the further reading closed.

Hosted models and on-device models are both in scope. Each reading names the method that produced it. The vault text is the input. The reading is not smuggled back in as if it had been typed.

---

## 3. The corpora

### 3.1 Why I want to do it

Unit: one `Task.why`, joined to that item's title, list, and whether the item was finished.

Questions worth a picture:

- The lines themselves, newest spelling kept when two wordings collapse under a light normalize (the same courtesy mood words already get).
- Which reasons recur, classically (repeated phrases) and by embedding neighborhood.
- Whether reasons cluster ("people," "money," "the body," "because I said I would") without those cluster names being stored as the reason.
- Sentiment of the why-line as a guess, beside the importance / resistance / excitement numbers when those exist. The numbers were asked. The sentiment was inferred. The card says which is which.
- Search: "lines like this why."

`consequences` can sit on the same card as the neighboring sentence. It is not pooled into the why corpus.

Empty `why` is empty. Do not infer a motive from the title.

### 3.2 Why I didn't

Two layers, and they must not be stirred into one soup.

**Tokens.** `no-energy`, `missing-input`, `procrastination`, `no-time`, `blocked-by-other`, `other`. This is a partition the person chose. The classical picture is the mosaic: counts, by period, by task. The regret ledger repeats the token; it does not add a second explanation.

**Notes.** The words typed under Other, and any later free-text reason for an action not taken. This is the language corpus. It gets the cloud, the sentiment guess, the clusters, the embedding search, and the model reading.

A cloud of notes must not swallow the six tokens. A bar of tokens must not pretend a one-word preset is a paragraph. "Other" with no note is a count, not a sentence.

Questions worth a picture:

- Token mosaic over the period, with `n`, and the share that is Other-with-words versus Other-blank.
- The notes, in the order of the nights they were written, each still tied to the task title.
- Neighbors: notes that resemble this note, across weeks.
- A labeled guess about the tone of the notes, never as a substitute for the token the person picked.

### 3.3 Gratitude

Unit: one line in a list. Morning, evening, and start-of-period stay distinguishable. Pooling them is a toggle, not the default. Ten short morning lines and one evening paragraph are not the same gesture.

**A word cloud is one of the pictures**, and it is wanted. Size follows count, after the light normalize above. Two clouds: one with everyday function words set aside, and one that keeps them, so "the" and "I" are available and are not the accidental finding.

Beside the cloud, on the same corpus:

- The lines, in the order written, with the period key.
- Repeated phrases, longer than one word.
- A calendar of days and longer periods that have a list, and the length of each list.
- Morning beside evening when both exist for the same day.
- Sentiment across periods, labeled as a guess about the lines.
- An embedding map: neighbors, clusters, and a comparison of one span of lists to another ("this month's lines sit near that month's").
- A model theme for a span the person asks about, dated, and dismissible.

The cloud is a way in. The line is what was written.

### 3.4 Day, week, and month plan text

Unit: one submitted entry’s `text`, joined to its period key, its `createdAt`, and its `stampSuffix` when present. Day, week, month, and season stay distinguishable. Pooling a day plan into the week plan that contains it is a toggle, not the default. They are different documents that share a calendar.

The classical picture is the one [Plan §1.4](03-plan.md) and [Plan §6](03-plan.md) already name, and it stays first:

- How many times the period was rewritten (entry count). A later entry does not record that it replaces an earlier one. Both remain.
- Lead: `createdAt` against the start of the period the words are about.
- Desk submits versus `from text`.
- A draft sitting unsent, shown as a draft. It is not mixed into the submitted log.
- Module lines (`• title [module]`) as their own mark. They are machine-appended titles. They do not enter the cloud of what the person wrote. They can have their own count, and their own small cloud, labeled as module lines.
- Volume of the person’s paragraphs.

The further reading is the same family as gratitude, on the person’s submitted paragraphs:

- The paragraphs, in append order, newest spelling when two wordings collapse under the light normalize.
- **A word cloud is one of the pictures**, with the same pair: function words set aside, and function words kept. A plan entry is often a paragraph, so the cloud is a way in. The entry stays on the card.
- Repeated phrases, longer than one word.
- A calendar of days, weeks, and months that have a log, and how long each log is.
- Sentiment across periods of one grain, labeled as a guess about the writing. It is not adherence, and it is not how the period felt.
- An embedding map within one grain: this week’s plan near that week’s, this October near last October. Neighbors are other plan entries, not gratitude lines and not why-lines, unless the person asks for a cross-corpus comparison and the card says so.
- A model theme for a span the person asks about (“what these month plans keep returning to”), dated, and dismissible. It does not become a new plan entry.

A day plan may sit beside the week plan and the month plan that cover that day, as three texts. That side-by-side is a comparison of documents. It does not extract tasks, times, or places out of the sentences and onto the calendar. Inbox dates parsed at capture are already a different path. The plan log itself has no items inside the paragraph.

Empty log is empty. A month-key tombstone is “no plan,” not a paragraph to score. Do not infer a theme from the scheduled task titles.

`PeriodReview.planReflection` and `nextPlans` use the same period keys and are not this log. They are their own corpora in §3.5. Laying a reflection beside the plan is a comparison of two texts. It is not a score of whether the prose was followed. The log cannot answer that, and a model does not get to answer it by guessing.

### 3.5 The other stored prose

The same two layers — classical counts first, further reading beside them — apply to every other natural-language field the vault already keeps. Each field is its own corpus. A cloud, a sentiment guess, a cluster, an embedding neighbor, and a dismissible theme are available on each. They are not stirred into one score for the day.

| Corpus | Where it lives | Unit |
|---|---|---|
| Day notes | `brain2-tracking-day-notes` | One append entry’s `text`, with `createdAt` against the day key (the delay is the classical picture). |
| Thought process | Activity instant, `eventKind: "thought-process"` | The title and the note, in clock order. A cloud is not the first picture (§4). |
| Review summary | `PeriodReview.summary` | One paragraph for that period. |
| Plan reflection | `PeriodReview.planReflection` | One paragraph. Not the plan log. |
| Next plans | `PeriodReview.nextPlans`, and `start.nextPlans` | What the ritual said would come next. Not the plan log. |
| Went well / improve / learned | `PeriodReview.reflections` | One answer per question id. The three questions stay separate. |
| Longer arc | `PeriodReview.arc` | One answer per question (wins, lessons, obstacles, joy, fear, and the rest). Each question is its own small corpus. Photos on `inspiredPhotos` are not text. |
| Morning intentions | `morning.intentions` | A list of lines. Same list pictures as gratitude, including a cloud. The week-and-longer intention is `start.summary`, one paragraph, kept separate. |
| Affirmations | `morning.affirmations` | The lines shown and kept. Distinct from intentions. |
| Must not / excited | `morning.mustNotDo`, `morning.excitedAbout` | One field each. |
| Wake reminder, what matters, time note | `wakeReminder`, `tomorrowMatters`, `timeReflection` | One short field each. |
| Start priorities and must-do | `start.priorities`, `start.mustDo`, `start.undoneNotes` | Planning prose for the coming period. Not the plan log. |
| Habit prioritize-why | `WeeklyTask.priorityEvents[].reasoning` | Optional why on a manual prioritize press. One line per press that has text. Ritual and permanent presses are events with no sentence. |

A neighbor search defaults to the same field: other month-plan entries, other “went well” answers, other day notes. Crossing fields is an explicit comparison, captioned with both names.

**Habit prioritize-why.** Unit: one `priorityEvents` row that has `reasoning`, joined to the habit, the press instant (`at`), the local day (`dayKey`), and `kind` (`set` or `refreshed`). Presses with no reasoning are not sentences. Do not invent a why from the habit name, the star, or the `priorityLog` line.

The classical picture is first: the dated lines, oldest first, each still tied to that press and that habit. Empty reasoning is empty.

The further reading is unbuilt. Intention, not shipped: these why lines are meant later as a language corpus for natural-language processing and machine-learning experiments, and for knowledge-graph traversals that join prioritize events to habits and outcomes. No model or graph reading ships with this change. Grades and priority weight do not read the prose.

---

## 4. Constraints carried over from the other files

These are not cancelled by the intention to use stronger tools.

- **Thought process stays in time order.** A `thought-process` instant is a strand through a minute (what you are doing, what you expect next, how it lands). Its first picture is the list in clock order, as [Tracking §7.7](01-tracking.md) already says. A cloud erases that order, so it is not the first picture. Sentiment and neighbors may sit beside the list, labeled. See also the day-note volume and the delay between writing stamp and day key.
- **Plan prose is not a hidden schedule.** The reading in §3.4 is about the writing. A sentiment score is a guess about that writing. It is not adherence, and it is not a state of the day. [Plan §6](03-plan.md). Do not pull tasks, clocks, or places out of a paragraph and onto the calendar.
- **Day-plan text is not a second tracking dataset.** Do not turn a sentence into an Activity pen, a location, or a mood. [Now §5.5](04-now.md). The morning ritual’s `dayPlanText` is the paragraph that was appended to `dayPlan-*`, not a second corpus.
- **Joins that cross an unidentified channel stay refused.** A night-review gratitude list is not stamped with a source. A chart that claims to be about Telegram does not cross it with the next day's habits. The cloud can still exist on the gratitude itself. The cross-channel join waits, as [Telegram](05-telegram.md) already says.
- **Show `n`.** A theme built on three lines says three. A sentiment mean with half the lines missing a score says how many were scored.
- **Spelling.** "Quiet stacks" and "quiet stacks " group. Show the newest spelling. Do not silently rewrite the stored line.
- **No forecast from a thin corpus.** The same humility as the tracking defaults: do not caption a trend the sample cannot hold.

---

## 5. What this intention refuses

A clever reading that the person cannot trace back to the lines.

An embedding distance sold as a cause.

A model paragraph stored as if it were gratitude, a why, a reason for skipping, or a plan entry.

A word cloud as the only view of a list or a plan log, or as the view of a strand that has a clock.

A single "language score" for a day, mixed from why-lines, skip notes, gratitude, and the plan. Those are different questions. They can be compared. They are not one number.
